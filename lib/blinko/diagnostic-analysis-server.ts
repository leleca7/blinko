import "server-only";

import { neon } from "@neondatabase/serverless";

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("neon_not_configured");
  return databaseUrl;
}

function getSql() {
  return neon(getDatabaseUrl());
}

function errorCode(error: unknown) {
  if (!error || typeof error !== "object") return "";
  return typeof (error as { code?: unknown }).code === "string"
    ? String((error as { code?: string }).code)
    : "";
}

export function isDiagnosticAnalysisSchemaPending(error: unknown) {
  return ["42P01", "42703", "42883"].includes(errorCode(error));
}

export type DiagnosticAnalysisContext = {
  schemaReady: boolean;
  diagnostic: Record<string, unknown> | null;
  collection: Record<string, unknown> | null;
  currentAnalysis: Record<string, unknown> | null;
  currentReview: Record<string, unknown> | null;
};

export async function getDiagnosticAnalysisContext(diagnosticId: string): Promise<DiagnosticAnalysisContext> {
  const sql = getSql();
  try {
    const rows = await sql`
      select jsonb_build_object(
        'diagnostic', to_jsonb(d),
        'collection', case when cv.id is null then null else to_jsonb(cv) end,
        'current_analysis', case when ar.id is null then null else to_jsonb(ar) end,
        'current_review', case when rv.id is null then null else to_jsonb(rv) end
      ) as result
      from public.diagnostics d
      left join public.diagnostic_collection_versions cv on cv.id = d.current_collection_version_id
      left join public.diagnostic_analysis_runs ar on ar.id = d.current_analysis_run_id
      left join public.diagnostic_analysis_review_versions rv on rv.id = d.current_analysis_review_id
      where d.id = ${diagnosticId}::uuid
      limit 1
    `;

    const result = rows[0]?.result as Record<string, unknown> | undefined;
    const record = (value: unknown) => value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;

    return {
      schemaReady: true,
      diagnostic: record(result?.diagnostic),
      collection: record(result?.collection),
      currentAnalysis: record(result?.current_analysis),
      currentReview: record(result?.current_review),
    };
  } catch (error) {
    if (isDiagnosticAnalysisSchemaPending(error)) {
      return { schemaReady: false, diagnostic: null, collection: null, currentAnalysis: null, currentReview: null };
    }
    throw error;
  }
}

export async function recordDiagnosticAnalysis(input: {
  diagnosticId: string;
  collectionVersionId: string;
  status: "processing" | "ready" | "failed";
  provider?: string;
  model?: string;
  promptVersion: string;
  inputSnapshot: Record<string, unknown>;
  output?: Record<string, unknown> | null;
  errorCode?: string | null;
  errorDetail?: string | null;
}) {
  const sql = getSql();
  const rows = await sql`
    select public.record_diagnostic_analysis(
      ${input.diagnosticId}::uuid,
      ${input.collectionVersionId}::uuid,
      ${input.status},
      ${input.provider ?? ""},
      ${input.model ?? ""},
      ${input.promptVersion},
      ${JSON.stringify(input.inputSnapshot)}::jsonb,
      ${input.output ? JSON.stringify(input.output) : null}::jsonb,
      ${input.errorCode ?? null},
      ${input.errorDetail ?? null}
    ) as result
  `;
  return rows[0]?.result as string;
}

export async function recordManualDiagnosticAnalysis(input: {
  diagnosticId: string;
  collectionVersionId: string;
  actorLabel: string;
  inputSnapshot: Record<string, unknown>;
  output: Record<string, unknown>;
}) {
  const sql = getSql();
  const rows = await sql`
    select public.record_manual_diagnostic_analysis(
      ${input.diagnosticId}::uuid,
      ${input.collectionVersionId}::uuid,
      ${input.actorLabel},
      ${JSON.stringify(input.inputSnapshot)}::jsonb,
      ${JSON.stringify(input.output)}::jsonb
    ) as result
  `;
  return rows[0]?.result as string;
}

export async function recordDiagnosticAnalysisReview(input: {
  diagnosticId: string;
  analysisRunId: string;
  reviewerLabel: string;
  decision: Record<string, unknown>;
}) {
  const sql = getSql();
  const rows = await sql`
    select public.record_diagnostic_analysis_review(
      ${input.diagnosticId}::uuid,
      ${input.analysisRunId}::uuid,
      ${input.reviewerLabel},
      ${JSON.stringify(input.decision)}::jsonb
    ) as result
  `;
  return rows[0]?.result as string;
}
