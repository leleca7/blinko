import { NextResponse } from "next/server";
import { getInternalSession } from "../../../../../../../lib/blinko/internal-auth";
import {
  getProposalExecutionContext,
  isExecutionSchemaPending,
  recordProposalExternalEvent,
} from "../../../../../../../lib/blinko/execution-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const localDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const allowedEvents = new Set(["sent", "negotiation", "accepted", "refused", "expired"]);

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const session = await getInternalSession();
  if (!session) return NextResponse.redirect(new URL("/interno/login", request.url), 303);

  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false }, { status: 404 });

  const form = await request.formData();
  const eventType = String(form.get("event_type") ?? "").trim();
  const occurredAtLocal = String(form.get("occurred_at") ?? "").trim();
  const externalReference = String(form.get("external_reference") ?? "").trim().slice(0, 500);
  const channel = String(form.get("channel") ?? "").trim().slice(0, 80);
  const notes = String(form.get("notes") ?? "").trim().slice(0, 3000);
  const confirmed = String(form.get("external_fact_confirmed") ?? "") === "yes";

  if (!confirmed || !allowedEvents.has(eventType) || !localDateTimePattern.test(occurredAtLocal) || !externalReference) {
    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=proposal_external_invalid`, request.url), 303);
  }

  try {
    const executionContext = await getProposalExecutionContext(id);
    if (!executionContext.schemaReady) {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=diagnostic_schema_pending`, request.url), 303);
    }
    const proposalId = String(executionContext.proposal?.id ?? "");
    if (!uuidPattern.test(proposalId)) {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=proposal_external_blocked`, request.url), 303);
    }

    await recordProposalExternalEvent({
      proposalId,
      actorLabel: session.user,
      eventType,
      channel,
      externalReference,
      notes,
      occurredAt: new Date(`${occurredAtLocal}:00-03:00`).toISOString(),
    });

    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=proposal_external_recorded`, request.url), 303);
  } catch (error) {
    if (isExecutionSchemaPending(error)) {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=diagnostic_schema_pending`, request.url), 303);
    }
    console.error("Blinko OS: falha ao registrar fato externo da proposta", error);
    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=proposal_external_blocked`, request.url), 303);
  }
}
