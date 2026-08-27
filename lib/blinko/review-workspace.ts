export type ReviewWorkspace = {
  lead: {
    id: string;
    name: string;
    email: string;
    whatsapp: string;
    company_name: string;
    company_role: string;
    segment: string;
    city_state: string;
    objective: string;
    urgency: string;
    commercial_score: number;
    status: string;
  };
  pre_diagnostic: Record<string, unknown> & {
    id: string;
    ai_analysis_status: string;
    human_review_status: string;
  };
  current_analysis: Record<string, unknown> | null;
  current_human_review: Record<string, unknown> | null;
  latest_initial_reading: Record<string, unknown> | null;
  open_actions: Record<string, unknown>[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function number(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && Number.isFinite(Number(value))) return Number(value);
  return 0;
}

export function normalizeReviewWorkspace(input: unknown): ReviewWorkspace | null {
  if (!isRecord(input) || !isRecord(input.lead) || !isRecord(input.pre_diagnostic)) return null;

  const leadId = text(input.lead.id);
  const preDiagnosticId = text(input.pre_diagnostic.id);
  if (!leadId || !preDiagnosticId) return null;

  return {
    lead: {
      id: leadId,
      name: text(input.lead.name),
      email: text(input.lead.email),
      whatsapp: text(input.lead.whatsapp),
      company_name: text(input.lead.company_name),
      company_role: text(input.lead.company_role),
      segment: text(input.lead.segment),
      city_state: text(input.lead.city_state),
      objective: text(input.lead.objective),
      urgency: text(input.lead.urgency),
      commercial_score: number(input.lead.commercial_score),
      status: text(input.lead.status),
    },
    pre_diagnostic: {
      ...input.pre_diagnostic,
      id: preDiagnosticId,
      ai_analysis_status: text(input.pre_diagnostic.ai_analysis_status),
      human_review_status: text(input.pre_diagnostic.human_review_status),
    },
    current_analysis: isRecord(input.current_analysis) ? input.current_analysis : null,
    current_human_review: isRecord(input.current_human_review) ? input.current_human_review : null,
    latest_initial_reading: isRecord(input.latest_initial_reading) ? input.latest_initial_reading : null,
    open_actions: Array.isArray(input.open_actions) ? input.open_actions.filter(isRecord) : [],
  };
}
