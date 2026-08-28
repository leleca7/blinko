import "server-only";

import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import {
  buildInitialReadingInput,
  normalizeInitialReadingDraft,
  type InitialReadingChannel,
  type InitialReadingDraft,
} from "./initial-reading";
import {
  buildPreDiagnosticAnalysisInput,
  normalizePreDiagnosticAnalysis,
  type PreDiagnosticAnalysis,
} from "./pre-diagnostic-analysis";
import type { ReviewWorkspace } from "./review-workspace";

const DEFAULT_BLINKO_AI_MODEL = "openai/gpt-5.6-sol";
const DEFAULT_BLINKO_GOOGLE_MODEL = "gemini-3.7-flash";
const BLINKO_GOOGLE_FALLBACK_MODEL = "gemini-3.1-flash-lite";

export type BlinkoAiProvider = "vercel-ai-gateway" | "google-generative-ai";

export class BlinkoAiAnalysisError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "BlinkoAiAnalysisError";
  }
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function parseJsonObject(raw: string) {
  const trimmed = raw.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(withoutFence) as unknown;
  } catch {
    const firstBrace = withoutFence.indexOf("{");
    const lastBrace = withoutFence.lastIndexOf("}");
    if (firstBrace < 0 || lastBrace <= firstBrace) return null;

    try {
      return JSON.parse(withoutFence.slice(firstBrace, lastBrace + 1)) as unknown;
    } catch {
      return null;
    }
  }
}

function isTransientGoogleFailure(error: unknown) {
  const errorObject = object(error);
  const statusCode = typeof errorObject.statusCode === "number" ? errorObject.statusCode : null;
  if (statusCode === 429 || (statusCode !== null && statusCode >= 500)) return true;

  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return [
    "high demand",
    "temporarily unavailable",
    "temporary unavailable",
    "try again later",
    "resource exhausted",
    "rate limit",
    "too many requests",
    "overloaded",
    "service unavailable",
  ].some((signal) => message.includes(signal));
}

export function getBlinkoAiProvider(): BlinkoAiProvider {
  return process.env.BLINKO_AI_PROVIDER?.trim().toLowerCase() === "google"
    ? "google-generative-ai"
    : "vercel-ai-gateway";
}

export function getBlinkoAiModel() {
  if (getBlinkoAiProvider() === "google-generative-ai") {
    return process.env.BLINKO_AI_GOOGLE_MODEL?.trim() || DEFAULT_BLINKO_GOOGLE_MODEL;
  }

  return process.env.BLINKO_AI_MODEL?.trim() || DEFAULT_BLINKO_AI_MODEL;
}

export async function generateBlinkoText(prompt: string): Promise<{
  text: string;
  model: string;
  provider: BlinkoAiProvider;
}> {
  const provider = getBlinkoAiProvider();
  const primaryModel = getBlinkoAiModel();

  if (provider !== "google-generative-ai") {
    const { text } = await generateText({ model: primaryModel, prompt });
    return { text, model: primaryModel, provider };
  }

  try {
    const { text } = await generateText({ model: google(primaryModel), prompt });
    return { text, model: primaryModel, provider };
  } catch (primaryError) {
    if (
      primaryModel === BLINKO_GOOGLE_FALLBACK_MODEL
      || !isTransientGoogleFailure(primaryError)
    ) {
      throw primaryError;
    }

    console.warn("Blinko AI: modelo Google primário indisponível; tentando fallback", {
      primaryModel,
      fallbackModel: BLINKO_GOOGLE_FALLBACK_MODEL,
    });

    const { text } = await generateText({
      model: google(BLINKO_GOOGLE_FALLBACK_MODEL),
      prompt,
    });
    return { text, model: BLINKO_GOOGLE_FALLBACK_MODEL, provider };
  }
}

/**
 * Reduz os dados enviados ao modelo ao necessário para a triagem.
 * Nome, e-mail, WhatsApp e nome da empresa ficam fora da entrada da IA.
 */
export function buildAiSafePreDiagnosticSnapshot(workspace: ReviewWorkspace) {
  const preDiagnostic = object(workspace.pre_diagnostic);

  return {
    segment: workspace.lead.segment,
    company_role: workspace.lead.company_role,
    objective: workspace.lead.objective,
    urgency: workspace.lead.urgency,
    perceived_blocker: preDiagnostic.perceived_blocker ?? "",
    perceived_areas: preDiagnostic.perceived_areas ?? [],
    pillar_answers: preDiagnostic.pillar_answers ?? {},
    operational_signals: preDiagnostic.operational_signals ?? [],
    team_size: preDiagnostic.team_size ?? "",
    company_moment: preDiagnostic.company_moment ?? "",
    openness_to_change: preDiagnostic.openness_to_change ?? "",
    investment_intent: preDiagnostic.investment_intent ?? "",
    additional_context: preDiagnostic.additional_context ?? "",
  } satisfies Record<string, unknown>;
}

export async function generateBlinkoPreDiagnosticAnalysis(
  inputSnapshot: Record<string, unknown>,
): Promise<{ analysis: PreDiagnosticAnalysis; model: string; provider: BlinkoAiProvider }> {
  const request = buildPreDiagnosticAnalysisInput(inputSnapshot);
  const result = await generateBlinkoText(
    `${request.instruction}\n\nIMPORTANTE SOBRE O FORMATO:\nResponda somente com um objeto JSON válido. Não use markdown, bloco de código, comentário antes ou depois do JSON. Não inclua dados pessoais que não aparecem na entrada.\n\nENTRADA DO PRÉ-DIAGNÓSTICO:\n${JSON.stringify(request.submission, null, 2)}\n\nFORMATO ESPERADO:\n${JSON.stringify(request.expectedShape, null, 2)}`,
  );

  const parsed = parseJsonObject(result.text);
  if (!parsed) {
    throw new BlinkoAiAnalysisError("invalid_json", "A Blinko AI não retornou JSON válido.");
  }

  const analysis = normalizePreDiagnosticAnalysis(parsed);
  if (!analysis) {
    throw new BlinkoAiAnalysisError("invalid_output", "A saída da Blinko AI não passou pela validação do contrato.");
  }

  return { analysis, model: result.model, provider: result.provider };
}

function buildAiSafeInitialReadingRequest(
  workspace: ReviewWorkspace,
  preferredChannel: InitialReadingChannel,
) {
  const analysisRun = object(workspace.current_analysis);
  const analysis = normalizePreDiagnosticAnalysis(analysisRun.output);
  if (!analysis) {
    throw new BlinkoAiAnalysisError("analysis_not_ready", "A análise atual não está pronta para gerar leitura inicial.");
  }

  const humanReview = object(workspace.current_human_review);
  const reviewDecision = object(humanReview.decision);
  const notes = typeof reviewDecision.notes === "string" ? reviewDecision.notes.trim().slice(0, 5000) : "";

  return buildInitialReadingInput({
    lead: {
      segment: workspace.lead.segment,
      company_role: workspace.lead.company_role,
      objective: workspace.lead.objective,
      urgency: workspace.lead.urgency,
    },
    preDiagnostic: buildAiSafePreDiagnosticSnapshot(workspace),
    analysis: analysis as unknown as Record<string, unknown>,
    humanReview: notes ? { notes } : {},
    preferredChannel,
  });
}

export async function generateBlinkoInitialReadingDraft(
  workspace: ReviewWorkspace,
  preferredChannel: InitialReadingChannel,
): Promise<{ draft: InitialReadingDraft; model: string; provider: BlinkoAiProvider }> {
  const request = buildAiSafeInitialReadingRequest(workspace, preferredChannel);
  const result = await generateBlinkoText(
    `${request.instruction}\n\nIMPORTANTE SOBRE O FORMATO:\nResponda somente com um objeto JSON válido. Não use markdown, bloco de código, comentário antes ou depois. O canal deve ser ${preferredChannel}. Não inclua nome, e-mail, WhatsApp, score comercial, nome da empresa, notas de fit ou qualquer dado que não esteja no contexto seguro.\n\nCONTEXTO REVISADO:\n${JSON.stringify(request.context, null, 2)}\n\nFORMATO ESPERADO:\n${JSON.stringify(request.expectedShape, null, 2)}`,
  );

  const parsed = parseJsonObject(result.text);
  if (!parsed) {
    throw new BlinkoAiAnalysisError("initial_reading_invalid_json", "A Blinko AI não retornou JSON válido para a leitura inicial.");
  }

  const draft = normalizeInitialReadingDraft(parsed);
  if (!draft) {
    throw new BlinkoAiAnalysisError("initial_reading_invalid_output", "O rascunho da leitura inicial não passou pela validação do contrato.");
  }

  return {
    draft: { ...draft, channel: preferredChannel },
    model: result.model,
    provider: result.provider,
  };
}
