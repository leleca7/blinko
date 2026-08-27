import { NextResponse } from "next/server";
import { getInternalSession } from "../../../../../../../lib/blinko/internal-auth";
import {
  approvePreDiagnosticInitialReading,
  getPreDiagnosticReviewWorkspace,
} from "../../../../../../../lib/blinko/neon-server";
import { normalizeReviewWorkspace } from "../../../../../../../lib/blinko/review-workspace";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Context = { params: Promise<{ id: string }> };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export async function POST(request: Request, context: Context) {
  const session = await getInternalSession();
  if (!session) return NextResponse.redirect(new URL("/interno/login", request.url), 303);

  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false }, { status: 404 });

  const form = await request.formData();
  const readingId = String(form.get("reading_id") ?? "").trim();
  const body = String(form.get("body") ?? "").trim().slice(0, 1800);
  const subject = String(form.get("subject") ?? "").trim().slice(0, 180);

  if (!uuidPattern.test(readingId)) return NextResponse.json({ ok: false }, { status: 404 });
  if (!body) return NextResponse.redirect(new URL(`/interno/pre-diagnosticos/${id}?status=reading_missing_body`, request.url), 303);

  const workspace = normalizeReviewWorkspace(await getPreDiagnosticReviewWorkspace(id));
  if (!workspace) return NextResponse.json({ ok: false }, { status: 404 });

  const review = asRecord(workspace.current_human_review);
  const reviewId = typeof review?.id === "string" ? review.id : "";
  if (!uuidPattern.test(reviewId)) {
    return NextResponse.redirect(new URL(`/interno/pre-diagnosticos/${id}?status=reading_missing_review`, request.url), 303);
  }

  const latest = asRecord(workspace.latest_initial_reading);
  const latestId = typeof latest?.id === "string" ? latest.id : "";
  const latestStatus = typeof latest?.status === "string" ? latest.status : "";

  if (latestId !== readingId) {
    return NextResponse.redirect(new URL(`/interno/pre-diagnosticos/${id}?status=reading_not_current`, request.url), 303);
  }

  if (!['draft', 'pending_approval'].includes(latestStatus)) {
    return NextResponse.redirect(new URL(`/interno/pre-diagnosticos/${id}?status=reading_not_approvable`, request.url), 303);
  }

  await approvePreDiagnosticInitialReading({
    readingId,
    humanReviewId: reviewId,
    body,
    subject,
    reviewerLabel: session.user,
  });

  return NextResponse.redirect(new URL(`/interno/pre-diagnosticos/${id}?status=reading_approved`, request.url), 303);
}
