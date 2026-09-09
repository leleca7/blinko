import "server-only";

import { neon } from "@neondatabase/serverless";

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("neon_not_configured");
  return neon(databaseUrl);
}

function errorCode(error: unknown) {
  if (!error || typeof error !== "object") return "";
  return typeof (error as { code?: unknown }).code === "string" ? String((error as { code?: string }).code) : "";
}

function records(value: unknown) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") as Record<string, unknown>[] : [];
}

export type ProjectExtensions = {
  schemaReady: boolean;
  driveItems: Record<string, unknown>[];
  approvals: Record<string, unknown>[];
  finance: Record<string, unknown> | null;
};

export async function getProjectExtensions(projectId: string): Promise<ProjectExtensions> {
  const sql = getSql();
  try {
    const rows = await sql`
      select jsonb_build_object(
        'drive_items', coalesce((
          select jsonb_agg(to_jsonb(di) order by di.created_at asc)
          from public.drive_items di where di.project_id = ${projectId}::uuid and di.status = 'active'
        ), '[]'::jsonb),
        'approvals', coalesce((
          select jsonb_agg(to_jsonb(a) order by a.created_at desc)
          from public.approvals a where a.project_id = ${projectId}::uuid
        ), '[]'::jsonb),
        'finance', (
          select to_jsonb(fs) from public.project_financial_summary fs where fs.project_id = ${projectId}::uuid limit 1
        )
      ) as result
    `;
    const result = rows[0]?.result as Record<string, unknown> | undefined;
    const finance = result?.finance && typeof result.finance === "object" && !Array.isArray(result.finance)
      ? result.finance as Record<string, unknown>
      : null;
    return {
      schemaReady: true,
      driveItems: records(result?.drive_items),
      approvals: records(result?.approvals),
      finance,
    };
  } catch (error) {
    if (["42P01", "42703"].includes(errorCode(error))) {
      return { schemaReady: false, driveItems: [], approvals: [], finance: null };
    }
    throw error;
  }
}
