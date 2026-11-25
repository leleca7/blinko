import { createHmac, timingSafeEqual } from 'node:crypto';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isLabUuid = (value: unknown): value is string => typeof value === 'string' && uuid.test(value);
export const LAB_COOKIE = 'blinko_os_lab_session';
const AUDIENCE = 'blinko-os-sandbox';
const MAX_AGE = 3600;
export function verifyLabSession(token: string | undefined, secret: string, now = Math.floor(Date.now()/1000)): {actorId:string;sessionId:string} | null {
  if (!token || token.length > 2048 || Buffer.byteLength(secret) < 32) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || parts.some(p => !/^[A-Za-z0-9_-]+$/.test(p))) return null;
  const [body, signature] = parts;
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(signature), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a,b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body,'base64url').toString('utf8'));
    if (!p || p.aud !== AUDIENCE || !isLabUuid(p.sub) || !isLabUuid(p.sid) || !Number.isSafeInteger(p.iat) || !Number.isSafeInteger(p.exp) || p.iat > now || p.exp <= now || p.exp <= p.iat || p.exp-p.iat > MAX_AGE) return null;
    return {actorId:p.sub.toLowerCase(),sessionId:p.sid.toLowerCase()};
  } catch { return null; }
}
export function validateEvidence(value: unknown): {projectId:string; pillar:number; kind:'fact'|'report'|'hypothesis'; summary:string} | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const p = value as Record<string, unknown>;
  if (Object.keys(p).some(k => !['projectId','pillar','kind','summary'].includes(k))) return null;
  if (!isLabUuid(p.projectId) || typeof p.pillar !== 'number' || !Number.isInteger(p.pillar) || p.pillar < 0 || p.pillar > 9 || (p.kind !== 'fact' && p.kind !== 'report' && p.kind !== 'hypothesis') || typeof p.summary !== 'string' || !p.summary.trim() || p.summary.trim().length > 500) return null;
  return {projectId:p.projectId.toLowerCase(),pillar:p.pillar,kind:p.kind,summary:p.summary.trim()};
}
export function isSandboxConnection(connection: string): boolean {
  try {
    const u = new URL(connection);
    return (u.protocol==='postgresql:' || u.protocol==='postgres:') && u.hostname==='ep-old-art-bbztkcnw.c-15.us-east-1.aws.neon.tech' && u.pathname==='/blinko_sandbox' && u.username==='os_lab_runtime' && !!u.password && u.searchParams.get('sslmode')==='require' && !u.hash && (!u.port || u.port==='5432');
  } catch { return false; }
}

export function validateEvidenceReview(value: unknown): {evidenceId:string;reviewed:boolean;reason:string} | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const p=value as Record<string,unknown>;
  if (Object.keys(p).some(k=>!['evidenceId','reviewed','reason'].includes(k))) return null;
  if (!isLabUuid(p.evidenceId) || typeof p.reviewed !== 'boolean' || typeof p.reason !== 'string' || !p.reason.trim() || p.reason.trim().length>500) return null;
  return {evidenceId:p.evidenceId.toLowerCase(),reviewed:p.reviewed,reason:p.reason.trim()};
}
