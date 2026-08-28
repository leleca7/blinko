-- Blinko OS — Criação atômica de plano de implantação a partir de kit
-- Depende de 014_solution_kits_implementation_plans.sql.

alter table public.company_implementation_plans
  add column if not exists created_by_label text;

create or replace function public.create_company_implementation_plan_from_kit(
  p_company_id uuid,
  p_kit_id uuid,
  p_name text,
  p_visual_direction_id uuid default null,
  p_objective text default null,
  p_actor_label text default 'internal'
)
returns uuid
language sql
as '
with eligible as (
  select
    p_company_id as company_id,
    p_kit_id as kit_id,
    nullif(btrim(coalesce(p_name, '''')), '''') as plan_name,
    p_visual_direction_id as visual_direction_id,
    nullif(btrim(coalesce(p_objective, '''')), '''') as objective,
    coalesce(nullif(btrim(coalesce(p_actor_label, '''')), ''''), ''internal'') as actor_label
  where nullif(btrim(coalesce(p_name, '''')), '''') is not null
    and exists (
      select 1
      from public.companies c
      where c.id = p_company_id
        and c.relationship_status <> ''closed''
    )
    and exists (
      select 1
      from public.solution_kits k
      where k.id = p_kit_id
        and k.status <> ''retired''
    )
    and exists (
      select 1
      from public.solution_kit_items i
      where i.kit_id = p_kit_id
    )
    and (
      p_visual_direction_id is null
      or exists (
        select 1
        from public.visual_directions v
        where v.id = p_visual_direction_id
          and v.status <> ''retired''
      )
    )
),
inserted_plan as (
  insert into public.company_implementation_plans (
    company_id,
    kit_id,
    name,
    status,
    visual_direction_id,
    objective,
    customizations,
    created_by_label
  )
  select
    e.company_id,
    e.kit_id,
    e.plan_name,
    ''draft'',
    e.visual_direction_id,
    e.objective,
    ''{}''::jsonb,
    e.actor_label
  from eligible e
  returning id
),
inserted_items as (
  insert into public.company_implementation_plan_items (
    plan_id,
    blueprint_id,
    source_kit_item_id,
    position,
    status,
    selected_version,
    customizations,
    notes
  )
  select
    p.id,
    i.blueprint_id,
    i.id,
    i.position,
    ''planned'',
    b.version,
    i.default_config,
    i.notes
  from inserted_plan p
  join public.solution_kit_items i on i.kit_id = p_kit_id
  join public.solution_blueprints b on b.id = i.blueprint_id
  order by i.position, i.created_at
  returning plan_id
)
select p.id
from inserted_plan p
where (
  select count(*) from inserted_items
) = (
  select count(*) from public.solution_kit_items i where i.kit_id = p_kit_id
)
';

comment on function public.create_company_implementation_plan_from_kit(uuid, uuid, text, uuid, text, text) is
  'Cria um plano draft e copia atomicamente os itens versionados do kit. Não aprova, publica nem ativa soluções.';
