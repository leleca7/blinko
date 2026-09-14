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

export function isDirectSalesSchemaPending(error: unknown) {
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

export type DirectOpportunityWorkspace = {
  schemaReady: boolean;
  opportunity: Record<string, unknown> | null;
  lead: Record<string, unknown> | null;
  company: Record<string, unknown> | null;
  currentQuote: Record<string, unknown> | null;
  externalEvents: Record<string, unknown>[];
  project: Record<string, unknown> | null;
};

export async function listDirectOpportunities() {
  const sql = getSql();
  try {
    const rows = await sql`
      select
        o.id,
        o.status,
        o.opportunity_type,
        o.product_code,
        o.source,
        o.created_at,
        l.name as lead_name,
        l.company_name,
        l.whatsapp,
        p.id as project_id,
        p.status as project_status
      from public.direct_opportunities o
      join public.leads l on l.id = o.lead_id
      left join public.projects p on p.direct_opportunity_id = o.id
      order by
        case o.status
          when 'paid' then 0
          when 'accepted' then 1
          when 'awaiting_payment' then 2
          when 'negotiation' then 3
          when 'quoted' then 4
          when 'ready_to_quote' then 5
          when 'qualifying' then 6
          when 'new' then 7
          else 8
        end,
        o.created_at desc
      limit 100
    `;
    return { schemaReady: true, opportunities: rows as Record<string, unknown>[] };
  } catch (error) {
    if (isDirectSalesSchemaPending(error)) return { schemaReady: false, opportunities: [] as Record<string, unknown>[] };
    throw error;
  }
}

export async function getDirectOpportunityWorkspace(opportunityId: string): Promise<DirectOpportunityWorkspace> {
  const sql = getSql();
  try {
    const rows = await sql`
      select jsonb_build_object(
        'opportunity', to_jsonb(o),
        'lead', to_jsonb(l),
        'company', case when c.id is null then null else to_jsonb(c) end,
        'current_quote', case when q.id is null then null else to_jsonb(q) end,
        'external_events', coalesce((
          select jsonb_agg(to_jsonb(e) order by e.occurred_at desc)
          from public.direct_opportunity_external_events e
          where e.opportunity_id = o.id
        ), '[]'::jsonb),
        'project', (
          select to_jsonb(p)
          from public.projects p
          where p.direct_opportunity_id = o.id
          limit 1
        )
      ) as result
      from public.direct_opportunities o
      join public.leads l on l.id = o.lead_id
      left join public.companies c on c.id = o.company_id
      left join public.direct_opportunity_quote_versions q on q.id = o.current_quote_version_id
      where o.id = ${opportunityId}::uuid
      limit 1
    `;
    const result = rows[0]?.result as Record<string, unknown> | undefined;
    return {
      schemaReady: true,
      opportunity: record(result?.opportunity),
      lead: record(result?.lead),
      company: record(result?.company),
      currentQuote: record(result?.current_quote),
      externalEvents: records(result?.external_events),
      project: record(result?.project),
    };
  } catch (error) {
    if (isDirectSalesSchemaPending(error)) {
      return { schemaReady: false, opportunity: null, lead: null, company: null, currentQuote: null, externalEvents: [], project: null };
    }
    throw error;
  }
}

export async function markDirectOpportunityReadyToQuote(input: {
  opportunityId: string;
  actorLabel: string;
  notes?: string;
}) {
  const sql = getSql();
  const rows = await sql`
    select public.mark_direct_opportunity_ready_to_quote(
      ${input.opportunityId}::uuid,
      ${input.actorLabel},
      null::jsonb,
      ${input.notes ?? ""}
    ) as result
  `;
  return rows[0]?.result as string;
}

export async function recordDirectOpportunityQuote(input: {
  opportunityId: string;
  actorLabel: string;
  scope: string;
  clientResponsibilities?: string;
  timeframe: string;
  investment: string;
  conditions: string;
  validity: string;
  risksLimits?: string;
}) {
  const sql = getSql();
  const rows = await sql`
    select public.record_direct_opportunity_quote(
      ${input.opportunityId}::uuid,
      ${input.actorLabel},
      ${input.scope},
      ${input.clientResponsibilities ?? ""},
      ${input.timeframe},
      ${input.investment},
      ${input.conditions},
      ${input.validity},
      ${input.risksLimits ?? ""}
    ) as result
  `;
  return rows[0]?.result as string;
}

export async function recordDirectOpportunityExternalEvent(input: {
  opportunityId: string;
  actorLabel: string;
  eventType: string;
  channel?: string;
  externalReference: string;
  notes?: string;
  occurredAt?: string | null;
}) {
  const sql = getSql();
  const occurredAt = input.occurredAt || null;
  const rows = await sql`
    select public.record_direct_opportunity_external_event(
      ${input.opportunityId}::uuid,
      ${input.actorLabel},
      ${input.eventType},
      ${input.channel ?? ""},
      ${input.externalReference},
      ${input.notes ?? ""},
      coalesce(${occurredAt}::timestamptz, now())
    ) as result
  `;
  return rows[0]?.result as string;
}
