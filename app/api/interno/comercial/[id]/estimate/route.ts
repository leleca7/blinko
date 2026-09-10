import { NextResponse } from "next/server";
import { requireInternalSession } from "../../../../../../lib/blinko/internal-auth";
import { isCommercialSchemaPending, setCommercialOpportunityEstimate } from "../../../../../../lib/blinko/commercial-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const session = await requireInternalSession("commercial.manage");
  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false }, { status: 404 });

  const form = await request.formData();
  const estimatedRaw = String(form.get("estimated_value") ?? "").trim();
  const expectedCloseDate = String(form.get("expected_close_date") ?? "").trim();
  const confirmed = String(form.get("estimate_confirmed") ?? "") === "yes";
  const estimatedValue = Number(estimatedRaw);

  if (!confirmed || !estimatedRaw || !Number.isFinite(estimatedValue) || estimatedValue <= 0 || (expectedCloseDate && !datePattern.test(expectedCloseDate))) {
    return NextResponse.redirect(new URL(`/interno/comercial/${id}?status=estimate_invalid`, request.url), 303);
  }

  try {
    await setCommercialOpportunityEstimate({ opportunityId: id, estimatedValue, expectedCloseDate: expectedCloseDate || null, actorLabel: session.user });
    return NextResponse.redirect(new URL(`/interno/comercial/${id}?status=estimate_saved`, request.url), 303);
  } catch (error) {
    if (isCommercialSchemaPending(error)) return NextResponse.redirect(new URL(`/interno/comercial/${id}?status=commercial_schema_pending`, request.url), 303);
    console.error("Blinko OS: falha ao atualizar estimativa comercial", error);
    return NextResponse.redirect(new URL(`/interno/comercial/${id}?status=estimate_blocked`, request.url), 303);
  }
}
