-- Blinko OS - ciclo comercial externo e execução inicial V1
-- Depende de 003 a 007.
-- Registra fatos que aconteceram fora do OS. Não envia proposta, mensagem ou aceite em nome do cliente.

create table if not exists public.proposal_external_events (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  event_type text not null check (event_type in ('sent','negotiation','accepted','refused','expired')),
  channel text,
  external_reference text,
  notes text,
  occurred_at timestamptz not null,
  recorded_by_label text,
  created_at timestamptz not null default now()
);

create index if not exists proposal_external_events_idx on public.proposal_external_events (proposal_id, occurred_at desc);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  proposal_id uuid not null unique references public.proposals(id) on delete restrict,
  objective text not null,
  start_date date not null,
  target_timeframe text not null,
  priority_ids jsonb not null default '[]'::jsonb,
  intervention_ids jsonb not null default '[]'::jsonb,
  indicators jsonb not null default '[]'::jsonb,
  team jsonb not null default '[]'::jsonb,
  status text not null default 'onboarding'
    check (status in ('onboarding','active','waiting_client','at_risk','paused','completed','closed')),
  next_review_at timestamptz,
  contract_reference text not null,
  created_by_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_company_idx on public.projects (company_id, created_at desc);
create index if not exists projects_status_idx on public.projects (status, created_at desc);

create table if not exists public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  intervention_id uuid references public.diagnostic_interventions(id) on delete set null,
  title text not null,
  responsible_label text,
  due_at timestamptz,
  dependencies jsonb not null default '[]'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','in_progress','waiting_client','done','cancelled')),
  priority text not null default 'normal'
    check (priority in ('low','normal','high','critical')),
  estimate text,
  completion_evidence text,
  approval_required boolean not null default false,
  created_by_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_tasks_idx on public.project_tasks (project_id, status, due_at);

create or replace function public.record_proposal_external_event(
  p_proposal_id uuid,
  p_actor_label text,
  p_event_type text,
  p_channel text,
  p_external_reference text,
  p_notes text,
  p_occurred_at timestamptz
)
returns uuid
language plpgsql
set search_path = public
as $record_proposal_external_event$
declare
  v_current_status text;
  v_event_id uuid;
  v_diagnostic_id uuid;
  v_pre_diagnostic_id uuid;
  v_lead_id uuid;
begin
  select p.status, p.diagnostic_id, d.pre_diagnostic_id, d.lead_id
    into v_current_status, v_diagnostic_id, v_pre_diagnostic_id, v_lead_id
  from public.proposals p
  join public.diagnostics d on d.id = p.diagnostic_id
  where p.id = p_proposal_id;

  if v_current_status is null then raise exception 'proposal not found'; end if;
  if p_event_type not in ('sent','negotiation','accepted','refused','expired') then raise exception 'invalid proposal external event'; end if;

  if p_event_type = 'sent' and v_current_status <> 'approved_internal' then raise exception 'proposal must be approved internally before sent record'; end if;
  if p_event_type = 'negotiation' and v_current_status not in ('sent','negotiation') then raise exception 'negotiation requires sent proposal'; end if;
  if p_event_type = 'accepted' and v_current_status not in ('sent','negotiation') then raise exception 'acceptance requires sent proposal'; end if;
  if p_event_type = 'refused' and v_current_status not in ('sent','negotiation') then raise exception 'refusal requires sent proposal'; end if;
  if p_event_type = 'expired' and v_current_status not in ('approved_internal','sent','negotiation') then raise exception 'proposal cannot expire from current status'; end if;

  if nullif(trim(coalesce(p_external_reference,'')), '') is null then
    raise exception 'external reference is required';
  end if;

  insert into public.proposal_external_events (
    proposal_id, event_type, channel, external_reference, notes, occurred_at, recorded_by_label
  ) values (
    p_proposal_id, p_event_type, nullif(trim(coalesce(p_channel,'')), ''),
    trim(p_external_reference), nullif(trim(coalesce(p_notes,'')), ''),
    coalesce(p_occurred_at, now()), nullif(trim(coalesce(p_actor_label,'')), '')
  ) returning id into v_event_id;

  update public.proposals set status = p_event_type, updated_at = now() where id = p_proposal_id;

  if p_event_type = 'sent' then
    update public.crm_actions set status = 'done', completed_at = now()
    where pre_diagnostic_id = v_pre_diagnostic_id
      and action_type = 'proposal_external_decision'
      and status in ('pending','in_progress');
  end if;

  if p_event_type = 'accepted' and not exists (
    select 1 from public.crm_actions
    where pre_diagnostic_id = v_pre_diagnostic_id
      and action_type = 'execution_contract_confirmation'
      and status in ('pending','in_progress')
  ) then
    insert into public.crm_actions (
      lead_id, pre_diagnostic_id, action_type, status, priority, title, payload
    ) values (
      v_lead_id, v_pre_diagnostic_id, 'execution_contract_confirmation', 'pending', 'high',
      'Confirmar contratação da execução antes de criar o projeto',
      jsonb_build_object('proposal_id', p_proposal_id, 'diagnostic_id', v_diagnostic_id, 'created_by', p_actor_label, 'source', 'blinko_os_internal')
    );
  end if;

  insert into public.audit_events (entity_type, entity_id, event_type, actor_type, actor_id, payload)
  values (
    'proposal', p_proposal_id, 'proposal_external_' || p_event_type, 'human',
    coalesce(nullif(trim(coalesce(p_actor_label,'')), ''), 'unknown'),
    jsonb_build_object('external_event_id', v_event_id, 'previous_status', v_current_status, 'external_reference', trim(p_external_reference), 'channel', nullif(trim(coalesce(p_channel,'')), ''))
  );

  return v_event_id;
end;
$record_proposal_external_event$;

create or replace function public.create_project_from_accepted_proposal(
  p_proposal_id uuid,
  p_actor_label text,
  p_objective text,
  p_start_date date,
  p_target_timeframe text,
  p_contract_reference text,
  p_next_review_at timestamptz default null
)
returns uuid
language plpgsql
set search_path = public
as $create_project_from_proposal$
declare
  v_company_id uuid;
  v_diagnostic_id uuid;
  v_pre_diagnostic_id uuid;
  v_lead_id uuid;
  v_current_version_id uuid;
  v_priority_ids jsonb;
  v_intervention_ids jsonb;
  v_project_id uuid;
begin
  select p.company_id, p.diagnostic_id, p.current_version_id, d.pre_diagnostic_id, d.lead_id
  into v_company_id, v_diagnostic_id, v_current_version_id, v_pre_diagnostic_id, v_lead_id
  from public.proposals p
  join public.diagnostics d on d.id = p.diagnostic_id
  where p.id = p_proposal_id and p.status = 'accepted';

  if v_company_id is null or v_current_version_id is null then raise exception 'accepted proposal with current version is required'; end if;
  if nullif(trim(coalesce(p_objective,'')), '') is null
     or p_start_date is null
     or nullif(trim(coalesce(p_target_timeframe,'')), '') is null
     or nullif(trim(coalesce(p_contract_reference,'')), '') is null then
    raise exception 'project contract confirmation is incomplete';
  end if;

  select priority_ids, intervention_ids into v_priority_ids, v_intervention_ids
  from public.proposal_versions where id = v_current_version_id;

  insert into public.projects (
    company_id, proposal_id, objective, start_date, target_timeframe,
    priority_ids, intervention_ids, status, next_review_at, contract_reference, created_by_label
  ) values (
    v_company_id, p_proposal_id, trim(p_objective), p_start_date, trim(p_target_timeframe),
    coalesce(v_priority_ids,'[]'::jsonb), coalesce(v_intervention_ids,'[]'::jsonb),
    'onboarding', p_next_review_at, trim(p_contract_reference), nullif(trim(coalesce(p_actor_label,'')), '')
  )
  on conflict (proposal_id) do update
    set objective = excluded.objective,
        start_date = excluded.start_date,
        target_timeframe = excluded.target_timeframe,
        next_review_at = excluded.next_review_at,
        contract_reference = excluded.contract_reference,
        updated_at = now()
  returning id into v_project_id;

  update public.leads set status = 'converted', updated_at = now() where id = v_lead_id;
  update public.diagnostics set status = 'completed', updated_at = now() where id = v_diagnostic_id and status = 'presented';

  update public.crm_actions set status = 'done', completed_at = now()
  where pre_diagnostic_id = v_pre_diagnostic_id
    and action_type = 'execution_contract_confirmation'
    and status in ('pending','in_progress');

  if not exists (
    select 1 from public.crm_actions
    where pre_diagnostic_id = v_pre_diagnostic_id
      and action_type = 'project_onboarding'
      and status in ('pending','in_progress')
  ) then
    insert into public.crm_actions (
      lead_id, pre_diagnostic_id, action_type, status, priority, title, payload
    ) values (
      v_lead_id, v_pre_diagnostic_id, 'project_onboarding', 'pending', 'high',
      'Iniciar onboarding da execução contratada',
      jsonb_build_object('project_id', v_project_id, 'proposal_id', p_proposal_id, 'created_by', p_actor_label, 'source', 'blinko_os_internal')
    );
  end if;

  insert into public.audit_events (entity_type, entity_id, event_type, actor_type, actor_id, payload)
  values (
    'project', v_project_id, 'project_created_from_accepted_proposal', 'human',
    coalesce(nullif(trim(coalesce(p_actor_label,'')), ''), 'unknown'),
    jsonb_build_object('proposal_id', p_proposal_id, 'diagnostic_id', v_diagnostic_id, 'contract_reference', trim(p_contract_reference), 'status', 'onboarding')
  );

  return v_project_id;
end;
$create_project_from_proposal$;

create or replace function public.record_project_task(
  p_project_id uuid,
  p_actor_label text,
  p_intervention_id uuid,
  p_title text,
  p_responsible_label text,
  p_due_at timestamptz,
  p_dependencies jsonb,
  p_priority text,
  p_estimate text,
  p_approval_required boolean
)
returns uuid
language plpgsql
set search_path = public
as $record_project_task$
declare
  v_task_id uuid;
  v_intervention_ids jsonb;
begin
  select intervention_ids into v_intervention_ids
  from public.projects where id = p_project_id and status in ('onboarding','active','waiting_client','at_risk');

  if v_intervention_ids is null then raise exception 'active project not found'; end if;
  if nullif(trim(coalesce(p_title,'')), '') is null then raise exception 'task title is required'; end if;
  if p_priority not in ('low','normal','high','critical') then raise exception 'invalid task priority'; end if;

  if p_intervention_id is not null and not exists (
    select 1 from jsonb_array_elements_text(v_intervention_ids) j(value)
    where j.value::uuid = p_intervention_id
  ) then
    raise exception 'task intervention does not belong to project';
  end if;

  insert into public.project_tasks (
    project_id, intervention_id, title, responsible_label, due_at, dependencies,
    priority, estimate, approval_required, created_by_label
  ) values (
    p_project_id, p_intervention_id, trim(p_title), nullif(trim(coalesce(p_responsible_label,'')), ''),
    p_due_at, coalesce(p_dependencies,'[]'::jsonb), p_priority,
    nullif(trim(coalesce(p_estimate,'')), ''), coalesce(p_approval_required,false),
    nullif(trim(coalesce(p_actor_label,'')), '')
  ) returning id into v_task_id;

  insert into public.audit_events (entity_type, entity_id, event_type, actor_type, actor_id, payload)
  values (
    'project_task', v_task_id, 'project_task_created', 'human',
    coalesce(nullif(trim(coalesce(p_actor_label,'')), ''), 'unknown'),
    jsonb_build_object('project_id', p_project_id, 'intervention_id', p_intervention_id)
  );

  return v_task_id;
end;
$record_project_task$;

create or replace function public.activate_project(
  p_project_id uuid,
  p_actor_label text
)
returns uuid
language plpgsql
set search_path = public
as $activate_project$
declare
  v_proposal_id uuid;
  v_diagnostic_id uuid;
  v_pre_diagnostic_id uuid;
begin
  select pr.proposal_id, p.diagnostic_id, d.pre_diagnostic_id
  into v_proposal_id, v_diagnostic_id, v_pre_diagnostic_id
  from public.projects pr
  join public.proposals p on p.id = pr.proposal_id
  join public.diagnostics d on d.id = p.diagnostic_id
  where pr.id = p_project_id and pr.status = 'onboarding';

  if v_proposal_id is null then raise exception 'project is not in onboarding'; end if;
  if not exists (select 1 from public.project_tasks t where t.project_id = p_project_id and t.status <> 'cancelled') then
    raise exception 'project requires at least one initial task';
  end if;

  update public.projects set status = 'active', updated_at = now() where id = p_project_id;

  update public.crm_actions set status = 'done', completed_at = now()
  where pre_diagnostic_id = v_pre_diagnostic_id
    and action_type = 'project_onboarding'
    and status in ('pending','in_progress');

  insert into public.audit_events (entity_type, entity_id, event_type, actor_type, actor_id, payload)
  values (
    'project', p_project_id, 'project_activated', 'human',
    coalesce(nullif(trim(coalesce(p_actor_label,'')), ''), 'unknown'),
    jsonb_build_object('proposal_id', v_proposal_id, 'diagnostic_id', v_diagnostic_id, 'new_status', 'active')
  );

  return p_project_id;
end;
$activate_project$;
