import { NextResponse } from "next/server";
import { getInternalSession } from "../../../../../../../lib/blinko/internal-auth";
import {
  getProposalExecutionContext,
  isExecutionSchemaPending,
  recordCommercialContract,
} from "../../../../../../../lib/blinko/execution-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const localDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const allowedStatuses = new Set(["sent", "accepted", "signed"]);
const allowedMethods = new Set(["signature", "digital_acceptance", "email", "platform", "manual_record"]);

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const session = await getInternalSession();
  if (!session) return NextResponse.redirect(new URL("/interno/login", request.url), 303);

  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false }, { status: 404 });

  const form = await request.formData();
  const status = String(form.get("status") ?? "").trim();
  const acceptanceMethod = String(form.get("acceptance_method") ?? "").trim();
  const externalReference = String(form.get("external_reference") ?? "").trim().slice(0, 1000);
  const documentReference = String(form.get("document_reference") ?? "").trim().slice(0, 1000);
  const acceptedAtLocal = String(form.get("accepted_at") ?? "").trim();
  const acceptedByLabel = String(form.get("accepted_by_label") ?? "").trim().slice(0, 300);
  const notes = String(form.get("notes") ?? "").trim().slice(0, 5000);
  const confirmed = String(form.get("contract_fact_confirmed") ?? "") === "yes";

  const needsAcceptance = ["accepted", "signed"].includes(status);
  const invalid = !confirmed
    || !allowedStatuses.has(status)
    || (acceptanceMethod && !allowedMethods.has(acceptanceMethod))
    || (acceptedAtLocal && !localDateTimePattern.test(acceptedAtLocal))
    || (needsAcceptance && (!acceptedAtLocal || (!externalReference && !documentReference)));

  if (invalid) {
    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=contract_invalid`, request.url), 303);
  }

  try {
    const execution = await getProposalExecutionContext(id);
    const proposalId = String(execution.proposal?.id ?? "");
    if (!execution.schemaReady || !execution.formalizationSchemaReady || !uuidPattern.test(proposalId) || execution.proposal?.status !== "accepted") {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=contract_blocked`, request.url), 303);
    }

    await recordCommercialContract({
      proposalId,
      status,
      acceptanceMethod: acceptanceMethod || null,
      externalReference,
      documentReference,
      acceptedAt: acceptedAtLocal ? new Date(`${acceptedAtLocal}:00-03:00`).toISOString() : null,
      acceptedByLabel,
      notes,
      actorLabel: session.user,
    });

    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=contract_recorded`, request.url), 303);
  } catch (error) {
    if (isExecutionSchemaPending(error)) {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=formalization_schema_pending`, request.url), 303);
    }
    console.error("Blinko OS: falha ao registrar contrato", error);
    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=contract_blocked`, request.url), 303);
  }
}
