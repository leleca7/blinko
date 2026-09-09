export type BlinkoInternalRole =
  | "owner"
  | "operations"
  | "commercial"
  | "specialist"
  | "viewer";

export type BlinkoPriority = "low" | "normal" | "high" | "urgent";
export type BlinkoTodayBucket = "do_now" | "waiting_client" | "waiting_partner" | "blocked";
export type BlinkoTodaySource = "crm" | "commercial_opportunity" | "project_task" | "approval" | "finance" | "project_closure" | "change_request";

export type BlinkoTodayCounts = {
  pending_pre_diagnostic_reviews: number;
  initial_readings_waiting_approval: number;
  priority_leads: number;
  ai_ready_waiting_human: number;
  overdue_project_tasks: number;
  project_tasks_due_today: number;
  waiting_client_project_tasks: number;
  waiting_partner_project_tasks: number;
  blocked_project_tasks: number;
  pending_approvals: number;
  approvals_changes_requested: number;
  overdue_receivables: number;
  receivables_due_today: number;
  projects_ready_to_close: number;
  change_requests_pending_decision: number;
  change_requests_ready_for_execution: number;
};

export type BlinkoTodayAction = {
  source: BlinkoTodaySource;
  bucket: BlinkoTodayBucket;
  action_id: string;
  action_type: string;
  status: "pending" | "in_progress" | "waiting_client" | "waiting_partner" | "blocked";
  priority: BlinkoPriority;
  title: string;
  due_at: string | null;
  created_at: string;
  lead_id: string | null;
  pre_diagnostic_id: string | null;
  lead_name: string;
  company_name: string;
  commercial_score: number;
  lead_status: string;
  ai_analysis_status: "pending" | "processing" | "ready" | "failed" | null;
  human_review_status: "pending" | "reviewing" | "reviewed" | null;
  project_id: string | null;
  project_status: string;
  responsible_label: string;
  opportunity_id: string | null;
  pipeline_stage: string;
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

export function normalizeBlinkoTodayQueue(input: unknown): BlinkoTodayQueue | null {
  if (!isObject(input) || !isObject(input.counts) || !Array.isArray(input.actions)) return null;
  const generatedAt = text(input.generated_at);
  if (!generatedAt) return null;

  const counts: BlinkoTodayCounts = {
    pending_pre_diagnostic_reviews: number(input.counts.pending_pre_diagnostic_reviews),
    initial_readings_waiting_approval: number(input.counts.initial_readings_waiting_approval),
    priority_leads: number(input.counts.priority_leads),
    ai_ready_waiting_human: number(input.counts.ai_ready_waiting_human),
    overdue_project_tasks: number(input.counts.overdue_project_tasks),
    project_tasks_due_today: number(input.counts.project_tasks_due_today),
    waiting_client_project_tasks: number(input.counts.waiting_client_project_tasks),
    waiting_partner_project_tasks: number(input.counts.waiting_partner_project_tasks),
    blocked_project_tasks: number(input.counts.blocked_project_tasks),
    pending_approvals: number(input.counts.pending_approvals),
    approvals_changes_requested: number(input.counts.approvals_changes_requested),
    overdue_receivables: number(input.counts.overdue_receivables),
    receivables_due_today: number(input.counts.receivables_due_today),
    projects_ready_to_close: number(input.counts.projects_ready_to_close),
    change_requests_pending_decision: number(input.counts.change_requests_pending_decision),
    change_requests_ready_for_execution: number(input.counts.change_requests_ready_for_execution),
  };

  const actions = input.actions.flatMap((raw): BlinkoTodayAction[] => {
    if (!isObject(raw)) return [];
    const actionId = text(raw.action_id);
    const title = text(raw.title);
    const priority = text(raw.priority) as BlinkoPriority;
    const status = text(raw.status) as BlinkoTodayAction["status"];
    const source = text(raw.source) as BlinkoTodaySource;
    const bucket = text(raw.bucket) as BlinkoTodayBucket;
    if (!actionId || !title || !["low","normal","high","urgent"].includes(priority) || !["pending","in_progress","waiting_client","waiting_partner","blocked"].includes(status) || !["crm","commercial_opportunity","project_task","approval","finance","project_closure","change_request"].includes(source) || !["do_now","waiting_client","waiting_partner","blocked"].includes(bucket)) return [];
    return [{
      source,bucket,action_id:actionId,action_type:text(raw.action_type),status,priority,title,
      due_at:raw.due_at==null?null:text(raw.due_at),created_at:text(raw.created_at),
      lead_id:raw.lead_id==null?null:text(raw.lead_id),pre_diagnostic_id:raw.pre_diagnostic_id==null?null:text(raw.pre_diagnostic_id),
      lead_name:text(raw.lead_name),company_name:text(raw.company_name),commercial_score:number(raw.commercial_score),lead_status:text(raw.lead_status),
      ai_analysis_status:raw.ai_analysis_status==null?null:text(raw.ai_analysis_status) as BlinkoTodayAction["ai_analysis_status"],
      human_review_status:raw.human_review_status==null?null:text(raw.human_review_status) as BlinkoTodayAction["human_review_status"],
      project_id:raw.project_id==null?null:text(raw.project_id),project_status:text(raw.project_status),responsible_label:text(raw.responsible_label),
      opportunity_id:raw.opportunity_id==null?null:text(raw.opportunity_id),pipeline_stage:text(raw.pipeline_stage),
    }];
  });
  return { generated_at: generatedAt, counts, actions };
}
