import "server-only";

import { generateText } from "ai";
import { BlinkoAiAnalysisError, getBlinkoAiModel } from "./ai-server";
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

export async function generateBlinkoDiagnosticAnalysis(
  collection: Record<string, unknown>,
): Promise<{ analysis: DiagnosticAnalysisDraft; model: string; safeInput: Record<string, unknown> }> {
  const model = getBlinkoAiModel();
  const request = buildDiagnosticAnalysisInput(collection);
  const safeInput = request.collection as Record<string, unknown>;

  const { text } = await generateText({
    model,
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

  return { analysis, model, safeInput };
}
