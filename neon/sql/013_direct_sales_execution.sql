-- Blinko OS — Venda direta -> execução — V1
-- Conecta oportunidades diretas pagas ao mesmo motor de projetos/tarefas já usado
-- pelas propostas originadas no Diagnóstico Blinko.
-- Mantém confirmação humana antes da ativação do projeto.

alter table public.projects
  alter column proposal_id drop not null;

alter table public.projects
  add column if not exists direct_opportunity_id uuid
  references public.direct_opportunities(id) on delete restrict;

create unique index if not exists projects_direct_opportunity_uidx
  on public.projects (direct_opportunity_id)
  where direct_opportunity_id is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'projects_exactly_one_origin_ck'
      and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects
      add constraint projects_exactly_one_origin_ck
      check (num_nonnulls(proposal_id, direct_opportunity_id) = 1)
      not valid;
  end if;
end $$;

alter table public.projects
  validate constraint projects_exactly_one_origin_ck;

create or replace function public.create_project_from_paid_direct_opportunity(
  p_opportunity_id uuid,
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
as $create_project_from_paid_direct_opportunity$
declare
  v_opportunity public.direct_opportunities%rowtype;
  v_lead public.leads%rowtype;
  v_company_id uuid;
  v_project_id uuid;
  v_task_id uuid;
  v_task_title text;
begin
  select * into v_opportunity
  from public.direct_opportunities
  where id = p_opportunity_id
    and status = 'paid';

  if v_opportunity.id is null then
    raise exception 'paid direct opportunity is required';
  end if;

  if v_opportunity.current_quote_version_id is null then
    raise exception 'direct opportunity requires a current quote version';
  end if;

  if nullif(trim(coalesce(p_objective,'')), '') is null
     or p_start_date is null
     or nullif(trim(coalesce(p_target_timeframe,'')), '') is null
     or nullif(trim(coalesce(p_contract_reference,'')), '') is null then
    raise exception 'project contract confirmation is incomplete';
  end if;

  select * into v_lead
  from public.leads
  where id = v_opportunity.lead_id;

  if v_lead.id is null then
    raise exception 'lead not found';
  end if;

  v_company_id := v_opportunity.company_id;

  if v_company_id is null then
    insert into public.companies (
      source_lead_id, name, segment, city_state, website, social_url,
      objective, relationship_status, responsible_label
    ) values (
      v_lead.id,
      v_lead.company_name,
      v_lead.segment,
      v_lead.city_state,
      v_lead.website,
      v_lead.social_url,
      v_lead.objective,
      'active',
      nullif(trim(coalesce(p_actor_label,'')), '')
    )
    on conflict (source_lead_id) do update
      set name = excluded.name,
          segment = excluded.segment,
          city_state = excluded.city_state,
          website = excluded.website,
          social_url = excluded.social_url,
          objective = excluded.objective,
          responsible_label = coalesce(excluded.responsible_label, public.companies.responsible_label),
          updated_at = now()
    returning id into v_company_id;

    update public.direct_opportunities
       set company_id = v_company_id,
           updated_at = now()
     where id = p_opportunity_id;
  end if;

  insert into public.projects (
    company_id,
    proposal_id,
    direct_opportunity_id,
    objective,
    start_date,
    target_timeframe,
    priority_ids,
    intervention_ids,
    indicators,
    team,
    status,
    next_review_at,
    contract_reference,
    created_by_label
  ) values (
    v_company_id,
    null,
    p_opportunity_id,
    trim(p_objective),
    p_start_date,
    trim(p_target_timeframe),
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    'onboarding',
    p_next_review_at,
    trim(p_contract_reference),
    nullif(trim(coalesce(p_actor_label,'')), '')
  )
  on conflict (direct_opportunity_id) where direct_opportunity_id is not null
  do update set
    objective = excluded.objective,
    start_date = excluded.start_date,
    target_timeframe = excluded.target_timeframe,
    next_review_at = excluded.next_review_at,
    contract_reference = excluded.contract_reference,
    updated_at = now()
  returning id into v_project_id;

  update public.direct_opportunities
     set status = 'won',
         company_id = v_company_id,
         updated_at = now()
   where id = p_opportunity_id;

  update public.leads
     set status = 'won', updated_at = now()
   where id = v_lead.id;

  update public.crm_actions
     set status = 'done', completed_at = now()
   where lead_id = v_lead.id
     and action_type = 'direct_opportunity_payment'
     and status in ('pending','in_progress')
     and payload->>'direct_opportunity_id' = p_opportunity_id::text;

  if not exists (
    select 1 from public.crm_actions
    where lead_id = v_lead.id
      and action_type = 'project_onboarding'
      and status in ('pending','in_progress')
      and payload->>'direct_opportunity_id' = p_opportunity_id::text
  ) then
    insert into public.crm_actions (
      lead_id, action_type, status, priority, title, payload
    ) values (
      v_lead.id,
      'project_onboarding',
      'pending',
      'high',
      'Iniciar onboarding da venda direta',
      jsonb_build_object(
        'project_id', v_project_id,
        'direct_opportunity_id', p_opportunity_id,
        'opportunity_type', v_opportunity.opportunity_type,
        'product_code', v_opportunity.product_code,
        'created_by', p_actor_label,
        'source', 'blinko_os_internal'
      )
    );
  end if;

  if not exists (
    select 1 from public.project_tasks
    where project_id = v_project_id
      and status <> 'cancelled'
  ) then
    v_task_title := case v_opportunity.opportunity_type
      when 'marketing_subscription'
        then 'Concluir onboarding e organizar o primeiro ciclo mensal'
      when 'graphic_production'
        then 'Validar briefing, arquivos e especificações para produção'
      else 'Revisar briefing e iniciar execução'
    end;

    insert into public.project_tasks (
      project_id,
      intervention_id,
      title,
      responsible_label,
      due_at,
      dependencies,
      status,
      priority,
      estimate,
      completion_evidence,
      approval_required,
      created_by_label
    ) values (
      v_project_id,
      null,
      v_task_title,
      nullif(trim(coalesce(p_actor_label,'')), ''),
      null,
      '[]'::jsonb,
      'pending',
      'high',
      null,
      null,
      false,
      nullif(trim(coalesce(p_actor_label,'')), '')
    )
    returning id into v_task_id;
  end if;

  insert into public.audit_events (
    entity_type, entity_id, event_type, actor_type, actor_id, payload
  ) values (
    'project',
    v_project_id,
    'project_created_from_paid_direct_opportunity',
    'human',
    coalesce(nullif(trim(coalesce(p_actor_label,'')), ''), 'unknown'),
    jsonb_build_object(
      'direct_opportunity_id', p_opportunity_id,
      'lead_id', v_lead.id,
      'company_id', v_company_id,
      'opportunity_type', v_opportunity.opportunity_type,
      'product_code', v_opportunity.product_code,
      'initial_task_id', v_task_id,
      'status', 'onboarding'
    )
  );

  return v_project_id;
end;
$create_project_from_paid_direct_opportunity$;

-- V2 da ativação: aceita projeto originado tanto de proposta/diagnóstico quanto de venda direta.
create or replace function public.activate_project(
  p_project_id uuid,
  p_actor_label text
)
returns uuid
language plpgsql
set search_path = public
as $activate_project$
declare
  v_project public.projects%rowtype;
  v_diagnostic_id uuid;
  v_pre_diagnostic_id uuid;
  v_lead_id uuid;
begin
  select * into v_project
  from public.projects
  where id = p_project_id
    and status = 'onboarding';

  if v_project.id is null then
    raise exception 'project is not in onboarding';
  end if;

  if not exists (
    select 1 from public.project_tasks t
    where t.project_id = p_project_id
      and t.status <> 'cancelled'
  ) then
    raise exception 'project requires at least one initial task';
  end if;

  if v_project.proposal_id is not null then
    select p.diagnostic_id, d.pre_diagnostic_id, d.lead_id
      into v_diagnostic_id, v_pre_diagnostic_id, v_lead_id
    from public.proposals p
    join public.diagnostics d on d.id = p.diagnostic_id
    where p.id = v_project.proposal_id;

    update public.crm_actions
       set status = 'done', completed_at = now()
     where pre_diagnostic_id = v_pre_diagnostic_id
       and action_type = 'project_onboarding'
       and status in ('pending','in_progress');
  else
    select o.lead_id into v_lead_id
    from public.direct_opportunities o
    where o.id = v_project.direct_opportunity_id;

    update public.crm_actions
       set status = 'done', completed_at = now()
     where lead_id = v_lead_id
       and action_type = 'project_onboarding'
       and status in ('pending','in_progress')
       and payload->>'direct_opportunity_id' = v_project.direct_opportunity_id::text;
  end if;

  update public.projects
     set status = 'active', updated_at = now()
   where id = p_project_id;

  insert into public.audit_events (
    entity_type, entity_id, event_type, actor_type, actor_id, payload
  ) values (
    'project',
    p_project_id,
    'project_activated',
    'human',
    coalesce(nullif(trim(coalesce(p_actor_label,'')), ''), 'unknown'),
    jsonb_build_object(
      'proposal_id', v_project.proposal_id,
      'diagnostic_id', v_diagnostic_id,
      'direct_opportunity_id', v_project.direct_opportunity_id,
      'lead_id', v_lead_id,
      'new_status', 'active'
    )
  );

  return p_project_id;
end;
$activate_project$;
