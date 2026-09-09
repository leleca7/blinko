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

export function isProjectExtensionsSchemaPending(error: unknown) {
  return ["42P01", "42703", "42883"].includes(errorCode(error));
}

function records(value: unknown) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") as Record<string, unknown>[] : [];
}

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export type ProjectExtensions = {
  schemaReady: boolean;
  driveItems: Record<string, unknown>[];
  approvals: Record<string, unknown>[];
  finance: Record<string, unknown> | null;
  closure: Record<string, unknown> | null;
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
        ),
        'closure', (
          select to_jsonb(pc) from public.project_closures pc where pc.project_id = ${projectId}::uuid limit 1
        )
      ) as result
    `;
    const result = rows[0]?.result as Record<string, unknown> | undefined;
    return {
      schemaReady: true,
      driveItems: records(result?.drive_items),
      approvals: records(result?.approvals),
      finance: record(result?.finance),
      closure: record(result?.closure),
    };
  } catch (error) {
    if (isProjectExtensionsSchemaPending(error)) {
      return { schemaReady: false, driveItems: [], approvals: [], finance: null, closure: null };
    }
    throw error;
  }
}

export async function prepareProjectClosure(input: {
  projectId: string;
  actorLabel: string;
  deliverySummary: string;
  deliveryEvidenceReference: string;
  resultSummary: string;
  lessonsLearned: string;
  clientFeedbackStatus: string;
  clientFeedbackNotes?: string;
  financePendingNote?: string;
  nextStep: string;
  reassessmentRequired: boolean;
}) {
  const sql = getSql();
  const rows = await sql`
    select public.prepare_project_closure(
      ${input.projectId}::uuid,
      ${input.actorLabel},
      ${input.deliverySummary},
      ${input.deliveryEvidenceReference},
      ${input.resultSummary},
      ${input.lessonsLearned},
      ${input.clientFeedbackStatus},
      ${input.clientFeedbackNotes ?? ""},
      ${input.financePendingNote ?? ""},
      ${input.nextStep},
      ${input.reassessmentRequired}
    ) as result
  `;
  return rows[0]?.result as string;
}

export async function closeProject(input: { projectId: string; actorLabel: string }) {
  const sql = getSql();
  const rows = await sql`
    select public.close_project(${input.projectId}::uuid, ${input.actorLabel}) as result
  `;
  return rows[0]?.result as string;
}
