-- Blinko OS — Biblioteca de Direções Visuais
-- Separa engenharia reutilizável de direção de arte.
-- Não gera nem publica sites automaticamente.

create table if not exists public.visual_directions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  positioning text,
  description text,
  status text not null default 'draft'
    check (status in ('draft','beta','ready','retired')),
  version text not null default '1.0.0',
  mood_keywords jsonb not null default '[]'::jsonb,
  typography_guidance jsonb not null default '[]'::jsonb,
  palette_guidance jsonb not null default '[]'::jsonb,
  composition_guidance jsonb not null default '[]'::jsonb,
  image_guidance jsonb not null default '[]'::jsonb,
  motion_guidance jsonb not null default '[]'::jsonb,
  component_guidance jsonb not null default '[]'::jsonb,
  avoid_patterns jsonb not null default '[]'::jsonb,
  reference_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists visual_directions_status_idx
  on public.visual_directions (status, name);

alter table public.company_solutions
  add column if not exists visual_direction_id uuid references public.visual_directions(id) on delete set null;

create index if not exists company_solutions_visual_direction_idx
  on public.company_solutions (visual_direction_id)
  where visual_direction_id is not null;
