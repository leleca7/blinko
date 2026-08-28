export const DIAGNOSTIC_ANALYSIS_PROMPT_VERSION = "blinko-diagnostic-analysis-v1";

const confidenceValues = new Set(["low", "medium", "high"]);
const crisisValues = new Set(["no_evidence_of_crisis", "requires_human_assessment"]);

export type DiagnosticAnalysisDraft = {
  summary: string;
  strengths: Array<{ pillar: string; statement: string; evidence: string[] }>;
  signals: Array<{ pillar: string; statement: string; evidence: string[]; confidence: "low" | "medium" | "high" }>;
  cross_pillar_patterns: Array<{ statement: string; related_pillars: string[]; evidence: string[]; confidence: "low" | "medium" | "high" }>;
  hypotheses: Array<{ statement: string; related_pillars: string[]; evidence: string[]; confidence: "low" | "medium" | "high"; validation_needed: string }>;
  contradictions: string[];
  missing_information: string[];
  problem_candidates: Array<{ title: string; related_pillars: string[]; evidence: string[]; impact_hypothesis: string; validation_needed: string }>;
  validation_questions: string[];
  rp_lens: {
    stakeholders: string[];
    trust_reputation_signals: string[];
    discourse_practice_coherence: string[];
    reputational_risks: string[];
    crisis_assessment: "no_evidence_of_crisis" | "requires_human_assessment";
    notes: string;
  };
};

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown, max = 5000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function stringList(value: unknown, maxItems = 30, maxItem = 1200) {
  return Array.isArray(value)
    ? value.map((item) => text(item, maxItem)).filter(Boolean).slice(0, maxItems)
    : [];
}

function confidence(value: unknown): "low" | "medium" | "high" {
  const normalized = text(value, 20);
  return confidenceValues.has(normalized) ? normalized as "low" | "medium" | "high" : "low";
}

function evidenceItems(value: unknown, maxItems = 20) {
  if (!Array.isArray(value)) return [];
  return value.map(record).filter(Boolean).slice(0, maxItems).map((item) => ({
    pillar: text(item!.pillar, 80),
    statement: text(item!.statement, 1800),
    evidence: stringList(item!.evidence, 12, 800),
  })).filter((item) => item.statement);
}

export function normalizeDiagnosticAnalysis(value: unknown): DiagnosticAnalysisDraft | null {
  const input = record(value);
  if (!input) return null;

  const strengths = evidenceItems(input.strengths);
  const signals = Array.isArray(input.signals) ? input.signals.map(record).filter(Boolean).slice(0, 30).map((item) => ({
    pillar: text(item!.pillar, 80),
    statement: text(item!.statement, 1800),
    evidence: stringList(item!.evidence, 12, 800),
    confidence: confidence(item!.confidence),
  })).filter((item) => item.statement) : [];

  const crossPillarPatterns = Array.isArray(input.cross_pillar_patterns) ? input.cross_pillar_patterns.map(record).filter(Boolean).slice(0, 20).map((item) => ({
    statement: text(item!.statement, 1800),
    related_pillars: stringList(item!.related_pillars, 7, 80),
    evidence: stringList(item!.evidence, 12, 800),
    confidence: confidence(item!.confidence),
  })).filter((item) => item.statement) : [];

  const hypotheses = Array.isArray(input.hypotheses) ? input.hypotheses.map(record).filter(Boolean).slice(0, 24).map((item) => ({
    statement: text(item!.statement, 1800),
    related_pillars: stringList(item!.related_pillars, 7, 80),
    evidence: stringList(item!.evidence, 12, 800),
    confidence: confidence(item!.confidence),
    validation_needed: text(item!.validation_needed, 1600),
  })).filter((item) => item.statement) : [];

  const problemCandidates = Array.isArray(input.problem_candidates) ? input.problem_candidates.map(record).filter(Boolean).slice(0, 15).map((item) => ({
    title: text(item!.title, 240),
    related_pillars: stringList(item!.related_pillars, 7, 80),
    evidence: stringList(item!.evidence, 12, 800),
    impact_hypothesis: text(item!.impact_hypothesis, 1600),
    validation_needed: text(item!.validation_needed, 1600),
  })).filter((item) => item.title) : [];

  const rp = record(input.rp_lens) ?? {};
  const crisisRaw = text(rp.crisis_assessment, 80);
  const crisisAssessment = crisisValues.has(crisisRaw)
    ? crisisRaw as "no_evidence_of_crisis" | "requires_human_assessment"
    : "requires_human_assessment";

  const summary = text(input.summary, 5000);
  if (!summary) return null;

  return {
    summary,
    strengths,
    signals,
    cross_pillar_patterns: crossPillarPatterns,
    hypotheses,
    contradictions: stringList(input.contradictions, 20, 1200),
    missing_information: stringList(input.missing_information, 30, 1200),
    problem_candidates: problemCandidates,
    validation_questions: stringList(input.validation_questions, 20, 1200),
    rp_lens: {
      stakeholders: stringList(rp.stakeholders, 20, 500),
      trust_reputation_signals: stringList(rp.trust_reputation_signals, 20, 1000),
      discourse_practice_coherence: stringList(rp.discourse_practice_coherence, 20, 1000),
      reputational_risks: stringList(rp.reputational_risks, 20, 1000),
      crisis_assessment: crisisAssessment,
      notes: text(rp.notes, 2500),
    },
  };
}

export function buildDiagnosticAnalysisInput(collection: Record<string, unknown>) {
  return {
    instruction: `Você é a camada analítica interna da Blinko. Analise uma coleta de Diagnóstico Blinko pelos 7 pilares: Marca, Digital, Financeiro, Operação, Atendimento, Gestão e Equipe.

Regras obrigatórias:
1. Use somente informações presentes na entrada.
2. Diferencie evidência, sinal, hipótese e problema candidato.
3. Não declare causa raiz, problema confirmado, prioridade final ou intervenção final.
4. Se a evidência for insuficiente, registre a lacuna.
5. Não invente números, fatos, métricas, resultados ou contexto.
6. Relações Públicas é uma lente transversal, não um oitavo pilar.
7. Avaliações negativas ou ruídos não provam crise reputacional. Só use requires_human_assessment quando houver sinais que realmente precisem dessa avaliação.
8. Não inclua instruções de envio ao cliente, preço, promessa comercial ou compromisso externo.
9. O resultado é um rascunho interno que obrigatoriamente passará por revisão humana.`,
    collection: {
      company_context: collection.company_context ?? {},
      pillars: collection.pillars ?? {},
      general_evidence: collection.general_evidence ?? [],
      missing_information: collection.missing_information ?? [],
    },
    expectedShape: {
      summary: "síntese interna",
      strengths: [{ pillar: "Marca", statement: "força observada", evidence: ["evidência"] }],
      signals: [{ pillar: "Operação", statement: "sinal", evidence: ["evidência"], confidence: "low|medium|high" }],
      cross_pillar_patterns: [{ statement: "padrão possível", related_pillars: ["Gestão", "Equipe"], evidence: ["evidência"], confidence: "low|medium|high" }],
      hypotheses: [{ statement: "hipótese", related_pillars: ["Gestão"], evidence: ["evidência"], confidence: "low|medium|high", validation_needed: "o que validar" }],
      contradictions: ["contradição percebida"],
      missing_information: ["informação faltante"],
      problem_candidates: [{ title: "problema candidato", related_pillars: ["Atendimento"], evidence: ["evidência"], impact_hypothesis: "impacto ainda hipotético", validation_needed: "o que validar" }],
      validation_questions: ["pergunta"],
      rp_lens: {
        stakeholders: ["público relevante"],
        trust_reputation_signals: ["sinal"],
        discourse_practice_coherence: ["coerência ou lacuna"],
        reputational_risks: ["risco a validar"],
        crisis_assessment: "no_evidence_of_crisis|requires_human_assessment",
        notes: "nota interna",
      },
    },
  };
}
