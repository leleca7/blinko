-- Blinko OS — torna mudança comercial idempotente na trilha de eventos.
-- Mesma etapa não deve gerar stage_changed; se a próxima ação mudar, registra next_action_changed.

create or replace function public.set_commercial_opportunity_stage(
  p_opportunity_id uuid,
  p_stage text,
  p_owner_label text,
  p_next_action_title text,
  p_next_action_at timestamptz,
  p_next_action_channel text,
  p_notes text,
  p_actor_label text
) returns uuid language plpgsql set search_path=public as $$
declare
  v_previous text;
  v_outcome text;
  v_previous_owner text;
  v_previous_action text;
  v_previous_action_at timestamptz;
  v_previous_channel text;
  v_new_owner text;
  v_new_action text;
  v_new_action_at timestamptz;
  v_new_channel text;
  v_stage_changed boolean;
  v_action_changed boolean;
begin
  if public.commercial_stage_number(p_stage) is null then raise exception 'invalid pipeline stage'; end if;

  select pipeline_stage,outcome_status,owner_label,next_action_title,next_action_at,next_action_channel
  into v_previous,v_outcome,v_previous_owner,v_previous_action,v_previous_action_at,v_previous_channel
  from public.commercial_opportunities
  where id=p_opportunity_id
  for update;

  if v_previous is null then raise exception 'opportunity not found'; end if;
  if v_outcome is not null then raise exception 'closed opportunity cannot change stage'; end if;
  if p_stage not in ('P00','P14') and (
    nullif(trim(coalesce(p_owner_label,'')),'') is null
    or nullif(trim(coalesce(p_next_action_title,'')),'') is null
    or p_next_action_at is null
  ) then raise exception 'active opportunity requires owner, next action and date'; end if;

  v_new_owner:=case when p_stage='P14' then v_previous_owner else nullif(trim(coalesce(p_owner_label,'')),'') end;
  v_new_action:=case when p_stage='P14' then null else nullif(trim(coalesce(p_next_action_title,'')),'') end;
  v_new_action_at:=case when p_stage='P14' then null else p_next_action_at end;
  v_new_channel:=case when p_stage='P14' then null else nullif(trim(coalesce(p_next_action_channel,'')),'') end;
  v_stage_changed:=v_previous is distinct from p_stage;
  v_action_changed:=v_previous_owner is distinct from v_new_owner
    or v_previous_action is distinct from v_new_action
    or v_previous_action_at is distinct from v_new_action_at
    or v_previous_channel is distinct from v_new_channel;

  update public.commercial_opportunities set
    pipeline_stage=p_stage,
    owner_label=v_new_owner,
    next_action_title=v_new_action,
    next_action_at=v_new_action_at,
    next_action_channel=v_new_channel,
    stage_changed_at=case when v_stage_changed then now() else stage_changed_at end,
    updated_at=now()
  where id=p_opportunity_id;

  if v_stage_changed then
    insert into public.commercial_opportunity_events(
      opportunity_id,event_type,from_stage,to_stage,summary,actor_label,payload
    ) values(
      p_opportunity_id,'stage_changed',v_previous,p_stage,nullif(trim(coalesce(p_notes,'')),''),p_actor_label,
      jsonb_build_object('next_action',v_new_action,'next_action_at',v_new_action_at)
    );
    insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
    values(
      'commercial_opportunity',p_opportunity_id,'commercial_stage_changed',
      public.commercial_audit_actor_type(p_actor_label),
      coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),
      jsonb_build_object('from',v_previous,'to',p_stage,'notes',nullif(trim(coalesce(p_notes,'')),''))
    );
  elsif v_action_changed then
    insert into public.commercial_opportunity_events(
      opportunity_id,event_type,from_stage,to_stage,summary,actor_label,payload
    ) values(
      p_opportunity_id,'next_action_changed',v_previous,p_stage,nullif(trim(coalesce(p_notes,'')),''),p_actor_label,
      jsonb_build_object(
        'previous_owner',v_previous_owner,'owner',v_new_owner,
        'previous_next_action',v_previous_action,'next_action',v_new_action,
        'previous_next_action_at',v_previous_action_at,'next_action_at',v_new_action_at,
        'previous_channel',v_previous_channel,'channel',v_new_channel
      )
    );
    insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
    values(
      'commercial_opportunity',p_opportunity_id,'commercial_next_action_changed',
      public.commercial_audit_actor_type(p_actor_label),
      coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),
      jsonb_build_object('stage',p_stage,'notes',nullif(trim(coalesce(p_notes,'')),''),'next_action',v_new_action,'next_action_at',v_new_action_at)
    );
  end if;

  return p_opportunity_id;
end; $$;
