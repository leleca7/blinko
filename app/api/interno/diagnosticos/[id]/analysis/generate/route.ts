import { NextResponse } from "next/server";
import { getInternalSession } from "../../../../../../../lib/blinko/internal-auth";
import { buildDiagnosticAnalysisInput, DIAGNOSTIC_ANALYSIS_PROMPT_VERSION } from "../../../../../../../lib/blinko/diagnostic-analysis";
import { generateBlinkoDiagnosticAnalysis } from "../../../../../../../lib/blinko/diagnostic-ai-server";
import {
  getDiagnosticAnalysisContext,
  isDiagnosticAnalysisSchemaPending,
  recordDiagnosticAnalysis,
} from "../../../../../../../lib/blinko/diagnostic-analysis-server";
import {
  BlinkoAiAnalysisError,
  getBlinkoAiModel,
  getBlinkoAiProvider,
} from "../../../../../../../lib/blinko/ai-server";

export const maxDuration = 60;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const session = await getInternalSession();
  if (!session) return NextResponse.redirect(new URL("/interno/login", request.url), 303);

  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false }, { status: 404 });

  try {
    const contextData = await getDiagnosticAnalysisContext(id);
    if (!contextData.schemaReady) {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=diagnostic_schema_pending`, request.url), 303);
    }
    if (!contextData.diagnostic || !contextData.collection) return NextResponse.json({ ok: false }, { status: 404 });
    if (contextData.diagnostic.status !== "analysis") {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=deep_analysis_blocked`, request.url), 303);
    }
    if (contextData.currentAnalysis) {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=deep_analysis_exists`, request.url), 303);
    }

    const collectionId = typeof contextData.collection.id === "string" ? contextData.collection.id : "";
    if (!uuidPattern.test(collectionId)) return NextResponse.json({ ok: false }, { status: 404 });

    const result = await generateBlinkoDiagnosticAnalysis(contextData.collection);
    await recordDiagnosticAnalysis({
      diagnosticId: id,
      collectionVersionId: collectionId,
      status: "ready",
      provider: result.provider,
      model: result.model,
      promptVersion: DIAGNOSTIC_ANALYSIS_PROMPT_VERSION,
      inputSnapshot: result.safeInput,
      output: result.analysis as unknown as Record<string, unknown>,
    });

    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=deep_analysis_ready`, request.url), 303);
  } catch (error) {
    if (isDiagnosticAnalysisSchemaPending(error)) {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=diagnostic_schema_pending`, request.url), 303);
    }

    const code = error instanceof BlinkoAiAnalysisError ? error.code : "diagnostic_analysis_failed";
    const detail = error instanceof Error ? error.message.slice(0, 1500) : "Falha desconhecida";
    const provider = getBlinkoAiProvider();
    const model = getBlinkoAiModel();
    console.error("Blinko AI: falha na análise profunda", { code, detail, actor: session.user, provider, model });

    try {
      const contextData = await getDiagnosticAnalysisContext(id);
      const collectionId = typeof contextData.collection?.id === "string" ? contextData.collection.id : "";
      if (uuidPattern.test(collectionId)) {
        const safeInput = buildDiagnosticAnalysisInput(contextData.collection ?? {}).collection as Record<string, unknown>;
        await recordDiagnosticAnalysis({
          diagnosticId: id,
          collectionVersionId: collectionId,
          status: "failed",
          provider,
          model,
          promptVersion: DIAGNOSTIC_ANALYSIS_PROMPT_VERSION,
          inputSnapshot: safeInput,
          errorCode: code,
          errorDetail: detail,
        });
      }
    } catch (recordError) {
      console.error("Blinko AI: não foi possível registrar a falha da análise profunda", recordError);
    }

    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=deep_analysis_failed`, request.url), 303);
  }
}
