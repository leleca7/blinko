-- Blinko OS — WhatsApp delivery status — V2
-- Mantém o histórico de eventos, mas impede que webhooks fora de ordem
-- rebaixem uma mensagem de read/delivered para um estágio anterior.

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
  if p_status not in ('queued','sent','delivered','read','failed') then
    raise exception 'invalid whatsapp delivery status';
  end if;

  if not exists (
    select 1 from public.whatsapp_messages
    where id = p_message_id and direction = 'outbound'
  ) then
    raise exception 'outbound whatsapp message not found';
  end if;

  insert into public.whatsapp_message_status_events (
    message_id, status, provider_event_id, occurred_at, error_detail, metadata
  ) values (
    p_message_id,
    p_status,
    nullif(trim(coalesce(p_provider_event_id,'')), ''),
    coalesce(p_occurred_at, now()),
    nullif(p_error_detail,''),
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (message_id, provider_event_id)
  where provider_event_id is not null
  do nothing;

  update public.whatsapp_messages
     set status = case
       when p_status = 'read'
            and status in ('queued','sent','delivered') then 'read'
       when p_status = 'delivered'
            and status in ('queued','sent') then 'delivered'
       when p_status = 'sent'
            and status = 'queued' then 'sent'
       when p_status = 'failed'
            and status not in ('delivered','read') then 'failed'
       else status
     end,
     error_detail = case
       when p_status = 'failed' and status not in ('delivered','read')
         then nullif(p_error_detail,'')
       else error_detail
     end,
     updated_at = now()
   where id = p_message_id;

  return p_message_id;
end;
$record_whatsapp_delivery_status$;
