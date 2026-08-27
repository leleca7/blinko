export const PRE_DIAGNOSTIC_PROMPT_VERSION = "pre-diagnostic-v1" as const;

export const BLINKO_PILLARS = [
  "Marca",
  "Digital",
  "Financeiro",
  "Operação",
  "Atendimento",
  "Gestão",
  "Equipe",
] as const;

export type BlinkoPillar = (typeof BLINKO_PILLARS)[number];
export type Confidence = "low" | "medium" | "high";
export type SuggestedNextAction =
  | "priority_contact"
  | "normal_contact"
  | "request_information"
  | "low_fit_now"
  | "mandatory_human_review";

export type PillarSignal = {
  pillar: BlinkoPillar;
  signal: string;
  evidence: string[];
  confidence: Confidence;
  missingInformation: string[];
};

export type InvestigationHypothesis = {
  hypothesis: string;
  evidence: string[];
  whatWouldConfirm: string[];
  whatWouldRefute: string[];
};

export type PreDiagnosticAnalysis = {
  version: typeof PRE_DIAGNOSTIC_PROMPT_VERSION;
  summary: string;
  declaredObjective: string;
  pillarSignals: PillarSignal[];
  investigationHypotheses: InvestigationHypothesis[];
  contradictionsOrGaps: string[];
  meetingQuestions: string[];
  suggestedNextAction: SuggestedNextAction;
  safetyNotes: string[];
};

const allowedActions = new Set<SuggestedNextAction>([
  "priority_contact",
  "normal_contact",
  "request_information",
  "low_fit_now",
  "mandatory_human_review",
]);

const allowedConfidence = new Set<Confidence>(["low", "medium", "high"]);
const allowedPillars = new Set<string>(BLINKO_PILLARS);

function asString(value: unknown, max = 1600) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function asStringArray(value: unknown, maxItems = 12, maxLength = 500) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

/**
 * Normaliza e valida uma saída de modelo antes de persistir.
 * Se a estrutura mínima não estiver presente, retorna null e a execução deve ser marcada como failed.
 */
export function normalizePreDiagnosticAnalysis(input: unknown): PreDiagnosticAnalysis | null {
  const value = asObject(input);

  const summary = asString(value.summary, 2200);
  const declaredObjective = asString(value.declaredObjective, 1400);
  const suggestedNextAction = asString(value.suggestedNextAction, 80) as SuggestedNextAction;

  if (!summary || !declaredObjective || !allowedActions.has(suggestedNextAction)) {
    return null;
  }

  const pillarSignals = Array.isArray(value.pillarSignals)
    ? value.pillarSignals.slice(0, 7).flatMap((raw) => {
        const item = asObject(raw);
        const pillar = asString(item.pillar, 40) as BlinkoPillar;
        const signal = asString(item.signal, 700);
        const confidence = asString(item.confidence, 20) as Confidence;

        if (!allowedPillars.has(pillar) || !signal || !allowedConfidence.has(confidence)) {
          return [];
        }

        return [{
          pillar,
          signal,
          evidence: asStringArray(item.evidence, 8, 700),
          confidence,
          missingInformation: asStringArray(item.missingInformation, 8, 500),
        } satisfies PillarSignal];
      })
    : [];

  const investigationHypotheses = Array.isArray(value.investigationHypotheses)
    ? value.investigationHypotheses.slice(0, 6).flatMap((raw) => {
        const item = asObject(raw);
        const hypothesis = asString(item.hypothesis, 900);
        if (!hypothesis) return [];

        return [{
          hypothesis,
          evidence: asStringArray(item.evidence, 8, 700),
          whatWouldConfirm: asStringArray(item.whatWouldConfirm, 8, 600),
          whatWouldRefute: asStringArray(item.whatWouldRefute, 8, 600),
        } satisfies InvestigationHypothesis];
      })
    : [];

  return {
    version: PRE_DIAGNOSTIC_PROMPT_VERSION,
    summary,
    declaredObjective,
    pillarSignals,
    investigationHypotheses,
    contradictionsOrGaps: asStringArray(value.contradictionsOrGaps, 10, 800),
    meetingQuestions: asStringArray(value.meetingQuestions, 5, 500),
    suggestedNextAction,
    safetyNotes: asStringArray(value.safetyNotes, 8, 700),
  };
}

/**
 * Contrato de instrução para qualquer provedor/modelo futuro usado pela Blinko AI.
 * A regra central é separar sinal, hipótese e causa validada.
 */
export function buildPreDiagnosticAnalysisInstruction() {
  return `Você é a camada de triagem da Blinko AI.

Objetivo: organizar um Pré-Diagnóstico para preparar uma boa revisão humana e uma reunião inicial. Você NÃO está autorizado a emitir um diagnóstico profundo, prescrever serviços como conclusão, criar preço, prometer resultado ou tratar hipótese como fato.

Princípio obrigatório:
SINAL -> HIPÓTESE DE INVESTIGAÇÃO -> CAUSA VALIDADA POR EVIDÊNCIA/HUMANO -> PRIORIDADE -> INTERVENÇÃO.
Nesta etapa você trabalha apenas com SINAIS e HIPÓTESES DE INVESTIGAÇÃO.

Regras:
1. Use apenas informações presentes nas respostas fornecidas.
2. Nunca invente fatos físicos, números, faturamento, margem, prazo, preço, disponibilidade ou situação operacional não informada.
3. Diferencie claramente percepção do lead de evidência confirmada.
4. Um pilar marcado pelo lead não significa problema confirmado naquele pilar.
5. Aponte contradições e lacunas quando existirem.
6. Gere no máximo 5 perguntas para reunião, priorizando as que mais mudariam a decisão.
7. Não recomende automaticamente site, CRM, tráfego, conteúdo, automação ou qualquer outra intervenção.
8. Se houver pouca informação ou risco de conclusão excessiva, use mandatory_human_review ou request_information.
9. A saída deve respeitar exatamente o schema JSON esperado pela aplicação.
10. O texto deve ser profissional, objetivo e em português do Brasil.`;
}

export function buildPreDiagnosticAnalysisInput(payload: Record<string, unknown>) {
  return {
    promptVersion: PRE_DIAGNOSTIC_PROMPT_VERSION,
    instruction: buildPreDiagnosticAnalysisInstruction(),
    submission: payload,
    expectedShape: {
      version: PRE_DIAGNOSTIC_PROMPT_VERSION,
      summary: "string",
      declaredObjective: "string",
      pillarSignals: [{
        pillar: "Marca | Digital | Financeiro | Operação | Atendimento | Gestão | Equipe",
        signal: "string",
        evidence: ["string"],
        confidence: "low | medium | high",
        missingInformation: ["string"],
      }],
      investigationHypotheses: [{
        hypothesis: "string",
        evidence: ["string"],
        whatWouldConfirm: ["string"],
        whatWouldRefute: ["string"],
      }],
      contradictionsOrGaps: ["string"],
      meetingQuestions: ["string - máximo 5"],
      suggestedNextAction: "priority_contact | normal_contact | request_information | low_fit_now | mandatory_human_review",
      safetyNotes: ["string"],
    },
  };
}
