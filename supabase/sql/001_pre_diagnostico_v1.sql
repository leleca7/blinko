-- Blinko OS — Pré-Diagnóstico V1
-- Aplicar no projeto Supabase EXCLUSIVO da Blinko.
-- Não aplicar no projeto Plumareli.

create extension if not exists pgcrypto;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'new' check (status in ('new','reviewing','contacted','meeting','diagnostic_offered','diagnostic_paid','qualified','won','lost','archived')),
  name text not null,
  email text not null,
  whatsapp text not null,
  company_name text not null,
  company_role text not null,
  city_state text not null,
  segment text not null,
  website text,
  social_url text,
  objective text not null,
  urgency text not null,
  commercial_score smallint not null check (commercial_score between 0 and 10),
  score_breakdown jsonb not null default '{}'::jsonb,
  source text not null default 'site_pre_diagnostic',
  consent_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_status_created_idx on public.leads (status, created_at desc);
create index if not exists leads_email_idx on public.leads (lower(email));
create index if not exists leads_company_idx on public.leads (lower(company_name));

create table if not exists public.pre_diagnostics (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  perceived_blocker text not null,
  perceived_areas text[] not null default '{}',
  pillar_answers jsonb not null default '{}'::jsonb,
  operational_signals text[] not null default '{}',
  team_size text not null,
  company_moment text not null,
  openness_to_change text not null,
  investment_intent text not null,
  additional_context text,
  raw_answers jsonb not null,
  ai_analysis_status text not null default 'pending' check (ai_analysis_status in ('pending','processing','ready','failed')),
  ai_analysis jsonb,
  human_review_status text not null default 'pending' check (human_review_status in ('pending','reviewing','reviewed')),
  human_review jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pre_diagnostics_lead_idx on public.pre_diagnostics (lead_id, created_at desc);
create index if not exists pre_diagnostics_review_idx on public.pre_diagnostics (human_review_status, created_at desc);

create table if not exists public.crm_actions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  pre_diagnostic_id uuid references public.pre_diagnostics(id) on delete cascade,
  action_type text not null,
  status text not null default 'pending' check (status in ('pending','in_progress','done','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  title text not null,
  payload jsonb not null default '{}'::jsonb,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists crm_actions_queue_idx on public.crm_actions (status, priority, created_at);
create index if not exists crm_actions_lead_idx on public.crm_actions (lead_id, created_at desc);

-- As tabelas estão no schema exposto `public`, mas a V1 NÃO permite acesso direto do navegador.
-- O site escreve apenas por backend confiável com SUPABASE_SECRET_KEY.
alter table public.leads enable row level security;
alter table public.pre_diagnostics enable row level security;
alter table public.crm_actions enable row level security;

revoke all on table public.leads from anon, authenticated;
revoke all on table public.pre_diagnostics from anon, authenticated;
revoke all on table public.crm_actions from anon, authenticated;

-- Criação atômica: Lead + Pré-Diagnóstico + próxima ação em uma única transação.
create or replace function public.create_pre_diagnostic_submission(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_lead_id uuid;
  v_pre_id uuid;
  v_action_id uuid;
  v_score integer;
  v_priority text;
begin
  v_score := greatest(0, least(10, coalesce((payload->>'commercial_score')::integer, 0)));
  v_priority := case
    when v_score >= 8 then 'high'
    when v_score >= 5 then 'normal'
    else 'low'
  end;

  insert into public.leads (
    name, email, whatsapp, company_name, company_role, city_state, segment,
    website, social_url, objective, urgency, commercial_score, score_breakdown,
    source, consent_at
  ) values (
    payload->>'name',
    lower(payload->>'email'),
    payload->>'whatsapp',
    payload->>'company_name',
    payload->>'company_role',
    payload->>'city_state',
    payload->>'segment',
    nullif(payload->>'website',''),
    nullif(payload->>'social_url',''),
    payload->>'objective',
    payload->>'urgency',
    v_score,
    coalesce(payload->'score_breakdown','{}'::jsonb),
    coalesce(nullif(payload->>'source',''),'site_pre_diagnostic'),
    now()
  ) returning id into v_lead_id;

  insert into public.pre_diagnostics (
    lead_id, perceived_blocker, perceived_areas, pillar_answers,
    operational_signals, team_size, company_moment, openness_to_change,
    investment_intent, additional_context, raw_answers
  ) values (
    v_lead_id,
    payload->>'perceived_blocker',
    coalesce(array(select jsonb_array_elements_text(coalesce(payload->'perceived_areas','[]'::jsonb))), '{}'),
    coalesce(payload->'pillar_answers','{}'::jsonb),
    coalesce(array(select jsonb_array_elements_text(coalesce(payload->'operational_signals','[]'::jsonb))), '{}'),
    payload->>'team_size',
    payload->>'company_moment',
    payload->>'openness_to_change',
    payload->>'investment_intent',
    nullif(payload->>'additional_context',''),
    payload
  ) returning id into v_pre_id;

  insert into public.crm_actions (
    lead_id, pre_diagnostic_id, action_type, priority, title, payload
  ) values (
    v_lead_id,
    v_pre_id,
    'review_pre_diagnostic',
    v_priority,
    'Revisar pré-diagnóstico',
    jsonb_build_object('commercial_score', v_score)
  ) returning id into v_action_id;

  return jsonb_build_object(
    'lead_id', v_lead_id,
    'pre_diagnostic_id', v_pre_id,
    'action_id', v_action_id,
    'commercial_score', v_score,
    'priority', v_priority
  );
end;
$$;

revoke all on function public.create_pre_diagnostic_submission(jsonb) from public, anon, authenticated;
grant execute on function public.create_pre_diagnostic_submission(jsonb) to service_role;

comment on function public.create_pre_diagnostic_submission(jsonb) is
'Cria atomicamente Lead, Pré-Diagnóstico e ação de revisão. Deve ser chamada apenas por backend confiável.';
