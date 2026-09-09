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

export async function getCommercialTodayActions() {
  const sql = getSql();
  try {
    const rows = await sql`
      select jsonb_build_object(
        'opportunity_id',p.id,
        'source','commercial_opportunity',
        'bucket','do_now',
        'action_id',p.id,
        'action_type','commercial_next_action',
        'status','pending',
        'priority',case when p.health='overdue' and p.fit='high' then 'urgent' when p.health='overdue' or p.fit='high' then 'high' when p.fit='medium' then 'normal' else 'low' end,
        'title',p.next_action_title,
        'due_at',p.next_action_at,
        'created_at',p.created_at,
        'lead_id',p.lead_id,
        'pre_diagnostic_id',p.pre_diagnostic_id,
        'lead_name',p.contact_name,
        'company_name',coalesce(p.company_name,p.lead_company_name),
        'commercial_score',p.commercial_score,
        'lead_status','',
        'ai_analysis_status',null,
        'human_review_status',null,
        'project_id',p.project_id,
        'project_status',coalesce(p.project_status,''),
        'responsible_label',p.owner_label,
        'pipeline_stage',p.pipeline_stage
      ) as result
      from public.commercial_pipeline p
      where p.outcome_status is null
        and p.pipeline_stage not in ('P00','P14')
        and p.next_action_title is not null
        and p.next_action_at is not null
      order by case when p.next_action_at < now() then 0 else 1 end,p.next_action_at,p.created_at
    `;
    return { schemaReady: true, actions: rows.map((row) => record(row.result)).filter(Boolean) as Record<string, unknown>[] };
  } catch (error) {
    if (isCommercialSchemaPending(error)) return { schemaReady: false, actions: [] };
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
