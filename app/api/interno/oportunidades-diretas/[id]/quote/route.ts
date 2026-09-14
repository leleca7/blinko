import { NextResponse } from "next/server";
import { getInternalSession } from "../../../../../../lib/blinko/internal-auth";
import { isDirectSalesSchemaPending, recordDirectOpportunityQuote } from "../../../../../../lib/blinko/direct-sales-server";

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
  const scope = value(form, "scope");
  const timeframe = value(form, "timeframe");
  const investment = value(form, "investment");
  const conditions = value(form, "conditions");
  const validity = value(form, "validity");

  if (!scope || !timeframe || !investment || !conditions || !validity) {
    return NextResponse.redirect(new URL(`/interno/oportunidades-diretas/${id}?status=invalid`, request.url), 303);
  }

  try {
    await recordDirectOpportunityQuote({
      opportunityId: id,
      actorLabel: session.user,
      scope,
      clientResponsibilities: value(form, "client_responsibilities"),
      timeframe,
      investment,
      conditions,
      validity,
      risksLimits: value(form, "risks_limits"),
    });
    return NextResponse.redirect(new URL(`/interno/oportunidades-diretas/${id}?status=quote_saved`, request.url), 303);
  } catch (error) {
    if (isDirectSalesSchemaPending(error)) {
      return NextResponse.redirect(new URL(`/interno/oportunidades-diretas/${id}?status=schema_pending`, request.url), 303);
    }
    console.error("Blinko OS: falha ao registrar orçamento da venda direta", error);
    return NextResponse.redirect(new URL(`/interno/oportunidades-diretas/${id}?status=blocked`, request.url), 303);
  }
}
