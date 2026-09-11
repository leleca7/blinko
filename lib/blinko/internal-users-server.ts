import "server-only";

import { neon } from "@neondatabase/serverless";
import { hashInternalPassword, type InternalSession } from "./internal-auth";

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("neon_not_configured");
  return neon(databaseUrl);
}

function errorCode(error: unknown) {
  if (!error || typeof error !== "object") return "";
  return typeof (error as { code?: unknown }).code === "string" ? String((error as { code?: string }).code) : "";
}

export function isInternalUsersSchemaPending(error: unknown) {
  return ["42P01", "42703", "42883"].includes(errorCode(error));
}

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export async function getInternalUsersAdminContext() {
  const sql = getSql();
  try {
    const [userRows, roleRows] = await Promise.all([
      sql`select to_jsonb(u) - 'password_hash' as result from public.internal_user_access u order by case when u.status='active' then 0 else 1 end,u.created_at,u.username`,
      sql`select jsonb_build_object('code',code,'name',name,'description',description,'access_scope',access_scope,'login_enabled',login_enabled,'status',status,'display_order',display_order) as result from public.internal_roles order by display_order`,
    ]);
    return {
      schemaReady: true,
      users: userRows.map((row) => record(row.result)).filter(Boolean) as Record<string, unknown>[],
      roles: roleRows.map((row) => record(row.result)).filter(Boolean) as Record<string, unknown>[],
    };
  } catch (error) {
    if (isInternalUsersSchemaPending(error)) return { schemaReady: false, users: [], roles: [] };
    throw error;
  }
}

function actorUserId(session: InternalSession) {
  return session.mode === "individual" ? session.userId ?? null : null;
}

export async function createInternalUserAccount(input: {
  username: string;
  displayName: string;
  email?: string;
  roleCode: string;
  password: string;
  session: InternalSession;
}) {
  const sql = getSql();
  if (!['admin','strategy_consulting','operations','financial'].includes(input.roleCode)) {
    throw new Error("internal_role_not_available_for_internal_login");
  }
  const passwordHash = hashInternalPassword(input.password);
  const rows = await sql`
    select public.create_internal_user(
      ${input.username},${input.displayName},${input.email ?? ""},${input.roleCode},${passwordHash},null,
      ${actorUserId(input.session)}::uuid,${input.session.user}
    ) as result
  `;
  return String(rows[0]?.result ?? "");
}

export async function setInternalUserStatus(input: { userId: string; status: "active" | "disabled"; session: InternalSession }) {
  const sql = getSql();
  const rows = await sql`select public.set_internal_user_status(${input.userId}::uuid,${input.status},${actorUserId(input.session)}::uuid,${input.session.user}) as result`;
  return String(rows[0]?.result ?? "");
}

export async function setInternalUserRole(input: { userId: string; roleCode: string; session: InternalSession }) {
  if (!['admin','strategy_consulting','operations','financial'].includes(input.roleCode)) {
    throw new Error("internal_role_not_available_for_internal_login");
  }
  const sql = getSql();
  const rows = await sql`select public.set_internal_user_role(${input.userId}::uuid,${input.roleCode},null,${actorUserId(input.session)}::uuid,${input.session.user}) as result`;
  return String(rows[0]?.result ?? "");
}

export async function resetInternalUserPassword(input: { userId: string; password: string; session: InternalSession }) {
  const sql = getSql();
  const passwordHash = hashInternalPassword(input.password);
  const rows = await sql`select public.set_internal_user_password_hash(${input.userId}::uuid,${passwordHash},${actorUserId(input.session)}::uuid,${input.session.user}) as result`;
  return String(rows[0]?.result ?? "");
}
