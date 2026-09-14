import { NextResponse } from "next/server";
import { getInternalSession } from "../../../../../../lib/blinko/internal-auth";
import { getMetaWhatsAppConfig, sendMetaWhatsAppText } from "../../../../../../lib/blinko/whatsapp-meta";
import { claimMetaWhatsAppOutboundMessage, releaseMetaWhatsAppOutboundClaim } from "../../../../../../lib/blinko/whatsapp-provider-server";
import { recordWhatsAppOutboundSent } from "../../../../../../lib/blinko/whatsapp-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Context = { params: Promise<{ id: string }> };

function safeErrorReason(error: unknown) {
  if (error instanceof Error && /^[a-z0-9_\-]+$/i.test(error.message)) return error.message.slice(0, 180);
  return "meta_whatsapp_send_failed";
}

export async function POST(request: Request, context: Context) {
  const session = await getInternalSession();
  if (!session) return NextResponse.redirect(new URL("/interno/login", request.url), 303);

  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false }, { status: 404 });

  const form = await request.formData();
  const messageId = String(form.get("message_id") ?? "").trim();
  if (!uuidPattern.test(messageId)) {
    return NextResponse.redirect(new URL(`/interno/whatsapp/${id}?status=invalid`, request.url), 303);
  }

  const config = getMetaWhatsAppConfig();
  if (!config) {
    return NextResponse.redirect(new URL(`/interno/whatsapp/${id}?status=provider_not_configured`, request.url), 303);
  }

  const claimed = await claimMetaWhatsAppOutboundMessage({
    conversationId: id,
    messageId,
    providerAccountId: config.phoneNumberId,
    actorLabel: session.user,
  });

  if (!claimed) {
    return NextResponse.redirect(new URL(`/interno/whatsapp/${id}?status=provider_send_blocked`, request.url), 303);
  }

  const messageType = typeof claimed.message_type === "string" ? claimed.message_type : "";
  const body = typeof claimed.body === "string" ? claimed.body : "";
  const phone = typeof claimed.phone_e164 === "string" ? claimed.phone_e164 : "";

  if (messageType !== "text" || !body.trim() || !phone) {
    await releaseMetaWhatsAppOutboundClaim({
      messageId,
      actorLabel: session.user,
      reason: "unsupported_provider_payload",
    });
    return NextResponse.redirect(new URL(`/interno/whatsapp/${id}?status=provider_send_blocked`, request.url), 303);
  }

  let providerMessageId = "";
  let providerPayload: unknown = null;
  try {
    const sent = await sendMetaWhatsAppText({ to: phone, body });
    providerMessageId = sent.providerMessageId;
    providerPayload = sent.payload;
  } catch (error) {
    console.error("Blinko OS: falha ao enviar mensagem pelo WhatsApp oficial", error);
    await releaseMetaWhatsAppOutboundClaim({
      messageId,
      actorLabel: session.user,
      reason: safeErrorReason(error),
    });
    return NextResponse.redirect(new URL(`/interno/whatsapp/${id}?status=provider_send_failed`, request.url), 303);
  }

  try {
    await recordWhatsAppOutboundSent({
      messageId,
      providerMessageId,
      actorLabel: session.user,
      metadata: { provider: "meta", provider_response_recorded: Boolean(providerPayload) },
    });
  } catch (error) {
    // A chamada externa já foi aceita pelo provedor. Não liberamos o claim para evitar envio duplicado.
    console.error("Blinko OS: WhatsApp enviado, mas o registro local precisa de reconciliação", error);
    return NextResponse.redirect(new URL(`/interno/whatsapp/${id}?status=provider_reconciliation_required`, request.url), 303);
  }

  return NextResponse.redirect(new URL(`/interno/whatsapp/${id}?status=sent_via_provider`, request.url), 303);
}
