import "server-only";
import { validateOperation } from "./operations";
import { randomUUID } from "node:crypto";
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
    sql`SELECT id,label FROM os_lab.projects ORDER BY label,id LIMIT 100`
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
    sql`SELECT id,pillar,kind,summary,reviewed FROM os_lab.evidence WHERE project_id=${projectId}::uuid ORDER BY id LIMIT 100`
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
      sql`INSERT INTO os_lab.evidence(id,project_id,org_id,pillar,kind,summary)
          SELECT ${randomUUID()}::uuid,p.id,p.org_id,${input.pillar},${input.kind},${input.summary}
          FROM os_lab.projects p WHERE p.id=${input.projectId}::uuid
          AND os_lab.can_access_project(p.id,p.org_id,true)
          RETURNING id,pillar,kind,summary,reviewed`
    ]);
    if (status[0]?.active!==true) throw new LabError(401,"session_inactive");
    if (!rows.length) throw new LabError(404,"project_unavailable");
    return rows[0];
  } catch (error) {
    if (error instanceof LabError) throw error;
    if (typeof error==="object" && error!==null && "code" in error && error.code==="42501") throw new LabError(403,"access_denied");
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
  const [,status,projects,scores,actions,appointments,financeAccess,ledger,totals]=await sql.transaction([
    sql`SELECT set_config('os_lab.actor_id', ${actor}, true),set_config('os_lab.session_id', ${sid}, true)`,
    sql`SELECT os_lab.session_is_active(${actor},${sid}) AS active`,
    sql`SELECT id FROM os_lab.projects WHERE id=${projectId}::uuid`,
    sql`SELECT s.pillar,s.value,s.evidence_id,
      (e.reviewed AND e.kind<>'hypothesis' AND e.review_revision=s.evidence_revision) AS eligible
      FROM os_lab.radar_scores s JOIN os_lab.evidence e ON e.id=s.evidence_id WHERE s.project_id=${projectId}::uuid ORDER BY s.pillar`,
    sql`SELECT a.id,a.title,a.owner_label,a.due_on,a.gravity,a.urgency,a.tendency,a.gut,a.done,a.evidence_id,
      (e.reviewed AND e.kind<>'hypothesis' AND e.review_revision=a.evidence_revision) AS eligible
      FROM os_lab.action_items a JOIN os_lab.evidence e ON e.id=a.evidence_id WHERE a.project_id=${projectId}::uuid ORDER BY a.due_on,a.id LIMIT 100`,
    sql`SELECT id,title,kind,due_on,done FROM os_lab.appointments WHERE project_id=${projectId}::uuid ORDER BY due_on,id LIMIT 100`,
    sql`SELECT os_lab.can_access_finance(p.id,p.org_id) AS allowed FROM os_lab.projects p WHERE p.id=${projectId}::uuid`,
    sql`SELECT id,label,kind,cents::text AS cents,due_on,settled_at FROM os_lab.ledger_entries WHERE project_id=${projectId}::uuid ORDER BY due_on,id LIMIT 100`,
    sql`SELECT COALESCE(sum(cents) FILTER(WHERE kind='income'),0)::text AS planned_income,
       COALESCE(sum(cents) FILTER(WHERE kind='expense'),0)::text AS planned_expense,
       COALESCE(sum(cents) FILTER(WHERE kind='income' AND settled_at IS NOT NULL),0)::text AS realized_income,
       COALESCE(sum(cents) FILTER(WHERE kind='expense' AND settled_at IS NOT NULL),0)::text AS realized_expense
       FROM os_lab.ledger_entries WHERE project_id=${projectId}::uuid`
  ]);
  if(status[0]?.active!==true)throw new LabError(401,"session_inactive");
  if(!projects.length)throw new LabError(404,"project_unavailable");
  return {scores,actions,appointments,finance:financeAccess[0]?.allowed===true?{entries:ledger,totals:totals[0]}:null};
}
export async function mutateLabOperation(token:string|undefined,body:unknown) {
 const {sql,actor,sid}=access(token);
 const op=validateOperation(body);
 if(!op)throw new LabError(400,"invalid_operation");
 const command=op.type==="score"
  ? sql`SELECT os_lab.save_radar_score(${op.projectId}::uuid,${op.pillar}::integer,${op.value}::integer,${op.evidenceId}::uuid) AS changed`
  : op.type==="action"
  ? sql`SELECT os_lab.create_action_item(${op.id}::uuid,${op.projectId}::uuid,${op.evidenceId}::uuid,${op.title},${op.owner},${op.due}::date,${op.gravity}::integer,${op.urgency}::integer,${op.tendency}::integer) AS changed`
  : op.type==="completion"
  ? sql`SELECT os_lab.set_action_done(${op.id}::uuid,${op.done}) AS changed`
  : op.type==="appointment"
  ? sql`SELECT os_lab.create_appointment(${op.id}::uuid,${op.projectId}::uuid,${op.title},${op.kind},${op.due}::date) AS changed`
  : op.type==="appointment_done"
  ? sql`SELECT os_lab.set_appointment_done(${op.id}::uuid,${op.done}) AS changed`
  : op.type==="ledger"
  ? sql`SELECT os_lab.create_ledger_entry(${op.id}::uuid,${op.projectId}::uuid,${op.label},${op.kind},${op.cents}::bigint,${op.due}::date) AS changed`
  : sql`SELECT os_lab.set_ledger_settled(${op.id}::uuid,${op.settled}) AS changed`;
 try {
  const [,rows]=await sql.transaction([
   sql`SELECT set_config('os_lab.actor_id',${actor},true),set_config('os_lab.session_id',${sid},true)`,
   command
  ]);
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
