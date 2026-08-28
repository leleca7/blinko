import { neon } from "@neondatabase/serverless";

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("neon_not_configured");
  return neon(databaseUrl);
}

export type SolutionKitItem = {
  id: string;
  blueprint_id: string;
  position: number;
  required: boolean;
  default_config: Record<string, unknown>;
  notes: string | null;
  blueprint: {
    slug: string;
    name: string;
    category: string;
    status: string;
    version: string;
    customization_level: string;
  };
};

export type SolutionKit = {
  id: string;
  slug: string;
  name: string;
  category: string;
  summary: string | null;
  status: string;
  version: string;
  ideal_profiles: unknown[];
  deliverables: unknown[];
  setup_checklist: unknown[];
  notes: string | null;
  selected_companies: number;
  items: SolutionKitItem[];
};

export type CompanyImplementationPlan = {
  id: string;
  company_id: string;
  kit_id: string | null;
  name: string;
  status: string;
  visual_direction_id: string | null;
  objective: string | null;
  customizations: Record<string, unknown>;
  approved_by_label: string | null;
  approved_at: string | null;
  created_at: string;
  kit: { slug: string; name: string; version: string } | null;
  visual_direction: { slug: string; name: string; version: string } | null;
  items: Array<{
    id: string;
    status: string;
    position: number;
    selected_version: string | null;
    blueprint: { slug: string; name: string; category: string; version: string };
  }>;
};

export async function getSolutionKits() {
  const sql = getSql();
  const rows = await sql`
    select
      k.*,
      (
        select count(distinct p.company_id)::int
        from public.company_implementation_plans p
        where p.kit_id = k.id and p.status <> 'cancelled'
      ) as selected_companies,
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', i.id,
              'blueprint_id', i.blueprint_id,
              'position', i.position,
              'required', i.required,
              'default_config', i.default_config,
              'notes', i.notes,
              'blueprint', jsonb_build_object(
                'slug', b.slug,
                'name', b.name,
                'category', b.category,
                'status', b.status,
                'version', b.version,
                'customization_level', b.customization_level
              )
            ) order by i.position, i.created_at
          )
          from public.solution_kit_items i
          join public.solution_blueprints b on b.id = i.blueprint_id
          where i.kit_id = k.id
        ),
        '[]'::jsonb
      ) as items
    from public.solution_kits k
    order by
      case k.status when 'ready' then 0 when 'beta' then 1 when 'draft' then 2 else 3 end,
      k.category,
      k.name
  `;
  return rows as unknown as SolutionKit[];
}

export async function getSolutionKit(slug: string) {
  const kits = await getSolutionKits();
  return kits.find((kit) => kit.slug === slug) ?? null;
}

export async function getCompanyImplementationPlans(companyId: string) {
  const sql = getSql();
  const rows = await sql`
    select
      p.id,
      p.company_id,
      p.kit_id,
      p.name,
      p.status,
      p.visual_direction_id,
      p.objective,
      p.customizations,
      p.approved_by_label,
      p.approved_at,
      p.created_at,
      case when k.id is null then null else jsonb_build_object(
        'slug', k.slug,
        'name', k.name,
        'version', k.version
      ) end as kit,
      case when v.id is null then null else jsonb_build_object(
        'slug', v.slug,
        'name', v.name,
        'version', v.version
      ) end as visual_direction,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', pi.id,
            'status', pi.status,
            'position', pi.position,
            'selected_version', pi.selected_version,
            'blueprint', jsonb_build_object(
              'slug', b.slug,
              'name', b.name,
              'category', b.category,
              'version', b.version
            )
          ) order by pi.position, pi.created_at
        ) filter (where pi.id is not null),
        '[]'::jsonb
      ) as items
    from public.company_implementation_plans p
    left join public.solution_kits k on k.id = p.kit_id
    left join public.visual_directions v on v.id = p.visual_direction_id
    left join public.company_implementation_plan_items pi on pi.plan_id = p.id
    left join public.solution_blueprints b on b.id = pi.blueprint_id
    where p.company_id = ${companyId}::uuid
    group by p.id, k.id, v.id
    order by p.created_at desc
  `;
  return rows as unknown as CompanyImplementationPlan[];
}
