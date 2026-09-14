-- Blinko OS — WhatsApp inbox foundation — V1
-- Camada provider-agnostic para conversas, mensagens, vinculo com CRM e rascunhos.
-- Esta migracao NAO envia mensagens para o WhatsApp. Envio externo entra em uma camada posterior.

create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'manual',
  provider_account_id text not null default '',
  provider_conversation_id text,
  phone_e164 text not null,
  contact_name text,
  lead_id uuid references public.leads(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  direct_opportunity_id uuid references public.direct_opportunities(id) on delete set null,
  status text not null default 'open'
    check (status in ('open','waiting_human','waiting_customer','closed','archived')),
  unread_count integer not null default 0 check (unread_count >= 0),
  last_message_at timestamptz,
  owner_label text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_account_id, phone_e164)
);

create unique index if not exists whatsapp_conversations_provider_id_uidx
  on public.whatsapp_conversations (provider, provider_account_id, provider_conversation_id)
  where provider_conversation_id is not null;
create index if not exists whatsapp_conversations_queue_idx
  on public.whatsapp_conversations (status, unread_count desc, last_message_at desc nulls last);
create index if not exists whatsapp_conversations_lead_idx
  on public.whatsapp_conversations (lead_id, last_message_at desc nulls last);
create index if not exists whatsapp_conversations_opportunity_idx
  on public.whatsapp_conversations (direct_opportunity_id, last_message_at desc nulls last);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  direction text not null check (direction in ('inbound','outbound')),
  provider_message_id text,
  message_type text not null default 'text'
    check (message_type in ('text','image','audio','video','document','location','template','interactive','system')),
  body text,
  media jsonb not null default '{}'::jsonb,
  status text not null
    check (status in ('received','draft','approved','queued','sent','delivered','read','failed')),
  occurred_at timestamptz not null default now(),
  created_by_type text not null default 'system'
    check (created_by_type in ('system','human','ai','provider')),
  created_by_label text,
  error_detail text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists whatsapp_messages_provider_id_uidx
  on public.whatsapp_messages (conversation_id, provider_message_id)
  where provider_message_id is not null;
create index if not exists whatsapp_messages_conversation_idx
  on public.whatsapp_messages (conversation_id, occurred_at desc, created_at desc);
create index if not exists whatsapp_messages_status_idx
  on public.whatsapp_messages (status, created_at);

create table if not exists public.whatsapp_message_status_events (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.whatsapp_messages(id) on delete cascade,
  status text not null check (status in ('queued','sent','delivered','read','failed')),
  provider_event_id text,
  occurred_at timestamptz not null default now(),
  error_detail text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists whatsapp_message_status_provider_event_uidx
  on public.whatsapp_message_status_events (message_id, provider_event_id)
  where provider_event_id is not null;
create index if not exists whatsapp_message_status_message_idx
  on public.whatsapp_message_status_events (message_id, occurred_at desc);

create or replace function public.normalize_brazil_whatsapp_phone(p_phone text)
returns text
language plpgsql
immutable
as $normalize_brazil_whatsapp_phone$
declare
  v_digits text;
begin
  v_digits := regexp_replace(coalesce(p_phone,''), '[^0-9]', '', 'g');
  if length(v_digits) in (10,11) then
    v_digits := '55' || v_digits;
  end if;
  if length(v_digits) < 12 or length(v_digits) > 15 then
    return null;
  end if;
  return '+' || v_digits;
end;
$normalize_brazil_whatsapp_phone$;

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

  select count(*), min(id) into v_match_count, v_lead_id
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

create or replace function public.link_whatsapp_conversation(
  p_conversation_id uuid,
  p_lead_id uuid,
  p_direct_opportunity_id uuid,
  p_actor_label text
)
returns uuid
language plpgsql
set search_path = public
as $link_whatsapp_conversation$
declare
  v_company_id uuid;
  v_opportunity_lead_id uuid;
begin
  if not exists (select 1 from public.whatsapp_conversations where id = p_conversation_id) then
    raise exception 'whatsapp conversation not found';
  end if;
  if p_lead_id is not null and not exists (select 1 from public.leads where id = p_lead_id) then
    raise exception 'lead not found';
  end if;

  if p_direct_opportunity_id is not null then
    select lead_id into v_opportunity_lead_id
    from public.direct_opportunities where id = p_direct_opportunity_id;
    if v_opportunity_lead_id is null then raise exception 'direct opportunity not found'; end if;
    if p_lead_id is null or v_opportunity_lead_id <> p_lead_id then
      raise exception 'direct opportunity does not belong to selected lead';
    end if;
  end if;

  if p_lead_id is not null then
    select id into v_company_id from public.companies where source_lead_id = p_lead_id limit 1;
  end if;

  update public.whatsapp_conversations
     set lead_id = p_lead_id,
         company_id = v_company_id,
         direct_opportunity_id = p_direct_opportunity_id,
         owner_label = coalesce(nullif(trim(coalesce(p_actor_label,'')), ''), owner_label),
         updated_at = now()
   where id = p_conversation_id;

  if p_lead_id is not null and exists (
    select 1 from public.whatsapp_conversations where id = p_conversation_id and unread_count > 0
  ) and not exists (
    select 1 from public.crm_actions
    where lead_id = p_lead_id
      and action_type = 'whatsapp_inbound_reply'
      and status in ('pending','in_progress')
      and payload->>'whatsapp_conversation_id' = p_conversation_id::text
  ) then
    insert into public.crm_actions (lead_id, action_type, status, priority, title, payload)
    values (
      p_lead_id, 'whatsapp_inbound_reply', 'pending', 'high', 'Responder conversa no WhatsApp',
      jsonb_build_object('whatsapp_conversation_id', p_conversation_id, 'source', 'whatsapp')
    );
  end if;

  insert into public.audit_events (entity_type, entity_id, event_type, actor_type, actor_id, payload)
  values (
    'whatsapp_conversation', p_conversation_id, 'whatsapp_conversation_linked', 'human',
    coalesce(nullif(trim(coalesce(p_actor_label,'')), ''), 'unknown'),
    jsonb_build_object('lead_id', p_lead_id, 'company_id', v_company_id, 'direct_opportunity_id', p_direct_opportunity_id)
  );

  return p_conversation_id;
end;
$link_whatsapp_conversation$;

create or replace function public.mark_whatsapp_conversation_read(
  p_conversation_id uuid,
  p_actor_label text
)
returns uuid
language plpgsql
set search_path = public
as $mark_whatsapp_conversation_read$
begin
  update public.whatsapp_conversations
     set unread_count = 0, updated_at = now()
   where id = p_conversation_id;
  if not found then raise exception 'whatsapp conversation not found'; end if;

  update public.whatsapp_messages
     set status = 'read', updated_at = now()
   where conversation_id = p_conversation_id
     and direction = 'inbound'
     and status = 'received';

  insert into public.audit_events (entity_type, entity_id, event_type, actor_type, actor_id, payload)
  values ('whatsapp_conversation', p_conversation_id, 'whatsapp_conversation_read', 'human', coalesce(nullif(trim(coalesce(p_actor_label,'')), ''), 'unknown'), '{}'::jsonb);

  return p_conversation_id;
end;
$mark_whatsapp_conversation_read$;

create or replace function public.create_whatsapp_outbound_draft(
  p_conversation_id uuid,
  p_body text,
  p_message_type text,
  p_media jsonb,
  p_created_by_type text,
  p_created_by_label text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
set search_path = public
as $create_whatsapp_outbound_draft$
declare
  v_message_id uuid;
begin
  if not exists (select 1 from public.whatsapp_conversations where id = p_conversation_id and status <> 'archived') then
    raise exception 'active whatsapp conversation not found';
  end if;
  if p_created_by_type not in ('human','ai','system') then raise exception 'invalid draft creator'; end if;
  if nullif(trim(coalesce(p_body,'')), '') is null and coalesce(p_media, '{}'::jsonb) = '{}'::jsonb then
    raise exception 'draft requires body or media';
  end if;

  insert into public.whatsapp_messages (
    conversation_id, direction, message_type, body, media, status,
    occurred_at, created_by_type, created_by_label, metadata
  ) values (
    p_conversation_id, 'outbound', coalesce(nullif(trim(coalesce(p_message_type,'')), ''), 'text'),
    nullif(p_body,''), coalesce(p_media, '{}'::jsonb), 'draft', now(),
    p_created_by_type, nullif(trim(coalesce(p_created_by_label,'')), ''), coalesce(p_metadata, '{}'::jsonb)
  ) returning id into v_message_id;

  insert into public.audit_events (entity_type, entity_id, event_type, actor_type, actor_id, payload)
  values (
    'whatsapp_message', v_message_id, 'whatsapp_outbound_draft_created',
    case when p_created_by_type = 'ai' then 'ai' when p_created_by_type = 'human' then 'human' else 'system' end,
    coalesce(nullif(trim(coalesce(p_created_by_label,'')), ''), p_created_by_type),
    jsonb_build_object('conversation_id', p_conversation_id)
  );

  return v_message_id;
end;
$create_whatsapp_outbound_draft$;

create or replace function public.approve_whatsapp_outbound_draft(
  p_message_id uuid,
  p_actor_label text
)
returns uuid
language plpgsql
set search_path = public
as $approve_whatsapp_outbound_draft$
declare
  v_conversation_id uuid;
  v_lead_id uuid;
begin
  update public.whatsapp_messages
     set status = 'approved', updated_at = now(),
         metadata = metadata || jsonb_build_object('approved_by', p_actor_label, 'approved_at', now())
   where id = p_message_id and direction = 'outbound' and status = 'draft'
   returning conversation_id into v_conversation_id;

  if v_conversation_id is null then raise exception 'outbound draft not found'; end if;

  select lead_id into v_lead_id from public.whatsapp_conversations where id = v_conversation_id;

  if v_lead_id is not null and not exists (
    select 1 from public.crm_actions
    where lead_id = v_lead_id
      and action_type = 'whatsapp_send_approved'
      and status in ('pending','in_progress')
      and payload->>'whatsapp_message_id' = p_message_id::text
  ) then
    insert into public.crm_actions (lead_id, action_type, status, priority, title, payload)
    values (
      v_lead_id, 'whatsapp_send_approved', 'pending', 'high', 'Enviar mensagem aprovada no WhatsApp',
      jsonb_build_object('whatsapp_conversation_id', v_conversation_id, 'whatsapp_message_id', p_message_id, 'source', 'whatsapp')
    );
  end if;

  insert into public.audit_events (entity_type, entity_id, event_type, actor_type, actor_id, payload)
  values (
    'whatsapp_message', p_message_id, 'whatsapp_outbound_approved', 'human',
    coalesce(nullif(trim(coalesce(p_actor_label,'')), ''), 'unknown'),
    jsonb_build_object('conversation_id', v_conversation_id)
  );

  return p_message_id;
end;
$approve_whatsapp_outbound_draft$;

create or replace function public.record_whatsapp_outbound_sent(
  p_message_id uuid,
  p_provider_message_id text,
  p_actor_label text,
  p_occurred_at timestamptz default now(),
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
set search_path = public
as $record_whatsapp_outbound_sent$
declare
  v_conversation_id uuid;
  v_lead_id uuid;
begin
  update public.whatsapp_messages
     set status = 'sent',
         provider_message_id = coalesce(nullif(trim(coalesce(p_provider_message_id,'')), ''), provider_message_id),
         occurred_at = coalesce(p_occurred_at, now()),
         metadata = metadata || coalesce(p_metadata, '{}'::jsonb),
         updated_at = now()
   where id = p_message_id and direction = 'outbound' and status in ('approved','queued')
   returning conversation_id into v_conversation_id;

  if v_conversation_id is null then raise exception 'approved outbound message not found'; end if;

  update public.whatsapp_conversations
     set status = 'waiting_customer', unread_count = 0,
         last_message_at = greatest(coalesce(last_message_at, '-infinity'::timestamptz), coalesce(p_occurred_at, now())),
         updated_at = now()
   where id = v_conversation_id
   returning lead_id into v_lead_id;

  if v_lead_id is not null then
    update public.crm_actions
       set status = 'done', completed_at = now()
     where lead_id = v_lead_id
       and status in ('pending','in_progress')
       and action_type in ('whatsapp_inbound_reply','whatsapp_send_approved')
       and payload->>'whatsapp_conversation_id' = v_conversation_id::text;
  end if;

  insert into public.whatsapp_message_status_events (message_id, status, occurred_at, metadata)
  values (p_message_id, 'sent', coalesce(p_occurred_at, now()), coalesce(p_metadata, '{}'::jsonb));

  insert into public.audit_events (entity_type, entity_id, event_type, actor_type, actor_id, payload)
  values (
    'whatsapp_message', p_message_id, 'whatsapp_outbound_sent', 'system',
    coalesce(nullif(trim(coalesce(p_actor_label,'')), ''), 'provider'),
    jsonb_build_object('conversation_id', v_conversation_id, 'provider_message_id', nullif(trim(coalesce(p_provider_message_id,'')), ''))
  );

  return p_message_id;
end;
$record_whatsapp_outbound_sent$;

create or replace function public.record_whatsapp_delivery_status(
  p_message_id uuid,
  p_status text,
  p_provider_event_id text,
  p_occurred_at timestamptz,
  p_error_detail text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
set search_path = public
as $record_whatsapp_delivery_status$
begin
  if p_status not in ('queued','sent','delivered','read','failed') then raise exception 'invalid whatsapp delivery status'; end if;
  if not exists (select 1 from public.whatsapp_messages where id = p_message_id and direction = 'outbound') then
    raise exception 'outbound whatsapp message not found';
  end if;

  insert into public.whatsapp_message_status_events (
    message_id, status, provider_event_id, occurred_at, error_detail, metadata
  ) values (
    p_message_id, p_status, nullif(trim(coalesce(p_provider_event_id,'')), ''),
    coalesce(p_occurred_at, now()), nullif(p_error_detail,''), coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (message_id, provider_event_id) where provider_event_id is not null do nothing;

  update public.whatsapp_messages
     set status = p_status,
         error_detail = case when p_status = 'failed' then nullif(p_error_detail,'') else error_detail end,
         updated_at = now()
   where id = p_message_id;

  return p_message_id;
end;
$record_whatsapp_delivery_status$;

-- Proxima camada: adaptador oficial do provedor (ex.: Meta Cloud API), webhook verificado,
-- envio das mensagens aprovadas e sincronizacao de delivered/read/failed.
-- Nenhuma mensagem e enviada automaticamente por esta migracao.
