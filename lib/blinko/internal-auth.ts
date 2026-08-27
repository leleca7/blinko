import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const BLINKO_INTERNAL_COOKIE = "blinko_internal_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

type InternalSessionPayload = {
  user: string;
  exp: number;
};

function env() {
  return {
    user: process.env.BLINKO_INTERNAL_USER?.trim() ?? "",
    password: process.env.BLINKO_INTERNAL_PASSWORD ?? "",
    secret: process.env.BLINKO_INTERNAL_SESSION_SECRET ?? "",
  };
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

export function isInternalAccessConfigured() {
  const config = env();
  return Boolean(config.user && config.password && config.secret.length >= 32);
}

export function verifyInternalCredentials(user: string, password: string) {
  const config = env();
  if (!isInternalAccessConfigured()) return false;
  return safeEqual(user.trim(), config.user) && safeEqual(password, config.password);
}

export function createInternalSessionToken(user: string) {
  const { secret } = env();
  if (!isInternalAccessConfigured()) throw new Error("internal_access_not_configured");

  const payload: InternalSessionPayload = {
    user,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded, secret)}`;
}

export function verifyInternalSessionToken(token: string | undefined | null) {
  if (!token || !isInternalAccessConfigured()) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const { secret } = env();
  const expected = sign(encoded, secret);
  if (!safeEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as InternalSessionPayload;
    if (!payload.user || !payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getInternalSession() {
  const store = await cookies();
  return verifyInternalSessionToken(store.get(BLINKO_INTERNAL_COOKIE)?.value);
}

export async function requireInternalSession() {
  const session = await getInternalSession();
  if (!session) redirect("/interno/login");
  return session;
}
