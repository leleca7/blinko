import { NextResponse } from "next/server";
import {
  extractMetaWhatsAppWebhookEvents,
  getMetaWhatsAppConfig,
  verifyMetaWebhookChallenge,
  verifyMetaWebhookSignature,
} from "../../../../../lib/blinko/whatsapp-meta";
import {
  findWhatsAppMessageByProviderId,
  recordWhatsAppDeliveryStatus,
  recordWhatsAppInboundMessage,
} from "../../../../../lib/blinko/whatsapp-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const verification = verifyMetaWebhookChallenge({
    mode: url.searchParams.get("hub.mode") ?? "",
    token: url.searchParams.get("hub.verify_token") ?? "",
    challenge: url.searchParams.get("hub.challenge") ?? "",
  });

  if (!verification.ok) {
    return new NextResponse(verification.reason === "not_configured" ? "Webhook not configured" : "Forbidden", {
      status: verification.reason === "not_configured" ? 503 : 403,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return new NextResponse(verification.challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const config = getMetaWhatsAppConfig();
  if (!config) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });

  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyMetaWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const events = extractMetaWhatsAppWebhookEvents(payload);
  let inboundRecorded = 0;
  let statusRecorded = 0;
  let ignored = 0;

  try {
    for (const event of events.inbound) {
      if (event.providerAccountId !== config.phoneNumberId) {
        ignored += 1;
        continue;
      }

      await recordWhatsAppInboundMessage({
        provider: "meta",
        providerAccountId: event.providerAccountId,
        providerConversationId: null,
        providerMessageId: event.providerMessageId,
        phone: event.phone,
        contactName: event.contactName,
        messageType: event.messageType,
        body: event.body,
        media: event.media,
        occurredAt: event.occurredAt,
        metadata: { ...event.metadata, source: "meta_webhook" },
      });
      inboundRecorded += 1;
    }

    for (const event of events.statuses) {
      const localMessage = await findWhatsAppMessageByProviderId(event.providerMessageId);
      const messageId = typeof localMessage?.id === "string" ? localMessage.id : "";
      if (!messageId) {
        ignored += 1;
        continue;
      }

      await recordWhatsAppDeliveryStatus({
        messageId,
        status: event.status,
        providerEventId: event.providerEventId,
        occurredAt: event.occurredAt,
        errorDetail: event.errorDetail,
        metadata: { ...event.metadata, source: "meta_webhook" },
      });
      statusRecorded += 1;
    }
  } catch (error) {
    console.error("Blinko OS: falha ao processar webhook do WhatsApp", error);
    return NextResponse.json({ ok: false, error: "processing_failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    inbound_recorded: inboundRecorded,
    status_recorded: statusRecorded,
    ignored,
  });
}
