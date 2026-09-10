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

export function isRecurrenceSchemaPending(error: unknown) {
  return ["42P01", "42703", "42883"].includes(errorCode(error));
}

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function records(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
}

export type RecurrenceOverview = {
  schemaReady: boolean;
  projects: Record<string, unknown>[];
  reassessments: Record<string, unknown>[];
};

export async function getRecurrenceOverview(input: { scopeAll: boolean; userId?: string | null }): Promise<RecurrenceOverview> {
  const sql = getSql();
  const userId = input.userId || null;
  try {
    const rows = await sql`
      select jsonb_build_object(
        'projects',coalesce((
          select jsonb_agg(jsonb_build_object(
            'project_id',p.id,
            'project_status',p.status,
            'objective',p.objective,
            'company_id',c.id,
            'company_name',c.name,
            'plan',case when rp.id is null then null else to_jsonb(rp) end,
            'latest_cycle',(
              select to_jsonb(sc) from public.recurring_service_cycle_summary sc
              where sc.project_id=p.id order by sc.sequence_number desc limit 1
            ),
            'renewal',(
              select to_jsonb(rq) from public.recurring_renewal_queue rq where rq.project_id=p.id limit 1
            )
          ) order by c.name,p.created_at desc)
          from public.projects p
          join public.companies c on c.id=p.company_id
          left join public.recurring_service_plans rp on rp.project_id=p.id and rp.is_current
          where p.status in ('onboarding','active','waiting_client','at_risk','paused')
            and (${input.scopeAll} or (${userId}::uuid is not null and public.internal_user_can_access_project(${userId}::uuid,p.id,'projects.view')))
        ),'[]'::jsonb),
        'reassessments',coalesce((
          select jsonb_agg(jsonb_build_object(
            'id',rq.id,'project_id',rq.project_id,'company_id',rq.company_id,'company_name',c.name,
            'source_diagnostic_id',rq.source_diagnostic_id,'new_diagnostic_id',rq.new_diagnostic_id,
            'due_at',rq.due_at,'status',rq.status,'queue_status',rq.queue_status,'route',rq.route,
            'owner_label',rq.owner_label,'reason',rq.reason,'opportunity_id',rq.opportunity_id
          ) order by rq.due_at asc)
          from public.diagnostic_reassessment_queue rq
          join public.companies c on c.id=rq.company_id
          where rq.project_id is not null
            and rq.status not in ('completed','waived','cancelled')
            and (${input.scopeAll} or (${userId}::uuid is not null and public.internal_user_can_access_project(${userId}::uuid,rq.project_id,'projects.view')))
        ),'[]'::jsonb)
      ) as result
    `;
    const result = record(rows[0]?.result);
    return { schemaReady: true, projects: records(result?.projects), reassessments: records(result?.reassessments) };
  } catch (error) {
    if (isRecurrenceSchemaPending(error)) return { schemaReady: false, projects: [], reassessments: [] };
    throw error;
  }
}

export type ProjectRecurrenceContext = {
  schemaReady: boolean;
  project: Record<string, unknown> | null;
  company: Record<string, unknown> | null;
  currentPlan: Record<string, unknown> | null;
  cycles: Record<string, unknown>[];
  cycleTasks: Record<string, unknown>[];
  cycleApprovals: Record<string, unknown>[];
  cycleReceivables: Record<string, unknown>[];
  cycleCosts: Record<string, unknown>[];
  renewal: Record<string, unknown> | null;
  reassessments: Record<string, unknown>[];
  eligibleDiagnostics: Record<string, unknown>[];
};

export async function getProjectRecurrenceContext(projectId: string, canViewFinance: boolean): Promise<ProjectRecurrenceContext> {
  const sql = getSql();
  try {
    const rows = await sql`
      select jsonb_build_object(
        'project',to_jsonb(p),
        'company',to_jsonb(c),
        'current_plan',(select to_jsonb(rp) from public.recurring_service_plans rp where rp.project_id=p.id and rp.is_current limit 1),
        'cycles',coalesce((
          select jsonb_agg(case when ${canViewFinance} then to_jsonb(sc) else to_jsonb(sc)-'cycle_receivable_total'-'cycle_received_total'-'cycle_cost_total' end order by sc.sequence_number desc)
          from public.recurring_service_cycle_summary sc where sc.project_id=p.id
        ),'[]'::jsonb),
        'cycle_tasks',coalesce((
          select jsonb_agg(to_jsonb(t) order by t.created_at desc) from public.project_tasks t
          where t.project_id=p.id and t.service_cycle_id is not null
        ),'[]'::jsonb),
        'cycle_approvals',coalesce((
          select jsonb_agg(to_jsonb(a) order by a.created_at desc) from public.approvals a
          where a.project_id=p.id and a.service_cycle_id is not null
        ),'[]'::jsonb),
        'cycle_receivables',case when ${canViewFinance} then coalesce((
          select jsonb_agg(to_jsonb(r) order by r.due_date desc,r.created_at desc) from public.receivables r
          where r.project_id=p.id and r.service_cycle_id is not null
        ),'[]'::jsonb) else '[]'::jsonb end,
        'cycle_costs',case when ${canViewFinance} then coalesce((
          select jsonb_agg(to_jsonb(pc) order by pc.created_at desc) from public.project_costs pc
          where pc.project_id=p.id and pc.service_cycle_id is not null
        ),'[]'::jsonb) else '[]'::jsonb end,
        'renewal',(select to_jsonb(rq) from public.recurring_renewal_queue rq where rq.project_id=p.id limit 1),
        'reassessments',coalesce((
          select jsonb_agg(to_jsonb(rq) order by rq.due_at desc) from public.diagnostic_reassessment_queue rq
          where rq.project_id=p.id
        ),'[]'::jsonb),
        'eligible_diagnostics',coalesce((
          select jsonb_agg(jsonb_build_object(
            'id',d.id,'status',d.status,'methodology_version',d.methodology_version,'assessment_cycle_number',d.assessment_cycle_number,
            'offered_at',d.offered_at,'presentation_at',d.presentation_at
          ) order by d.assessment_cycle_number desc,d.offered_at desc)
          from public.diagnostics d where d.company_id=p.company_id and d.status in ('presented','completed')
        ),'[]'::jsonb)
      ) as result
      from public.projects p join public.companies c on c.id=p.company_id
      where p.id=${projectId}::uuid limit 1
    `;
    const result = record(rows[0]?.result);
    return {
      schemaReady: true,
      project: record(result?.project),
      company: record(result?.company),
      currentPlan: record(result?.current_plan),
      cycles: records(result?.cycles),
      cycleTasks: records(result?.cycle_tasks),
      cycleApprovals: records(result?.cycle_approvals),
      cycleReceivables: records(result?.cycle_receivables),
      cycleCosts: records(result?.cycle_costs),
      renewal: record(result?.renewal),
      reassessments: records(result?.reassessments),
      eligibleDiagnostics: records(result?.eligible_diagnostics),
    };
  } catch (error) {
    if (isRecurrenceSchemaPending(error)) return { schemaReady: false, project: null, company: null, currentPlan: null, cycles: [], cycleTasks: [], cycleApprovals: [], cycleReceivables: [], cycleCosts: [], renewal: null, reassessments: [], eligibleDiagnostics: [] };
    throw error;
  }
}

export async function setRecurringServicePlan(input: {
  projectId: string; status: string; cadenceUnit: string; cadenceCount: number; firstPeriodStart: string; firstPeriodEnd: string;
  contractValidUntil?: string | null; renewalReviewAt?: string | null; expectedDeliverables: string[]; sourceReference: string;
  evidenceReference: string; ownerLabel: string; notes?: string; actorLabel: string;
}) {
  const sql = getSql();
  const rows = await sql`select public.set_recurring_service_plan(
    ${input.projectId}::uuid,${input.status},${input.cadenceUnit},${input.cadenceCount},${input.firstPeriodStart}::date,${input.firstPeriodEnd}::date,
    ${input.contractValidUntil || null}::date,${input.renewalReviewAt || null}::timestamptz,${JSON.stringify(input.expectedDeliverables)}::jsonb,
    ${input.sourceReference},${input.evidenceReference},${input.ownerLabel},${input.notes ?? ""},${input.actorLabel}
  ) as result`;
  return String(rows[0]?.result ?? "");
}

export async function createFirstServiceCycle(projectId: string, actorLabel: string) {
  const sql = getSql();
  const rows = await sql`select public.create_first_service_cycle(${projectId}::uuid,${actorLabel}) as result`;
  return String(rows[0]?.result ?? "");
}

export async function startServiceCycle(cycleId: string, actorLabel: string) {
  const sql = getSql();
  const rows = await sql`select public.start_service_cycle(${cycleId}::uuid,${actorLabel}) as result`;
  return String(rows[0]?.result ?? "");
}

export async function closeServiceCycle(input: {
  cycleId: string; deliverySummary: string; deliveryEvidenceReference: string; indicatorSnapshot: Record<string, unknown>;
  pendingItems: string[]; financePendingNote?: string; carryOverItems: string[]; carryOverJustification?: string;
  continuationStatus: string; continuationEvidence?: string; actorLabel: string;
}) {
  const sql = getSql();
  const rows = await sql`select public.close_service_cycle(
    ${input.cycleId}::uuid,${input.deliverySummary},${input.deliveryEvidenceReference},${JSON.stringify(input.indicatorSnapshot)}::jsonb,
    ${JSON.stringify(input.pendingItems)}::jsonb,${input.financePendingNote ?? ""},${JSON.stringify(input.carryOverItems)}::jsonb,
    ${input.carryOverJustification ?? ""},${input.continuationStatus},${input.continuationEvidence ?? ""},${input.actorLabel}
  ) as result`;
  return String(rows[0]?.result ?? "");
}

export async function createNextServiceCycle(input: { previousCycleId: string; customPeriodStart?: string | null; customPeriodEnd?: string | null; actorLabel: string }) {
  const sql = getSql();
  const rows = await sql`select public.create_next_service_cycle(${input.previousCycleId}::uuid,${input.customPeriodStart || null}::date,${input.customPeriodEnd || null}::date,${input.actorLabel}) as result`;
  return String(rows[0]?.result ?? "");
}

export async function recordCycleTask(input: {
  projectId: string; cycleId: string; actorLabel: string; title: string; responsibleLabel?: string; dueAt?: string | null;
  dependencies: string[]; priority: string; estimate?: string; approvalRequired: boolean;
}) {
  const sql = getSql();
  const rows = await sql`
    with created as (
      select public.record_project_task(${input.projectId}::uuid,${input.actorLabel},null::uuid,${input.title},${input.responsibleLabel ?? ""},
        ${input.dueAt || null}::timestamptz,${JSON.stringify(input.dependencies)}::jsonb,${input.priority},${input.estimate ?? ""},${input.approvalRequired})::uuid as id
    )
    update public.project_tasks t set service_cycle_id=${input.cycleId}::uuid,updated_at=now()
    from created where t.id=created.id and t.project_id=${input.projectId}::uuid returning t.id
  `;
  return String(rows[0]?.id ?? "");
}

export async function requestCycleApproval(input: {
  projectId: string; cycleId: string; taskId?: string | null; title: string; versionLabel: string; dueAt?: string | null; actorLabel: string;
}) {
  const sql = getSql();
  const rows = await sql`
    with created as (
      select public.request_approval(${input.projectId}::uuid,${input.taskId || null}::uuid,null::uuid,null,${input.title},${input.versionLabel},${input.actorLabel},${input.dueAt || null}::timestamptz)::uuid as id
    )
    update public.approvals a set service_cycle_id=${input.cycleId}::uuid,updated_at=now()
    from created where a.id=created.id and a.project_id=${input.projectId}::uuid returning a.id
  `;
  return String(rows[0]?.id ?? "");
}

export async function recordCycleReceivable(input: { projectId: string; cycleId: string; description: string; amount: number; dueDate: string; actorLabel: string }) {
  const sql = getSql();
  const rows = await sql`
    with created as (
      select public.record_receivable(${input.projectId}::uuid,${input.description},${input.amount},${input.dueDate}::date,${input.actorLabel})::uuid as id
    )
    update public.receivables r set service_cycle_id=${input.cycleId}::uuid,updated_at=now()
    from created where r.id=created.id and r.project_id=${input.projectId}::uuid returning r.id
  `;
  return String(rows[0]?.id ?? "");
}

export async function recordCycleCost(input: { projectId: string; cycleId: string; costType: string; description: string; amount: number; status: string; partnerLabel?: string; dueDate?: string | null; actorLabel: string }) {
  const sql = getSql();
  const rows = await sql`
    with created as (
      select public.record_project_cost(${input.projectId}::uuid,${input.costType},${input.description},${input.amount},${input.status},${input.partnerLabel ?? ""},${input.dueDate || null}::date,${input.actorLabel})::uuid as id
    )
    update public.project_costs pc set service_cycle_id=${input.cycleId}::uuid,updated_at=now()
    from created where pc.id=created.id and pc.project_id=${input.projectId}::uuid returning pc.id
  `;
  return String(rows[0]?.id ?? "");
}

export async function openRecurringRenewalReview(input: { planId: string; ownerLabel: string; notes?: string; actorLabel: string }) {
  const sql = getSql();
  const rows = await sql`select public.open_recurring_renewal_review(${input.planId}::uuid,${input.ownerLabel},${input.notes ?? ""},${input.actorLabel}) as result`;
  return String(rows[0]?.result ?? "");
}

export async function routeRecurringRenewalToCommercial(input: {
  reviewId: string; decision: string; route: string; fit: string; ownerLabel: string; nextActionTitle: string;
  nextActionAt: string; nextActionChannel: string; notes?: string; actorLabel: string;
}) {
  const sql = getSql();
  const rows = await sql`select public.route_recurring_renewal_to_commercial(
    ${input.reviewId}::uuid,${input.decision},${input.route},${input.fit},${input.ownerLabel},${input.nextActionTitle},${input.nextActionAt}::timestamptz,
    ${input.nextActionChannel},${input.notes ?? ""},${input.actorLabel}
  ) as result`;
  return String(rows[0]?.result ?? "");
}

export async function resolveRecurringRenewalReview(input: { reviewId: string; decision: string; status: string; evidence: string; notes?: string; actorLabel: string }) {
  const sql = getSql();
  const rows = await sql`select public.resolve_recurring_renewal_review(${input.reviewId}::uuid,${input.decision},${input.status},${input.evidence},${input.notes ?? ""},${input.actorLabel}) as result`;
  return String(rows[0]?.result ?? "");
}

export async function scheduleDiagnosticReassessment(input: {
  sourceDiagnosticId: string; projectId: string; dueAt: string; reason: string; ownerLabel: string; sourceReference: string; notes?: string; actorLabel: string;
}) {
  const sql = getSql();
  const rows = await sql`select public.schedule_diagnostic_reassessment(${input.sourceDiagnosticId}::uuid,${input.projectId}::uuid,${input.dueAt}::timestamptz,${input.reason},${input.ownerLabel},${input.sourceReference},${input.notes ?? ""},${input.actorLabel}) as result`;
  return String(rows[0]?.result ?? "");
}

export async function setDiagnosticReassessmentRoute(input: { requestId: string; route: string; evidence: string; notes?: string; actorLabel: string }) {
  const sql = getSql();
  const rows = await sql`select public.set_diagnostic_reassessment_route(${input.requestId}::uuid,${input.route},${input.evidence},${input.notes ?? ""},${input.actorLabel}) as result`;
  return String(rows[0]?.result ?? "");
}

export async function startIncludedDiagnosticReassessment(requestId: string, actorLabel: string) {
  const sql = getSql();
  const rows = await sql`select public.start_included_diagnostic_reassessment(${requestId}::uuid,${actorLabel}) as result`;
  return String(rows[0]?.result ?? "");
}

export async function routeDiagnosticReassessmentToCommercial(input: {
  requestId: string; route: string; fit: string; ownerLabel: string; nextActionTitle: string; nextActionAt: string; nextActionChannel: string; notes?: string; actorLabel: string;
}) {
  const sql = getSql();
  const rows = await sql`select public.route_diagnostic_reassessment_to_commercial(
    ${input.requestId}::uuid,${input.route},${input.fit},${input.ownerLabel},${input.nextActionTitle},${input.nextActionAt}::timestamptz,${input.nextActionChannel},${input.notes ?? ""},${input.actorLabel}
  ) as result`;
  return String(rows[0]?.result ?? "");
}
