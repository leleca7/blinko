import { NextResponse } from "next/server";
import { getInternalSession } from "../../../../../../lib/blinko/internal-auth";
import { getDirectOpportunityWorkspace, isDirectSalesSchemaPending } from "../../../../../../lib/blinko/direct-sales-server";
import { createProjectFromPaidDirectOpportunity, isExecutionSchemaPending } from "../../../../../../lib/blinko/execution-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Context = { params: Promise<{ id: string }> };

function value(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

export async function POST(request: Request, context: Context) {
  const session = await getInternalSession();
  if (!session) return NextResponse.redirect(new URL("/interno/login", request.url), 303);

  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false }, { status: 404 });

  const form = await request.formData();
  const objective = value(form, "objective");
  const startDate = value(form, "start_date");
  const targetTimeframe = value(form, "target_timeframe");
  const contractReference = value(form, "contract_reference");
  const nextReviewAt = value(form, "next_review_at") || null;

  if (!objective || !startDate || !targetTimeframe || !contractReference) {
    return NextResponse.redirect(new URL(`/interno/oportunidades-diretas/${id}?status=invalid`, request.url), 303);
  }

  try {
    const workspace = await getDirectOpportunityWorkspace(id);
    if (!workspace.schemaReady) {
      return NextResponse.redirect(new URL(`/interno/oportunidades-diretas/${id}?status=schema_pending`, request.url), 303);
    }
    if (workspace.opportunity?.status !== "paid") {
      return NextResponse.redirect(new URL(`/interno/oportunidades-diretas/${id}?status=blocked`, request.url), 303);
    }

    const projectId = await createProjectFromPaidDirectOpportunity({
      opportunityId: id,
      actorLabel: session.user,
      objective,
      startDate,
      targetTimeframe,
      contractReference,
      nextReviewAt,
    });

    return NextResponse.redirect(new URL(`/interno/projetos/${projectId}?status=project_created`, request.url), 303);
  } catch (error) {
    if (isDirectSalesSchemaPending(error) || isExecutionSchemaPending(error)) {
      return NextResponse.redirect(new URL(`/interno/oportunidades-diretas/${id}?status=schema_pending`, request.url), 303);
    }
    console.error("Blinko OS: falha ao criar projeto da venda direta", error);
    return NextResponse.redirect(new URL(`/interno/oportunidades-diretas/${id}?status=blocked`, request.url), 303);
  }
}
