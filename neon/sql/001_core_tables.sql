-- Blinko OS — Neon Postgres — Core V1
-- Tabelas e índices. Funções ficam em 002_core_functions.sql.

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
  submission_id uuid,
  form_version text not null default 'pre-diagnostic-form-v1',
  consent_version text not null default 'pre-diagnostic-consent-v1',
  source_page text not null default '/diagnostico',
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
  current_ai_analysis_run_id uuid,
  current_human_review_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists pre_diagnostics_submission_id_uidx
  on public.pre_diagnostics (submission_id) where submission_id is not null;
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

alter table public.pre_diagnostics
  drop constraint if exists pre_diagnostics_current_ai_analysis_run_id_fkey;
alter table public.pre_diagnostics
  add constraint pre_diagnostics_current_ai_analysis_run_id_fkey
  foreign key (current_ai_analysis_run_id) references public.pre_diagnostic_analysis_runs(id) on delete set null;

alter table public.pre_diagnostics
  drop constraint if exists pre_diagnostics_current_human_review_id_fkey;
alter table public.pre_diagnostics
  add constraint pre_diagnostics_current_human_review_id_fkey
  foreign key (current_human_review_id) references public.pre_diagnostic_review_versions(id) on delete set null;

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

create table if not exists public.pre_diagnostic_initial_readings (
  id uuid primary key default gen_random_uuid(),
  pre_diagnostic_id uuid not null references public.pre_diagnostics(id) on delete cascade,
  analysis_run_id uuid references public.pre_diagnostic_analysis_runs(id) on delete set null,
  human_review_id uuid references public.pre_diagnostic_review_versions(id) on delete set null,
  supersedes_id uuid references public.pre_diagnostic_initial_readings(id) on delete set null,
  channel text not null check (channel in ('whatsapp','email','manual')),
  status text not null default 'pending_approval'
    check (status in ('draft','pending_approval','approved','sent','failed','cancelled')),
  content_version text not null default 'initial-reading-v1',
  subject text,
  body text not null,
  created_by_type text not null check (created_by_type in ('ai','human','system')),
  created_by_id text,
  approved_by_user_id uuid,
  approved_by_label text,
  approved_at timestamptz,
  delivery_provider text,
  delivery_message_id text,
  delivery_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pre_diag_initial_readings_queue_idx
  on public.pre_diagnostic_initial_readings (status, created_at);
create index if not exists pre_diag_initial_readings_pre_diag_idx
  on public.pre_diagnostic_initial_readings (pre_diagnostic_id, created_at desc);
