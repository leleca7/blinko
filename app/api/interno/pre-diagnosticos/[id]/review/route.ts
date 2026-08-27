import { NextResponse } from "next/server";
import { getInternalSession } from "../../../../../../lib/blinko/internal-auth";
import {
  getPreDiagnosticReviewWorkspace,
  recordPreDiagnosticReview,
} from "../../../../../../lib/blinko/neon-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Context = { params: Promise<{ id: string }> };

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

  const analysis = rawWorkspace.current_analysis;
  const analysisRunId = analysis && typeof analysis === "object" && !Array.isArray(analysis)
    && typeof (analysis as Record<string, unknown>).id === "string"
    ? String((analysis as Record<string, unknown>).id)
    : null;

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
