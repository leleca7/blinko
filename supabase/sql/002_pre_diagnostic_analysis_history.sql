-- Blinko OS — Histórico de análise e revisão do Pré-Diagnóstico
-- Aplicar depois de 001_pre_diagnostico_v1.sql no projeto Supabase EXCLUSIVO da Blinko.

create table if not exists public.pre_diagnostic_analysis_runs (
  id uuid primary key default gen_random_uuid(),
  pre_diagnostic_id uuid not null references public.pre_diagnostics(id) on delete cascade,
  status text not null check (status in ('processing','ready','failed')),
  provider text,
  model text,
  prompt_version text not null default 'pre-diagnostic-v1',
  input_snapshot jsonb not null default '{}'::jsonb,
  output jsonb,
  error_code text,
  error_detail text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists pre_diag_analysis_runs_idx
  on public.pre_diagnostic_analysis_runs (pre_diagnostic_id, created_at desc);

create table if not exists public.pre_diagnostic_review_versions (
  id uuid primary key default gen_random_uuid(),
  pre_diagnostic_id uuid not null references public.pre_diagnostics(id) on delete cascade,
  analysis_run_id uuid references public.pre_diagnostic_analysis_runs(id) on delete set null,
  reviewer_user_id uuid,
  reviewer_label text,
  decision jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists pre_diag_review_versions_idx
  on public.pre_diagnostic_review_versions (pre_diagnostic_id, created_at desc);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  event_type text not null,
  actor_type text not null check (actor_type in ('system','ai','human')),
  actor_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_entity_idx
  on public.audit_events (entity_type, entity_id, created_at desc);

alter table public.pre_diagnostics
  add column if not exists current_ai_analysis_run_id uuid references public.pre_diagnostic_analysis_runs(id) on delete set null,
  add column if not exists current_human_review_id uuid references public.pre_diagnostic_review_versions(id) on delete set null;

alter table public.pre_diagnostic_analysis_runs enable row level security;
alter table public.pre_diagnostic_review_versions enable row level security;
alter table public.audit_events enable row level security;

revoke all on table public.pre_diagnostic_analysis_runs from anon, authenticated;
revoke all on table public.pre_diagnostic_review_versions from anon, authenticated;
revoke all on table public.audit_events from anon, authenticated;

-- Registra uma análise sem apagar execuções anteriores.
create or replace function public.record_pre_diagnostic_analysis(
  p_pre_diagnostic_id uuid,
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
security invoker
set search_path = public
as $$
declare
  v_run_id uuid;
begin
  if p_status not in ('processing','ready','failed') then
    raise exception 'invalid analysis status';
  end if;

  if not exists (select 1 from public.pre_diagnostics where id = p_pre_diagnostic_id) then
    raise exception 'pre-diagnostic not found';
  end if;

  insert into public.pre_diagnostic_analysis_runs (
    pre_diagnostic_id,
    status,
    provider,
    model,
    prompt_version,
    input_snapshot,
    output,
    error_code,
    error_detail,
    completed_at
  ) values (
    p_pre_diagnostic_id,
    p_status,
    nullif(p_provider, ''),
    nullif(p_model, ''),
    coalesce(nullif(p_prompt_version, ''), 'pre-diagnostic-v1'),
    coalesce(p_input_snapshot, '{}'::jsonb),
    p_output,
    p_error_code,
    p_error_detail,
    case when p_status in ('ready','failed') then now() else null end
  ) returning id into v_run_id;

  update public.pre_diagnostics
     set ai_analysis_status = case
       when p_status = 'processing' then 'processing'
       when p_status = 'ready' then 'ready'
       else 'failed'
     end,
         ai_analysis = case when p_status = 'ready' then p_output else ai_analysis end,
         current_ai_analysis_run_id = case when p_status = 'ready' then v_run_id else current_ai_analysis_run_id end,
         updated_at = now()
   where id = p_pre_diagnostic_id;

  insert into public.audit_events (
    entity_type, entity_id, event_type, actor_type, actor_id, payload
  ) values (
    'pre_diagnostic',
    p_pre_diagnostic_id,
    'ai_analysis_' || p_status,
    'ai',
    coalesce(nullif(p_model, ''), nullif(p_provider, ''), 'blinko-ai'),
    jsonb_build_object('analysis_run_id', v_run_id, 'prompt_version', coalesce(nullif(p_prompt_version, ''), 'pre-diagnostic-v1'))
  );

  return v_run_id;
end;
$$;

-- Registra uma decisão humana versionada; não apaga a saída original da IA.
create or replace function public.record_pre_diagnostic_review(
  p_pre_diagnostic_id uuid,
  p_analysis_run_id uuid,
  p_reviewer_user_id uuid,
  p_reviewer_label text,
  p_decision jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_review_id uuid;
begin
  if not exists (select 1 from public.pre_diagnostics where id = p_pre_diagnostic_id) then
    raise exception 'pre-diagnostic not found';
  end if;

  if p_analysis_run_id is not null and not exists (
    select 1
      from public.pre_diagnostic_analysis_runs
     where id = p_analysis_run_id
       and pre_diagnostic_id = p_pre_diagnostic_id
  ) then
    raise exception 'analysis run does not belong to pre-diagnostic';
  end if;

  insert into public.pre_diagnostic_review_versions (
    pre_diagnostic_id,
    analysis_run_id,
    reviewer_user_id,
    reviewer_label,
    decision
  ) values (
    p_pre_diagnostic_id,
    p_analysis_run_id,
    p_reviewer_user_id,
    nullif(p_reviewer_label, ''),
    coalesce(p_decision, '{}'::jsonb)
  ) returning id into v_review_id;

  update public.pre_diagnostics
     set human_review_status = 'reviewed',
         human_review = coalesce(p_decision, '{}'::jsonb),
         current_human_review_id = v_review_id,
         updated_at = now()
   where id = p_pre_diagnostic_id;

  update public.leads l
     set status = case when l.status = 'new' then 'reviewing' else l.status end,
         updated_at = now()
    from public.pre_diagnostics pd
   where pd.id = p_pre_diagnostic_id
     and pd.lead_id = l.id;

  insert into public.audit_events (
    entity_type, entity_id, event_type, actor_type, actor_id, payload
  ) values (
    'pre_diagnostic',
    p_pre_diagnostic_id,
    'human_review_recorded',
    'human',
    coalesce(p_reviewer_user_id::text, nullif(p_reviewer_label, ''), 'unknown'),
    jsonb_build_object('review_id', v_review_id, 'analysis_run_id', p_analysis_run_id)
  );

  return v_review_id;
end;
$$;

revoke all on function public.record_pre_diagnostic_analysis(uuid,text,text,text,text,jsonb,jsonb,text,text) from public, anon, authenticated;
revoke all on function public.record_pre_diagnostic_review(uuid,uuid,uuid,text,jsonb) from public, anon, authenticated;

grant execute on function public.record_pre_diagnostic_analysis(uuid,text,text,text,text,jsonb,jsonb,text,text) to service_role;
grant execute on function public.record_pre_diagnostic_review(uuid,uuid,uuid,text,jsonb) to service_role;

comment on table public.pre_diagnostic_analysis_runs is
'Histórico append-only das análises automatizadas do Pré-Diagnóstico.';

comment on table public.pre_diagnostic_review_versions is
'Histórico versionado das revisões humanas; uma revisão nunca apaga a análise original.';
