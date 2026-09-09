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
  formalizationSchemaReady: boolean;
  diagnostic: Record<string, unknown> | null;
  proposal: Record<string, unknown> | null;
  currentProposalVersion: Record<string, unknown> | null;
  externalEvents: Record<string, unknown>[];
  project: Record<string, unknown> | null;
  contracts: Record<string, unknown>[];
  startConditions: Record<string, unknown>[];
  startReadiness: Record<string, unknown> | null;
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
    const proposal = record(result?.proposal);

    let formalizationSchemaReady = true;
    let contracts: Record<string, unknown>[] = [];
    let startConditions: Record<string, unknown>[] = [];
    let startReadiness: Record<string, unknown> | null = null;

    const proposalId = typeof proposal?.id === "string" ? proposal.id : "";
    if (proposalId) {
      try {
        const extensionRows = await sql`
          select jsonb_build_object(
            'contracts', coalesce((
              select jsonb_agg(to_jsonb(c) order by c.created_at desc)
              from public.contracts c where c.proposal_id = p.id
            ), '[]'::jsonb),
            'start_conditions', coalesce((
              select jsonb_agg(to_jsonb(sc) order by sc.condition_code)
              from public.commercial_start_conditions sc where sc.opportunity_id = p.opportunity_id
            ), '[]'::jsonb),
            'start_readiness', (
              select to_jsonb(r) from public.commercial_start_readiness r where r.opportunity_id = p.opportunity_id
            )
          ) as result
          from public.proposals p where p.id = ${proposalId}::uuid
          limit 1
        `;
        const extension = record(extensionRows[0]?.result);
        contracts = records(extension?.contracts);
        startConditions = records(extension?.start_conditions);
        startReadiness = record(extension?.start_readiness);
      } catch (error) {
        if (!isExecutionSchemaPending(error)) throw error;
        formalizationSchemaReady = false;
      }
    }

    return {
      schemaReady: true,
      formalizationSchemaReady,
      diagnostic: record(result?.diagnostic),
      proposal,
      currentProposalVersion: record(result?.current_proposal_version),
      externalEvents: records(result?.external_events),
      project: record(result?.project),
      contracts,
      startConditions,
      startReadiness,
    };
  } catch (error) {
    if (isExecutionSchemaPending(error)) {
      return {
        schemaReady: false,
        formalizationSchemaReady: false,
        diagnostic: null,
        proposal: null,
        currentProposalVersion: null,
        externalEvents: [],
        project: null,
        contracts: [],
        startConditions: [],
        startReadiness: null,
      };
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

export async function recordCommercialContract(input: {
  proposalId: string;
  status: string;
  acceptanceMethod?: string | null;
  externalReference?: string;
  documentReference?: string;
  acceptedAt?: string | null;
  acceptedByLabel?: string;
  notes?: string;
  actorLabel: string;
}) {
  const sql = getSql();
  const acceptanceMethod = input.acceptanceMethod || null;
  const acceptedAt = input.acceptedAt || null;
  const rows = await sql`
    select public.record_commercial_contract(
      ${input.proposalId}::uuid,
      ${input.status},
      ${acceptanceMethod},
      ${input.externalReference ?? ""},
      ${input.documentReference ?? ""},
      ${acceptedAt}::timestamptz,
      ${input.acceptedByLabel ?? ""},
      ${input.notes ?? ""},
      ${input.actorLabel}
    ) as result
  `;
  return rows[0]?.result as string;
}

export async function setCommercialStartCondition(input: {
  opportunityId: string;
  conditionCode: string;
  requirement: string;
  status: string;
  evidence?: string;
  ownerLabel?: string;
  dueAt?: string | null;
  notes?: string;
  actorLabel: string;
}) {
  const sql = getSql();
  const dueAt = input.dueAt || null;
  const rows = await sql`
    select public.set_commercial_start_condition(
      ${input.opportunityId}::uuid,
      ${input.conditionCode},
      ${input.requirement},
      ${input.status},
      ${input.evidence ?? ""},
      ${input.ownerLabel ?? ""},
      ${dueAt}::timestamptz,
      ${input.notes ?? ""},
      ${input.actorLabel}
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
  contractReference?: string;
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
      ${input.contractReference ?? ""},
      ${nextReview}::timestamptz
    ) as result
  `;
  return rows[0]?.result as string;
}

export type ProjectWorkspace = {
  schemaReady: boolean;
  onboardingSchemaReady: boolean;
  project: Record<string, unknown> | null;
  company: Record<string, unknown> | null;
  proposal: Record<string, unknown> | null;
  diagnostic: Record<string, unknown> | null;
  interventions: Record<string, unknown>[];
  tasks: Record<string, unknown>[];
  onboardingItems: Record<string, unknown>[];
  onboardingReadiness: Record<string, unknown> | null;
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

    let onboardingSchemaReady = true;
    let onboardingItems: Record<string, unknown>[] = [];
    let onboardingReadiness: Record<string, unknown> | null = null;
    try {
      const extensionRows = await sql`
        select jsonb_build_object(
          'items', coalesce((
            select jsonb_agg(to_jsonb(i) order by i.category,i.module_code)
            from public.project_onboarding_items i where i.project_id=${projectId}::uuid
          ), '[]'::jsonb),
          'readiness', (
            select to_jsonb(r) from public.project_onboarding_readiness r where r.project_id=${projectId}::uuid
          )
        ) as result
      `;
      const extension = record(extensionRows[0]?.result);
      onboardingItems = records(extension?.items);
      onboardingReadiness = record(extension?.readiness);
    } catch (error) {
      if (!isExecutionSchemaPending(error)) throw error;
      onboardingSchemaReady = false;
    }

    return {
      schemaReady: true,
      onboardingSchemaReady,
      project: record(result?.project),
      company: record(result?.company),
      proposal: record(result?.proposal),
      diagnostic: record(result?.diagnostic),
      interventions: records(result?.interventions),
      tasks: records(result?.tasks),
      onboardingItems,
      onboardingReadiness,
    };
  } catch (error) {
    if (isExecutionSchemaPending(error)) {
      return {
        schemaReady: false,
        onboardingSchemaReady: false,
        project: null,
        company: null,
        proposal: null,
        diagnostic: null,
        interventions: [],
        tasks: [],
        onboardingItems: [],
        onboardingReadiness: null,
      };
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

export async function setProjectOnboardingItem(input: {
  projectId: string;
  moduleCode: string;
  requirement: string;
  status: string;
  evidence?: string;
  responsibleLabel?: string;
  dueAt?: string | null;
  blockingReason?: string;
  blockingOwnerLabel?: string;
  nextCheckAt?: string | null;
  notes?: string;
  actorLabel: string;
}) {
  const sql = getSql();
  const dueAt = input.dueAt || null;
  const nextCheckAt = input.nextCheckAt || null;
  const rows = await sql`
    select public.set_project_onboarding_item(
      ${input.projectId}::uuid,
      ${input.moduleCode},
      ${input.requirement},
      ${input.status},
      ${input.evidence ?? ""},
      ${input.responsibleLabel ?? ""},
      ${dueAt}::timestamptz,
      ${input.blockingReason ?? ""},
      ${input.blockingOwnerLabel ?? ""},
      ${nextCheckAt}::timestamptz,
      ${input.notes ?? ""},
      ${input.actorLabel}
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
