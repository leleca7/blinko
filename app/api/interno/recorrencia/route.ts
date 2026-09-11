import { NextResponse } from "next/server";
import { requireInternalProjectSession } from "../../../../lib/blinko/internal-auth";
import {
  closeServiceCycle,
  createFirstServiceCycle,
  createNextServiceCycle,
  isRecurrenceSchemaPending,
  openRecurringRenewalReview,
  recordCycleCost,
  recordCycleReceivable,
  recordCycleTask,
  requestCycleApproval,
  resolveRecurringRenewalReview,
  routeDiagnosticReassessmentToCommercial,
  routeRecurringRenewalToCommercial,
  scheduleDiagnosticReassessment,
  setDiagnosticReassessmentRoute,
  setRecurringServicePlan,
  startIncludedDiagnosticReassessment,
  startServiceCycle,
} from "../../../../lib/blinko/recurrence-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const localDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const projectActions = new Set(["plan_save","cycle_first","cycle_start","cycle_close","cycle_next"]);
const contractActions = new Set(["renewal_open","renewal_resolve"]);
const taskActions = new Set(["cycle_task"]);
const approvalActions = new Set(["cycle_approval"]);
const financeActions = new Set(["cycle_receivable","cycle_cost"]);
const commercialActions = new Set(["renewal_route_commercial","reassessment_route_commercial"]);
const diagnosticActions = new Set(["reassessment_schedule","reassessment_route","reassessment_start"]);

function lines(value: FormDataEntryValue | null) {
  return String(value ?? "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, 100);
}
function text(form: FormData, key: string, max = 1000) { return String(form.get(key) ?? "").trim().slice(0, max); }
function localIso(value: string) { return value && localDateTimePattern.test(value) ? new Date(`${value}:00-03:00`).toISOString() : null; }
function redirect(request: Request, projectId: string, status: string) { return NextResponse.redirect(new URL(`/interno/projetos/${projectId}/recorrencia?status=${encodeURIComponent(status)}`, request.url), 303); }

export async function POST(request: Request) {
  const form = await request.formData();
  const action = text(form, "action", 80);
  const projectId = text(form, "project_id", 80);
  if (!uuidPattern.test(projectId)) return NextResponse.json({ ok: false }, { status: 404 });

  let permission = "projects.manage";
  if (contractActions.has(action)) permission = "contracts.manage";
  else if (taskActions.has(action)) permission = "tasks.manage";
  else if (approvalActions.has(action)) permission = "approvals.manage";
  else if (financeActions.has(action)) permission = "finance.manage";
  else if (commercialActions.has(action)) permission = "commercial.manage";
  else if (diagnosticActions.has(action)) permission = "diagnostics.manage";
  else if (!projectActions.has(action)) return redirect(request, projectId, "action_invalid");

  const session = await requireInternalProjectSession(projectId, permission);

  try {
    if (action === "plan_save") {
      const status = text(form, "status", 30);
      const cadenceUnit = text(form, "cadence_unit", 30);
      const cadenceCount = Number(text(form, "cadence_count", 10));
      const firstPeriodStart = text(form, "first_period_start", 20);
      const firstPeriodEnd = text(form, "first_period_end", 20);
      const contractValidUntil = text(form, "contract_valid_until", 20);
      const renewalReviewRaw = text(form, "renewal_review_at", 30);
      const expectedDeliverables = lines(form.get("expected_deliverables"));
      if (!["draft","active","paused","ended"].includes(status) || !["day","week","month","custom"].includes(cadenceUnit) || !Number.isInteger(cadenceCount) || cadenceCount < 1 || !datePattern.test(firstPeriodStart) || !datePattern.test(firstPeriodEnd) || (contractValidUntil && !datePattern.test(contractValidUntil)) || (renewalReviewRaw && !localDateTimePattern.test(renewalReviewRaw)) || expectedDeliverables.length === 0) return redirect(request, projectId, "plan_invalid");
      await setRecurringServicePlan({ projectId, status, cadenceUnit, cadenceCount, firstPeriodStart, firstPeriodEnd, contractValidUntil: contractValidUntil || null, renewalReviewAt: renewalReviewRaw ? localIso(renewalReviewRaw) : null, expectedDeliverables, sourceReference: text(form, "source_reference", 500), evidenceReference: text(form, "evidence_reference", 500), ownerLabel: text(form, "owner_label", 180), notes: text(form, "notes", 2000), actorLabel: session.user });
      return redirect(request, projectId, "plan_saved");
    }

    if (action === "cycle_first") {
      await createFirstServiceCycle(projectId, session.user);
      return redirect(request, projectId, "cycle_created");
    }
    if (action === "cycle_start") {
      const cycleId = text(form, "cycle_id", 80);
      if (!uuidPattern.test(cycleId)) return redirect(request, projectId, "cycle_invalid");
      await startServiceCycle(cycleId, session.user);
      return redirect(request, projectId, "cycle_started");
    }
    if (action === "cycle_next") {
      const cycleId = text(form, "cycle_id", 80);
      const customStart = text(form, "custom_period_start", 20);
      const customEnd = text(form, "custom_period_end", 20);
      if (!uuidPattern.test(cycleId) || (customStart && !datePattern.test(customStart)) || (customEnd && !datePattern.test(customEnd))) return redirect(request, projectId, "cycle_invalid");
      await createNextServiceCycle({ previousCycleId: cycleId, customPeriodStart: customStart || null, customPeriodEnd: customEnd || null, actorLabel: session.user });
      return redirect(request, projectId, "cycle_created");
    }
    if (action === "cycle_close") {
      const cycleId = text(form, "cycle_id", 80);
      if (!uuidPattern.test(cycleId)) return redirect(request, projectId, "cycle_invalid");
      let indicatorSnapshot: Record<string, unknown> = {};
      const rawIndicators = text(form, "indicator_snapshot", 8000);
      if (rawIndicators) {
        const parsed = JSON.parse(rawIndicators) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return redirect(request, projectId, "cycle_invalid");
        indicatorSnapshot = parsed as Record<string, unknown>;
      }
      await closeServiceCycle({ cycleId, deliverySummary: text(form, "delivery_summary", 4000), deliveryEvidenceReference: text(form, "delivery_evidence_reference", 1000), indicatorSnapshot, pendingItems: lines(form.get("pending_items")), financePendingNote: text(form, "finance_pending_note", 2000), carryOverItems: lines(form.get("carry_over_items")), carryOverJustification: text(form, "carry_over_justification", 2000), continuationStatus: text(form, "continuation_status", 40), continuationEvidence: text(form, "continuation_evidence", 1000), actorLabel: session.user });
      return redirect(request, projectId, "cycle_closed");
    }

    if (action === "cycle_task") {
      const cycleId = text(form, "cycle_id", 80);
      const dueRaw = text(form, "due_at", 30);
      const priority = text(form, "priority", 30) || "normal";
      if (!uuidPattern.test(cycleId) || (dueRaw && !localDateTimePattern.test(dueRaw)) || !["low","normal","high","critical"].includes(priority)) return redirect(request, projectId, "cycle_item_invalid");
      await recordCycleTask({ projectId, cycleId, actorLabel: session.user, title: text(form, "title", 300), responsibleLabel: text(form, "responsible_label", 180), dueAt: dueRaw ? localIso(dueRaw) : null, dependencies: lines(form.get("dependencies")), priority, estimate: text(form, "estimate", 500), approvalRequired: text(form, "approval_required", 10) === "yes" });
      return redirect(request, projectId, "cycle_item_created");
    }

    if (action === "cycle_approval") {
      const cycleId = text(form, "cycle_id", 80);
      const taskId = text(form, "task_id", 80);
      const dueRaw = text(form, "due_at", 30);
      if (!uuidPattern.test(cycleId) || (taskId && !uuidPattern.test(taskId)) || (dueRaw && !localDateTimePattern.test(dueRaw))) return redirect(request, projectId, "cycle_item_invalid");
      await requestCycleApproval({ projectId, cycleId, taskId: taskId || null, title: text(form, "title", 300), versionLabel: text(form, "version_label", 120), dueAt: dueRaw ? localIso(dueRaw) : null, actorLabel: session.user });
      return redirect(request, projectId, "cycle_item_created");
    }

    if (action === "cycle_receivable") {
      const cycleId = text(form, "cycle_id", 80);
      const amount = Number(text(form, "amount", 40).replace(",", "."));
      const dueDate = text(form, "due_date", 20);
      if (!uuidPattern.test(cycleId) || !Number.isFinite(amount) || amount <= 0 || !datePattern.test(dueDate)) return redirect(request, projectId, "cycle_item_invalid");
      await recordCycleReceivable({ projectId, cycleId, description: text(form, "description", 500), amount, dueDate, actorLabel: session.user });
      return redirect(request, projectId, "cycle_item_created");
    }

    if (action === "cycle_cost") {
      const cycleId = text(form, "cycle_id", 80);
      const amount = Number(text(form, "amount", 40).replace(",", "."));
      const dueDate = text(form, "due_date", 20);
      const costType = text(form, "cost_type", 40);
      const status = text(form, "cost_status", 40);
      if (!uuidPattern.test(cycleId) || !Number.isFinite(amount) || amount < 0 || (dueDate && !datePattern.test(dueDate)) || !["internal","partner","supplier","logistics","tax_fee","software","other"].includes(costType) || !["estimated","committed","realized"].includes(status)) return redirect(request, projectId, "cycle_item_invalid");
      await recordCycleCost({ projectId, cycleId, costType, description: text(form, "description", 500), amount, status, partnerLabel: text(form, "partner_label", 180), dueDate: dueDate || null, actorLabel: session.user });
      return redirect(request, projectId, "cycle_item_created");
    }

    if (action === "renewal_open") {
      const planId = text(form, "plan_id", 80);
      if (!uuidPattern.test(planId)) return redirect(request, projectId, "renewal_invalid");
      await openRecurringRenewalReview({ planId, ownerLabel: text(form, "owner_label", 180), notes: text(form, "notes", 2000), actorLabel: session.user });
      return redirect(request, projectId, "renewal_opened");
    }
    if (action === "renewal_route_commercial") {
      const reviewId = text(form, "review_id", 80);
      const nextActionRaw = text(form, "next_action_at", 30);
      if (!uuidPattern.test(reviewId) || !localDateTimePattern.test(nextActionRaw)) return redirect(request, projectId, "renewal_invalid");
      await routeRecurringRenewalToCommercial({ reviewId, decision: text(form, "decision", 30), route: text(form, "commercial_route", 30), fit: text(form, "fit", 30), ownerLabel: text(form, "owner_label", 180), nextActionTitle: text(form, "next_action_title", 300), nextActionAt: localIso(nextActionRaw)!, nextActionChannel: text(form, "next_action_channel", 80), notes: text(form, "notes", 2000), actorLabel: session.user });
      return redirect(request, projectId, "renewal_routed");
    }
    if (action === "renewal_resolve") {
      const reviewId = text(form, "review_id", 80);
      if (!uuidPattern.test(reviewId)) return redirect(request, projectId, "renewal_invalid");
      await resolveRecurringRenewalReview({ reviewId, decision: text(form, "decision", 30), status: text(form, "resolution_status", 30), evidence: text(form, "evidence", 1000), notes: text(form, "notes", 2000), actorLabel: session.user });
      return redirect(request, projectId, "renewal_resolved");
    }

    if (action === "reassessment_schedule") {
      const sourceDiagnosticId = text(form, "source_diagnostic_id", 80);
      const dueRaw = text(form, "due_at", 30);
      if (!uuidPattern.test(sourceDiagnosticId) || !localDateTimePattern.test(dueRaw)) return redirect(request, projectId, "reassessment_invalid");
      await scheduleDiagnosticReassessment({ sourceDiagnosticId, projectId, dueAt: localIso(dueRaw)!, reason: text(form, "reason", 2000), ownerLabel: text(form, "owner_label", 180), sourceReference: text(form, "source_reference", 1000), notes: text(form, "notes", 2000), actorLabel: session.user });
      return redirect(request, projectId, "reassessment_scheduled");
    }
    if (action === "reassessment_route") {
      const requestId = text(form, "request_id", 80);
      if (!uuidPattern.test(requestId)) return redirect(request, projectId, "reassessment_invalid");
      await setDiagnosticReassessmentRoute({ requestId, route: text(form, "reassessment_route", 40), evidence: text(form, "evidence", 1000), notes: text(form, "notes", 2000), actorLabel: session.user });
      return redirect(request, projectId, "reassessment_routed");
    }
    if (action === "reassessment_start") {
      const requestId = text(form, "request_id", 80);
      if (!uuidPattern.test(requestId)) return redirect(request, projectId, "reassessment_invalid");
      await startIncludedDiagnosticReassessment(requestId, session.user);
      return redirect(request, projectId, "reassessment_started");
    }
    if (action === "reassessment_route_commercial") {
      const requestId = text(form, "request_id", 80);
      const nextActionRaw = text(form, "next_action_at", 30);
      if (!uuidPattern.test(requestId) || !localDateTimePattern.test(nextActionRaw)) return redirect(request, projectId, "reassessment_invalid");
      await routeDiagnosticReassessmentToCommercial({ requestId, route: text(form, "commercial_route", 30), fit: text(form, "fit", 30), ownerLabel: text(form, "owner_label", 180), nextActionTitle: text(form, "next_action_title", 300), nextActionAt: localIso(nextActionRaw)!, nextActionChannel: text(form, "next_action_channel", 80), notes: text(form, "notes", 2000), actorLabel: session.user });
      return redirect(request, projectId, "reassessment_commercial");
    }

    return redirect(request, projectId, "action_invalid");
  } catch (error) {
    if (isRecurrenceSchemaPending(error)) return redirect(request, projectId, "schema_pending");
    console.error("Blinko OS: falha em ação de recorrência", { action, projectId, error });
    return redirect(request, projectId, "action_blocked");
  }
}
