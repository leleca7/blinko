-- Blinko OS — Catálogo de Soluções
-- Blueprints reutilizáveis + seleção por empresa.
-- Não provisiona, publica ou conecta integrações automaticamente.
-- Revisada após sincronização da PR #14 com a main.

create table if not exists public.solution_blueprints (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null,
  problem_statement text,
  summary text,
  status text not null default 'draft'
    check (status in ('draft','beta','ready','retired')),
  customization_level text not null default 'medium'
    check (customization_level in ('low','medium','high','custom')),
  version text not null default '1.0.0',
  source_repository_url text,
  drive_document_url text,
  modules jsonb not null default '[]'::jsonb,
  optional_integrations jsonb not null default '[]'::jsonb,
  required_config jsonb not null default '[]'::jsonb,
  implementation_checklist jsonb not null default '[]'::jsonb,
  ideal_profiles jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists solution_blueprints_status_idx
  on public.solution_blueprints (status, category, name);

create table if not exists public.company_solutions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  blueprint_id uuid not null references public.solution_blueprints(id) on delete restrict,
  status text not null default 'selected'
    check (status in ('planned','selected','in_build','live','paused','retired')),
  selected_version text,
  customizations jsonb not null default '{}'::jsonb,
  notes text,
  selected_by_label text,
  selected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, blueprint_id)
);

create index if not exists company_solutions_company_idx
  on public.company_solutions (company_id, status, selected_at desc);

create index if not exists company_solutions_blueprint_idx
  on public.company_solutions (blueprint_id, status, selected_at desc);
