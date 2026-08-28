import { NextResponse } from "next/server";
import { getInternalSession } from "../../../../../../../lib/blinko/internal-auth";
import {
  getDiagnosticAnalysisContext,
  isDiagnosticAnalysisSchemaPending,
  recordDiagnosticAnalysisReview,
} from "../../../../../../../lib/blinko/diagnostic-analysis-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Context = { params: Promise<{ id: string }> };

function field(form: FormData, name: string, max = 7000) {
  return String(form.get(name) ?? "").trim().slice(0, max);
}

export async function POST(request: Request, context: Context) {
  const session = await getInternalSession();
  if (!session) return NextResponse.redirect(new URL("/interno/login", request.url), 303);

  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false }, { status: 404 });

  const form = await request.formData();
  const analysisRunId = field(form, "analysis_run_id", 80);
  const notes = field(form, "notes");
  const validatedPoints = field(form, "validated_points", 5000);
  const discardedOrUnproven = field(form, "discarded_or_unproven", 5000);
  const additionalValidationNeeded = field(form, "additional_validation_needed", 5000);

  if (!uuidPattern.test(analysisRunId) || !notes) {
    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=deep_review_missing`, request.url), 303);
  }

  try {
    const contextData = await getDiagnosticAnalysisContext(id);
    if (!contextData.schemaReady) {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=diagnostic_schema_pending`, request.url), 303);
    }

    const currentId = typeof contextData.currentAnalysis?.id === "string" ? contextData.currentAnalysis.id : "";
    const currentStatus = typeof contextData.currentAnalysis?.status === "string" ? contextData.currentAnalysis.status : "";
    if (currentId !== analysisRunId || currentStatus !== "ready") {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=deep_review_not_current`, request.url), 303);
    }

    await recordDiagnosticAnalysisReview({
      diagnosticId: id,
      analysisRunId,
      reviewerLabel: session.user,
      decision: {
        notes,
        validated_points: validatedPoints,
        discarded_or_unproven: discardedOrUnproven,
        additional_validation_needed: additionalValidationNeeded,
        reviewed_at: new Date().toISOString(),
        source: "blinko_os_internal",
      },
    });

    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=deep_review_saved`, request.url), 303);
  } catch (error) {
    if (isDiagnosticAnalysisSchemaPending(error)) {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=diagnostic_schema_pending`, request.url), 303);
    }
    console.error("Blinko OS: falha ao registrar revisão da análise profunda", error);
    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=deep_review_failed`, request.url), 303);
  }
}
