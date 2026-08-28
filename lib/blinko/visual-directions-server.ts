import { neon } from "@neondatabase/serverless";

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("neon_not_configured");
  return neon(databaseUrl);
}

export type VisualDirection = {
  id: string;
  slug: string;
  name: string;
  positioning: string | null;
  description: string | null;
  status: string;
  version: string;
  mood_keywords: unknown[];
  typography_guidance: unknown[];
  palette_guidance: unknown[];
  composition_guidance: unknown[];
  image_guidance: unknown[];
  motion_guidance: unknown[];
  component_guidance: unknown[];
  avoid_patterns: unknown[];
  reference_notes: string | null;
  selected_companies?: number;
};

export async function getVisualDirections() {
  const sql = getSql();
  const rows = await sql`
    select
      d.*,
      count(cs.id)::int as selected_companies
    from public.visual_directions d
    left join public.company_solutions cs
      on cs.visual_direction_id = d.id and cs.status <> 'retired'
    group by d.id
    order by
      case d.status when 'ready' then 0 when 'beta' then 1 when 'draft' then 2 else 3 end,
      d.name
  `;
  return rows as VisualDirection[];
}

export async function getVisualDirection(slug: string) {
  const sql = getSql();
  const rows = await sql`
    select
      d.*,
      count(cs.id)::int as selected_companies
    from public.visual_directions d
    left join public.company_solutions cs
      on cs.visual_direction_id = d.id and cs.status <> 'retired'
    where d.slug = ${slug}
    group by d.id
    limit 1
  `;
  return (rows[0] ?? null) as VisualDirection | null;
}
