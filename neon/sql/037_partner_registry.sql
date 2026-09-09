-- Blinko OS — Cadastro geral de Parceiros
-- Fonte: Documento 04 — Catálogo de Soluções e Parceiros, seções 17–19.
-- Depende de 030–036.
-- Produção/main não deve receber esta migração sem promoção controlada.

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  official_code text unique,
  legal_name text,
  trade_name text not null,
  area text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  city_region text,
  required_documents jsonb not null default '[]'::jsonb,
  capacity_notes text,
  base_lead_time text,
  cost_table_reference text,
  cost_table_valid_until date,
  payment_terms text,
  urgency_policy text,
  change_policy text,
  error_responsibility text,
  warranty_reexecution_policy text,
  cancellation_policy text,
  logistics_policy text,
  technical_requirements text,
  confidentiality_notes text,
  client_direct_contact_policy text not null default 'to_define'
    check (client_direct_contact_policy in ('allowed','restricted','not_allowed','to_define')),
  client_recurrence_policy text,
  internal_owner_label text,
  status text not null default 'prospected'
    check (status in ('prospected','validating','pilot','active','restricted','suspended','inactive')),
  official_status_label text,
  registration_status text not null default 'pending'
    check (registration_status in ('pending','partial','complete')),
  technical_validation_status text not null default 'pending'
    check (technical_validation_status in ('pending','in_review','validated','not_applicable')),
  commercial_validation_status text not null default 'pending'
    check (commercial_validation_status in ('pending','in_review','validated','not_applicable')),
  pilot_controlled boolean not null default false,
  quality_evaluation text,
  occurrences jsonb not null default '[]'::jsonb,
  last_reviewed_at timestamptz,
  source_document text not null default '04 — BLINKO — CATÁLOGO DE SOLUÇÕES E PARCEIROS',
  source_version text not null default 'v1.0 — 09/09/2026',
  created_by_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (nullif(trim(trade_name),'') is not null),
  check (nullif(trim(area),'') is not null)
);

create index if not exists partners_status_idx on public.partners(status,registration_status,updated_at desc);
create index if not exists partners_trade_name_idx on public.partners(lower(trade_name));

create table if not exists public.partner_solution_capabilities (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  blueprint_id uuid not null references public.solution_blueprints(id) on delete restrict,
  status text not null default 'candidate'
    check (status in ('candidate','pilot','enabled','restricted','suspended')),
  capability_notes text,
  region_scope text,
  valid_from date,
  valid_until date,
  approved_by_label text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(partner_id,blueprint_id)
);

create index if not exists partner_solution_capabilities_partner_idx
  on public.partner_solution_capabilities(partner_id,status);
create index if not exists partner_solution_capabilities_solution_idx
  on public.partner_solution_capabilities(blueprint_id,status);

create or replace function public.partner_operational_eligibility(p_partner_id uuid)
returns text
language plpgsql
stable
set search_path=public
as $$
declare
  v_partner public.partners%rowtype;
begin
  select * into v_partner from public.partners where id=p_partner_id;
  if not found then return 'not_found'; end if;

  if v_partner.status in ('suspended','inactive') then return 'blocked'; end if;
  if v_partner.registration_status='pending' then return 'registration_pending'; end if;

  if v_partner.status='active'
     and v_partner.registration_status='complete'
     and v_partner.technical_validation_status in ('validated','not_applicable')
     and v_partner.commercial_validation_status in ('validated','not_applicable') then
    return 'eligible';
  end if;

  if v_partner.status='pilot' and v_partner.pilot_controlled then
    return 'pilot_requires_project_approval';
  end if;

  if v_partner.status='restricted' then
    return 'restricted_requires_scope_check';
  end if;

  return 'validation_incomplete';
end;
$$;

create or replace view public.partner_registry_summary as
select
  p.*,
  public.partner_operational_eligibility(p.id) as operational_eligibility,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'capability_id',pc.id,
      'solution_code',sb.official_code,
      'solution_name',sb.name,
      'status',pc.status,
      'notes',pc.capability_notes,
      'region_scope',pc.region_scope,
      'valid_from',pc.valid_from,
      'valid_until',pc.valid_until
    ) order by sb.official_code)
    from public.partner_solution_capabilities pc
    join public.solution_blueprints sb on sb.id=pc.blueprint_id
    where pc.partner_id=p.id
  ),'[]'::jsonb) as capabilities
from public.partners p;

-- Parceiros explicitamente registrados no Documento 04.
insert into public.partners(
  official_code,legal_name,trade_name,area,status,official_status_label,registration_status,
  technical_validation_status,commercial_validation_status,pilot_controlled,capacity_notes,
  created_by_label
) values
(
  'P01',null,'Hélio — Produção Gráfica','Produção gráfica e produtos relacionados à capacidade confirmada',
  'pilot','EM VALIDAÇÃO / PILOTO CONTROLADO','partial','in_review','in_review',true,
  'Catálogo, custos, prazos, quantidades, acabamentos, requisitos técnicos, logística, erro/reimpressão, cancelamento, regra final de divisão/repasse, recorrência e teste ponta a ponta ainda exigem validação.',
  'migration-037'
),
(
  'P02',null,'Parceira Audiovisual — cadastro pendente','Fotografia, captação e edição audiovisual conforme demanda',
  'pilot','CADASTRO PENDENTE / PILOTO','pending','in_review','pending',true,
  'Nome/cadastro oficial, portfólio, tabela, disponibilidade, deslocamento, equipamentos, formatos, prazos, revisões, direitos de uso, arquivos brutos, cancelamento e regra comercial ainda estão pendentes.',
  'migration-037'
)
on conflict (official_code) do nothing;

-- Capacidades explicitamente sustentadas pelo Documento 04.
insert into public.partner_solution_capabilities(partner_id,blueprint_id,status,capability_notes)
select p.id,sb.id,'pilot','Parceiro citado nominalmente na solução S24; uso somente controlado enquanto validação técnica/comercial estiver incompleta.'
from public.partners p join public.solution_blueprints sb on sb.official_code='S24'
where p.official_code='P01'
on conflict (partner_id,blueprint_id) do nothing;

insert into public.partner_solution_capabilities(partner_id,blueprint_id,status,capability_notes)
select p.id,sb.id,'pilot','Frente audiovisual prevista no Documento 04; cadastro e condições ainda pendentes.'
from public.partners p join public.solution_blueprints sb on sb.official_code in ('S20','S21')
where p.official_code='P02'
on conflict (partner_id,blueprint_id) do nothing;
