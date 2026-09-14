import { NextResponse } from "next/server";
import { getInternalSession } from "../../../../../../lib/blinko/internal-auth";
import { isWhatsAppSchemaPending, linkWhatsAppConversation } from "../../../../../../lib/blinko/whatsapp-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Context = { params: Promise<{ id: string }> };

function optionalUuid(form: FormData, key: string) {
  const value = String(form.get(key) ?? "").trim();
  if (!value) return null;
  return uuidPattern.test(value) ? value : "invalid";
}

export async function POST(request: Request, context: Context) {
  const session = await getInternalSession();
  if (!session) return NextResponse.redirect(new URL("/interno/login", request.url), 303);

  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false }, { status: 404 });

  const form = await request.formData();
  const leadId = optionalUuid(form, "lead_id");
  const opportunityId = optionalUuid(form, "direct_opportunity_id");
  if (leadId === "invalid" || opportunityId === "invalid" || (opportunityId && !leadId)) {
    return NextResponse.redirect(new URL(`/interno/whatsapp/${id}?status=invalid`, request.url), 303);
  }

  try {
    await linkWhatsAppConversation({
      conversationId: id,
      leadId,
      directOpportunityId: opportunityId,
      actorLabel: session.user,
    });
    return NextResponse.redirect(new URL(`/interno/whatsapp/${id}?status=linked`, request.url), 303);
  } catch (error) {
    if (isWhatsAppSchemaPending(error)) {
      return NextResponse.redirect(new URL(`/interno/whatsapp/${id}?status=schema_pending`, request.url), 303);
    }
    console.error("Blinko OS: falha ao vincular conversa do WhatsApp", error);
    return NextResponse.redirect(new URL(`/interno/whatsapp/${id}?status=blocked`, request.url), 303);
  }
}
