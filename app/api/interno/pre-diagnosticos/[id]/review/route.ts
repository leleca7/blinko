import { NextResponse } from "next/server";
import { getInternalSession } from "../../../../../../lib/blinko/internal-auth";
import {
  getPreDiagnosticReviewWorkspace,
  recordPreDiagnosticReview,
} from "../../../../../../lib/blinko/neon-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Context = { params: Promise<{ id: string }> };

function asRecord(value: unknown) {
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
  const notes = typeof form.get("notes") === "string" ? String(form.get("notes")).trim().slice(0, 5000) : "";
  if (!notes) {
    return NextResponse.redirect(new URL(`/interno/pre-diagnosticos/${id}?status=missing`, request.url), 303);
  }

  const rawWorkspace = await getPreDiagnosticReviewWorkspace(id) as Record<string, unknown> | null;
  if (!rawWorkspace) return NextResponse.json({ ok: false }, { status: 404 });

  const analysis = asRecord(rawWorkspace.current_analysis);
  const analysisRunId = typeof analysis?.id === "string" ? analysis.id : null;

  const currentReview = asRecord(rawWorkspace.current_human_review);
  const currentDecision = asRecord(currentReview?.decision);
  const currentNotes = typeof currentDecision?.notes === "string" ? currentDecision.notes.trim() : "";
  const currentReviewer = typeof currentReview?.reviewer_label === "string" ? currentReview.reviewer_label : "";
  const currentAnalysisRunId = typeof currentReview?.analysis_run_id === "string" ? currentReview.analysis_run_id : null;

  const unchanged = currentNotes === notes
    && currentReviewer === session.user
    && currentAnalysisRunId === analysisRunId;

  if (unchanged) {
    return NextResponse.redirect(new URL(`/interno/pre-diagnosticos/${id}?status=unchanged`, request.url), 303);
  }

  await recordPreDiagnosticReview({
    preDiagnosticId: id,
    analysisRunId,
    reviewerLabel: session.user,
    decision: {
      notes,
      reviewed_at: new Date().toISOString(),
      source: "blinko_os_internal",
    },
  });

  return NextResponse.redirect(new URL(`/interno/pre-diagnosticos/${id}?status=saved`, request.url), 303);
}
