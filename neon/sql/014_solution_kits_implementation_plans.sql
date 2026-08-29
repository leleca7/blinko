-- Blinko OS — Kits reutilizáveis + planos de implantação
-- Organiza combinações de blueprints e sua implantação por empresa.
-- Não publica, provisiona repositórios ou ativa integrações automaticamente.

create table if not exists public.solution_kits (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null,
  summary text,
  status text not null default 'draft'
    check (status in ('draft','beta','ready','retired')),
  version text not null default '1.0.0',
  ideal_profiles jsonb not null default '[]'::jsonb,
  deliverables jsonb not null default '[]'::jsonb,
  setup_checklist jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists solution_kits_status_idx
  on public.solution_kits (status, category, name);

create table if not exists public.solution_kit_items (
  id uuid primary key default gen_random_uuid(),
  kit_id uuid not null references public.solution_kits(id) on delete cascade,
  blueprint_id uuid not null references public.solution_blueprints(id) on delete restrict,
  position integer not null default 0,
  required boolean not null default true,
  default_config jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  unique (kit_id, blueprint_id)
);

create index if not exists solution_kit_items_kit_idx
  on public.solution_kit_items (kit_id, position, created_at);

create table if not exists public.company_implementation_plans (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  kit_id uuid references public.solution_kits(id) on delete set null,
  name text not null,
  status text not null default 'draft'
    check (status in ('draft','approved','in_build','review','live','paused','cancelled')),
  visual_direction_id uuid references public.visual_directions(id) on delete set null,
  objective text,
  customizations jsonb not null default '{}'::jsonb,
  approved_by_label text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists company_implementation_plans_company_idx
  on public.company_implementation_plans (company_id, status, created_at desc);

create table if not exists public.company_implementation_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.company_implementation_plans(id) on delete cascade,
  blueprint_id uuid not null references public.solution_blueprints(id) on delete restrict,
  source_kit_item_id uuid references public.solution_kit_items(id) on delete set null,
  position integer not null default 0,
  status text not null default 'planned'
    check (status in ('planned','configuring','in_build','review','ready','live','skipped')),
  selected_version text,
  customizations jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, blueprint_id)
);

create index if not exists company_implementation_plan_items_plan_idx
  on public.company_implementation_plan_items (plan_id, position, created_at);

comment on table public.solution_kits is
  'Receitas reutilizáveis que combinam blueprints Blinko. Não representam publicação automática.';

comment on table public.company_implementation_plans is
  'Plano humano de implantação de soluções para uma empresa. Aprovação e publicação permanecem separadas.';
