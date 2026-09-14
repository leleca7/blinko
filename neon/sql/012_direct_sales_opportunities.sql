-- Blinko OS — Venda direta / oportunidades comerciais — V1
-- Permite operar serviços padronizados (ex.: planos mensais e produção gráfica)
-- sem obrigar o cliente a passar pelo Diagnóstico Blinko completo.
-- Mantém revisão humana para preço, aceite, pagamento e ativação da execução.

create table if not exists public.direct_opportunities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete restrict,
  company_id uuid references public.companies(id) on delete set null,
  source text not null default 'manual',
  source_reference text,
  opportunity_type text not null
    check (opportunity_type in ('marketing_subscription','graphic_production')),
  product_code text not null,
  status text not null default 'new'
    check (status in (
      'new','qualifying','ready_to_quote','quoted','negotiation',
      'accepted','awaiting_payment','paid','won','lost','cancelled'
    )),
  brief jsonb not null default '{}'::jsonb,
  notes text,
  owner_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists direct_opportunities_status_idx
  on public.direct_opportunities (status, created_at desc);
create index if not exists direct_opportunities_lead_idx
  on public.direct_opportunities (lead_id, created_at desc);
create index if not exists direct_opportunities_type_idx
  on public.direct_opportunities (opportunity_type, product_code, created_at desc);

create table if not exists public.direct_opportunity_quote_versions (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.direct_opportunities(id) on delete cascade,
  version_number integer not null,
  scope text not null,
  client_responsibilities text not null default '',
  timeframe text not null,
  investment text not null,
  conditions text not null,
  validity text not null,
  risks_limits text not null default '',
  created_by_label text,
  created_at timestamptz not null default now(),
  unique (opportunity_id, version_number)
);

create index if not exists direct_opportunity_quote_versions_idx
  on public.direct_opportunity_quote_versions (opportunity_id, version_number desc);

alter table public.direct_opportunities
  add column if not exists current_quote_version_id uuid;

alter table public.direct_opportunities
  drop constraint if exists direct_opportunities_current_quote_version_id_fkey;

alter table public.direct_opportunities
  add constraint direct_opportunities_current_quote_version_id_fkey
  foreign key (current_quote_version_id)
  references public.direct_opportunity_quote_versions(id)
  on delete set null;

create table if not exists public.direct_opportunity_external_events (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.direct_opportunities(id) on delete cascade,
  event_type text not null
    check (event_type in ('quote_sent','negotiation','accepted','refused','payment_requested','payment_confirmed')),
  channel text,
  external_reference text,
  notes text,
  occurred_at timestamptz not null default now(),
  recorded_by_label text,
  created_at timestamptz not null default now()
);

create index if not exists direct_opportunity_external_events_idx
  on public.direct_opportunity_external_events (opportunity_id, occurred_at desc);

create or replace function public.create_direct_opportunity(
  p_lead_id uuid,
  p_actor_label text,
  p_source text,
  p_source_reference text,
  p_opportunity_type text,
  p_product_code text,
  p_brief jsonb,
  p_notes text default null
)
returns uuid
language plpgsql
set search_path = public
as $create_direct_opportunity$
declare
  v_opportunity_id uuid;
  v_lead_status text;
begin
  select status into v_lead_status
  from public.leads
  where id = p_lead_id;

  if v_lead_status is null then
    raise exception 'lead not found';
  end if;

  if p_opportunity_type not in ('marketing_subscription','graphic_production') then
    raise exception 'invalid opportunity type';
  end if;

  if nullif(trim(coalesce(p_product_code,'')), '') is null then
    raise exception 'product code is required';
  end if;

  insert into public.direct_opportunities (
    lead_id, source, source_reference, opportunity_type, product_code,
    status, brief, notes, owner_label
  ) values (
    p_lead_id,
    coalesce(nullif(trim(coalesce(p_source,'')), ''), 'manual'),
    nullif(trim(coalesce(p_source_reference,'')), ''),
    p_opportunity_type,
    trim(p_product_code),
    'qualifying',
    coalesce(p_brief, '{}'::jsonb),
    nullif(trim(coalesce(p_notes,'')), ''),
    nullif(trim(coalesce(p_actor_label,'')), '')
  ) returning id into v_opportunity_id;

  update public.leads
     set status = case
       when status in ('new','reviewing') then 'contacted'
       else status
     end,
     updated_at = now()
   where id = p_lead_id;

  insert into public.crm_actions (
    lead_id, action_type, status, priority, title, payload
  ) values (
    p_lead_id,
    'direct_opportunity_qualification',
    'pending',
    'high',
    case
      when p_opportunity_type = 'marketing_subscription'
        then 'Qualificar oportunidade de plano mensal'
      else 'Qualificar oportunidade de produção gráfica'
    end,
    jsonb_build_object(
      'direct_opportunity_id', v_opportunity_id,
      'opportunity_type', p_opportunity_type,
      'product_code', trim(p_product_code),
      'source', coalesce(nullif(trim(coalesce(p_source,'')), ''), 'manual')
    )
  );

  insert into public.audit_events (
    entity_type, entity_id, event_type, actor_type, actor_id, payload
  ) values (
    'direct_opportunity',
    v_opportunity_id,
    'direct_opportunity_created',
    'human',
    coalesce(nullif(trim(coalesce(p_actor_label,'')), ''), 'unknown'),
    jsonb_build_object(
      'lead_id', p_lead_id,
      'source', coalesce(nullif(trim(coalesce(p_source,'')), ''), 'manual'),
      'opportunity_type', p_opportunity_type,
      'product_code', trim(p_product_code)
    )
  );

  return v_opportunity_id;
end;
$create_direct_opportunity$;

create or replace function public.mark_direct_opportunity_ready_to_quote(
  p_opportunity_id uuid,
  p_actor_label text,
  p_brief jsonb,
  p_notes text default null
)
returns uuid
language plpgsql
set search_path = public
as $mark_direct_opportunity_ready_to_quote$
declare
  v_lead_id uuid;
begin
  select lead_id into v_lead_id
  from public.direct_opportunities
  where id = p_opportunity_id
    and status in ('new','qualifying');

  if v_lead_id is null then
    raise exception 'opportunity is not qualifying';
  end if;

  update public.direct_opportunities
     set status = 'ready_to_quote',
         brief = coalesce(p_brief, brief),
         notes = coalesce(nullif(trim(coalesce(p_notes,'')), ''), notes),
         updated_at = now()
   where id = p_opportunity_id;

  update public.crm_actions
     set status = 'done', completed_at = now()
   where lead_id = v_lead_id
     and action_type = 'direct_opportunity_qualification'
     and status in ('pending','in_progress')
     and payload->>'direct_opportunity_id' = p_opportunity_id::text;

  if not exists (
    select 1 from public.crm_actions
    where lead_id = v_lead_id
      and action_type = 'direct_opportunity_quote'
      and status in ('pending','in_progress')
      and payload->>'direct_opportunity_id' = p_opportunity_id::text
  ) then
    insert into public.crm_actions (
      lead_id, action_type, status, priority, title, payload
    ) values (
      v_lead_id,
      'direct_opportunity_quote',
      'pending',
      'high',
      'Preparar orçamento da venda direta',
      jsonb_build_object('direct_opportunity_id', p_opportunity_id)
    );
  end if;

  insert into public.audit_events (
    entity_type, entity_id, event_type, actor_type, actor_id, payload
  ) values (
    'direct_opportunity', p_opportunity_id, 'direct_opportunity_ready_to_quote',
    'human', coalesce(nullif(trim(coalesce(p_actor_label,'')), ''), 'unknown'),
    jsonb_build_object('lead_id', v_lead_id)
  );

  return p_opportunity_id;
end;
$mark_direct_opportunity_ready_to_quote$;

create or replace function public.record_direct_opportunity_quote(
  p_opportunity_id uuid,
  p_actor_label text,
  p_scope text,
  p_client_responsibilities text,
  p_timeframe text,
  p_investment text,
  p_conditions text,
  p_validity text,
  p_risks_limits text default ''
)
returns uuid
language plpgsql
set search_path = public
as $record_direct_opportunity_quote$
declare
  v_version integer;
  v_quote_id uuid;
  v_lead_id uuid;
begin
  select lead_id into v_lead_id
  from public.direct_opportunities
  where id = p_opportunity_id
    and status in ('ready_to_quote','quoted','negotiation');

  if v_lead_id is null then
    raise exception 'opportunity is not ready for quote';
  end if;

  if nullif(trim(coalesce(p_scope,'')), '') is null
     or nullif(trim(coalesce(p_timeframe,'')), '') is null
     or nullif(trim(coalesce(p_investment,'')), '') is null
     or nullif(trim(coalesce(p_conditions,'')), '') is null
     or nullif(trim(coalesce(p_validity,'')), '') is null then
    raise exception 'quote is incomplete';
  end if;

  select coalesce(max(version_number),0) + 1 into v_version
  from public.direct_opportunity_quote_versions
  where opportunity_id = p_opportunity_id;

  insert into public.direct_opportunity_quote_versions (
    opportunity_id, version_number, scope, client_responsibilities,
    timeframe, investment, conditions, validity, risks_limits, created_by_label
  ) values (
    p_opportunity_id, v_version, trim(p_scope),
    coalesce(p_client_responsibilities,''), trim(p_timeframe), trim(p_investment),
    trim(p_conditions), trim(p_validity), coalesce(p_risks_limits,''),
    nullif(trim(coalesce(p_actor_label,'')), '')
  ) returning id into v_quote_id;

  update public.direct_opportunities
     set current_quote_version_id = v_quote_id,
         status = 'quoted',
         updated_at = now()
   where id = p_opportunity_id;

  update public.crm_actions
     set status = 'done', completed_at = now()
   where lead_id = v_lead_id
     and action_type = 'direct_opportunity_quote'
     and status in ('pending','in_progress')
     and payload->>'direct_opportunity_id' = p_opportunity_id::text;

  insert into public.audit_events (
    entity_type, entity_id, event_type, actor_type, actor_id, payload
  ) values (
    'direct_opportunity', p_opportunity_id, 'direct_opportunity_quote_recorded',
    'human', coalesce(nullif(trim(coalesce(p_actor_label,'')), ''), 'unknown'),
    jsonb_build_object('quote_version_id', v_quote_id, 'version_number', v_version)
  );

  return v_quote_id;
end;
$record_direct_opportunity_quote$;

create or replace function public.record_direct_opportunity_external_event(
  p_opportunity_id uuid,
  p_actor_label text,
  p_event_type text,
  p_channel text,
  p_external_reference text,
  p_notes text default null,
  p_occurred_at timestamptz default now()
)
returns uuid
language plpgsql
set search_path = public
as $record_direct_opportunity_external_event$
declare
  v_status text;
  v_lead_id uuid;
  v_event_id uuid;
begin
  select status, lead_id into v_status, v_lead_id
  from public.direct_opportunities
  where id = p_opportunity_id;

  if v_status is null then
    raise exception 'opportunity not found';
  end if;

  if p_event_type not in ('quote_sent','negotiation','accepted','refused','payment_requested','payment_confirmed') then
    raise exception 'invalid event type';
  end if;

  if nullif(trim(coalesce(p_external_reference,'')), '') is null then
    raise exception 'external reference is required';
  end if;

  insert into public.direct_opportunity_external_events (
    opportunity_id, event_type, channel, external_reference, notes,
    occurred_at, recorded_by_label
  ) values (
    p_opportunity_id, p_event_type,
    nullif(trim(coalesce(p_channel,'')), ''),
    trim(p_external_reference),
    nullif(trim(coalesce(p_notes,'')), ''),
    coalesce(p_occurred_at, now()),
    nullif(trim(coalesce(p_actor_label,'')), '')
  ) returning id into v_event_id;

  update public.direct_opportunities
     set status = case p_event_type
       when 'quote_sent' then 'quoted'
       when 'negotiation' then 'negotiation'
       when 'accepted' then 'accepted'
       when 'refused' then 'lost'
       when 'payment_requested' then 'awaiting_payment'
       when 'payment_confirmed' then 'paid'
       else status
     end,
     updated_at = now()
   where id = p_opportunity_id;

  if p_event_type = 'accepted' and not exists (
    select 1 from public.crm_actions
    where lead_id = v_lead_id
      and action_type = 'direct_opportunity_payment'
      and status in ('pending','in_progress')
      and payload->>'direct_opportunity_id' = p_opportunity_id::text
  ) then
    insert into public.crm_actions (
      lead_id, action_type, status, priority, title, payload
    ) values (
      v_lead_id,
      'direct_opportunity_payment',
      'pending',
      'high',
      'Confirmar pagamento da venda direta',
      jsonb_build_object('direct_opportunity_id', p_opportunity_id)
    );
  end if;

  if p_event_type = 'payment_confirmed' then
    update public.crm_actions
       set status = 'done', completed_at = now()
     where lead_id = v_lead_id
       and action_type = 'direct_opportunity_payment'
       and status in ('pending','in_progress')
       and payload->>'direct_opportunity_id' = p_opportunity_id::text;
  end if;

  insert into public.audit_events (
    entity_type, entity_id, event_type, actor_type, actor_id, payload
  ) values (
    'direct_opportunity', p_opportunity_id,
    'direct_opportunity_external_' || p_event_type,
    'human',
    coalesce(nullif(trim(coalesce(p_actor_label,'')), ''), 'unknown'),
    jsonb_build_object(
      'external_event_id', v_event_id,
      'channel', nullif(trim(coalesce(p_channel,'')), ''),
      'external_reference', trim(p_external_reference),
      'previous_status', v_status
    )
  );

  return v_event_id;
end;
$record_direct_opportunity_external_event$;

-- Catálogo inicial de códigos esperados pela aplicação.
-- O banco não restringe product_code a estes valores para permitir expansão sem nova migração.
-- Marketing mensal: conteudo_247, marketing_347, presenca_447
-- Produção gráfica: calendario, sacola, caixa, embalagem, cartao_visita, panfleto,
-- folder, cardapio, adesivo, banner, wind_banner, fachada, vitrine, credencial, outro

-- Compatibilidade futura com WhatsApp:
-- direct_opportunity_external_events.channel já aceita 'whatsapp'.
-- external_reference pode guardar o message_id/conversation_id do provedor.
-- A automação de mensagens deve ser adicionada em uma camada posterior, sem envio automático nesta V1.
