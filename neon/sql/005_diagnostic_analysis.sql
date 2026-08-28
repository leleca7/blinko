-- Blinko OS — Diagnóstico Blinko — Análise profunda assistida V1
-- Depende de 003_diagnostic_commercial_flow.sql e 004_diagnostic_collection.sql.
-- A IA produz rascunho analítico. Problemas e causas confirmados continuam humanos.

create table if not exists public.diagnostic_analysis_runs (
  id uuid primary key default gen_random_uuid(),
  diagnostic_id uuid not null references public.diagnostics(id) on delete cascade,
  collection_version_id uuid not null references public.diagnostic_collection_versions(id) on delete restrict,
  status text not null check (status in ('processing','ready','failed')),
  provider text,
  model text,
  prompt_version text not null default 'blinko-diagnostic-analysis-v1',
  input_snapshot jsonb not null default '{}'::jsonb,
  output jsonb,
  error_code text,
  error_detail text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists diagnostic_analysis_runs_idx
  on public.diagnostic_analysis_runs (diagnostic_id, created_at desc);

create table if not exists public.diagnostic_analysis_review_versions (
  id uuid primary key default gen_random_uuid(),
  diagnostic_id uuid not null references public.diagnostics(id) on delete cascade,
  analysis_run_id uuid not null references public.diagnostic_analysis_runs(id) on delete restrict,
  reviewer_label text,
  decision jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists diagnostic_analysis_reviews_idx
  on public.diagnostic_analysis_review_versions (diagnostic_id, created_at desc);

alter table public.diagnostics add column if not exists current_analysis_run_id uuid;
alter table public.diagnostics add column if not exists current_analysis_review_id uuid;

alter table public.diagnostics drop constraint if exists diagnostics_current_analysis_run_id_fkey;
alter table public.diagnostics
  add constraint diagnostics_current_analysis_run_id_fkey
  foreign key (current_analysis_run_id) references public.diagnostic_analysis_runs(id) on delete set null;

alter table public.diagnostics drop constraint if exists diagnostics_current_analysis_review_id_fkey;
alter table public.diagnostics
  add constraint diagnostics_current_analysis_review_id_fkey
  foreign key (current_analysis_review_id) references public.diagnostic_analysis_review_versions(id) on delete set null;

create or replace function public.record_diagnostic_analysis(
  p_diagnostic_id uuid,
  p_collection_version_id uuid,
  p_status text,
  p_provider text,
  p_model text,
  p_prompt_version text,
  p_input_snapshot jsonb,
  p_output jsonb,
  p_error_code text default null,
  p_error_detail text default null
)
returns uuid
language plpgsql
set search_path = public
as $record_diagnostic_analysis$
declare
  v_run_id uuid;
begin
  if p_status not in ('processing','ready','failed') then
    raise exception 'invalid diagnostic analysis status';
  end if;

  if not exists (
    select 1 from public.diagnostics d
    where d.id = p_diagnostic_id and d.status = 'analysis'
  ) then
    raise exception 'diagnostic is not in analysis';
  end if;

  if not exists (
    select 1 from public.diagnostic_collection_versions cv
    where cv.id = p_collection_version_id and cv.diagnostic_id = p_diagnostic_id
  ) then
    raise exception 'collection version does not belong to diagnostic';
  end if;

  insert into public.diagnostic_analysis_runs (
    diagnostic_id, collection_version_id, status, provider, model, prompt_version,
    input_snapshot, output, error_code, error_detail, completed_at
  ) values (
    p_diagnostic_id, p_collection_version_id, p_status,
    nullif(p_provider,''), nullif(p_model,''), coalesce(nullif(p_prompt_version,''),'blinko-diagnostic-analysis-v1'),
    coalesce(p_input_snapshot,'{}'::jsonb), p_output, p_error_code, p_error_detail,
    case when p_status in ('ready','failed') then now() else null end
  ) returning id into v_run_id;

  if p_status = 'ready' then
    update public.diagnostics
       set current_analysis_run_id = v_run_id,
           current_analysis_review_id = null,
           updated_at = now()
     where id = p_diagnostic_id;
  end if;

  insert into public.audit_events (
    entity_type, entity_id, event_type, actor_type, actor_id, payload
  ) values (
    'diagnostic', p_diagnostic_id, 'diagnostic_ai_analysis_' || p_status,
    'ai', coalesce(nullif(p_model,''), nullif(p_provider,''), 'blinko-ai'),
    jsonb_build_object('analysis_run_id', v_run_id, 'collection_version_id', p_collection_version_id)
  );

  return v_run_id;
end;
$record_diagnostic_analysis$;

create or replace function public.record_diagnostic_analysis_review(
  p_diagnostic_id uuid,
  p_analysis_run_id uuid,
  p_reviewer_label text,
  p_decision jsonb
)
returns uuid
language plpgsql
set search_path = public
as $record_diagnostic_analysis_review$
declare
  v_review_id uuid;
  v_pre_diagnostic_id uuid;
  v_lead_id uuid;
begin
  if not exists (
    select 1 from public.diagnostic_analysis_runs ar
    where ar.id = p_analysis_run_id
      and ar.diagnostic_id = p_diagnostic_id
      and ar.status = 'ready'
  ) then
    raise exception 'ready analysis run does not belong to diagnostic';
  end if;

  select pre_diagnostic_id, lead_id
    into v_pre_diagnostic_id, v_lead_id
    from public.diagnostics where id = p_diagnostic_id;

  insert into public.diagnostic_analysis_review_versions (
    diagnostic_id, analysis_run_id, reviewer_label, decision
  ) values (
    p_diagnostic_id, p_analysis_run_id,
    nullif(trim(coalesce(p_reviewer_label,'')), ''), coalesce(p_decision,'{}'::jsonb)
  ) returning id into v_review_id;

  update public.diagnostics
     set current_analysis_review_id = v_review_id,
         status = 'review',
         updated_at = now()
   where id = p_diagnostic_id;

  update public.crm_actions
     set status = 'done', completed_at = now()
   where pre_diagnostic_id = v_pre_diagnostic_id
     and action_type = 'diagnostic_analysis'
     and status in ('pending','in_progress');

  if not exists (
    select 1 from public.crm_actions
     where pre_diagnostic_id = v_pre_diagnostic_id
       and action_type = 'diagnostic_structure_problems'
       and status in ('pending','in_progress')
  ) then
    insert into public.crm_actions (
      lead_id, pre_diagnostic_id, action_type, status, priority, title, payload
    ) values (
      v_lead_id, v_pre_diagnostic_id, 'diagnostic_structure_problems', 'pending', 'high',
      'Estruturar problemas e causas do Diagnóstico Blinko',
      jsonb_build_object(
        'diagnostic_id', p_diagnostic_id,
        'analysis_run_id', p_analysis_run_id,
        'analysis_review_id', v_review_id,
        'created_by', p_reviewer_label,
        'source', 'blinko_os_internal'
      )
    );
  end if;

  insert into public.audit_events (
    entity_type, entity_id, event_type, actor_type, actor_id, payload
  ) values (
    'diagnostic', p_diagnostic_id, 'diagnostic_analysis_review_recorded',
    'human', coalesce(nullif(trim(coalesce(p_reviewer_label,'')), ''), 'unknown'),
    jsonb_build_object('analysis_run_id', p_analysis_run_id, 'analysis_review_id', v_review_id)
  );

  return v_review_id;
end;
$record_diagnostic_analysis_review$;
