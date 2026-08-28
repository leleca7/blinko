import "server-only";

import { neon } from "@neondatabase/serverless";
import type { DiagnosticCollectionPayload } from "./diagnostic-collection";

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

export function isDiagnosticCollectionSchemaPending(error: unknown) {
  return ["42P01", "42703", "42883"].includes(errorCode(error));
}

export type DiagnosticWorkspace = {
  schemaReady: boolean;
  diagnostic: Record<string, unknown> | null;
  company: Record<string, unknown> | null;
  lead: Record<string, unknown> | null;
  preDiagnostic: Record<string, unknown> | null;
  currentCollection: Record<string, unknown> | null;
};

export async function getDiagnosticWorkspace(diagnosticId: string): Promise<DiagnosticWorkspace> {
  const sql = getSql();

  try {
    const rows = await sql`
      select jsonb_build_object(
        'diagnostic', to_jsonb(d),
        'company', case when c.id is null then null else to_jsonb(c) end,
        'lead', to_jsonb(l),
        'pre_diagnostic', case when pd.id is null then null else to_jsonb(pd) end,
        'current_collection', case when cv.id is null then null else to_jsonb(cv) end
      ) as result
      from public.diagnostics d
      join public.leads l on l.id = d.lead_id
      left join public.companies c on c.id = d.company_id
      left join public.pre_diagnostics pd on pd.id = d.pre_diagnostic_id
      left join public.diagnostic_collection_versions cv on cv.id = d.current_collection_version_id
      where d.id = ${diagnosticId}::uuid
      limit 1
    `;

    const result = rows[0]?.result as Record<string, unknown> | undefined;
    if (!result) {
      return {
        schemaReady: true,
        diagnostic: null,
        company: null,
        lead: null,
        preDiagnostic: null,
        currentCollection: null,
      };
    }

    const record = (value: unknown) => value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;

    return {
      schemaReady: true,
      diagnostic: record(result.diagnostic),
      company: record(result.company),
      lead: record(result.lead),
      preDiagnostic: record(result.pre_diagnostic),
      currentCollection: record(result.current_collection),
    };
  } catch (error) {
    if (isDiagnosticCollectionSchemaPending(error)) {
      return {
        schemaReady: false,
        diagnostic: null,
        company: null,
        lead: null,
        preDiagnostic: null,
        currentCollection: null,
      };
    }
    throw error;
  }
}

export async function recordDiagnosticCollectionVersion(input: {
  diagnosticId: string;
  actorLabel: string;
  payload: DiagnosticCollectionPayload;
}) {
  const sql = getSql();
  const rows = await sql`
    select public.record_diagnostic_collection_version(
      ${input.diagnosticId}::uuid,
      ${input.actorLabel},
      ${JSON.stringify(input.payload.company_context)}::jsonb,
      ${JSON.stringify(input.payload.pillars)}::jsonb,
      ${JSON.stringify(input.payload.general_evidence)}::jsonb,
      ${JSON.stringify(input.payload.missing_information)}::jsonb,
      ${input.payload.meeting_notes}
    ) as result
  `;
  return rows[0]?.result as string;
}

export async function advanceDiagnosticToAnalysis(input: {
  diagnosticId: string;
  actorLabel: string;
}) {
  const sql = getSql();
  const rows = await sql`
    select public.advance_diagnostic_to_analysis(
      ${input.diagnosticId}::uuid,
      ${input.actorLabel}
    ) as result
  `;
  return rows[0]?.result as string;
}
