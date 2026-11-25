import "server-only";
import { validateOperation } from "./operations";
import { neon } from "@neondatabase/serverless";
import { isSandboxConnection, isLabUuid, validateEvidence, validateEvidenceReview, verifyLabSession } from "./session";

export class LabError extends Error {
  constructor(public readonly status: number, public readonly code: string) { super(code); }
}

// Fail closed: never fall back to DATABASE_URL or any production credentials.
function access(token: string | undefined) {
  if (process.env.BLINKO_OS_LAB_ENABLED !== "true" || process.env.VERCEL_ENV === "production") throw new LabError(404,"lab_disabled");
  const session=verifyLabSession(token,process.env.BLINKO_OS_LAB_SESSION_SECRET ?? "");
  if (!session) throw new LabError(401,"session_required");
  const url=process.env.BLINKO_OS_LAB_DATABASE_URL ?? "";
  if (!isSandboxConnection(url)) throw new LabError(503,"lab_not_configured");
  return {sql:neon(url),actor:session.actorId,sid:session.sessionId};
}

export async function listLabProjects(token: string | undefined) {
  const {sql,actor,sid}=access(token);
  const [,status,rows]=await sql.transaction([
    sql`SELECT set_config('os_lab.actor_id', ${actor}, true), set_config('os_lab.session_id', ${sid}, true)`,
    sql`SELECT os_lab.session_is_active(${actor}, ${sid}) AS active`,
    sql`SELECT id,label,method_stage,owner_label,due_on::text AS due_on FROM os_lab.projects ORDER BY label,id LIMIT 100`
  ]);
  if (status[0]?.active!==true) throw new LabError(401,"session_inactive");
  return rows;
}

export async function listLabEvidence(token: string | undefined, projectId: string) {
  const {sql,actor,sid}=access(token);
  if (!isLabUuid(projectId)) throw new LabError(400,"invalid_project");
  const [,status,projects,rows]=await sql.transaction([
    sql`SELECT set_config('os_lab.actor_id', ${actor}, true), set_config('os_lab.session_id', ${sid}, true)`,
    sql`SELECT os_lab.session_is_active(${actor}, ${sid}) AS active`,
    sql`SELECT id FROM os_lab.projects WHERE id=${projectId}::uuid`,
    sql`SELECT id,pillar,kind,summary,reviewed,source_label,recorded_at::text AS recorded_at FROM os_lab.evidence WHERE project_id=${projectId}::uuid ORDER BY id LIMIT 100`
  ]);
  if (status[0]?.active!==true) throw new LabError(401,"session_inactive");
  if (!projects.length) throw new LabError(404,"project_unavailable");
  return rows;
}

export async function createLabEvidence(token: string | undefined, body: unknown) {
  const {sql,actor,sid}=access(token);
  const input=validateEvidence(body);
  if (!input) throw new LabError(400,"invalid_evidence");
  try {
    const [,status,rows]=await sql.transaction([
      sql`SELECT set_config('os_lab.actor_id', ${actor}, true), set_config('os_lab.session_id', ${sid}, true)`,
    sql`SELECT os_lab.session_is_active(${actor}, ${sid}) AS active`,
      sql`SELECT id,pillar,kind,summary,reviewed,source_label,recorded_at::text AS recorded_at
       FROM os_lab.record_evidence(${input.id}::uuid,${input.projectId}::uuid,${input.pillar}::integer,${input.kind},${input.source},${input.summary})`
    ]);
    if (status[0]?.active!==true) throw new LabError(401,"session_inactive");
    if (!rows.length) throw new LabError(404,"project_unavailable");
    return rows[0];
  } catch (error) {
    if (error instanceof LabError) throw error;
    if (typeof error==="object" && error!==null && "code" in error) {
      if(error.code==="42501")throw new LabError(403,"access_denied");
      if(error.code==="22023")throw new LabError(400,"invalid_evidence");
      if(error.code==="23505")throw new LabError(409,"evidence_conflict");
    }
    throw error;
  }
}

export async function reviewLabEvidence(token: string | undefined, body: unknown) {
  const {sql,actor,sid}=access(token);
  const input=validateEvidenceReview(body);
  if (!input) throw new LabError(400,"invalid_review");
  try {
    const [,rows]=await sql.transaction([
      sql`SELECT set_config('os_lab.actor_id', ${actor}, true), set_config('os_lab.session_id', ${sid}, true)`,
      sql`SELECT os_lab.review_evidence(${input.evidenceId}::uuid,${input.reviewed},${input.reason}) AS changed`
    ]);
    return {changed:rows[0]?.changed===true};
  } catch(error) {
    if (typeof error==="object" && error!==null && "code" in error) {
      if(error.code==="42501") throw new LabError(403,"review_denied");
      if(error.code==="22023") throw new LabError(400,"invalid_review");
    }
    throw error;
  }
}

export async function listLabOperations(token:string|undefined,projectId:string) {
  const {sql,actor,sid}=access(token);
  if(!isLabUuid(projectId)) throw new LabError(400,"invalid_project");
  const [,status,projects,scores,actions,appointments,financeAccess,ledger,totals,hypotheses]=await sql.transaction([
    sql`SELECT set_config('os_lab.actor_id', ${actor}, true),set_config('os_lab.session_id', ${sid}, true)`,
    sql`SELECT os_lab.session_is_active(${actor},${sid}) AS active`,
    sql`SELECT id FROM os_lab.projects WHERE id=${projectId}::uuid`,
    sql`SELECT s.pillar,s.value,s.evidence_id,
      (e.reviewed AND e.kind<>'hypothesis' AND e.review_revision=s.evidence_revision) AS eligible
      FROM os_lab.radar_scores s JOIN os_lab.evidence e ON e.id=s.evidence_id WHERE s.project_id=${projectId}::uuid ORDER BY s.pillar`,
    sql`SELECT a.id,a.title,a.owner_label,a.due_on::text AS due_on,a.gravity,a.urgency,a.tendency,a.gut,a.done,a.evidence_id,
      (e.reviewed AND e.kind<>'hypothesis' AND e.review_revision=a.evidence_revision) AS eligible
      FROM os_lab.action_items a JOIN os_lab.evidence e ON e.id=a.evidence_id WHERE a.project_id=${projectId}::uuid ORDER BY a.due_on,a.id LIMIT 100`,
    sql`SELECT id,title,kind,due_on::text AS due_on,done FROM os_lab.appointments WHERE project_id=${projectId}::uuid ORDER BY due_on,id LIMIT 100`,
    sql`SELECT os_lab.can_access_finance(p.id,p.org_id) AS allowed FROM os_lab.projects p WHERE p.id=${projectId}::uuid`,
    sql`SELECT id,label,kind,cents::text AS cents,due_on::text AS due_on,settled_at::text AS settled_at FROM os_lab.ledger_entries WHERE project_id=${projectId}::uuid ORDER BY due_on,id LIMIT 100`,
    sql`SELECT COALESCE(sum(cents) FILTER(WHERE kind='income'),0)::text AS planned_income,
       COALESCE(sum(cents) FILTER(WHERE kind='expense'),0)::text AS planned_expense,
       COALESCE(sum(cents) FILTER(WHERE kind='income' AND settled_at IS NOT NULL),0)::text AS realized_income,
       COALESCE(sum(cents) FILTER(WHERE kind='expense' AND settled_at IS NOT NULL),0)::text AS realized_expense
       FROM os_lab.ledger_entries WHERE project_id=${projectId}::uuid`,
    sql`SELECT h.id,h.pillar,h.cause,h.effect,h.support_id,h.challenge_id,h.decision,h.rationale,
      ((h.support_id IS NOT NULL AND (s.reviewed IS DISTINCT FROM true OR s.kind='hypothesis' OR s.review_revision IS DISTINCT FROM h.support_revision))
       OR (h.challenge_id IS NOT NULL AND (c.reviewed IS DISTINCT FROM true OR c.kind='hypothesis' OR c.review_revision IS DISTINCT FROM h.challenge_revision))) AS stale
      FROM os_lab.hypotheses h LEFT JOIN os_lab.evidence s ON s.id=h.support_id LEFT JOIN os_lab.evidence c ON c.id=h.challenge_id
      WHERE h.project_id=${projectId}::uuid ORDER BY h.pillar,h.id LIMIT 100`
  ]);
  if(status[0]?.active!==true)throw new LabError(401,"session_inactive");
  if(!projects.length)throw new LabError(404,"project_unavailable");
  return {scores,actions,appointments,hypotheses,finance:financeAccess[0]?.allowed===true?{entries:ledger,totals:totals[0]}:null};
}
export async function mutateLabOperation(token:string|undefined,body:unknown) {
 const {sql,actor,sid}=access(token);
 const op=validateOperation(body);
 if(!op)throw new LabError(400,"invalid_operation");
 const command=op.type==="score"
  ? sql`SELECT os_lab.save_radar_score(${op.projectId}::uuid,${op.pillar}::integer,${op.value}::integer,${op.evidenceId}::uuid) AS changed`
  : op.type==="action"
  ? sql`SELECT os_lab.create_action_item(${op.id}::uuid,${op.projectId}::uuid,${op.evidenceId}::uuid,${op.title},${op.owner},${op.due}::date,${op.gravity}::integer,${op.urgency}::integer,${op.tendency}::integer) AS changed`
  : op.type==="action_revalidate"
  ? sql`SELECT os_lab.revalidate_action(${op.id}::uuid,${op.evidenceId}::uuid,${op.reason}) AS changed`
  : op.type==="completion"
  ? sql`SELECT os_lab.set_action_done(${op.id}::uuid,${op.done}) AS changed`
  : op.type==="appointment"
  ? sql`SELECT os_lab.create_appointment(${op.id}::uuid,${op.projectId}::uuid,${op.title},${op.kind},${op.due}::date) AS changed`
  : op.type==="appointment_done"
  ? sql`SELECT os_lab.set_appointment_done(${op.id}::uuid,${op.done}) AS changed`
  : op.type==="ledger"
  ? sql`SELECT os_lab.create_ledger_entry(${op.id}::uuid,${op.projectId}::uuid,${op.label},${op.kind},${op.cents}::bigint,${op.due}::date) AS changed`
  : op.type==="ledger_settled"
  ? sql`SELECT os_lab.set_ledger_settled(${op.id}::uuid,${op.settled}) AS changed`
  : op.type==="lead_create"
  ? sql`SELECT os_lab.create_synthetic_lead(${op.id}::uuid,${op.submissionId}::uuid,${op.company},${op.consent}) AS id`
  : op.type==="lead_complete"
  ? sql`SELECT os_lab.complete_synthetic_lead(${op.id}::uuid,${op.challenge}) AS changed`
  : op.type==="lead_move"
  ? sql`SELECT os_lab.move_lead(${op.id}::uuid,${op.expectedStage},${op.nextStage}) AS changed`
  : op.type==="lead_contract"
  ? sql`SELECT os_lab.contract_synthetic_lead(${op.id}::uuid,${op.projectId}::uuid,${op.confirmed}) AS id`
  : op.type==="project_details"
  ? sql`SELECT os_lab.update_project_details(${op.id}::uuid,${op.stage},${op.owner},${op.due}::date) AS changed`
  : op.type==="report_save"
  ? sql`SELECT os_lab.save_report(${op.id}::uuid,${op.synthesis}) AS changed`
  : op.type==="report_review"
  ? sql`SELECT os_lab.review_report(${op.id}::uuid,${op.reviewed},${op.note}) AS changed`
  : op.type==="portal_save"
  ? sql`SELECT os_lab.save_portal_draft(${op.id}::uuid,${op.summary},${op.nextStep},${op.showMaturity},${op.showActions}) AS changed`
  : op.type==="portal_approve"
  ? sql`SELECT os_lab.approve_portal(${op.id}::uuid,${op.approved}) AS changed`
  : op.type==="hypothesis_save"
  ? sql`SELECT os_lab.save_hypothesis(${op.id}::uuid,${op.projectId}::uuid,${op.pillar}::integer,${op.cause},${op.effect},${op.supportId}::uuid,${op.challengeId}::uuid,${op.decision},${op.rationale}) AS changed`
  : sql`SELECT os_lab.create_quote(${op.id}::uuid,${op.leadId}::uuid,${op.minutes}::integer,${op.hourlyCents}::integer,${op.expenseCents}::bigint,${op.feeBps}::integer,${op.marginBps}::integer) AS id`;
 try {
  const [,rows]=await sql.transaction([
   sql`SELECT set_config('os_lab.actor_id',${actor},true),set_config('os_lab.session_id',${sid},true)`,
   command
  ]);
  if(op.type==="lead_create"||op.type==="lead_contract"||op.type==="quote_create") {
   if(!isLabUuid(rows[0]?.id))throw new LabError(500,"invalid_operation_result");
   return {id:rows[0].id};
  }
  return {changed:rows[0]?.changed===true};
 } catch(error) {
  if(typeof error==="object"&&error!==null&&"code" in error) {
   if(error.code==="42501")throw new LabError(403,"operation_denied");
   if(error.code==="22023")throw new LabError(400,"invalid_operation_or_evidence");
   if(error.code==="23505")throw new LabError(409,"operation_conflict");
  }
  throw error;
 }
}

export async function listLabLeads(token:string|undefined) {
 const {sql,actor,sid}=access(token);
 const [,status,rows]=await sql.transaction([
  sql`SELECT set_config('os_lab.actor_id',${actor},true),set_config('os_lab.session_id',${sid},true)`,
  sql`SELECT os_lab.session_is_active(${actor},${sid}) AS active`,
  sql`SELECT l.id,l.display_name,l.stage,l.intake_complete,l.challenge,l.created_at,p.id AS project_id
   FROM os_lab.leads l LEFT JOIN os_lab.projects p ON p.lead_id=l.id
   ORDER BY l.created_at DESC,l.id LIMIT 100`
 ]);
 if(status[0]?.active!==true)throw new LabError(401,"session_inactive");
 return rows;
}

export async function getLabDelivery(token:string|undefined,projectId:string) {
 const {sql,actor,sid}=access(token);
 if(!isLabUuid(projectId))throw new LabError(400,"invalid_project");
 const [,status,projects,deliverables,previews]=await sql.transaction([
  sql`SELECT set_config('os_lab.actor_id',${actor},true),set_config('os_lab.session_id',${sid},true)`,
  sql`SELECT os_lab.session_is_active(${actor},${sid}) AS active`,
  sql`SELECT id FROM os_lab.projects WHERE id=${projectId}::uuid`,
  sql`SELECT d.synthesis,d.review_note,d.client_summary,d.client_next_step,d.show_maturity,d.show_actions,
    d.draft_revision::text AS draft_revision,
    (d.reviewed_at IS NOT NULL AND d.review_project_revision=p.content_revision AND d.review_draft_revision=d.draft_revision) AS review_current
    FROM os_lab.deliverables d JOIN os_lab.projects p ON p.id=d.project_id WHERE d.project_id=${projectId}::uuid`,
  sql`SELECT os_lab.internal_portal_preview(${projectId}::uuid) AS preview`
 ]);
 if(status[0]?.active!==true)throw new LabError(401,"session_inactive");
 if(!projects.length)throw new LabError(404,"project_unavailable");
 return {draft:deliverables[0]??null,preview:previews[0]?.preview??null};
}

export async function listLabQuotes(token:string|undefined) {
 const {sql,actor,sid}=access(token);
 const [,status,rows]=await sql.transaction([
  sql`SELECT set_config('os_lab.actor_id',${actor},true),set_config('os_lab.session_id',${sid},true)`,
  sql`SELECT os_lab.session_is_active(${actor},${sid}) AS active`,
  sql`SELECT q.id,q.lead_id,l.display_name,q.minutes,q.hourly_cents,q.expense_cents::text AS expense_cents,q.fee_bps,q.margin_bps,q.cost_cents::text AS cost_cents,q.price_cents::text AS price_cents,q.created_at
       FROM os_lab.quote_estimates q JOIN os_lab.leads l ON l.id=q.lead_id ORDER BY q.created_at DESC,q.id LIMIT 100`
 ]);
 if(status[0]?.active!==true)throw new LabError(401,"session_inactive");
 return rows;
}

export async function listLabDailyQueue(token:string|undefined) {
 const {sql,actor,sid}=access(token);
 const [,status,rows]=await sql.transaction([
  sql`SELECT set_config('os_lab.actor_id',${actor},true),set_config('os_lab.session_id',${sid},true)`,
  sql`SELECT os_lab.session_is_active(${actor},${sid}) AS active`,
  sql`WITH queue AS (
   SELECT 'lead' AS kind,l.id,NULL::uuid AS project_id,l.display_name AS company,
      CASE WHEN l.intake_complete THEN 'Acompanhar oportunidade' ELSE 'Concluir triagem' END AS title,NULL::date AS due_on
   FROM os_lab.leads l WHERE NOT EXISTS(SELECT 1 FROM os_lab.projects p WHERE p.lead_id=l.id)
   UNION ALL
   SELECT 'evidence',e.id,p.id,p.label,'Revisar evidência',NULL::date
   FROM os_lab.evidence e JOIN os_lab.projects p ON p.id=e.project_id WHERE NOT e.reviewed
   UNION ALL
   SELECT 'action',a.id,p.id,p.label,CASE WHEN NOT e.reviewed OR e.kind='hypothesis' OR e.review_revision<>a.evidence_revision THEN 'Revalidar ação: '||a.title ELSE a.title END,a.due_on FROM os_lab.action_items a JOIN os_lab.projects p ON p.id=a.project_id JOIN os_lab.evidence e ON e.id=a.evidence_id WHERE NOT a.done OR NOT e.reviewed OR e.kind='hypothesis' OR e.review_revision<>a.evidence_revision
   UNION ALL
   SELECT 'appointment',a.id,p.id,p.label,a.title,a.due_on FROM os_lab.appointments a JOIN os_lab.projects p ON p.id=a.project_id WHERE NOT a.done
   UNION ALL
   SELECT 'delivery',d.project_id,p.id,p.label,'Revisar relatório',p.due_on
   FROM os_lab.deliverables d JOIN os_lab.projects p ON p.id=d.project_id
   WHERE d.reviewed_at IS NULL OR d.review_project_revision IS DISTINCT FROM p.content_revision OR d.review_draft_revision IS DISTINCT FROM d.draft_revision
  )
  SELECT kind,id,project_id,company,title,due_on::text AS due_on,count(*) OVER()::text AS total
  FROM queue ORDER BY queue.due_on NULLS LAST,company,kind,id LIMIT 50`
 ]);
 if(status[0]?.active!==true)throw new LabError(401,"session_inactive");
 return {items:rows.map(({total,...row})=>row),total:rows[0]?.total??"0"};
}
