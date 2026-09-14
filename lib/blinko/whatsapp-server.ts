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

function errorCode(error: unknown) {
  if (!error || typeof error !== "object") return "";
  return typeof (error as { code?: unknown }).code === "string"
    ? String((error as { code?: string }).code)
    : "";
}

export function isWhatsAppSchemaPending(error: unknown) {
  return ["42P01", "42703", "42883"].includes(errorCode(error));
}

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function records(value: unknown) {
  return Array.isArray(value) ? value.map(record).filter(Boolean) as Record<string, unknown>[] : [];
}

export async function listWhatsAppConversations() {
  const sql = getSql();
  try {
    const rows = await sql`
      select
        c.id,
        c.provider,
        c.phone_e164,
        c.contact_name,
        c.status,
        c.unread_count,
        c.last_message_at,
        c.lead_id,
        c.direct_opportunity_id,
        l.name as lead_name,
        l.company_name,
        o.product_code,
        latest.body as latest_body,
        latest.direction as latest_direction,
        latest.message_type as latest_message_type
      from public.whatsapp_conversations c
      left join public.leads l on l.id = c.lead_id
      left join public.direct_opportunities o on o.id = c.direct_opportunity_id
      left join lateral (
        select m.body, m.direction, m.message_type
        from public.whatsapp_messages m
        where m.conversation_id = c.id
        order by m.occurred_at desc, m.created_at desc
        limit 1
      ) latest on true
      where c.status <> 'archived'
      order by
        case c.status when 'waiting_human' then 0 when 'open' then 1 when 'waiting_customer' then 2 when 'closed' then 3 else 4 end,
        c.unread_count desc,
        c.last_message_at desc nulls last,
        c.created_at desc
      limit 150
    `;
    return { schemaReady: true, conversations: rows as Record<string, unknown>[] };
  } catch (error) {
    if (isWhatsAppSchemaPending(error)) return { schemaReady: false, conversations: [] as Record<string, unknown>[] };
    throw error;
  }
}

export type WhatsAppConversationWorkspace = {
  schemaReady: boolean;
  conversation: Record<string, unknown> | null;
  lead: Record<string, unknown> | null;
  company: Record<string, unknown> | null;
  directOpportunity: Record<string, unknown> | null;
  messages: Record<string, unknown>[];
  recentLeads: Record<string, unknown>[];
  leadOpportunities: Record<string, unknown>[];
};

export async function getWhatsAppConversationWorkspace(conversationId: string): Promise<WhatsAppConversationWorkspace> {
  const sql = getSql();
  try {
    const rows = await sql`
      select jsonb_build_object(
        'conversation', to_jsonb(c),
        'lead', case when l.id is null then null else to_jsonb(l) end,
        'company', case when co.id is null then null else to_jsonb(co) end,
        'direct_opportunity', case when o.id is null then null else to_jsonb(o) end,
        'messages', coalesce((
          select jsonb_agg(to_jsonb(m) order by m.occurred_at asc, m.created_at asc)
          from public.whatsapp_messages m
          where m.conversation_id = c.id
        ), '[]'::jsonb),
        'recent_leads', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', lr.id,
            'name', lr.name,
            'company_name', lr.company_name,
            'whatsapp', lr.whatsapp,
            'status', lr.status
          ) order by lr.updated_at desc)
          from (
            select id, name, company_name, whatsapp, status, updated_at
            from public.leads
            where status <> 'archived'
            order by updated_at desc
            limit 100
          ) lr
        ), '[]'::jsonb),
        'lead_opportunities', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', od.id,
            'product_code', od.product_code,
            'opportunity_type', od.opportunity_type,
            'status', od.status
          ) order by od.created_at desc)
          from public.direct_opportunities od
          where od.lead_id = c.lead_id
        ), '[]'::jsonb)
      ) as result
      from public.whatsapp_conversations c
      left join public.leads l on l.id = c.lead_id
      left join public.companies co on co.id = c.company_id
      left join public.direct_opportunities o on o.id = c.direct_opportunity_id
      where c.id = ${conversationId}::uuid
      limit 1
    `;
    const result = rows[0]?.result as Record<string, unknown> | undefined;
    return {
      schemaReady: true,
      conversation: record(result?.conversation),
      lead: record(result?.lead),
      company: record(result?.company),
      directOpportunity: record(result?.direct_opportunity),
      messages: records(result?.messages),
      recentLeads: records(result?.recent_leads),
      leadOpportunities: records(result?.lead_opportunities),
    };
  } catch (error) {
    if (isWhatsAppSchemaPending(error)) {
      return {
        schemaReady: false,
        conversation: null,
        lead: null,
        company: null,
        directOpportunity: null,
        messages: [],
        recentLeads: [],
        leadOpportunities: [],
      };
    }
    throw error;
  }
}

export async function recordWhatsAppInboundMessage(input: {
  provider: string;
  providerAccountId: string;
  providerConversationId?: string | null;
  providerMessageId: string;
  phone: string;
  contactName?: string | null;
  messageType: string;
  body?: string | null;
  media?: Record<string, unknown>;
  occurredAt: string;
  metadata?: Record<string, unknown>;
}) {
  const sql = getSql();
  const rows = await sql`
    select public.record_whatsapp_inbound_message(
      ${input.provider},
      ${input.providerAccountId},
      ${input.providerConversationId ?? ""},
      ${input.providerMessageId},
      ${input.phone},
      ${input.contactName ?? ""},
      ${input.messageType},
      ${input.body ?? ""},
      ${JSON.stringify(input.media ?? {})}::jsonb,
      ${input.occurredAt}::timestamptz,
      ${JSON.stringify(input.metadata ?? {})}::jsonb
    ) as result
  `;
  return rows[0]?.result as Record<string, unknown>;
}

export async function linkWhatsAppConversation(input: {
  conversationId: string;
  leadId?: string | null;
  directOpportunityId?: string | null;
  actorLabel: string;
}) {
  const sql = getSql();
  const leadId = input.leadId || null;
  const opportunityId = input.directOpportunityId || null;
  const rows = await sql`
    select public.link_whatsapp_conversation(
      ${input.conversationId}::uuid,
      ${leadId}::uuid,
      ${opportunityId}::uuid,
      ${input.actorLabel}
    ) as result
  `;
  return rows[0]?.result as string;
}

export async function markWhatsAppConversationRead(input: { conversationId: string; actorLabel: string }) {
  const sql = getSql();
  const rows = await sql`
    select public.mark_whatsapp_conversation_read(${input.conversationId}::uuid, ${input.actorLabel}) as result
  `;
  return rows[0]?.result as string;
}

export async function createWhatsAppOutboundDraft(input: {
  conversationId: string;
  body: string;
  actorLabel: string;
  createdByType?: "human" | "ai" | "system";
}) {
  const sql = getSql();
  const rows = await sql`
    select public.create_whatsapp_outbound_draft(
      ${input.conversationId}::uuid,
      ${input.body},
      'text',
      '{}'::jsonb,
      ${input.createdByType ?? "human"},
      ${input.actorLabel},
      '{}'::jsonb
    ) as result
  `;
  return rows[0]?.result as string;
}

export async function approveWhatsAppOutboundDraft(input: { messageId: string; actorLabel: string }) {
  const sql = getSql();
  const rows = await sql`
    select public.approve_whatsapp_outbound_draft(${input.messageId}::uuid, ${input.actorLabel}) as result
  `;
  return rows[0]?.result as string;
}

export async function getWhatsAppOutboundMessageForSend(input: { conversationId: string; messageId: string }) {
  const sql = getSql();
  const rows = await sql`
    select
      m.id,
      m.conversation_id,
      m.message_type,
      m.body,
      m.media,
      m.status,
      c.phone_e164,
      c.provider,
      c.provider_account_id,
      c.status as conversation_status
    from public.whatsapp_messages m
    join public.whatsapp_conversations c on c.id = m.conversation_id
    where m.id = ${input.messageId}::uuid
      and m.conversation_id = ${input.conversationId}::uuid
      and m.direction = 'outbound'
      and m.status = 'approved'
      and c.status <> 'archived'
    limit 1
  `;
  return record(rows[0]) ?? null;
}

export async function findWhatsAppMessageByProviderId(providerMessageId: string) {
  const sql = getSql();
  const rows = await sql`
    select id, conversation_id, status
    from public.whatsapp_messages
    where provider_message_id = ${providerMessageId}
    order by created_at desc
    limit 2
  `;
  if (rows.length !== 1) return null;
  return record(rows[0]);
}

export async function recordWhatsAppOutboundSent(input: {
  messageId: string;
  providerMessageId?: string;
  actorLabel: string;
  metadata?: Record<string, unknown>;
}) {
  const sql = getSql();
  const rows = await sql`
    select public.record_whatsapp_outbound_sent(
      ${input.messageId}::uuid,
      ${input.providerMessageId ?? ""},
      ${input.actorLabel},
      now(),
      ${JSON.stringify(input.metadata ?? {})}::jsonb
    ) as result
  `;
  return rows[0]?.result as string;
}

export async function recordWhatsAppDeliveryStatus(input: {
  messageId: string;
  status: "queued" | "sent" | "delivered" | "read" | "failed";
  providerEventId?: string | null;
  occurredAt: string;
  errorDetail?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const sql = getSql();
  const rows = await sql`
    select public.record_whatsapp_delivery_status(
      ${input.messageId}::uuid,
      ${input.status},
      ${input.providerEventId ?? ""},
      ${input.occurredAt}::timestamptz,
      ${input.errorDetail ?? ""},
      ${JSON.stringify(input.metadata ?? {})}::jsonb
    ) as result
  `;
  return rows[0]?.result as string;
}
