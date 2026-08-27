import { neon } from "@neondatabase/serverless";

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("neon_not_configured");
  }

  return databaseUrl;
}

function getSql() {
  return neon(getDatabaseUrl());
}

/**
 * Uso exclusivo do servidor.
 * Nunca importar este módulo em Client Components.
 */
export function isNeonConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export async function createPreDiagnosticSubmission<T>(payload: Record<string, unknown>) {
  const sql = getSql();
  const rows = await sql`
    select public.create_pre_diagnostic_submission(${JSON.stringify(payload)}::jsonb) as result
  `;

  return rows[0]?.result as T;
}

export async function createPreDiagnosticInitialReadingDraft(input: {
  preDiagnosticId: string;
  analysisRunId?: string | null;
  channel: string;
  subject?: string;
  body: string;
  contentVersion: string;
  createdByType: "ai" | "human" | "system";
  createdById?: string | null;
  supersedesId?: string | null;
}) {
  const sql = getSql();
  const rows = await sql`
    select public.create_pre_diagnostic_initial_reading_draft(
      ${input.preDiagnosticId}::uuid,
      ${input.analysisRunId ?? null}::uuid,
      ${input.channel},
      ${input.subject ?? ""},
      ${input.body},
      ${input.contentVersion},
      ${input.createdByType},
      ${input.createdById ?? null},
      ${input.supersedesId ?? null}::uuid
    ) as result
  `;

  return rows[0]?.result as string;
}

export async function approvePreDiagnosticInitialReading(input: {
  readingId: string;
  humanReviewId: string;
  body: string;
  subject?: string;
  reviewerUserId?: string | null;
  reviewerLabel?: string;
}) {
  const sql = getSql();
  const rows = await sql`
    select public.approve_pre_diagnostic_initial_reading(
      ${input.readingId}::uuid,
      ${input.humanReviewId}::uuid,
      ${input.body},
      ${input.subject ?? ""},
      ${input.reviewerUserId ?? null}::uuid,
      ${input.reviewerLabel ?? ""}
    ) as result
  `;

  return rows[0]?.result as string;
}

export async function markPreDiagnosticInitialReadingSent(input: {
  readingId: string;
  deliveryProvider: string;
  deliveryMessageId?: string;
}) {
  const sql = getSql();
  const rows = await sql`
    select public.record_pre_diagnostic_initial_reading_sent(
      ${input.readingId}::uuid,
      ${input.deliveryProvider},
      ${input.deliveryMessageId ?? ""}
    ) as result
  `;

  return rows[0]?.result as string;
}

export async function markPreDiagnosticInitialReadingFailed(input: {
  readingId: string;
  deliveryProvider: string;
  error: string;
}) {
  const sql = getSql();
  const rows = await sql`
    select public.record_pre_diagnostic_initial_reading_failed(
      ${input.readingId}::uuid,
      ${input.deliveryProvider},
      ${input.error}
    ) as result
  `;

  return rows[0]?.result as string;
}
