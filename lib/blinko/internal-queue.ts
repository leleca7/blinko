export type BlinkoInternalRole =
  | "owner"
  | "operations"
  | "commercial"
  | "specialist"
  | "viewer";

export type BlinkoPriority = "low" | "normal" | "high" | "urgent";

export type BlinkoTodayCounts = {
  pending_pre_diagnostic_reviews: number;
  initial_readings_waiting_approval: number;
  priority_leads: number;
  ai_ready_waiting_human: number;
};

export type BlinkoTodayAction = {
  action_id: string;
  action_type: string;
  status: "pending" | "in_progress";
  priority: BlinkoPriority;
  title: string;
  due_at: string | null;
  created_at: string;
  lead_id: string;
  pre_diagnostic_id: string | null;
  lead_name: string;
  company_name: string;
  commercial_score: number;
  lead_status: string;
  ai_analysis_status: "pending" | "processing" | "ready" | "failed" | null;
  human_review_status: "pending" | "reviewing" | "reviewed" | null;
};

export type BlinkoTodayQueue = {
  generated_at: string;
  counts: BlinkoTodayCounts;
  actions: BlinkoTodayAction[];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function number(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return 0;
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

/**
 * Normaliza a resposta do RPC interno antes de renderizar.
 * O painel não deve confiar cegamente no formato retornado pelo banco.
 */
export function normalizeBlinkoTodayQueue(input: unknown): BlinkoTodayQueue | null {
  if (!isObject(input) || !isObject(input.counts) || !Array.isArray(input.actions)) return null;

  const generatedAt = text(input.generated_at);
  if (!generatedAt) return null;

  const counts: BlinkoTodayCounts = {
    pending_pre_diagnostic_reviews: number(input.counts.pending_pre_diagnostic_reviews),
    initial_readings_waiting_approval: number(input.counts.initial_readings_waiting_approval),
    priority_leads: number(input.counts.priority_leads),
    ai_ready_waiting_human: number(input.counts.ai_ready_waiting_human),
  };

  const actions = input.actions.flatMap((raw): BlinkoTodayAction[] => {
    if (!isObject(raw)) return [];

    const actionId = text(raw.action_id);
    const leadId = text(raw.lead_id);
    const title = text(raw.title);
    const priority = text(raw.priority) as BlinkoPriority;
    const status = text(raw.status) as "pending" | "in_progress";

    if (
      !actionId ||
      !leadId ||
      !title ||
      !["low", "normal", "high", "urgent"].includes(priority) ||
      !["pending", "in_progress"].includes(status)
    ) {
      return [];
    }

    return [{
      action_id: actionId,
      action_type: text(raw.action_type),
      status,
      priority,
      title,
      due_at: raw.due_at == null ? null : text(raw.due_at),
      created_at: text(raw.created_at),
      lead_id: leadId,
      pre_diagnostic_id: raw.pre_diagnostic_id == null ? null : text(raw.pre_diagnostic_id),
      lead_name: text(raw.lead_name),
      company_name: text(raw.company_name),
      commercial_score: number(raw.commercial_score),
      lead_status: text(raw.lead_status),
      ai_analysis_status: raw.ai_analysis_status == null ? null : text(raw.ai_analysis_status) as BlinkoTodayAction["ai_analysis_status"],
      human_review_status: raw.human_review_status == null ? null : text(raw.human_review_status) as BlinkoTodayAction["human_review_status"],
    }];
  });

  return { generated_at: generatedAt, counts, actions };
}
