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

export function isDiagnosticStrategySchemaPending(error: unknown) {
  return ["42P01", "42703", "42883"].includes(errorCode(error));
}

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function records(value: unknown) {
  return Array.isArray(value) ? value.map(record).filter(Boolean) as Record<string, unknown>[] : [];
}

export type DiagnosticStrategyContext = {
  schemaReady: boolean;
  diagnostic: Record<string, unknown> | null;
  currentReview: Record<string, unknown> | null;
  problems: Record<string, unknown>[];
  causes: Record<string, unknown>[];
  priorities: Record<string, unknown>[];
  interventions: Record<string, unknown>[];
};

export async function getDiagnosticStrategyContext(diagnosticId: string): Promise<DiagnosticStrategyContext> {
  const sql = getSql();

  try {
    const rows = await sql`
      select jsonb_build_object(
        'diagnostic', to_jsonb(d),
        'current_review', case when rv.id is null then null else to_jsonb(rv) end,
        'problems', coalesce((
          select jsonb_agg(to_jsonb(p) order by p.created_at desc)
          from public.diagnostic_problems p
          where p.diagnostic_id = d.id
        ), '[]'::jsonb),
        'causes', coalesce((
          select jsonb_agg(to_jsonb(c) order by c.created_at desc)
          from public.diagnostic_causes c
          where c.diagnostic_id = d.id
        ), '[]'::jsonb),
        'priorities', coalesce((
          select jsonb_agg(to_jsonb(pr) order by pr.sequence_position asc, pr.created_at asc)
          from public.diagnostic_priorities pr
          where pr.diagnostic_id = d.id
        ), '[]'::jsonb),
        'interventions', coalesce((
          select jsonb_agg(to_jsonb(i) order by i.created_at desc)
          from public.diagnostic_interventions i
          where i.diagnostic_id = d.id
        ), '[]'::jsonb)
      ) as result
      from public.diagnostics d
      left join public.diagnostic_analysis_review_versions rv on rv.id = d.current_analysis_review_id
      where d.id = ${diagnosticId}::uuid
      limit 1
    `;

    const result = rows[0]?.result as Record<string, unknown> | undefined;
    return {
      schemaReady: true,
      diagnostic: record(result?.diagnostic),
      currentReview: record(result?.current_review),
      problems: records(result?.problems),
      causes: records(result?.causes),
      priorities: records(result?.priorities),
      interventions: records(result?.interventions),
    };
  } catch (error) {
    if (isDiagnosticStrategySchemaPending(error)) {
      return {
        schemaReady: false,
        diagnostic: null,
        currentReview: null,
        problems: [],
        causes: [],
        priorities: [],
        interventions: [],
      };
    }
    throw error;
  }
}

export async function recordDiagnosticStrategyBundle(input: {
  diagnosticId: string;
  analysisReviewId: string;
  actorLabel: string;
  problem: Record<string, unknown>;
  cause: Record<string, unknown>;
  priority: Record<string, unknown>;
  intervention: Record<string, unknown>;
}) {
  const sql = getSql();
  const rows = await sql`
    select public.record_diagnostic_strategy_bundle(
      ${input.diagnosticId}::uuid,
      ${input.analysisReviewId}::uuid,
      ${input.actorLabel},
      ${JSON.stringify(input.problem)}::jsonb,
      ${JSON.stringify(input.cause)}::jsonb,
      ${JSON.stringify(input.priority)}::jsonb,
      ${JSON.stringify(input.intervention)}::jsonb
    ) as result
  `;
  return rows[0]?.result as Record<string, unknown>;
}

export async function finalizeDiagnosticStrategy(input: {
  diagnosticId: string;
  actorLabel: string;
}) {
  const sql = getSql();
  const rows = await sql`
    select public.finalize_diagnostic_strategy(
      ${input.diagnosticId}::uuid,
      ${input.actorLabel}
    ) as result
  `;
  return rows[0]?.result as string;
}
