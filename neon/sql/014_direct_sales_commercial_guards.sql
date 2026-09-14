-- Blinko OS — Venda direta — guardas e fila comercial V1
-- Endurece as transições da venda direta e mantém uma próxima ação explícita no CRM.

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
     and action_type in ('direct_opportunity_quote','direct_opportunity_send_quote')
     and status in ('pending','in_progress')
     and payload->>'direct_opportunity_id' = p_opportunity_id::text;

  insert into public.crm_actions (
    lead_id, action_type, status, priority, title, payload
  ) values (
    v_lead_id,
    'direct_opportunity_send_quote',
    'pending',
    'high',
    'Enviar orçamento da venda direta',
    jsonb_build_object(
      'direct_opportunity_id', p_opportunity_id,
      'quote_version_id', v_quote_id,
      'source', 'blinko_os_internal'
    )
  );

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

  if p_event_type = 'quote_sent' and v_status <> 'quoted' then
    raise exception 'quote must be recorded before it can be sent';
  end if;
  if p_event_type = 'negotiation' and v_status not in ('quoted','negotiation') then
    raise exception 'negotiation requires a quoted opportunity';
  end if;
  if p_event_type = 'accepted' and v_status not in ('quoted','negotiation') then
    raise exception 'acceptance requires a quoted or negotiating opportunity';
  end if;
  if p_event_type = 'refused' and v_status not in ('quoted','negotiation') then
    raise exception 'refusal requires a quoted or negotiating opportunity';
  end if;
  if p_event_type = 'payment_requested' and v_status <> 'accepted' then
    raise exception 'payment request requires an accepted opportunity';
  end if;
  if p_event_type = 'payment_confirmed' and v_status <> 'awaiting_payment' then
    raise exception 'payment confirmation requires an awaiting-payment opportunity';
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

  if p_event_type = 'quote_sent' then
    update public.crm_actions
       set status = 'done', completed_at = now()
     where lead_id = v_lead_id
       and action_type = 'direct_opportunity_send_quote'
       and status in ('pending','in_progress')
       and payload->>'direct_opportunity_id' = p_opportunity_id::text;

    if not exists (
      select 1 from public.crm_actions
      where lead_id = v_lead_id
        and action_type = 'direct_opportunity_followup'
        and status in ('pending','in_progress')
        and payload->>'direct_opportunity_id' = p_opportunity_id::text
    ) then
      insert into public.crm_actions (
        lead_id, action_type, status, priority, title, payload
      ) values (
        v_lead_id,
        'direct_opportunity_followup',
        'pending',
        'normal',
        'Acompanhar resposta do orçamento',
        jsonb_build_object('direct_opportunity_id', p_opportunity_id, 'source', 'blinko_os_internal')
      );
    end if;
  end if;

  if p_event_type in ('accepted','refused') then
    update public.crm_actions
       set status = 'done', completed_at = now()
     where lead_id = v_lead_id
       and action_type = 'direct_opportunity_followup'
       and status in ('pending','in_progress')
       and payload->>'direct_opportunity_id' = p_opportunity_id::text;
  end if;

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
      'Solicitar e confirmar pagamento da venda direta',
      jsonb_build_object('direct_opportunity_id', p_opportunity_id, 'source', 'blinko_os_internal')
    );
  end if;

  if p_event_type = 'payment_confirmed' then
    update public.crm_actions
       set status = 'done', completed_at = now()
     where lead_id = v_lead_id
       and action_type = 'direct_opportunity_payment'
       and status in ('pending','in_progress')
       and payload->>'direct_opportunity_id' = p_opportunity_id::text;

    if not exists (
      select 1 from public.crm_actions
      where lead_id = v_lead_id
        and action_type = 'direct_opportunity_create_project'
        and status in ('pending','in_progress')
        and payload->>'direct_opportunity_id' = p_opportunity_id::text
    ) then
      insert into public.crm_actions (
        lead_id, action_type, status, priority, title, payload
      ) values (
        v_lead_id,
        'direct_opportunity_create_project',
        'pending',
        'high',
        'Criar projeto da venda direta paga',
        jsonb_build_object('direct_opportunity_id', p_opportunity_id, 'source', 'blinko_os_internal')
      );
    end if;
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
