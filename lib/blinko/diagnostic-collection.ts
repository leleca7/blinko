export const BLINKO_DIAGNOSTIC_PILLARS = [
  { key: "brand", label: "Marca" },
  { key: "digital", label: "Digital" },
  { key: "financial", label: "Financeiro" },
  { key: "operations", label: "Operação" },
  { key: "service", label: "Atendimento" },
  { key: "management", label: "Gestão" },
  { key: "team", label: "Equipe" },
] as const;

export type DiagnosticPillarKey = typeof BLINKO_DIAGNOSTIC_PILLARS[number]["key"];
export type DiagnosticPillarCollectionStatus = "collected" | "insufficient";

export type DiagnosticPillarCollection = {
  status: DiagnosticPillarCollectionStatus;
  evidence: string;
  signals: string;
  missing: string;
  validation_questions: string;
};

export type DiagnosticCollectionPayload = {
  company_context: {
    business_model: string;
    target_public: string;
    main_offer: string;
    current_goal: string;
    constraints: string;
  };
  pillars: Record<DiagnosticPillarKey, DiagnosticPillarCollection>;
  general_evidence: string[];
  missing_information: string[];
  meeting_notes: string;
};

function text(value: FormDataEntryValue | null, max = 5000) {
  return String(value ?? "").trim().slice(0, max);
}

function lines(value: FormDataEntryValue | null, maxItems = 40) {
  return text(value, 12000)
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

export function collectionFromForm(form: FormData): DiagnosticCollectionPayload {
  const pillars = {} as Record<DiagnosticPillarKey, DiagnosticPillarCollection>;

  for (const pillar of BLINKO_DIAGNOSTIC_PILLARS) {
    const rawStatus = text(form.get(`${pillar.key}_status`), 32);
    pillars[pillar.key] = {
      status: rawStatus === "insufficient" ? "insufficient" : "collected",
      evidence: text(form.get(`${pillar.key}_evidence`)),
      signals: text(form.get(`${pillar.key}_signals`)),
      missing: text(form.get(`${pillar.key}_missing`)),
      validation_questions: text(form.get(`${pillar.key}_questions`)),
    };
  }

  return {
    company_context: {
      business_model: text(form.get("business_model"), 3000),
      target_public: text(form.get("target_public"), 3000),
      main_offer: text(form.get("main_offer"), 3000),
      current_goal: text(form.get("current_goal"), 3000),
      constraints: text(form.get("constraints"), 5000),
    },
    pillars,
    general_evidence: lines(form.get("general_evidence")),
    missing_information: lines(form.get("missing_information")),
    meeting_notes: text(form.get("meeting_notes"), 8000),
  };
}

export function validateDiagnosticCollection(payload: DiagnosticCollectionPayload) {
  const incompletePillars = BLINKO_DIAGNOSTIC_PILLARS.filter(({ key }) => {
    const item = payload.pillars[key];
    if (item.status === "insufficient") return !item.missing;
    return !item.evidence && !item.missing;
  }).map((item) => item.label);

  return {
    ok: incompletePillars.length === 0,
    incompletePillars,
  };
}
