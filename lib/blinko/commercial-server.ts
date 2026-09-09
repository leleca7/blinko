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

export function isCommercialSchemaPending(error: unknown) {
  return ["42P01", "42703", "42883"].includes(errorCode(error));
}

function records(value: unknown) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") as Record<string, unknown>[] : [];
}

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export async function getCommercialPipeline() {
  const sql = getSql();
  try {
    const [rows, summaryRows] = await Promise.all([
      sql`select to_jsonb(p) as result from public.commercial_pipeline p order by case when p.outcome_status is null then 0 else 1 end, p.next_action_at nulls last, p.created_at desc`,
      sql`select to_jsonb(s) as result from public.commercial_pipeline_summary s order by s.pipeline_stage,s.outcome_status nulls first`,
    ]);
    return { schemaReady: true, opportunities: rows.map((row) => record(row.result)).filter(Boolean) as Record<string, unknown>[], summary: summaryRows.map((row) => record(row.result)).filter(Boolean) as Record<string, unknown>[] };
  } catch (error) {
    if (isCommercialSchemaPending(error)) return { schemaReady: false, opportunities: [], summary: [] };
    throw error;
  }
}

export async function getCommercialOpportunity(opportunityId: string) {
  const sql = getSql();
  try {
    const rows = await sql`
      select jsonb_build_object(
        'opportunity',to_jsonb(p),
        'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.occurred_at desc) from public.commercial_opportunity_events e where e.opportunity_id=p.id),'[]'::jsonb)
      ) as result
      from public.commercial_pipeline p where p.id=${opportunityId}::uuid limit 1
    `;
    const result = record(rows[0]?.result);
    return { schemaReady: true, opportunity: record(result?.opportunity), events: records(result?.events) };
  } catch (error) {
    if (isCommercialSchemaPending(error)) return { schemaReady: false, opportunity: null, events: [] };
    throw error;
  }
}

export async function updateCommercialStage(input: { opportunityId: string; stage: string; ownerLabel: string; nextActionTitle: string; nextActionAt: string | null; nextActionChannel: string; notes: string; actorLabel: string }) {
  const sql = getSql();
  const rows = await sql`select public.set_commercial_opportunity_stage(${input.opportunityId}::uuid,${input.stage},${input.ownerLabel},${input.nextActionTitle},${input.nextActionAt}::timestamptz,${input.nextActionChannel},${input.notes},${input.actorLabel}) as result`;
  return String(rows[0]?.result ?? "");
}

export async function recordCommercialInteraction(input: { opportunityId: string; channel: string; summary: string; nextActionTitle: string; nextActionAt: string | null; nextActionChannel: string; actorLabel: string }) {
  const sql = getSql();
  const rows = await sql`select public.record_commercial_interaction(${input.opportunityId}::uuid,${input.channel},${input.summary},${input.nextActionTitle},${input.nextActionAt}::timestamptz,${input.nextActionChannel},${input.actorLabel}) as result`;
  return String(rows[0]?.result ?? "");
}

export async function closeCommercialOpportunity(input: { opportunityId: string; outcome: string; lossReason: string | null; lossNotes: string; actorLabel: string }) {
  const sql = getSql();
  const rows = await sql`select public.close_commercial_opportunity(${input.opportunityId}::uuid,${input.outcome},${input.lossReason},${input.lossNotes},${input.actorLabel}) as result`;
  return String(rows[0]?.result ?? "");
}
