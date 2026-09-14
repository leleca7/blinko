import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

type MetaWhatsAppConfig = {
  accessToken: string;
  phoneNumberId: string;
  verifyToken: string;
  appSecret: string;
  graphApiVersion: string;
};

function nonEmpty(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function getMetaWhatsAppConfig(): MetaWhatsAppConfig | null {
  const accessToken = nonEmpty(process.env.META_WHATSAPP_ACCESS_TOKEN);
  const phoneNumberId = nonEmpty(process.env.META_WHATSAPP_PHONE_NUMBER_ID);
  const verifyToken = nonEmpty(process.env.META_WHATSAPP_VERIFY_TOKEN);
  const appSecret = nonEmpty(process.env.META_WHATSAPP_APP_SECRET);
  const graphApiVersion = nonEmpty(process.env.META_GRAPH_API_VERSION);

  if (!accessToken || !phoneNumberId || !verifyToken || !appSecret || !graphApiVersion) return null;
  if (!/^v\d+\.\d+$/.test(graphApiVersion)) return null;

  return { accessToken, phoneNumberId, verifyToken, appSecret, graphApiVersion };
}

export function isMetaWhatsAppConfigured() {
  return Boolean(getMetaWhatsAppConfig());
}

export function getMetaWhatsAppConfigurationState() {
  const checks = {
    access_token: Boolean(nonEmpty(process.env.META_WHATSAPP_ACCESS_TOKEN)),
    phone_number_id: Boolean(nonEmpty(process.env.META_WHATSAPP_PHONE_NUMBER_ID)),
    verify_token: Boolean(nonEmpty(process.env.META_WHATSAPP_VERIFY_TOKEN)),
    app_secret: Boolean(nonEmpty(process.env.META_WHATSAPP_APP_SECRET)),
    graph_api_version: /^v\d+\.\d+$/.test(nonEmpty(process.env.META_GRAPH_API_VERSION) ?? ""),
  };
  return { configured: Object.values(checks).every(Boolean), checks };
}

export function verifyMetaWebhookChallenge(input: { mode: string; token: string; challenge: string }) {
  const config = getMetaWhatsAppConfig();
  if (!config) return { ok: false as const, reason: "not_configured" as const };
  if (input.mode !== "subscribe" || input.token !== config.verifyToken || !input.challenge) {
    return { ok: false as const, reason: "invalid_challenge" as const };
  }
  return { ok: true as const, challenge: input.challenge };
}

export function verifyMetaWebhookSignature(rawBody: string, signatureHeader: string | null) {
  const config = getMetaWhatsAppConfig();
  if (!config || !signatureHeader?.startsWith("sha256=")) return false;

  const suppliedHex = signatureHeader.slice("sha256=".length).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(suppliedHex)) return false;

  const expectedHex = createHmac("sha256", config.appSecret).update(rawBody, "utf8").digest("hex");
  const supplied = Buffer.from(suppliedHex, "hex");
  const expected = Buffer.from(expectedHex, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function sendMetaWhatsAppText(input: { to: string; body: string }) {
  const config = getMetaWhatsAppConfig();
  if (!config) throw new Error("meta_whatsapp_not_configured");

  const digits = input.to.replace(/\D/g, "");
  const body = input.body.trim();
  if (!digits || !body) throw new Error("invalid_whatsapp_outbound_payload");

  const response = await fetch(
    `https://graph.facebook.com/${encodeURIComponent(config.graphApiVersion)}/${encodeURIComponent(config.phoneNumberId)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: digits,
        type: "text",
        text: { preview_url: false, body },
      }),
      cache: "no-store",
    },
  );

  const payload = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    const error = new Error(`meta_whatsapp_send_failed_${response.status}`) as Error & { response?: unknown };
    error.response = payload;
    throw error;
  }

  const providerMessageId = firstString(payload, ["messages", 0, "id"]);
  if (!providerMessageId) throw new Error("meta_whatsapp_send_missing_message_id");

  return { providerMessageId, payload };
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function array(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function string(value: unknown) {
  return typeof value === "string" ? value : "";
}

function firstString(value: unknown, path: Array<string | number>) {
  let current: unknown = value;
  for (const part of path) {
    if (typeof part === "number") {
      if (!Array.isArray(current)) return "";
      current = current[part];
    } else {
      const currentObject = object(current);
      if (!currentObject) return "";
      current = currentObject[part];
    }
  }
  return string(current);
}

function isoFromUnixSeconds(value: unknown) {
  const seconds = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  if (!Number.isFinite(seconds) || seconds <= 0) return new Date().toISOString();
  return new Date(seconds * 1000).toISOString();
}

function normalizeInboundType(rawType: string) {
  if (["text", "image", "audio", "video", "document", "location", "template", "interactive", "system"].includes(rawType)) {
    return rawType;
  }
  if (["button", "contacts", "sticker", "reaction", "order"].includes(rawType)) return "interactive";
  return "system";
}

function messageBody(message: Record<string, unknown>, rawType: string) {
  if (rawType === "text") return firstString(message, ["text", "body"]);
  if (["image", "video", "document"].includes(rawType)) return firstString(message, [rawType, "caption"]);
  if (rawType === "button") return firstString(message, ["button", "text"]);
  if (rawType === "interactive") {
    return firstString(message, ["interactive", "button_reply", "title"])
      || firstString(message, ["interactive", "list_reply", "title"]);
  }
  if (rawType === "system") return firstString(message, ["system", "body"]);
  return "";
}

function contactNameFor(contacts: unknown[], waId: string) {
  for (const raw of contacts) {
    const contact = object(raw);
    if (!contact || string(contact.wa_id) !== waId) continue;
    const name = firstString(contact, ["profile", "name"]);
    if (name) return name;
  }
  return "";
}

export type MetaInboundEvent = {
  providerAccountId: string;
  providerMessageId: string;
  phone: string;
  contactName: string;
  messageType: string;
  body: string;
  occurredAt: string;
  media: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export type MetaStatusEvent = {
  providerMessageId: string;
  status: "sent" | "delivered" | "read" | "failed";
  providerEventId: string;
  occurredAt: string;
  errorDetail: string;
  metadata: Record<string, unknown>;
};

export function extractMetaWhatsAppWebhookEvents(payload: unknown) {
  const inbound: MetaInboundEvent[] = [];
  const statuses: MetaStatusEvent[] = [];

  const root = object(payload);
  if (!root || (root.object && root.object !== "whatsapp_business_account")) return { inbound, statuses };

  for (const rawEntry of array(root.entry)) {
    const entry = object(rawEntry);
    if (!entry) continue;

    for (const rawChange of array(entry.changes)) {
      const change = object(rawChange);
      const value = object(change?.value);
      if (!value) continue;

      const metadata = object(value.metadata) ?? {};
      const providerAccountId = string(metadata.phone_number_id) || string(entry.id);
      const contacts = array(value.contacts);

      for (const rawMessage of array(value.messages)) {
        const message = object(rawMessage);
        if (!message) continue;

        const providerMessageId = string(message.id);
        const phone = string(message.from);
        if (!providerMessageId || !phone || !providerAccountId) continue;

        const rawType = string(message.type) || "system";
        const mediaSource = object(message[rawType]) ?? {};
        inbound.push({
          providerAccountId,
          providerMessageId,
          phone,
          contactName: contactNameFor(contacts, phone),
          messageType: normalizeInboundType(rawType),
          body: messageBody(message, rawType),
          occurredAt: isoFromUnixSeconds(message.timestamp),
          media: mediaSource,
          metadata: {
            raw_type: rawType,
            context: object(message.context) ?? null,
            referral: object(message.referral) ?? null,
          },
        });
      }

      for (const rawStatus of array(value.statuses)) {
        const status = object(rawStatus);
        if (!status) continue;
        const providerMessageId = string(status.id);
        const rawStatusValue = string(status.status);
        if (!providerMessageId || !["sent", "delivered", "read", "failed"].includes(rawStatusValue)) continue;

        const occurredAt = isoFromUnixSeconds(status.timestamp);
        const errors = array(status.errors);
        statuses.push({
          providerMessageId,
          status: rawStatusValue as MetaStatusEvent["status"],
          providerEventId: `${providerMessageId}:${rawStatusValue}:${string(status.timestamp) || occurredAt}`,
          occurredAt,
          errorDetail: errors.length ? JSON.stringify(errors) : "",
          metadata: {
            recipient_id: string(status.recipient_id) || null,
            conversation: object(status.conversation) ?? null,
            pricing: object(status.pricing) ?? null,
          },
        });
      }
    }
  }

  return { inbound, statuses };
}
