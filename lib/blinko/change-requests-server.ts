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

export function isChangeRequestSchemaPending(error: unknown) {
  return ["42P01", "42703", "42883"].includes(errorCode(error));
}

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function records(value: unknown) {
  return Array.isArray(value) ? value.map(record).filter(Boolean) as Record<string, unknown>[] : [];
}

export type ProjectChangeRequestWorkspace = {
  schemaReady: boolean;
  project: Record<string, unknown> | null;
  company: Record<string, unknown> | null;
  solutions: Record<string, unknown>[];
  approvals: Record<string, unknown>[];
  changeRequests: Record<string, unknown>[];
};

export async function getProjectChangeRequestWorkspace(projectId: string): Promise<ProjectChangeRequestWorkspace> {
  const sql = getSql();
  try {
    const rows = await sql`
      select jsonb_build_object(
        'project',to_jsonb(p),
        'company',to_jsonb(c),
        'solutions',coalesce((
          select jsonb_agg(jsonb_build_object(
            'id',ps.id,'solution_code',ps.solution_code,'selected_route',ps.selected_route,'status',ps.status,
            'name',sb.name,'official_status',sb.official_status
          ) order by ps.solution_code)
          from public.project_solutions ps
          join public.solution_blueprints sb on sb.id=ps.blueprint_id
          where ps.project_id=p.id
        ),'[]'::jsonb),
        'approvals',coalesce((
          select jsonb_agg(jsonb_build_object(
            'id',a.id,'title',a.title,'version_label',a.version_label,'status',a.status,
            'responded_by_label',a.responded_by_label,'responded_at',a.responded_at,'evidence_reference',a.evidence_reference
          ) order by a.created_at desc)
          from public.approvals a where a.project_id=p.id
        ),'[]'::jsonb),
        'change_requests',coalesce((
          select jsonb_agg(
            to_jsonb(crs) || jsonb_build_object(
              'tasks',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from public.project_tasks t where t.change_request_id=crs.id),'[]'::jsonb),
              'decisions',coalesce((select jsonb_agg(to_jsonb(d) order by d.decided_at) from public.project_change_request_decisions d where d.change_request_id=crs.id),'[]'::jsonb)
            ) order by crs.requested_at desc
          )
          from public.project_change_request_summary crs where crs.project_id=p.id
        ),'[]'::jsonb)
      ) as result
      from public.projects p
      join public.companies c on c.id=p.company_id
      where p.id=${projectId}::uuid
      limit 1
    `;
    const result=record(rows[0]?.result);
    return {
      schemaReady:true,
      project:record(result?.project),
      company:record(result?.company),
      solutions:records(result?.solutions),
      approvals:records(result?.approvals),
      changeRequests:records(result?.change_requests),
    };
  } catch (error) {
    if (isChangeRequestSchemaPending(error)) {
      return { schemaReady:false,project:null,company:null,solutions:[],approvals:[],changeRequests:[] };
    }
    throw error;
  }
}

export async function createProjectChangeRequest(input: {
  projectId:string;
  projectSolutionId?:string|null;
  requesterType:string;
  requesterLabel:string;
  description:string;
  classification:string;
  affectedDeliverableKey?:string;
  affectedVersionLabel?:string;
  scopeReference?:string;
  impactAnalysis?:string;
  deadlineImpactStatus:string;
  deadlineImpactDescription?:string;
  proposedNewDueAt?:string|null;
  financialImpactStatus:string;
  financialImpactDescription?:string;
  financialReference?:string;
  decisionOwnerLabel:string;
  actorLabel:string;
}) {
  const sql=getSql();
  const projectSolutionId=input.projectSolutionId || null;
  const proposedNewDueAt=input.proposedNewDueAt || null;
  const rows=await sql`
    select public.create_project_change_request(
      ${input.projectId}::uuid,${projectSolutionId}::uuid,${input.requesterType},${input.requesterLabel},${input.description},${input.classification},
      ${input.affectedDeliverableKey ?? ""},${input.affectedVersionLabel ?? ""},${input.scopeReference ?? ""},${input.impactAnalysis ?? ""},
      ${input.deadlineImpactStatus},${input.deadlineImpactDescription ?? ""},${proposedNewDueAt}::timestamptz,
      ${input.financialImpactStatus},${input.financialImpactDescription ?? ""},${input.financialReference ?? ""},
      ${input.decisionOwnerLabel},${input.actorLabel}
    ) as result
  `;
  return String(rows[0]?.result ?? "");
}

export async function updateProjectChangeRequestAnalysis(input: {
  changeRequestId:string;
  impactAnalysis?:string;
  deadlineImpactStatus:string;
  deadlineImpactDescription?:string;
  proposedNewDueAt?:string|null;
  financialImpactStatus:string;
  financialImpactDescription?:string;
  financialReference?:string;
  decisionOwnerLabel:string;
  actorLabel:string;
}) {
  const sql=getSql();
  const proposedNewDueAt=input.proposedNewDueAt || null;
  const rows=await sql`
    select public.update_project_change_request_analysis(
      ${input.changeRequestId}::uuid,${input.impactAnalysis ?? ""},${input.deadlineImpactStatus},${input.deadlineImpactDescription ?? ""},
      ${proposedNewDueAt}::timestamptz,${input.financialImpactStatus},${input.financialImpactDescription ?? ""},
      ${input.financialReference ?? ""},${input.decisionOwnerLabel},${input.actorLabel}
    ) as result
  `;
  return String(rows[0]?.result ?? "");
}

export async function decideProjectChangeRequest(input: {
  changeRequestId:string;
  decision:string;
  decisionNotes?:string;
  approvalId?:string|null;
  approvalEvidence?:string;
  actorLabel:string;
}) {
  const sql=getSql();
  const approvalId=input.approvalId || null;
  const rows=await sql`
    select public.decide_project_change_request(
      ${input.changeRequestId}::uuid,${input.decision},${input.decisionNotes ?? ""},${approvalId}::uuid,${input.approvalEvidence ?? ""},${input.actorLabel}
    ) as result
  `;
  return String(rows[0]?.result ?? "");
}

export async function routeNewDemandChangeRequest(input: {
  changeRequestId:string;
  route:string;
  nextActionAt:string;
  actorLabel:string;
}) {
  const sql=getSql();
  const rows=await sql`
    select public.route_new_demand_change_request(${input.changeRequestId}::uuid,${input.route},${input.nextActionAt}::timestamptz,${input.actorLabel}) as result
  `;
  return String(rows[0]?.result ?? "");
}

export async function recordChangeRequestTask(input: {
  changeRequestId:string;
  title:string;
  responsibleLabel?:string;
  dueAt?:string|null;
  priority:string;
  estimate?:string;
  approvalRequired:boolean;
  actorLabel:string;
}) {
  const sql=getSql();
  const dueAt=input.dueAt || null;
  const rows=await sql`
    select public.record_change_request_task(
      ${input.changeRequestId}::uuid,${input.title},${input.responsibleLabel ?? ""},${dueAt}::timestamptz,
      ${input.priority},${input.estimate ?? ""},${input.approvalRequired},${input.actorLabel}
    ) as result
  `;
  return String(rows[0]?.result ?? "");
}

export async function closeProjectChangeRequest(input: {
  changeRequestId:string;
  implementationEvidence:string;
  actorLabel:string;
}) {
  const sql=getSql();
  const rows=await sql`
    select public.close_project_change_request(${input.changeRequestId}::uuid,${input.implementationEvidence},${input.actorLabel}) as result
  `;
  return String(rows[0]?.result ?? "");
}
