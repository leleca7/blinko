import "server-only";

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const BLINKO_INTERNAL_COOKIE = "blinko_internal_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;

type SessionMode = "legacy" | "individual";

type InternalSessionPayload = {
  mode: SessionMode;
  user: string;
  userId?: string;
  sessionVersion?: number;
  exp: number;
};

export type InternalSession = InternalSessionPayload & {
  displayName: string;
  roleCode: string;
  roleName: string;
  accessScope: string;
  permissions: string[];
};

type AuthIdentity = {
  mode: SessionMode;
  user: string;
  userId?: string;
  sessionVersion?: number;
  displayName: string;
  roleCode: string;
  roleName: string;
  accessScope: string;
  permissions: string[];
};

function env() {
  return {
    user: process.env.BLINKO_INTERNAL_USER?.trim() ?? "",
    password: process.env.BLINKO_INTERNAL_PASSWORD ?? "",
    secret: process.env.BLINKO_INTERNAL_SESSION_SECRET ?? "",
    databaseUrl: process.env.DATABASE_URL ?? "",
  };
}

function getSql() {
  const { databaseUrl } = env();
  if (!databaseUrl) throw new Error("neon_not_configured");
  return neon(databaseUrl);
}

function errorCode(error: unknown) {
  if (!error || typeof error !== "object") return "";
  return typeof (error as { code?: unknown }).code === "string" ? String((error as { code?: string }).code) : "";
}

function isAuthSchemaPending(error: unknown) {
  return ["42P01", "42703", "42883"].includes(errorCode(error));
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function secretConfigured() {
  return env().secret.length >= 32;
}

function legacyCredentialsConfigured() {
  const config = env();
  return Boolean(config.user && config.password && secretConfigured());
}

function legacyCredentialsMatch(user: string, password: string) {
  const config = env();
  if (!legacyCredentialsConfigured()) return false;
  return safeEqual(user.trim(), config.user) && safeEqual(password, config.password);
}

export function hashInternalPassword(password: string) {
  if (password.length < 12) throw new Error("internal_password_too_short");
  const salt = randomBytes(18);
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export function verifyInternalPassword(password: string, stored: string) {
  const [algorithm, nRaw, rRaw, pRaw, saltRaw, hashRaw] = stored.split("$");
  if (algorithm !== "scrypt" || !nRaw || !rRaw || !pRaw || !saltRaw || !hashRaw) return false;
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (N !== SCRYPT_N || r !== SCRYPT_R || p !== SCRYPT_P) return false;
  try {
    const expected = Buffer.from(hashRaw, "base64url");
    const actual = scryptSync(password, Buffer.from(saltRaw, "base64url"), expected.length, {
      N,
      r,
      p,
      maxmem: 64 * 1024 * 1024,
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

async function individualAuthInitialized() {
  if (!env().databaseUrl) return false;
  const sql = getSql();
  try {
    const rows = await sql`select public.internal_individual_auth_initialized() as initialized`;
    return rows[0]?.initialized === true;
  } catch (error) {
    if (isAuthSchemaPending(error)) return false;
    throw error;
  }
}

export async function getInternalAccessMode(): Promise<"individual" | "bootstrap" | "unconfigured"> {
  if (!secretConfigured()) return "unconfigured";
  if (await individualAuthInitialized()) return "individual";
  return legacyCredentialsConfigured() ? "bootstrap" : "unconfigured";
}

export async function isInternalAccessConfigured() {
  return (await getInternalAccessMode()) !== "unconfigured";
}

async function loadIndividualIdentityById(userId: string, expectedUsername?: string): Promise<AuthIdentity | null> {
  const sql = getSql();
  try {
    const rows = await sql`
      select id,username,display_name,role_code,role_name,access_scope,login_enabled,status,permissions,session_version
      from public.internal_user_access
      where id=${userId}::uuid
      limit 1
    `;
    const row = rows[0];
    if (!row || row.status !== "active" || row.login_enabled !== true) return null;
    const username = String(row.username ?? "");
    const sessionVersion = Number(row.session_version);
    if (!username || !Number.isInteger(sessionVersion) || sessionVersion < 1 || (expectedUsername && username !== expectedUsername)) return null;
    return {
      mode: "individual",
      user: username,
      userId: String(row.id),
      sessionVersion,
      displayName: String(row.display_name ?? username),
      roleCode: String(row.role_code ?? ""),
      roleName: String(row.role_name ?? ""),
      accessScope: String(row.access_scope ?? "global"),
      permissions: Array.isArray(row.permissions) ? row.permissions.map(String) : [],
    };
  } catch (error) {
    if (isAuthSchemaPending(error)) return null;
    throw error;
  }
}

async function authenticateIndividual(user: string, password: string): Promise<AuthIdentity | null> {
  const sql = getSql();
  try {
    const rows = await sql`
      select u.id,u.username,u.display_name,u.password_hash,u.status,u.session_version,
             r.code as role_code,r.name as role_name,r.access_scope,r.login_enabled,
             coalesce(array_agg(rp.permission_code order by rp.permission_code) filter (where rp.permission_code is not null),array[]::text[]) as permissions
      from public.internal_users u
      join public.internal_roles r on r.code=u.role_code and r.status='active'
      left join public.internal_role_permissions rp on rp.role_code=r.code
      where lower(u.username)=lower(${user.trim()})
      group by u.id,r.code,r.name,r.access_scope,r.login_enabled
      limit 1
    `;
    const row = rows[0];
    if (!row || row.status !== "active" || row.login_enabled !== true) return null;
    if (!verifyInternalPassword(password, String(row.password_hash ?? ""))) return null;
    const sessionVersion = Number(row.session_version);
    if (!Number.isInteger(sessionVersion) || sessionVersion < 1) return null;
    await sql`select public.record_internal_login(${String(row.id)}::uuid)`;
    return {
      mode: "individual",
      user: String(row.username),
      userId: String(row.id),
      sessionVersion,
      displayName: String(row.display_name ?? row.username),
      roleCode: String(row.role_code ?? ""),
      roleName: String(row.role_name ?? ""),
      accessScope: String(row.access_scope ?? "global"),
      permissions: Array.isArray(row.permissions) ? row.permissions.map(String) : [],
    };
  } catch (error) {
    if (isAuthSchemaPending(error)) return null;
    throw error;
  }
}

export async function authenticateInternalCredentials(user: string, password: string): Promise<AuthIdentity | null> {
  const mode = await getInternalAccessMode();
  if (mode === "individual") return authenticateIndividual(user, password);
  if (mode === "bootstrap" && legacyCredentialsMatch(user, password)) {
    const username = user.trim();
    return {
      mode: "legacy",
      user: username,
      displayName: username,
      roleCode: "bootstrap_admin",
      roleName: "Bootstrap Admin",
      accessScope: "global",
      permissions: ["*"],
    };
  }
  return null;
}

export function createInternalSessionToken(identity: AuthIdentity) {
  const { secret } = env();
  if (!secretConfigured()) throw new Error("internal_access_not_configured");
  if (identity.mode === "individual" && (!identity.userId || !Number.isInteger(identity.sessionVersion))) throw new Error("invalid_individual_session_identity");
  const payload: InternalSessionPayload = {
    mode: identity.mode,
    user: identity.user,
    userId: identity.userId,
    sessionVersion: identity.sessionVersion,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded, secret)}`;
}

export function verifyInternalSessionToken(token: string | undefined | null) {
  if (!token || !secretConfigured()) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const { secret } = env();
  const expected = sign(encoded, secret);
  if (!safeEqual(signature, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as InternalSessionPayload;
    if (!payload.mode || !payload.user || !payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    if (payload.mode === "individual" && (!payload.userId || !Number.isInteger(payload.sessionVersion) || Number(payload.sessionVersion) < 1)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getInternalSession(): Promise<InternalSession | null> {
  const store = await cookies();
  const payload = verifyInternalSessionToken(store.get(BLINKO_INTERNAL_COOKIE)?.value);
  if (!payload) return null;

  if (payload.mode === "individual") {
    const identity = await loadIndividualIdentityById(String(payload.userId), payload.user);
    if (!identity || identity.sessionVersion !== payload.sessionVersion) return null;
    return { ...identity, exp: payload.exp };
  }

  // Uma vez inicializado o auth individual, sessões bootstrap compartilhadas deixam de ser válidas.
  if (await individualAuthInitialized()) return null;
  if (!legacyCredentialsConfigured() || payload.user !== env().user) return null;
  return {
    ...payload,
    displayName: payload.user,
    roleCode: "bootstrap_admin",
    roleName: "Bootstrap Admin",
    accessScope: "global",
    permissions: ["*"],
  };
}

export function hasInternalPermission(session: InternalSession, permissionCode: string) {
  return session.mode === "legacy" || session.permissions.includes("*") || session.permissions.includes(permissionCode);
}

export async function hasInternalProjectPermission(session: InternalSession, projectId: string, permissionCode: string) {
  if (session.mode === "legacy") return true;
  if (!session.userId) return false;
  const sql = getSql();
  try {
    const rows = await sql`select public.internal_user_can_access_project(${session.userId}::uuid,${projectId}::uuid,${permissionCode}) as allowed`;
    return rows[0]?.allowed === true;
  } catch (error) {
    if (isAuthSchemaPending(error)) return false;
    throw error;
  }
}

export async function requireInternalSession(permissionCode?: string) {
  const session = await getInternalSession();
  if (!session) redirect("/interno/login");
  if (permissionCode && !hasInternalPermission(session, permissionCode)) redirect("/interno?status=forbidden");
  return session;
}

export async function requireInternalProjectSession(projectId: string, permissionCode: string) {
  const session = await requireInternalSession();
  if (!(await hasInternalProjectPermission(session, projectId, permissionCode))) redirect("/interno?status=forbidden");
  return session;
}
