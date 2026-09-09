import { NextResponse } from "next/server";
import { getInternalSession } from "../../../../../../../lib/blinko/internal-auth";
import {
  getProposalExecutionContext,
  isExecutionSchemaPending,
  setCommercialStartCondition,
} from "../../../../../../../lib/blinko/execution-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const localDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const requirements = new Set(["required", "not_required", "to_define"]);
const statuses = new Set(["pending", "satisfied", "waived", "not_applicable"]);
const conditionCodes = new Set([
  "contract_valid",
  "financial_condition",
  "company_registration",
  "briefing_minimum",
  "accesses",
  "materials",
  "authorizations",
  "partner_validation",
  "operational_capacity",
  "solution_prerequisites",
]);

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const session = await getInternalSession();
  if (!session) return NextResponse.redirect(new URL("/interno/login", request.url), 303);

  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false }, { status: 404 });

  const form = await request.formData();
  const conditionCode = String(form.get("condition_code") ?? "").trim();
  const requirement = String(form.get("requirement") ?? "").trim();
  const conditionStatus = String(form.get("condition_status") ?? "").trim();
  const evidence = String(form.get("evidence") ?? "").trim().slice(0, 5000);
  const ownerLabel = String(form.get("owner_label") ?? "").trim().slice(0, 300);
  const dueAtLocal = String(form.get("due_at") ?? "").trim();
  const notes = String(form.get("notes") ?? "").trim().slice(0, 5000);
  const confirmed = String(form.get("condition_confirmed") ?? "") === "yes";

  if (!confirmed || !conditionCodes.has(conditionCode) || !requirements.has(requirement) || !statuses.has(conditionStatus) || (dueAtLocal && !localDateTimePattern.test(dueAtLocal))) {
    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=start_condition_invalid`, request.url), 303);
  }

  try {
    const execution = await getProposalExecutionContext(id);
    const opportunityId = String(execution.proposal?.opportunity_id ?? "");
    if (!execution.schemaReady || !execution.formalizationSchemaReady || !uuidPattern.test(opportunityId)) {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=start_condition_blocked`, request.url), 303);
    }

    await setCommercialStartCondition({
      opportunityId,
      conditionCode,
      requirement,
      status: conditionStatus,
      evidence,
      ownerLabel,
      dueAt: dueAtLocal ? new Date(`${dueAtLocal}:00-03:00`).toISOString() : null,
      notes,
      actorLabel: session.user,
    });

    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=start_condition_saved`, request.url), 303);
  } catch (error) {
    if (isExecutionSchemaPending(error)) {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=formalization_schema_pending`, request.url), 303);
    }
    console.error("Blinko OS: falha ao atualizar condição de início", error);
    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=start_condition_blocked`, request.url), 303);
  }
}
