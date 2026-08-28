import { NextResponse } from "next/server";
import { getInternalSession } from "../../../../../../../../lib/blinko/internal-auth";
import { normalizeDiagnosticAnalysis } from "../../../../../../../../lib/blinko/diagnostic-analysis";
import {
  getDiagnosticAnalysisContext,
  isDiagnosticAnalysisSchemaPending,
  recordManualDiagnosticAnalysis,
} from "../../../../../../../../lib/blinko/diagnostic-analysis-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

type Context = { params: Promise<{ id: string }> };

function field(form: FormData, name: string, max = 5000) {
  return String(form.get(name) ?? "").trim().slice(0, max);
}

function lines(form: FormData, name: string, maxItems = 30) {
  return field(form, name, 12000)
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

export async function POST(request: Request, context: Context) {
  const session = await getInternalSession();
  if (!session) return NextResponse.redirect(new URL("/interno/login", request.url), 303);

  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false }, { status: 404 });

  const form = await request.formData();
  const summary = field(form, "summary");
  if (!summary) {
    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=manual_analysis_missing`, request.url), 303);
  }

  try {
    const contextData = await getDiagnosticAnalysisContext(id);
    if (!contextData.schemaReady) {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=diagnostic_schema_pending`, request.url), 303);
    }

    const diagnosticStatus = typeof contextData.diagnostic?.status === "string" ? contextData.diagnostic.status : "";
    const collectionId = typeof contextData.collection?.id === "string" ? contextData.collection.id : "";
    if (diagnosticStatus !== "analysis" || !uuidPattern.test(collectionId)) {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=manual_analysis_blocked`, request.url), 303);
    }

    if (contextData.currentAnalysis) {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=deep_analysis_exists`, request.url), 303);
    }

    const strengths = lines(form, "strengths", 20).map((statement) => ({ pillar: "", statement, evidence: [] as string[] }));
    const signals = lines(form, "signals", 30).map((statement) => ({ pillar: "", statement, evidence: [] as string[], confidence: "low" as const }));
    const hypotheses = lines(form, "hypotheses", 24).map((statement) => ({
      statement,
      related_pillars: [] as string[],
      evidence: [] as string[],
      confidence: "low" as const,
      validation_needed: "Validar na revisão humana e confrontar com as evidências da coleta.",
    }));
    const missingInformation = lines(form, "missing_information", 30);
    const validationQuestions = lines(form, "validation_questions", 20);
    const rpNotes = field(form, "rp_notes", 2500);
    const crisisAssessment = field(form, "crisis_assessment", 80) === "requires_human_assessment"
      ? "requires_human_assessment"
      : "no_evidence_of_crisis";

    const output = normalizeDiagnosticAnalysis({
      summary,
      strengths,
      signals,
      cross_pillar_patterns: [],
      hypotheses,
      contradictions: [],
      missing_information: missingInformation,
      problem_candidates: [],
      validation_questions: validationQuestions,
      rp_lens: {
        stakeholders: [],
        trust_reputation_signals: [],
        discourse_practice_coherence: [],
        reputational_risks: [],
        crisis_assessment: crisisAssessment,
        notes: rpNotes,
      },
    });

    if (!output) {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=manual_analysis_invalid`, request.url), 303);
    }

    await recordManualDiagnosticAnalysis({
      diagnosticId: id,
      collectionVersionId: collectionId,
      actorLabel: session.user,
      inputSnapshot: {
        source: "manual-analysis-v1",
        collection_version_id: collectionId,
      },
      output: output as unknown as Record<string, unknown>,
    });

    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=manual_analysis_ready`, request.url), 303);
  } catch (error) {
    if (isDiagnosticAnalysisSchemaPending(error)) {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=diagnostic_schema_pending`, request.url), 303);
    }
    console.error("Blinko OS: falha ao registrar análise manual", error);
    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=manual_analysis_failed`, request.url), 303);
  }
}
