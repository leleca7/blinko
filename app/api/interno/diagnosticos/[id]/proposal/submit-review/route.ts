import { NextResponse } from "next/server";
import { getInternalSession } from "../../../../../../../lib/blinko/internal-auth";
import {
  getProposalContext,
  isProposalSchemaPending,
  submitProposalForInternalReview,
} from "../../../../../../../lib/blinko/proposal-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const session = await getInternalSession();
  if (!session) return NextResponse.redirect(new URL("/interno/login", request.url), 303);

  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false }, { status: 404 });

  const form = await request.formData();
  const proposalId = String(form.get("proposal_id") ?? "").trim();
  if (!uuidPattern.test(proposalId)) return NextResponse.json({ ok: false }, { status: 404 });

  try {
    const proposalContext = await getProposalContext(id);
    if (!proposalContext.schemaReady) {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=diagnostic_schema_pending`, request.url), 303);
    }
    if (proposalContext.proposal?.id !== proposalId || proposalContext.proposal?.status !== "draft") {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=proposal_review_blocked`, request.url), 303);
    }

    await submitProposalForInternalReview({ proposalId, actorLabel: session.user });
    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=proposal_review_started`, request.url), 303);
  } catch (error) {
    if (isProposalSchemaPending(error)) {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=diagnostic_schema_pending`, request.url), 303);
    }
    console.error("Blinko OS: falha ao enviar proposta para revisão interna", error);
    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=proposal_incomplete`, request.url), 303);
  }
}
