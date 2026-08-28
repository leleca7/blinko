import { neon } from "@neondatabase/serverless";

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("neon_not_configured");
  return neon(databaseUrl);
}

export type SolutionBlueprint = {
  id: string;
  slug: string;
  name: string;
  category: string;
  problem_statement: string | null;
  summary: string | null;
  status: string;
  customization_level: string;
  version: string;
  source_repository_url: string | null;
  drive_document_url: string | null;
  modules: unknown[];
  optional_integrations: unknown[];
  required_config: unknown[];
  implementation_checklist: unknown[];
  ideal_profiles: unknown[];
  notes: string | null;
  selected_companies?: number;
};

export type CompanySolution = {
  id: string;
  company_id: string;
  blueprint_id: string;
  status: string;
  selected_version: string | null;
  customizations: Record<string, unknown>;
  notes: string | null;
  selected_by_label: string | null;
  selected_at: string;
  blueprint: Pick<SolutionBlueprint, "slug" | "name" | "category" | "status" | "version">;
  visual_direction: null | {
    slug: string;
    name: string;
    status: string;
    version: string;
  };
};

export async function getSolutionCatalog() {
  const sql = getSql();
  const rows = await sql`
    select
      b.*,
      count(cs.id)::int as selected_companies
    from public.solution_blueprints b
    left join public.company_solutions cs on cs.blueprint_id = b.id and cs.status <> 'retired'
    group by b.id
    order by
      case b.status when 'ready' then 0 when 'beta' then 1 when 'draft' then 2 else 3 end,
      b.category,
      b.name
  `;
  return rows as SolutionBlueprint[];
}

export async function getSolutionBlueprint(slug: string) {
  const sql = getSql();
  const rows = await sql`
    select
      b.*,
      count(cs.id)::int as selected_companies
    from public.solution_blueprints b
    left join public.company_solutions cs on cs.blueprint_id = b.id and cs.status <> 'retired'
    where b.slug = ${slug}
    group by b.id
    limit 1
  `;
  return (rows[0] ?? null) as SolutionBlueprint | null;
}

export async function getCompanySolutions(companyId: string) {
  const sql = getSql();
  const rows = await sql`
    select
      cs.id,
      cs.company_id,
      cs.blueprint_id,
      cs.status,
      cs.selected_version,
      cs.customizations,
      cs.notes,
      cs.selected_by_label,
      cs.selected_at,
      jsonb_build_object(
        'slug', b.slug,
        'name', b.name,
        'category', b.category,
        'status', b.status,
        'version', b.version
      ) as blueprint,
      case when vd.id is null then null else jsonb_build_object(
        'slug', vd.slug,
        'name', vd.name,
        'status', vd.status,
        'version', vd.version
      ) end as visual_direction
    from public.company_solutions cs
    join public.solution_blueprints b on b.id = cs.blueprint_id
    left join public.visual_directions vd on vd.id = cs.visual_direction_id
    where cs.company_id = ${companyId}::uuid
    order by cs.selected_at desc
  `;
  return rows as CompanySolution[];
}
