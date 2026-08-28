import "server-only";

import { generateText } from "ai";
import {
  BlinkoAiAnalysisError,
  getBlinkoAiModel,
  getBlinkoAiProvider,
} from "./ai-server";
import { google } from "@ai-sdk/google";
import {
  buildDiagnosticAnalysisInput,
  normalizeDiagnosticAnalysis,
  type DiagnosticAnalysisDraft,
} from "./diagnostic-analysis";

function parseJsonObject(raw: string) {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace < 0 || lastBrace <= firstBrace) return null;
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as unknown;
    } catch {
      return null;
    }
  }
}

function getDiagnosticLanguageModel() {
  const model = getBlinkoAiModel();
  return getBlinkoAiProvider() === "google-generative-ai" ? google(model) : model;
}

export async function generateBlinkoDiagnosticAnalysis(
  collection: Record<string, unknown>,
): Promise<{
  analysis: DiagnosticAnalysisDraft;
  model: string;
  provider: ReturnType<typeof getBlinkoAiProvider>;
  safeInput: Record<string, unknown>;
}> {
  const model = getBlinkoAiModel();
  const provider = getBlinkoAiProvider();
  const request = buildDiagnosticAnalysisInput(collection);
  const safeInput = request.collection as Record<string, unknown>;

  const { text } = await generateText({
    model: getDiagnosticLanguageModel(),
    prompt: `${request.instruction}\n\nFORMATO:\nResponda somente com JSON válido, sem markdown, sem comentários e sem texto antes ou depois. Não repita identificadores pessoais que eventualmente apareçam no material.\n\nCOLETA DO DIAGNÓSTICO:\n${JSON.stringify(safeInput, null, 2)}\n\nFORMATO ESPERADO:\n${JSON.stringify(request.expectedShape, null, 2)}`,
  });

  const parsed = parseJsonObject(text);
  if (!parsed) {
    throw new BlinkoAiAnalysisError("diagnostic_analysis_invalid_json", "A Blinko AI não retornou JSON válido para o diagnóstico.");
  }

  const analysis = normalizeDiagnosticAnalysis(parsed);
  if (!analysis) {
    throw new BlinkoAiAnalysisError("diagnostic_analysis_invalid_output", "A análise profunda não passou pela validação do contrato.");
  }

  return { analysis, model, provider, safeInput };
}
