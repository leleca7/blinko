import { NextResponse } from "next/server";
import { getInternalSession } from "../../../../../../../lib/blinko/internal-auth";
import {
  createProjectFromAcceptedProposal,
  getProposalExecutionContext,
  isExecutionSchemaPending,
} from "../../../../../../../lib/blinko/execution-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const localDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const session = await getInternalSession();
  if (!session) return NextResponse.redirect(new URL("/interno/login", request.url), 303);

  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false }, { status: 404 });

  const form = await request.formData();
  const objective = String(form.get("objective") ?? "").trim().slice(0, 5000);
  const startDate = String(form.get("start_date") ?? "").trim();
  const targetTimeframe = String(form.get("target_timeframe") ?? "").trim().slice(0, 1000);
  const contractReference = String(form.get("contract_reference") ?? "").trim().slice(0, 1000);
  const nextReviewLocal = String(form.get("next_review_at") ?? "").trim();
  const confirmed = String(form.get("execution_contracted") ?? "") === "yes";

  if (!confirmed || !objective || !datePattern.test(startDate) || !targetTimeframe || !contractReference || (nextReviewLocal && !localDateTimePattern.test(nextReviewLocal))) {
    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=project_contract_invalid`, request.url), 303);
  }

  try {
    const executionContext = await getProposalExecutionContext(id);
    if (!executionContext.schemaReady) {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=diagnostic_schema_pending`, request.url), 303);
    }
    const proposalId = String(executionContext.proposal?.id ?? "");
    if (!uuidPattern.test(proposalId) || executionContext.proposal?.status !== "accepted") {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=project_contract_blocked`, request.url), 303);
    }

    const projectId = await createProjectFromAcceptedProposal({
      proposalId,
      actorLabel: session.user,
      objective,
      startDate,
      targetTimeframe,
      contractReference,
      nextReviewAt: nextReviewLocal ? new Date(`${nextReviewLocal}:00-03:00`).toISOString() : null,
    });

    return NextResponse.redirect(new URL(`/interno/projetos/${projectId}?status=project_created`, request.url), 303);
  } catch (error) {
    if (isExecutionSchemaPending(error)) {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=diagnostic_schema_pending`, request.url), 303);
    }
    console.error("Blinko OS: falha ao criar projeto da execução", error);
    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=project_contract_blocked`, request.url), 303);
  }
}
