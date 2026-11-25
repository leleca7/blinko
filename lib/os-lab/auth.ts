import "server-only";
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { accessCodeDigest,isIssuerConnection,isSandboxConnection,signLabSession,verifyLabSession } from "./session";

export async function redeemLabCode(code:unknown){
 const digest=accessCodeDigest(code);
 const url=process.env.BLINKO_OS_LAB_ISSUER_URL??"";
 const secret=process.env.BLINKO_OS_LAB_SESSION_SECRET??"";
 if(!digest)return null;
 if(!isIssuerConnection(url)||Buffer.byteLength(secret)<32)throw new Error("auth_not_configured");
 const sql=neon(url);
 const rows=await sql`SELECT member_id,session_id,issued_epoch::text,expires_epoch::text FROM os_lab.redeem_access_code(${digest},${randomUUID()}::uuid)`;
 if(rows.length!==1)return null;
 const r=rows[0],issued=Number(r.issued_epoch),expires=Number(r.expires_epoch);
 const token=signLabSession(r.member_id,r.session_id,issued,expires,secret);
 if(!token)throw new Error("invalid_session_result");
 return {token,maxAge:Math.max(0,expires-Math.floor(Date.now()/1000))};
}
export async function endLabSession(token:string|undefined){
 const session=verifyLabSession(token,process.env.BLINKO_OS_LAB_SESSION_SECRET??"");
 if(!session)return;
 const url=process.env.BLINKO_OS_LAB_DATABASE_URL??"";
 if(!isSandboxConnection(url))throw new Error("auth_not_configured");
 const sql=neon(url);
 await sql.transaction([
  sql`SELECT set_config('os_lab.actor_id',${session.actorId},true),set_config('os_lab.session_id',${session.sessionId},true)`,
  sql`SELECT os_lab.revoke_own_session()`
 ]);
}
