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

export function isExecutionSchemaPending(error: unknown) {
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

export type ProposalExecutionContext = {
  schemaReady: boolean;
  diagnostic: Record<string, unknown> | null;
  proposal: Record<string, unknown> | null;
  currentProposalVersion: Record<string, unknown> | null;
  externalEvents: Record<string, unknown>[];
  project: Record<string, unknown> | null;
};

export async function getProposalExecutionContext(diagnosticId: string): Promise<ProposalExecutionContext> {
  const sql = getSql();
  try {
    const rows = await sql`
      select jsonb_build_object(
        'diagnostic', to_jsonb(d),
        'proposal', case when p.id is null then null else to_jsonb(p) end,
        'current_proposal_version', case when pv.id is null then null else to_jsonb(pv) end,
        'external_events', coalesce((
          select jsonb_agg(to_jsonb(e) order by e.occurred_at desc)
          from public.proposal_external_events e where e.proposal_id = p.id
        ), '[]'::jsonb),
        'project', (
          select to_jsonb(prj) from public.projects prj where prj.proposal_id = p.id limit 1
        )
      ) as result
      from public.diagnostics d
      left join public.proposals p on p.diagnostic_id = d.id
      left join public.proposal_versions pv on pv.id = p.current_version_id
      where d.id = ${diagnosticId}::uuid
      limit 1
    `;
    const result = rows[0]?.result as Record<string, unknown> | undefined;
    return {
      schemaReady: true,
      diagnostic: record(result?.diagnostic),
      proposal: record(result?.proposal),
      currentProposalVersion: record(result?.current_proposal_version),
      externalEvents: records(result?.external_events),
      project: record(result?.project),
    };
  } catch (error) {
    if (isExecutionSchemaPending(error)) {
      return { schemaReady: false, diagnostic: null, proposal: null, currentProposalVersion: null, externalEvents: [], project: null };
    }
    throw error;
  }
}

export async function recordProposalExternalEvent(input: {
  proposalId: string;
  actorLabel: string;
  eventType: string;
  channel?: string;
  externalReference: string;
  notes?: string;
  occurredAt: string;
}) {
  const sql = getSql();
  const rows = await sql`
    select public.record_proposal_external_event(
      ${input.proposalId}::uuid,
      ${input.actorLabel},
      ${input.eventType},
      ${input.channel ?? ""},
      ${input.externalReference},
      ${input.notes ?? ""},
      ${input.occurredAt}::timestamptz
    ) as result
  `;
  return rows[0]?.result as string;
}

export async function createProjectFromAcceptedProposal(input: {
  proposalId: string;
  actorLabel: string;
  objective: string;
  startDate: string;
  targetTimeframe: string;
  contractReference: string;
  nextReviewAt?: string | null;
}) {
  const sql = getSql();
  const nextReview = input.nextReviewAt || null;
  const rows = await sql`
    select public.create_project_from_accepted_proposal(
      ${input.proposalId}::uuid,
      ${input.actorLabel},
      ${input.objective},
      ${input.startDate}::date,
      ${input.targetTimeframe},
      ${input.contractReference},
      ${nextReview}::timestamptz
    ) as result
  `;
  return rows[0]?.result as string;
}

export type ProjectWorkspace = {
  schemaReady: boolean;
  project: Record<string, unknown> | null;
  company: Record<string, unknown> | null;
  proposal: Record<string, unknown> | null;
  diagnostic: Record<string, unknown> | null;
  interventions: Record<string, unknown>[];
  tasks: Record<string, unknown>[];
};

export async function getProjectWorkspace(projectId: string): Promise<ProjectWorkspace> {
  const sql = getSql();
  try {
    const rows = await sql`
      select jsonb_build_object(
        'project', to_jsonb(prj),
        'company', to_jsonb(c),
        'proposal', to_jsonb(p),
        'diagnostic', to_jsonb(d),
        'interventions', coalesce((
          select jsonb_agg(jsonb_build_object('id', i.id, 'title', i.title, 'objective', i.objective) order by i.created_at)
          from public.diagnostic_interventions i
          where i.id in (select value::uuid from jsonb_array_elements_text(prj.intervention_ids))
        ), '[]'::jsonb),
        'tasks', coalesce((
          select jsonb_agg(to_jsonb(t) order by t.created_at asc)
          from public.project_tasks t where t.project_id = prj.id
        ), '[]'::jsonb)
      ) as result
      from public.projects prj
      join public.companies c on c.id = prj.company_id
      join public.proposals p on p.id = prj.proposal_id
      join public.diagnostics d on d.id = p.diagnostic_id
      where prj.id = ${projectId}::uuid
      limit 1
    `;
    const result = rows[0]?.result as Record<string, unknown> | undefined;
    return {
      schemaReady: true,
      project: record(result?.project),
      company: record(result?.company),
      proposal: record(result?.proposal),
      diagnostic: record(result?.diagnostic),
      interventions: records(result?.interventions),
      tasks: records(result?.tasks),
    };
  } catch (error) {
    if (isExecutionSchemaPending(error)) {
      return { schemaReady: false, project: null, company: null, proposal: null, diagnostic: null, interventions: [], tasks: [] };
    }
    throw error;
  }
}

export async function recordProjectTask(input: {
  projectId: string;
  actorLabel: string;
  interventionId?: string | null;
  title: string;
  responsibleLabel?: string;
  dueAt?: string | null;
  dependencies: string[];
  priority: string;
  estimate?: string;
  approvalRequired: boolean;
}) {
  const sql = getSql();
  const interventionId = input.interventionId || null;
  const dueAt = input.dueAt || null;
  const rows = await sql`
    select public.record_project_task(
      ${input.projectId}::uuid,
      ${input.actorLabel},
      ${interventionId}::uuid,
      ${input.title},
      ${input.responsibleLabel ?? ""},
      ${dueAt}::timestamptz,
      ${JSON.stringify(input.dependencies)}::jsonb,
      ${input.priority},
      ${input.estimate ?? ""},
      ${input.approvalRequired}
    ) as result
  `;
  return rows[0]?.result as string;
}

export async function activateProject(input: { projectId: string; actorLabel: string }) {
  const sql = getSql();
  const rows = await sql`
    select public.activate_project(${input.projectId}::uuid, ${input.actorLabel}) as result
  `;
  return rows[0]?.result as string;
}
