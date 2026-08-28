-- Blinko OS - alinhamento de status na conversão para execução
-- Depende de 008_execution_initial.sql.
-- O schema core usa 'won' como estado de lead convertido/ganho.

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

  if v_company_id is null or v_current_version_id is null then
    raise exception 'accepted proposal with current version is required';
  end if;

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

  update public.leads set status = 'won', updated_at = now() where id = v_lead_id;
  update public.diagnostics set status = 'completed', updated_at = now()
  where id = v_diagnostic_id and status = 'presented';

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
      jsonb_build_object(
        'project_id', v_project_id,
        'proposal_id', p_proposal_id,
        'created_by', p_actor_label,
        'source', 'blinko_os_internal'
      )
    );
  end if;

  insert into public.audit_events (entity_type, entity_id, event_type, actor_type, actor_id, payload)
  values (
    'project', v_project_id, 'project_created_from_accepted_proposal', 'human',
    coalesce(nullif(trim(coalesce(p_actor_label,'')), ''), 'unknown'),
    jsonb_build_object(
      'proposal_id', p_proposal_id,
      'diagnostic_id', v_diagnostic_id,
      'contract_reference', trim(p_contract_reference),
      'status', 'onboarding',
      'lead_status', 'won'
    )
  );

  return v_project_id;
end;
$create_project_from_proposal$;
