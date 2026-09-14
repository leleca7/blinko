import "server-only";

import { neon } from "@neondatabase/serverless";

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("neon_not_configured");
  return databaseUrl;
}

function getSql() {
  return neon(getDatabaseUrl());
}

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export async function claimMetaWhatsAppOutboundMessage(input: {
  conversationId: string;
  messageId: string;
  providerAccountId: string;
  actorLabel: string;
}) {
  const sql = getSql();
  const rows = await sql`
    with target as (
      select
        m.id,
        m.conversation_id,
        m.message_type,
        m.body,
        m.media,
        c.phone_e164,
        c.provider,
        c.provider_account_id
      from public.whatsapp_messages m
      join public.whatsapp_conversations c on c.id = m.conversation_id
      where m.id = ${input.messageId}::uuid
        and m.conversation_id = ${input.conversationId}::uuid
        and m.direction = 'outbound'
        and m.status = 'approved'
        and c.status <> 'archived'
        and c.provider = 'meta'
        and c.provider_account_id = ${input.providerAccountId}
      limit 1
      for update of m
    ), claimed as (
      update public.whatsapp_messages m
         set status = 'queued',
             updated_at = now(),
             metadata = m.metadata || jsonb_build_object(
               'provider_send_claimed_by', ${input.actorLabel},
               'provider_send_claimed_at', now(),
               'provider', 'meta'
             )
        from target t
       where m.id = t.id
         and m.status = 'approved'
      returning
        m.id,
        m.conversation_id,
        m.message_type,
        m.body,
        m.media,
        t.phone_e164,
        t.provider,
        t.provider_account_id
    )
    select * from claimed
  `;
  return record(rows[0]) ?? null;
}

export async function releaseMetaWhatsAppOutboundClaim(input: {
  messageId: string;
  actorLabel: string;
  reason: string;
}) {
  const sql = getSql();
  const rows = await sql`
    with updated as (
      update public.whatsapp_messages
         set status = 'approved',
             error_detail = ${input.reason},
             updated_at = now(),
             metadata = metadata || jsonb_build_object(
               'provider_send_released_by', ${input.actorLabel},
               'provider_send_released_at', now(),
               'provider_send_release_reason', ${input.reason}
             )
       where id = ${input.messageId}::uuid
         and direction = 'outbound'
         and status = 'queued'
      returning id, conversation_id
    ), audit as (
      insert into public.audit_events (entity_type, entity_id, event_type, actor_type, actor_id, payload)
      select
        'whatsapp_message',
        u.id,
        'whatsapp_provider_send_released',
        'system',
        ${input.actorLabel},
        jsonb_build_object('conversation_id', u.conversation_id, 'reason', ${input.reason}, 'provider', 'meta')
      from updated u
      returning id
    )
    select id from updated limit 1
  `;
  return typeof rows[0]?.id === "string" ? rows[0].id : null;
}
