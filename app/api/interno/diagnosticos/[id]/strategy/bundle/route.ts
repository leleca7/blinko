import { NextResponse } from "next/server";
import { getInternalSession } from "../../../../../../../lib/blinko/internal-auth";
import { BLINKO_DIAGNOSTIC_PILLARS } from "../../../../../../../lib/blinko/diagnostic-collection";
import {
  getDiagnosticStrategyContext,
  isDiagnosticStrategySchemaPending,
  recordDiagnosticStrategyBundle,
} from "../../../../../../../lib/blinko/diagnostic-strategy-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const pillarKeys = new Set(BLINKO_DIAGNOSTIC_PILLARS.map((item) => item.key));
const urgencyValues = new Set(["low", "medium", "high", "critical"]);
const problemStatusValues = new Set(["candidate", "confirmed", "discarded"]);
const confidenceValues = new Set(["low", "medium", "high"]);
const causeStatusValues = new Set(["hypothesis", "in_validation", "confirmed", "discarded"]);
const effortValues = new Set(["low", "medium", "high"]);
const riskValues = new Set(["low", "medium", "high"]);
const priorityStatusValues = new Set(["proposed", "selected", "deferred", "done"]);
const interventionStatusValues = new Set(["candidate", "selected", "approved_for_proposal", "discarded"]);

type Context = { params: Promise<{ id: string }> };

function field(form: FormData, name: string, max = 7000) {
  return String(form.get(name) ?? "").trim().slice(0, max);
}

function lines(form: FormData, name: string, maxItems = 40) {
  return field(form, name, 14000)
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function allowed(value: string, values: Set<string>, fallback: string) {
  return values.has(value) ? value : fallback;
}

export async function POST(request: Request, context: Context) {
  const session = await getInternalSession();
  if (!session) return NextResponse.redirect(new URL("/interno/login", request.url), 303);

  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false }, { status: 404 });

  const form = await request.formData();
  const problemTitle = field(form, "problem_title", 240);
  const problemDescription = field(form, "problem_description", 5000);
  const problemEvidence = lines(form, "problem_evidence", 30);
  const problemStatus = allowed(field(form, "problem_status", 40), problemStatusValues, "candidate");

  const causeDescription = field(form, "cause_description", 5000);
  const causeEvidence = lines(form, "cause_evidence", 30);
  const causeStatus = allowed(field(form, "cause_status", 40), causeStatusValues, "hypothesis");

  const priorityRationale = field(form, "priority_rationale", 5000);
  const interventionTitle = field(form, "intervention_title", 240);
  const interventionObjective = field(form, "intervention_objective", 5000);
  const interventionScope = field(form, "intervention_scope", 7000);
  const priorityStatus = allowed(field(form, "priority_status", 40), priorityStatusValues, "proposed");
  const interventionStatus = allowed(field(form, "intervention_status", 40), interventionStatusValues, "candidate");

  const invalidConfirmation = problemStatus === "confirmed" && problemEvidence.length === 0;
  const invalidCauseConfirmation = causeStatus === "confirmed" && causeEvidence.length === 0;
  const interventionIncomplete = Boolean(interventionTitle) && (!interventionObjective || !interventionScope);
  const selectedInterventionWithoutPriority = ["selected", "approved_for_proposal"].includes(interventionStatus) && !priorityRationale;

  if (!problemTitle || !problemDescription || invalidConfirmation || invalidCauseConfirmation || interventionIncomplete || selectedInterventionWithoutPriority) {
    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=strategy_invalid`, request.url), 303);
  }

  try {
    const strategyContext = await getDiagnosticStrategyContext(id);
    if (!strategyContext.schemaReady) {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=diagnostic_schema_pending`, request.url), 303);
    }

    const diagnosticStatus = typeof strategyContext.diagnostic?.status === "string" ? strategyContext.diagnostic.status : "";
    const reviewId = typeof strategyContext.currentReview?.id === "string" ? strategyContext.currentReview.id : "";
    if (diagnosticStatus !== "review" || !uuidPattern.test(reviewId)) {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=strategy_review_required`, request.url), 303);
    }

    const primaryPillarRaw = field(form, "problem_primary_pillar", 60);
    const relatedPillars = lines(form, "problem_related_pillars", 7).filter((item) => pillarKeys.has(item as never));
    const priorityPositionRaw = Number(field(form, "priority_position", 12));
    const priorityPosition = Number.isInteger(priorityPositionRaw) && priorityPositionRaw > 0 ? priorityPositionRaw : 1;

    await recordDiagnosticStrategyBundle({
      diagnosticId: id,
      analysisReviewId: reviewId,
      actorLabel: session.user,
      problem: {
        title: problemTitle,
        description: problemDescription,
        primary_pillar: pillarKeys.has(primaryPillarRaw as never) ? primaryPillarRaw : "",
        related_pillars: relatedPillars,
        evidence: problemEvidence,
        perceived_impact: field(form, "problem_impact", 3000),
        urgency: allowed(field(form, "problem_urgency", 40), urgencyValues, "medium"),
        status: problemStatus,
        confirmation_notes: field(form, "problem_confirmation_notes", 3000),
      },
      cause: {
        description: causeDescription,
        evidence: causeEvidence,
        confidence: allowed(field(form, "cause_confidence", 40), confidenceValues, "low"),
        validation_status: causeStatus,
        validation_notes: field(form, "cause_validation_notes", 3000),
      },
      priority: {
        impact: field(form, "priority_impact", 3000),
        urgency: allowed(field(form, "priority_urgency", 40), urgencyValues, "medium"),
        dependencies: lines(form, "priority_dependencies", 30),
        estimated_effort: allowed(field(form, "priority_effort", 40), effortValues, "medium"),
        risk: allowed(field(form, "priority_risk", 40), riskValues, "medium"),
        rationale: priorityRationale,
        sequence_position: priorityPosition,
        status: priorityStatus,
      },
      intervention: {
        library_key: field(form, "intervention_library_key", 160),
        title: interventionTitle,
        objective: interventionObjective,
        scope: interventionScope,
        deliverables: lines(form, "intervention_deliverables", 40),
        responsible_label: field(form, "intervention_responsible", 180),
        specialists_needed: lines(form, "intervention_specialists", 30),
        timeframe: field(form, "intervention_timeframe", 240),
        effort: field(form, "intervention_effort", 500),
        risks: lines(form, "intervention_risks", 30),
        dependencies: lines(form, "intervention_dependencies", 30),
        success_indicator: field(form, "intervention_success_indicator", 1600),
        approvals_required: lines(form, "intervention_approvals", 30),
        status: interventionStatus,
      },
    });

    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=strategy_saved`, request.url), 303);
  } catch (error) {
    if (isDiagnosticStrategySchemaPending(error)) {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=diagnostic_schema_pending`, request.url), 303);
    }
    console.error("Blinko OS: falha ao registrar estrutura estratégica", error);
    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=strategy_failed`, request.url), 303);
  }
}
