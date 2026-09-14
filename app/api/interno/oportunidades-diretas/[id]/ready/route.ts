import { NextResponse } from "next/server";
import { getInternalSession } from "../../../../../../lib/blinko/internal-auth";
import { isDirectSalesSchemaPending, markDirectOpportunityReadyToQuote } from "../../../../../../lib/blinko/direct-sales-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const session = await getInternalSession();
  if (!session) return NextResponse.redirect(new URL("/interno/login", request.url), 303);

  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false }, { status: 404 });

  const form = await request.formData();
  try {
    await markDirectOpportunityReadyToQuote({
      opportunityId: id,
      actorLabel: session.user,
      notes: String(form.get("notes") ?? ""),
    });
    return NextResponse.redirect(new URL(`/interno/oportunidades-diretas/${id}?status=ready`, request.url), 303);
  } catch (error) {
    if (isDirectSalesSchemaPending(error)) {
      return NextResponse.redirect(new URL(`/interno/oportunidades-diretas/${id}?status=schema_pending`, request.url), 303);
    }
    console.error("Blinko OS: falha ao concluir qualificação da venda direta", error);
    return NextResponse.redirect(new URL(`/interno/oportunidades-diretas/${id}?status=blocked`, request.url), 303);
  }
}
