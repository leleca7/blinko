-- Blinko OS — WhatsApp inbox — correção de matching de lead
-- PostgreSQL não oferece min(uuid) por padrão. Mantém o mesmo comportamento:
-- só vincula automaticamente quando existe exatamente um lead para o número normalizado.

create or replace function public.record_whatsapp_inbound_message(
  p_provider text,
  p_provider_account_id text,
  p_provider_conversation_id text,
  p_provider_message_id text,
  p_phone text,
  p_contact_name text,
  p_message_type text,
  p_body text,
  p_media jsonb,
  p_occurred_at timestamptz,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
set search_path = public
as $record_whatsapp_inbound_message$
declare
  v_phone text;
  v_provider text;
  v_account text;
  v_conversation_id uuid;
  v_message_id uuid;
  v_lead_id uuid;
  v_company_id uuid;
  v_match_count integer;
begin
  v_phone := public.normalize_brazil_whatsapp_phone(p_phone);
  if v_phone is null then raise exception 'invalid whatsapp phone'; end if;

  v_provider := coalesce(nullif(trim(coalesce(p_provider,'')), ''), 'manual');
  v_account := coalesce(nullif(trim(coalesce(p_provider_account_id,'')), ''), '');

  select count(*), (array_agg(id order by updated_at desc))[1]
    into v_match_count, v_lead_id
  from public.leads
  where public.normalize_brazil_whatsapp_phone(whatsapp) = v_phone
    and status <> 'archived';

  if v_match_count <> 1 then v_lead_id := null; end if;

  if v_lead_id is not null then
    select id into v_company_id
    from public.companies
    where source_lead_id = v_lead_id
    limit 1;
  end if;

  insert into public.whatsapp_conversations (
    provider, provider_account_id, provider_conversation_id, phone_e164,
    contact_name, lead_id, company_id, status, unread_count, last_message_at, metadata
  ) values (
    v_provider, v_account, nullif(trim(coalesce(p_provider_conversation_id,'')), ''), v_phone,
    nullif(trim(coalesce(p_contact_name,'')), ''), v_lead_id, v_company_id,
    'open', 0, coalesce(p_occurred_at, now()), coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (provider, provider_account_id, phone_e164)
  do update set
    provider_conversation_id = coalesce(excluded.provider_conversation_id, public.whatsapp_conversations.provider_conversation_id),
    contact_name = coalesce(excluded.contact_name, public.whatsapp_conversations.contact_name),
    lead_id = coalesce(public.whatsapp_conversations.lead_id, excluded.lead_id),
    company_id = coalesce(public.whatsapp_conversations.company_id, excluded.company_id),
    status = case when public.whatsapp_conversations.status = 'archived' then 'open' else public.whatsapp_conversations.status end,
    metadata = public.whatsapp_conversations.metadata || excluded.metadata,
    updated_at = now()
  returning id, lead_id, company_id into v_conversation_id, v_lead_id, v_company_id;

  insert into public.whatsapp_messages (
    conversation_id, direction, provider_message_id, message_type, body, media,
    status, occurred_at, created_by_type, created_by_label, metadata
  ) values (
    v_conversation_id, 'inbound', nullif(trim(coalesce(p_provider_message_id,'')), ''),
    coalesce(nullif(trim(coalesce(p_message_type,'')), ''), 'text'),
    nullif(p_body, ''), coalesce(p_media, '{}'::jsonb), 'received',
    coalesce(p_occurred_at, now()), 'provider', v_provider, coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (conversation_id, provider_message_id) where provider_message_id is not null
  do nothing
  returning id into v_message_id;

  if v_message_id is null then
    select id into v_message_id
    from public.whatsapp_messages
    where conversation_id = v_conversation_id
      and provider_message_id = nullif(trim(coalesce(p_provider_message_id,'')), '')
    limit 1;
    return jsonb_build_object(
      'conversation_id', v_conversation_id,
      'message_id', v_message_id,
      'lead_id', v_lead_id,
      'duplicate', true
    );
  end if;

  update public.whatsapp_conversations
     set unread_count = unread_count + 1,
         status = 'waiting_human',
         last_message_at = greatest(coalesce(last_message_at, '-infinity'::timestamptz), coalesce(p_occurred_at, now())),
         updated_at = now()
   where id = v_conversation_id;

  if v_lead_id is not null and not exists (
    select 1 from public.crm_actions
    where lead_id = v_lead_id
      and action_type = 'whatsapp_inbound_reply'
      and status in ('pending','in_progress')
      and payload->>'whatsapp_conversation_id' = v_conversation_id::text
  ) then
    insert into public.crm_actions (
      lead_id, action_type, status, priority, title, payload
    ) values (
      v_lead_id, 'whatsapp_inbound_reply', 'pending', 'high',
      'Responder conversa no WhatsApp',
      jsonb_build_object(
        'whatsapp_conversation_id', v_conversation_id,
        'whatsapp_message_id', v_message_id,
        'source', 'whatsapp'
      )
    );
  end if;

  insert into public.audit_events (entity_type, entity_id, event_type, actor_type, actor_id, payload)
  values (
    'whatsapp_conversation', v_conversation_id, 'whatsapp_inbound_received', 'system',
    v_provider,
    jsonb_build_object('message_id', v_message_id, 'lead_id', v_lead_id, 'phone_e164', v_phone)
  );

  return jsonb_build_object(
    'conversation_id', v_conversation_id,
    'message_id', v_message_id,
    'lead_id', v_lead_id,
    'duplicate', false
  );
end;
$record_whatsapp_inbound_message$;
