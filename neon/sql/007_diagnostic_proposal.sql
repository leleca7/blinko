-- Blinko OS - Diagnóstico Blinko - Apresentação e proposta V1
-- Depende de 003 a 006.
-- Investimento, condições, validade e compromissos externos são preenchidos e aprovados por humanos.
-- Nenhuma função desta migração envia proposta ou mensagem ao cliente.

alter table public.diagnostics add column if not exists presentation_at timestamptz;
alter table public.diagnostics add column if not exists presentation_by_label text;
alter table public.diagnostics add column if not exists presentation_notes text;

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  diagnostic_id uuid not null unique references public.diagnostics(id) on delete restrict,
  company_id uuid not null references public.companies(id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft','internal_review','approved_internal','sent','negotiation','accepted','refused','expired')),
  approved_by_label text,
  approved_at timestamptz,
  created_by_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.proposal_versions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  version_number integer not null,
  diagnostic_id uuid not null references public.diagnostics(id) on delete restrict,
  problem_ids jsonb not null default '[]'::jsonb,
  priority_ids jsonb not null default '[]'::jsonb,
  intervention_ids jsonb not null default '[]'::jsonb,
  execution_order jsonb not null default '[]'::jsonb,
  scope text not null default '',
  blinko_responsibilities text not null default '',
  client_responsibilities text not null default '',
  timeframe text not null default '',
  investment text not null default '',
  conditions text not null default '',
  validity text not null default '',
  risks_limits text not null default '',
  created_by_label text,
  created_at timestamptz not null default now(),
  unique (proposal_id, version_number)
);

create index if not exists proposal_versions_idx on public.proposal_versions (proposal_id, version_number desc);

alter table public.proposals add column if not exists current_version_id uuid;
alter table public.proposals drop constraint if exists proposals_current_version_id_fkey;
alter table public.proposals
  add constraint proposals_current_version_id_fkey
  foreign key (current_version_id) references public.proposal_versions(id) on delete set null;

create or replace function public.record_diagnostic_presentation(
  p_diagnostic_id uuid,
  p_actor_label text,
  p_presented_at timestamptz,
  p_notes text default null
)
returns uuid
language plpgsql
set search_path = public
as $record_diagnostic_presentation$
declare
  v_pre_diagnostic_id uuid;
  v_lead_id uuid;
begin
  select pre_diagnostic_id, lead_id into v_pre_diagnostic_id, v_lead_id
  from public.diagnostics
  where id = p_diagnostic_id and status = 'ready_for_presentation';

  if v_lead_id is null then raise exception 'diagnostic is not ready for presentation'; end if;

  update public.diagnostics
     set status = 'presented',
         presentation_at = coalesce(p_presented_at, now()),
         presentation_by_label = nullif(trim(coalesce(p_actor_label,'')), ''),
         presentation_notes = nullif(trim(coalesce(p_notes,'')), ''),
         updated_at = now()
   where id = p_diagnostic_id;

  update public.crm_actions set status = 'done', completed_at = now()
  where pre_diagnostic_id = v_pre_diagnostic_id
    and action_type = 'diagnostic_prepare_presentation'
    and status in ('pending','in_progress');

  if not exists (
    select 1 from public.crm_actions
    where pre_diagnostic_id = v_pre_diagnostic_id
      and action_type = 'diagnostic_prepare_proposal'
      and status in ('pending','in_progress')
  ) then
    insert into public.crm_actions (
      lead_id, pre_diagnostic_id, action_type, status, priority, title, payload
    ) values (
      v_lead_id, v_pre_diagnostic_id, 'diagnostic_prepare_proposal', 'pending', 'high',
      'Preparar proposta com base nas intervenções selecionadas',
      jsonb_build_object('diagnostic_id', p_diagnostic_id, 'created_by', p_actor_label, 'source', 'blinko_os_internal')
    );
  end if;

  insert into public.audit_events (entity_type, entity_id, event_type, actor_type, actor_id, payload)
  values (
    'diagnostic', p_diagnostic_id, 'diagnostic_presented', 'human',
    coalesce(nullif(trim(coalesce(p_actor_label,'')), ''), 'unknown'),
    jsonb_build_object('presented_at', coalesce(p_presented_at, now()), 'notes', nullif(trim(coalesce(p_notes,'')), ''))
  );

  return p_diagnostic_id;
end;
$record_diagnostic_presentation$;

create or replace function public.record_proposal_version(
  p_diagnostic_id uuid,
  p_actor_label text,
  p_intervention_ids jsonb,
  p_scope text,
  p_blinko_responsibilities text,
  p_client_responsibilities text,
  p_timeframe text,
  p_investment text,
  p_conditions text,
  p_validity text,
  p_risks_limits text
)
returns uuid
language plpgsql
set search_path = public
as $record_proposal_version$
declare
  v_company_id uuid;
  v_proposal_id uuid;
  v_proposal_status text;
  v_version_id uuid;
  v_next_version integer;
  v_requested_count integer;
  v_valid_count integer;
  v_problem_ids jsonb;
  v_priority_ids jsonb;
  v_execution_order jsonb;
begin
  select company_id into v_company_id
  from public.diagnostics
  where id = p_diagnostic_id and status = 'presented';

  if v_company_id is null then raise exception 'diagnostic is not presented'; end if;
  if jsonb_typeof(coalesce(p_intervention_ids,'[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_intervention_ids,'[]'::jsonb)) = 0 then
    raise exception 'proposal requires at least one intervention';
  end if;

  v_requested_count := jsonb_array_length(p_intervention_ids);

  select count(distinct i.id) into v_valid_count
  from public.diagnostic_interventions i
  where i.diagnostic_id = p_diagnostic_id
    and i.status in ('selected','approved_for_proposal')
    and i.id in (select value::uuid from jsonb_array_elements_text(p_intervention_ids));

  if v_valid_count <> v_requested_count then raise exception 'proposal contains invalid intervention'; end if;

  select
    coalesce(jsonb_agg(distinct i.problem_id) filter (where i.problem_id is not null), '[]'::jsonb),
    coalesce(jsonb_agg(distinct i.priority_id) filter (where i.priority_id is not null), '[]'::jsonb)
  into v_problem_ids, v_priority_ids
  from public.diagnostic_interventions i
  where i.id in (select value::uuid from jsonb_array_elements_text(p_intervention_ids));

  select coalesce(jsonb_agg(jsonb_build_object(
    'priority_id', pr.id,
    'position', pr.sequence_position,
    'intervention_id', i.id,
    'intervention_title', i.title
  ) order by pr.sequence_position asc, i.created_at asc), '[]'::jsonb)
  into v_execution_order
  from public.diagnostic_interventions i
  join public.diagnostic_priorities pr on pr.id = i.priority_id
  where i.id in (select value::uuid from jsonb_array_elements_text(p_intervention_ids));

  select id, status into v_proposal_id, v_proposal_status
  from public.proposals where diagnostic_id = p_diagnostic_id limit 1;

  if v_proposal_id is null then
    insert into public.proposals (diagnostic_id, company_id, status, created_by_label)
    values (p_diagnostic_id, v_company_id, 'draft', nullif(trim(coalesce(p_actor_label,'')), ''))
    returning id into v_proposal_id;
  elsif v_proposal_status in ('sent','negotiation','accepted','refused','expired') then
    raise exception 'proposal can no longer be edited internally';
  else
    update public.proposals set status = 'draft', approved_by_label = null, approved_at = null, updated_at = now()
    where id = v_proposal_id;
  end if;

  select coalesce(max(version_number),0) + 1 into v_next_version
  from public.proposal_versions where proposal_id = v_proposal_id;

  insert into public.proposal_versions (
    proposal_id, version_number, diagnostic_id, problem_ids, priority_ids, intervention_ids,
    execution_order, scope, blinko_responsibilities, client_responsibilities, timeframe,
    investment, conditions, validity, risks_limits, created_by_label
  ) values (
    v_proposal_id, v_next_version, p_diagnostic_id, v_problem_ids, v_priority_ids, p_intervention_ids,
    v_execution_order, coalesce(p_scope,''), coalesce(p_blinko_responsibilities,''),
    coalesce(p_client_responsibilities,''), coalesce(p_timeframe,''), coalesce(p_investment,''),
    coalesce(p_conditions,''), coalesce(p_validity,''), coalesce(p_risks_limits,''),
    nullif(trim(coalesce(p_actor_label,'')), '')
  ) returning id into v_version_id;

  update public.proposals set current_version_id = v_version_id, updated_at = now()
  where id = v_proposal_id;

  insert into public.audit_events (entity_type, entity_id, event_type, actor_type, actor_id, payload)
  values (
    'proposal', v_proposal_id, 'proposal_version_recorded', 'human',
    coalesce(nullif(trim(coalesce(p_actor_label,'')), ''), 'unknown'),
    jsonb_build_object('proposal_version_id', v_version_id, 'version_number', v_next_version, 'diagnostic_id', p_diagnostic_id)
  );

  return v_proposal_id;
end;
$record_proposal_version$;

create or replace function public.submit_proposal_internal_review(
  p_proposal_id uuid,
  p_actor_label text
)
returns uuid
language plpgsql
set search_path = public
as $submit_proposal_review$
declare
  v_version public.proposal_versions%rowtype;
begin
  select pv.* into v_version
  from public.proposals p
  join public.proposal_versions pv on pv.id = p.current_version_id
  where p.id = p_proposal_id and p.status = 'draft';

  if v_version.id is null then raise exception 'proposal draft with current version is required'; end if;
  if nullif(trim(v_version.scope),'') is null
     or nullif(trim(v_version.blinko_responsibilities),'') is null
     or nullif(trim(v_version.client_responsibilities),'') is null
     or nullif(trim(v_version.timeframe),'') is null
     or nullif(trim(v_version.investment),'') is null
     or nullif(trim(v_version.conditions),'') is null
     or nullif(trim(v_version.validity),'') is null
     or jsonb_array_length(v_version.intervention_ids) = 0 then
    raise exception 'proposal is incomplete for internal review';
  end if;

  update public.proposals set status = 'internal_review', updated_at = now() where id = p_proposal_id;

  insert into public.audit_events (entity_type, entity_id, event_type, actor_type, actor_id, payload)
  values ('proposal', p_proposal_id, 'proposal_submitted_internal_review', 'human', coalesce(nullif(trim(coalesce(p_actor_label,'')), ''), 'unknown'), jsonb_build_object('version_id', v_version.id));

  return p_proposal_id;
end;
$submit_proposal_review$;

create or replace function public.approve_proposal_internally(
  p_proposal_id uuid,
  p_actor_label text
)
returns uuid
language plpgsql
set search_path = public
as $approve_proposal_internally$
declare
  v_diagnostic_id uuid;
  v_pre_diagnostic_id uuid;
  v_lead_id uuid;
begin
  select p.diagnostic_id, d.pre_diagnostic_id, d.lead_id
  into v_diagnostic_id, v_pre_diagnostic_id, v_lead_id
  from public.proposals p
  join public.diagnostics d on d.id = p.diagnostic_id
  where p.id = p_proposal_id and p.status = 'internal_review' and p.current_version_id is not null;

  if v_diagnostic_id is null then raise exception 'proposal is not in internal review'; end if;

  update public.proposals
     set status = 'approved_internal', approved_by_label = nullif(trim(coalesce(p_actor_label,'')), ''), approved_at = now(), updated_at = now()
   where id = p_proposal_id;

  update public.crm_actions set status = 'done', completed_at = now()
  where pre_diagnostic_id = v_pre_diagnostic_id
    and action_type = 'diagnostic_prepare_proposal'
    and status in ('pending','in_progress');

  if not exists (
    select 1 from public.crm_actions
    where pre_diagnostic_id = v_pre_diagnostic_id
      and action_type = 'proposal_external_decision'
      and status in ('pending','in_progress')
  ) then
    insert into public.crm_actions (
      lead_id, pre_diagnostic_id, action_type, status, priority, title, payload
    ) values (
      v_lead_id, v_pre_diagnostic_id, 'proposal_external_decision', 'pending', 'high',
      'Decidir envio externo da proposta aprovada',
      jsonb_build_object('diagnostic_id', v_diagnostic_id, 'proposal_id', p_proposal_id, 'created_by', p_actor_label, 'source', 'blinko_os_internal')
    );
  end if;

  insert into public.audit_events (entity_type, entity_id, event_type, actor_type, actor_id, payload)
  values ('proposal', p_proposal_id, 'proposal_approved_internally', 'human', coalesce(nullif(trim(coalesce(p_actor_label,'')), ''), 'unknown'), jsonb_build_object('diagnostic_id', v_diagnostic_id, 'external_send_enabled', false));

  return p_proposal_id;
end;
$approve_proposal_internally$;
