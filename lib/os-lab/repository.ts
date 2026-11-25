import "server-only";
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { isSandboxConnection, isLabUuid, validateEvidence, verifyLabSession } from "./session";

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
