-- Blinko OS - Diagnóstico Blinko - Problemas, causas, prioridades e intervenções V1
-- Depende de 003, 004 e 005.
-- A estrutura só é registrada por ação humana após a revisão da análise profunda.

create table if not exists public.diagnostic_problems (
  id uuid primary key default gen_random_uuid(),
  diagnostic_id uuid not null references public.diagnostics(id) on delete cascade,
  analysis_review_id uuid not null references public.diagnostic_analysis_review_versions(id) on delete restrict,
  title text not null,
  description text not null,
  primary_pillar text,
  related_pillars jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  perceived_impact text,
  urgency text not null default 'medium' check (urgency in ('low','medium','high','critical')),
  status text not null default 'candidate' check (status in ('candidate','confirmed','discarded')),
  confirmation_notes text,
  created_by_label text,
  confirmed_by_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists diagnostic_problems_idx on public.diagnostic_problems (diagnostic_id, created_at desc);
create index if not exists diagnostic_problems_status_idx on public.diagnostic_problems (diagnostic_id, status);

create table if not exists public.diagnostic_causes (
  id uuid primary key default gen_random_uuid(),
  diagnostic_id uuid not null references public.diagnostics(id) on delete cascade,
  problem_id uuid not null references public.diagnostic_problems(id) on delete cascade,
  description text not null,
  evidence jsonb not null default '[]'::jsonb,
  confidence text not null default 'low' check (confidence in ('low','medium','high')),
  validation_status text not null default 'hypothesis' check (validation_status in ('hypothesis','in_validation','confirmed','discarded')),
  validation_notes text,
  validated_by_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists diagnostic_causes_idx on public.diagnostic_causes (diagnostic_id, problem_id, created_at desc);

create table if not exists public.diagnostic_priorities (
  id uuid primary key default gen_random_uuid(),
  diagnostic_id uuid not null references public.diagnostics(id) on delete cascade,
  problem_id uuid not null references public.diagnostic_problems(id) on delete cascade,
  cause_id uuid references public.diagnostic_causes(id) on delete set null,
  impact text,
  urgency text not null default 'medium' check (urgency in ('low','medium','high','critical')),
  dependencies jsonb not null default '[]'::jsonb,
  estimated_effort text not null default 'medium' check (estimated_effort in ('low','medium','high')),
  risk text not null default 'medium' check (risk in ('low','medium','high')),
  rationale text not null,
  sequence_position integer not null default 1 check (sequence_position > 0),
  status text not null default 'proposed' check (status in ('proposed','selected','deferred','done')),
  created_by_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists diagnostic_priorities_idx on public.diagnostic_priorities (diagnostic_id, sequence_position, created_at);

create table if not exists public.diagnostic_interventions (
  id uuid primary key default gen_random_uuid(),
  diagnostic_id uuid not null references public.diagnostics(id) on delete cascade,
  problem_id uuid not null references public.diagnostic_problems(id) on delete cascade,
  cause_id uuid references public.diagnostic_causes(id) on delete set null,
  priority_id uuid references public.diagnostic_priorities(id) on delete set null,
  library_key text,
  title text not null,
  objective text not null,
  scope text not null,
  deliverables jsonb not null default '[]'::jsonb,
  responsible_label text,
  specialists_needed jsonb not null default '[]'::jsonb,
  timeframe text,
  effort text,
  risks jsonb not null default '[]'::jsonb,
  dependencies jsonb not null default '[]'::jsonb,
  success_indicator text,
  approvals_required jsonb not null default '[]'::jsonb,
  status text not null default 'candidate' check (status in ('candidate','selected','approved_for_proposal','discarded')),
  created_by_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists diagnostic_interventions_idx on public.diagnostic_interventions (diagnostic_id, status, created_at desc);

create or replace function public.record_diagnostic_strategy_bundle(
  p_diagnostic_id uuid,
  p_analysis_review_id uuid,
  p_actor_label text,
  p_problem jsonb,
  p_cause jsonb,
  p_priority jsonb,
  p_intervention jsonb
)
returns jsonb
language plpgsql
set search_path = public
as $record_strategy_bundle$
declare
  v_problem_id uuid;
  v_cause_id uuid;
  v_priority_id uuid;
  v_intervention_id uuid;
  v_problem_status text;
  v_cause_status text;
  v_priority_status text;
  v_intervention_status text;
begin
  if not exists (
    select 1 from public.diagnostics d
    where d.id = p_diagnostic_id
      and d.status = 'review'
      and d.current_analysis_review_id = p_analysis_review_id
  ) then
    raise exception 'diagnostic review is not current';
  end if;

  if nullif(trim(coalesce(p_problem->>'title','')), '') is null
     or nullif(trim(coalesce(p_problem->>'description','')), '') is null then
    raise exception 'problem title and description are required';
  end if;

  v_problem_status := coalesce(nullif(p_problem->>'status',''), 'candidate');
  if v_problem_status not in ('candidate','confirmed','discarded') then raise exception 'invalid problem status'; end if;
  if v_problem_status = 'confirmed' and jsonb_array_length(coalesce(p_problem->'evidence','[]'::jsonb)) = 0 then
    raise exception 'confirmed problem requires evidence';
  end if;

  insert into public.diagnostic_problems (
    diagnostic_id, analysis_review_id, title, description, primary_pillar, related_pillars,
    evidence, perceived_impact, urgency, status, confirmation_notes,
    created_by_label, confirmed_by_label
  ) values (
    p_diagnostic_id, p_analysis_review_id,
    trim(p_problem->>'title'), trim(p_problem->>'description'), nullif(trim(coalesce(p_problem->>'primary_pillar','')), ''),
    coalesce(p_problem->'related_pillars','[]'::jsonb), coalesce(p_problem->'evidence','[]'::jsonb),
    nullif(trim(coalesce(p_problem->>'perceived_impact','')), ''),
    coalesce(nullif(p_problem->>'urgency',''), 'medium'), v_problem_status,
    nullif(trim(coalesce(p_problem->>'confirmation_notes','')), ''),
    nullif(trim(coalesce(p_actor_label,'')), ''),
    case when v_problem_status = 'confirmed' then nullif(trim(coalesce(p_actor_label,'')), '') else null end
  ) returning id into v_problem_id;

  if nullif(trim(coalesce(p_cause->>'description','')), '') is not null then
    v_cause_status := coalesce(nullif(p_cause->>'validation_status',''), 'hypothesis');
    if v_cause_status not in ('hypothesis','in_validation','confirmed','discarded') then raise exception 'invalid cause status'; end if;
    if v_cause_status = 'confirmed' and jsonb_array_length(coalesce(p_cause->'evidence','[]'::jsonb)) = 0 then
      raise exception 'confirmed cause requires evidence';
    end if;

    insert into public.diagnostic_causes (
      diagnostic_id, problem_id, description, evidence, confidence,
      validation_status, validation_notes, validated_by_label
    ) values (
      p_diagnostic_id, v_problem_id, trim(p_cause->>'description'), coalesce(p_cause->'evidence','[]'::jsonb),
      coalesce(nullif(p_cause->>'confidence',''), 'low'), v_cause_status,
      nullif(trim(coalesce(p_cause->>'validation_notes','')), ''),
      case when v_cause_status in ('confirmed','discarded') then nullif(trim(coalesce(p_actor_label,'')), '') else null end
    ) returning id into v_cause_id;
  end if;

  if nullif(trim(coalesce(p_priority->>'rationale','')), '') is not null then
    v_priority_status := coalesce(nullif(p_priority->>'status',''), 'proposed');
    if v_priority_status not in ('proposed','selected','deferred','done') then raise exception 'invalid priority status'; end if;

    insert into public.diagnostic_priorities (
      diagnostic_id, problem_id, cause_id, impact, urgency, dependencies,
      estimated_effort, risk, rationale, sequence_position, status, created_by_label
    ) values (
      p_diagnostic_id, v_problem_id, v_cause_id,
      nullif(trim(coalesce(p_priority->>'impact','')), ''),
      coalesce(nullif(p_priority->>'urgency',''), 'medium'), coalesce(p_priority->'dependencies','[]'::jsonb),
      coalesce(nullif(p_priority->>'estimated_effort',''), 'medium'), coalesce(nullif(p_priority->>'risk',''), 'medium'),
      trim(p_priority->>'rationale'), greatest(coalesce((p_priority->>'sequence_position')::integer, 1), 1),
      v_priority_status, nullif(trim(coalesce(p_actor_label,'')), '')
    ) returning id into v_priority_id;
  end if;

  if nullif(trim(coalesce(p_intervention->>'title','')), '') is not null then
    v_intervention_status := coalesce(nullif(p_intervention->>'status',''), 'candidate');
    if v_intervention_status not in ('candidate','selected','approved_for_proposal','discarded') then raise exception 'invalid intervention status'; end if;
    if nullif(trim(coalesce(p_intervention->>'objective','')), '') is null or nullif(trim(coalesce(p_intervention->>'scope','')), '') is null then
      raise exception 'intervention objective and scope are required';
    end if;
    if v_intervention_status in ('selected','approved_for_proposal') and v_priority_id is null then
      raise exception 'selected intervention requires priority';
    end if;

    insert into public.diagnostic_interventions (
      diagnostic_id, problem_id, cause_id, priority_id, library_key, title, objective, scope,
      deliverables, responsible_label, specialists_needed, timeframe, effort, risks,
      dependencies, success_indicator, approvals_required, status, created_by_label
    ) values (
      p_diagnostic_id, v_problem_id, v_cause_id, v_priority_id,
      nullif(trim(coalesce(p_intervention->>'library_key','')), ''), trim(p_intervention->>'title'),
      trim(p_intervention->>'objective'), trim(p_intervention->>'scope'),
      coalesce(p_intervention->'deliverables','[]'::jsonb), nullif(trim(coalesce(p_intervention->>'responsible_label','')), ''),
      coalesce(p_intervention->'specialists_needed','[]'::jsonb), nullif(trim(coalesce(p_intervention->>'timeframe','')), ''),
      nullif(trim(coalesce(p_intervention->>'effort','')), ''), coalesce(p_intervention->'risks','[]'::jsonb),
      coalesce(p_intervention->'dependencies','[]'::jsonb), nullif(trim(coalesce(p_intervention->>'success_indicator','')), ''),
      coalesce(p_intervention->'approvals_required','[]'::jsonb), v_intervention_status,
      nullif(trim(coalesce(p_actor_label,'')), '')
    ) returning id into v_intervention_id;
  end if;

  insert into public.audit_events (entity_type, entity_id, event_type, actor_type, actor_id, payload)
  values (
    'diagnostic', p_diagnostic_id, 'diagnostic_strategy_bundle_recorded', 'human',
    coalesce(nullif(trim(coalesce(p_actor_label,'')), ''), 'unknown'),
    jsonb_build_object(
      'analysis_review_id', p_analysis_review_id,
      'problem_id', v_problem_id,
      'cause_id', v_cause_id,
      'priority_id', v_priority_id,
      'intervention_id', v_intervention_id
    )
  );

  return jsonb_build_object(
    'problem_id', v_problem_id,
    'cause_id', v_cause_id,
    'priority_id', v_priority_id,
    'intervention_id', v_intervention_id
  );
end;
$record_strategy_bundle$;

create or replace function public.finalize_diagnostic_strategy(
  p_diagnostic_id uuid,
  p_actor_label text
)
returns uuid
language plpgsql
set search_path = public
as $finalize_strategy$
declare
  v_pre_diagnostic_id uuid;
  v_lead_id uuid;
begin
  select pre_diagnostic_id, lead_id into v_pre_diagnostic_id, v_lead_id
  from public.diagnostics
  where id = p_diagnostic_id and status = 'review';

  if v_lead_id is null then raise exception 'diagnostic is not in review'; end if;

  if not exists (
    select 1
    from public.diagnostic_interventions i
    join public.diagnostic_priorities pr on pr.id = i.priority_id and pr.status = 'selected'
    join public.diagnostic_problems p on p.id = i.problem_id and p.status = 'confirmed'
    join public.diagnostic_causes c on c.id = i.cause_id and c.validation_status = 'confirmed'
    where i.diagnostic_id = p_diagnostic_id and i.status = 'selected'
  ) then
    raise exception 'a confirmed problem, confirmed cause, selected priority and selected intervention are required';
  end if;

  update public.diagnostics set status = 'ready_for_presentation', updated_at = now()
  where id = p_diagnostic_id;

  update public.crm_actions set status = 'done', completed_at = now()
  where pre_diagnostic_id = v_pre_diagnostic_id
    and action_type = 'diagnostic_structure_problems'
    and status in ('pending','in_progress');

  if not exists (
    select 1 from public.crm_actions
    where pre_diagnostic_id = v_pre_diagnostic_id
      and action_type = 'diagnostic_prepare_presentation'
      and status in ('pending','in_progress')
  ) then
    insert into public.crm_actions (
      lead_id, pre_diagnostic_id, action_type, status, priority, title, payload
    ) values (
      v_lead_id, v_pre_diagnostic_id, 'diagnostic_prepare_presentation', 'pending', 'high',
      'Preparar apresentação do Diagnóstico Blinko',
      jsonb_build_object('diagnostic_id', p_diagnostic_id, 'created_by', p_actor_label, 'source', 'blinko_os_internal')
    );
  end if;

  insert into public.audit_events (entity_type, entity_id, event_type, actor_type, actor_id, payload)
  values (
    'diagnostic', p_diagnostic_id, 'diagnostic_strategy_finalized', 'human',
    coalesce(nullif(trim(coalesce(p_actor_label,'')), ''), 'unknown'),
    jsonb_build_object('new_status', 'ready_for_presentation')
  );

  return p_diagnostic_id;
end;
$finalize_strategy$;
