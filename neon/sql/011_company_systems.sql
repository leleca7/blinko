-- Blinko OS — Central de empresas e sistemas conectados
-- Mantém aplicações operacionais especializadas isoladas do Blinko.
-- Esta migração armazena somente metadados de integração. Nunca guardar segredos aqui.

create table if not exists public.company_systems (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  system_key text not null,
  name text not null,
  system_type text not null default 'operational'
    check (system_type in ('operational','portal','integration','analytics','other')),
  app_url text,
  health_url text,
  repository_url text,
  environment text not null default 'production'
    check (environment in ('production','preview','development','other')),
  status text not null default 'unknown'
    check (status in ('unknown','healthy','degraded','offline','paused')),
  auth_strategy text not null default 'independent'
    check (auth_strategy in ('independent','sso','api_only','none','other')),
  last_health_checked_at timestamptz,
  last_health_status_code integer,
  last_health_detail text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, system_key)
);

create index if not exists company_systems_company_idx
  on public.company_systems (company_id, created_at desc);

create index if not exists company_systems_status_idx
  on public.company_systems (status, environment, updated_at desc);

comment on table public.company_systems is
  'Metadados dos sistemas externos conectados a cada empresa. Não armazenar tokens, senhas ou connection strings.';

comment on column public.company_systems.metadata is
  'Somente metadados não sensíveis e configurações públicas/operacionais.';
