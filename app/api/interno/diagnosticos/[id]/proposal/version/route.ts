import { NextResponse } from "next/server";
import { getInternalSession } from "../../../../../../../lib/blinko/internal-auth";
import {
  getProposalContext,
  isProposalSchemaPending,
  recordProposalVersion,
} from "../../../../../../../lib/blinko/proposal-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Context = { params: Promise<{ id: string }> };

function field(form: FormData, name: string, max = 7000) {
  return String(form.get(name) ?? "").trim().slice(0, max);
}

export async function POST(request: Request, context: Context) {
  const session = await getInternalSession();
  if (!session) return NextResponse.redirect(new URL("/interno/login", request.url), 303);

  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false }, { status: 404 });

  const form = await request.formData();
  const interventionIds = form.getAll("intervention_ids")
    .map((value) => String(value).trim())
    .filter((value) => uuidPattern.test(value));

  if (!interventionIds.length) {
    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=proposal_missing_intervention`, request.url), 303);
  }

  try {
    const proposalContext = await getProposalContext(id);
    if (!proposalContext.schemaReady) {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=diagnostic_schema_pending`, request.url), 303);
    }
    if (proposalContext.diagnostic?.status !== "presented") {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=proposal_requires_presentation`, request.url), 303);
    }

    const allowedIds = new Set(proposalContext.availableInterventions.map((item) => String(item.id ?? "")));
    if (interventionIds.some((value) => !allowedIds.has(value))) {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=proposal_invalid`, request.url), 303);
    }

    await recordProposalVersion({
      diagnosticId: id,
      actorLabel: session.user,
      interventionIds,
      scope: field(form, "scope"),
      blinkoResponsibilities: field(form, "blinko_responsibilities"),
      clientResponsibilities: field(form, "client_responsibilities"),
      timeframe: field(form, "timeframe", 1200),
      investment: field(form, "investment", 1200),
      conditions: field(form, "conditions", 3000),
      validity: field(form, "validity", 1000),
      risksLimits: field(form, "risks_limits", 5000),
    });

    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=proposal_saved`, request.url), 303);
  } catch (error) {
    if (isProposalSchemaPending(error)) {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=diagnostic_schema_pending`, request.url), 303);
    }
    console.error("Blinko OS: falha ao registrar versão da proposta", error);
    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=proposal_failed`, request.url), 303);
  }
}
