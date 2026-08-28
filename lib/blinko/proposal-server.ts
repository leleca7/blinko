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

export function isProposalSchemaPending(error: unknown) {
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

export type ProposalContext = {
  schemaReady: boolean;
  diagnostic: Record<string, unknown> | null;
  company: Record<string, unknown> | null;
  proposal: Record<string, unknown> | null;
  currentVersion: Record<string, unknown> | null;
  availableInterventions: Record<string, unknown>[];
  versionCount: number;
};

export async function getProposalContext(diagnosticId: string): Promise<ProposalContext> {
  const sql = getSql();

  try {
    const rows = await sql`
      select jsonb_build_object(
        'diagnostic', to_jsonb(d),
        'company', case when c.id is null then null else to_jsonb(c) end,
        'proposal', case when p.id is null then null else to_jsonb(p) end,
        'current_version', case when pv.id is null then null else to_jsonb(pv) end,
        'available_interventions', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', i.id,
            'title', i.title,
            'objective', i.objective,
            'scope', i.scope,
            'status', i.status,
            'problem_id', i.problem_id,
            'problem_title', prb.title,
            'cause_id', i.cause_id,
            'cause_description', ca.description,
            'priority_id', i.priority_id,
            'priority_position', pri.sequence_position,
            'priority_rationale', pri.rationale
          ) order by pri.sequence_position asc, i.created_at asc)
          from public.diagnostic_interventions i
          join public.diagnostic_problems prb on prb.id = i.problem_id
          left join public.diagnostic_causes ca on ca.id = i.cause_id
          left join public.diagnostic_priorities pri on pri.id = i.priority_id
          where i.diagnostic_id = d.id
            and i.status in ('selected','approved_for_proposal')
        ), '[]'::jsonb),
        'version_count', coalesce((select count(*) from public.proposal_versions pvc where pvc.proposal_id = p.id), 0)
      ) as result
      from public.diagnostics d
      left join public.companies c on c.id = d.company_id
      left join public.proposals p on p.diagnostic_id = d.id
      left join public.proposal_versions pv on pv.id = p.current_version_id
      where d.id = ${diagnosticId}::uuid
      limit 1
    `;

    const result = rows[0]?.result as Record<string, unknown> | undefined;
    const versionCountRaw = result?.version_count;
    const versionCount = typeof versionCountRaw === "number" ? versionCountRaw : Number(versionCountRaw ?? 0);

    return {
      schemaReady: true,
      diagnostic: record(result?.diagnostic),
      company: record(result?.company),
      proposal: record(result?.proposal),
      currentVersion: record(result?.current_version),
      availableInterventions: records(result?.available_interventions),
      versionCount: Number.isFinite(versionCount) ? versionCount : 0,
    };
  } catch (error) {
    if (isProposalSchemaPending(error)) {
      return {
        schemaReady: false,
        diagnostic: null,
        company: null,
        proposal: null,
        currentVersion: null,
        availableInterventions: [],
        versionCount: 0,
      };
    }
    throw error;
  }
}

export async function recordDiagnosticPresentation(input: {
  diagnosticId: string;
  actorLabel: string;
  presentedAt: string;
  notes?: string;
}) {
  const sql = getSql();
  const rows = await sql`
    select public.record_diagnostic_presentation(
      ${input.diagnosticId}::uuid,
      ${input.actorLabel},
      ${input.presentedAt}::timestamptz,
      ${input.notes ?? ""}
    ) as result
  `;
  return rows[0]?.result as string;
}

export async function recordProposalVersion(input: {
  diagnosticId: string;
  actorLabel: string;
  interventionIds: string[];
  scope: string;
  blinkoResponsibilities: string;
  clientResponsibilities: string;
  timeframe: string;
  investment: string;
  conditions: string;
  validity: string;
  risksLimits: string;
}) {
  const sql = getSql();
  const rows = await sql`
    select public.record_proposal_version(
      ${input.diagnosticId}::uuid,
      ${input.actorLabel},
      ${JSON.stringify(input.interventionIds)}::jsonb,
      ${input.scope},
      ${input.blinkoResponsibilities},
      ${input.clientResponsibilities},
      ${input.timeframe},
      ${input.investment},
      ${input.conditions},
      ${input.validity},
      ${input.risksLimits}
    ) as result
  `;
  return rows[0]?.result as string;
}

export async function submitProposalForInternalReview(input: {
  proposalId: string;
  actorLabel: string;
}) {
  const sql = getSql();
  const rows = await sql`
    select public.submit_proposal_internal_review(
      ${input.proposalId}::uuid,
      ${input.actorLabel}
    ) as result
  `;
  return rows[0]?.result as string;
}

export async function approveProposalInternally(input: {
  proposalId: string;
  actorLabel: string;
}) {
  const sql = getSql();
  const rows = await sql`
    select public.approve_proposal_internally(
      ${input.proposalId}::uuid,
      ${input.actorLabel}
    ) as result
  `;
  return rows[0]?.result as string;
}
