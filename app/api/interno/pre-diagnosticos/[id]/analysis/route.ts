import { NextResponse } from "next/server";
import {
  buildAiSafePreDiagnosticSnapshot,
  BlinkoAiAnalysisError,
  generateBlinkoPreDiagnosticAnalysis,
  getBlinkoAiModel,
} from "../../../../../../lib/blinko/ai-server";
import { getInternalSession } from "../../../../../../lib/blinko/internal-auth";
import {
  getPreDiagnosticReviewWorkspace,
  recordPreDiagnosticAnalysis,
} from "../../../../../../lib/blinko/neon-server";
import { PRE_DIAGNOSTIC_PROMPT_VERSION } from "../../../../../../lib/blinko/pre-diagnostic-analysis";
import { normalizeReviewWorkspace } from "../../../../../../lib/blinko/review-workspace";

export const maxDuration = 60;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const session = await getInternalSession();
  if (!session) {
    return NextResponse.redirect(new URL("/interno/login", request.url), 303);
  }

  const { id } = await context.params;
  if (!uuidPattern.test(id)) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const workspace = normalizeReviewWorkspace(await getPreDiagnosticReviewWorkspace(id));
  if (!workspace) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  if (workspace.current_analysis) {
    return NextResponse.redirect(
      new URL(`/interno/pre-diagnosticos/${id}?status=ai_exists`, request.url),
      303,
    );
  }

  if (workspace.current_human_review) {
    return NextResponse.redirect(
      new URL(`/interno/pre-diagnosticos/${id}?status=ai_review_exists`, request.url),
      303,
    );
  }

  const inputSnapshot = buildAiSafePreDiagnosticSnapshot(workspace);
  const model = getBlinkoAiModel();

  try {
    const result = await generateBlinkoPreDiagnosticAnalysis(inputSnapshot);

    await recordPreDiagnosticAnalysis({
      preDiagnosticId: id,
      status: "ready",
      provider: "vercel-ai-gateway",
      model: result.model,
      promptVersion: PRE_DIAGNOSTIC_PROMPT_VERSION,
      inputSnapshot,
      output: result.analysis as unknown as Record<string, unknown>,
    });

    return NextResponse.redirect(
      new URL(`/interno/pre-diagnosticos/${id}?status=ai_ready`, request.url),
      303,
    );
  } catch (error) {
    const code = error instanceof BlinkoAiAnalysisError ? error.code : "generation_failed";
    const detail = error instanceof Error ? error.message.slice(0, 1200) : "Falha desconhecida na geração.";

    try {
      await recordPreDiagnosticAnalysis({
        preDiagnosticId: id,
        status: "failed",
        provider: "vercel-ai-gateway",
        model,
        promptVersion: PRE_DIAGNOSTIC_PROMPT_VERSION,
        inputSnapshot,
        errorCode: code,
        errorDetail: detail,
      });
    } catch (recordError) {
      console.error("Blinko AI: falha ao registrar execução com erro", recordError);
    }

    console.error("Blinko AI: análise do pré-diagnóstico falhou", { code, detail });
    return NextResponse.redirect(
      new URL(`/interno/pre-diagnosticos/${id}?status=ai_failed`, request.url),
      303,
    );
  }
}
