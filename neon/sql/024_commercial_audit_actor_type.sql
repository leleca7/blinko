-- Blinko OS — corrige a classificação do ator em auditorias comerciais.
-- Mantém o contrato das funções e diferencia system/ai de ações humanas.

create or replace function public.commercial_audit_actor_type(p_actor_label text)
returns text language sql immutable as $$
  select case lower(trim(coalesce(p_actor_label,'')))
    when 'system' then 'system'
    when 'ai' then 'ai'
    else 'human'
  end
$$;

create or replace function public.create_commercial_opportunity(
  p_lead_id uuid,
  p_route text,
  p_fit text,
  p_stated_need text,
  p_owner_label text,
  p_next_action_title text,
  p_next_action_at timestamptz,
  p_next_action_channel text,
  p_actor_label text,
  p_stage text default 'P01'
) returns uuid language plpgsql set search_path=public as $$
declare v_id uuid; v_source text; v_stage text:=coalesce(nullif(trim(p_stage),''),'P01');
begin
  if not exists(select 1 from public.leads where id=p_lead_id) then raise exception 'lead not found'; end if;
  if p_route not in ('strategic','transactional') then raise exception 'invalid commercial route'; end if;
  if p_fit not in ('high','medium','low') then raise exception 'invalid fit'; end if;
  if public.commercial_stage_number(v_stage) is null then raise exception 'invalid pipeline stage'; end if;
  if v_stage not in ('P00','P14') and (
    nullif(trim(coalesce(p_owner_label,'')),'') is null
    or nullif(trim(coalesce(p_next_action_title,'')),'') is null
    or p_next_action_at is null
  ) then raise exception 'active opportunity requires owner, next action and date'; end if;

  select source into v_source from public.leads where id=p_lead_id;

  insert into public.commercial_opportunities(
    lead_id,route,pipeline_stage,fit,stated_need,owner_label,next_action_title,next_action_at,
    next_action_channel,source,created_by_label
  ) values(
    p_lead_id,p_route,v_stage,p_fit,nullif(trim(coalesce(p_stated_need,'')),''),
    nullif(trim(coalesce(p_owner_label,'')),''),nullif(trim(coalesce(p_next_action_title,'')),''),
    p_next_action_at,nullif(trim(coalesce(p_next_action_channel,'')),''),v_source,
    nullif(trim(coalesce(p_actor_label,'')),'')
  ) returning id into v_id;

  insert into public.commercial_opportunity_events(
    opportunity_id,event_type,to_stage,summary,actor_label,payload
  ) values(
    v_id,'created',v_stage,'Oportunidade comercial criada.',p_actor_label,
    jsonb_build_object('route',p_route,'fit',p_fit)
  );

  insert into public.audit_events(
    entity_type,entity_id,event_type,actor_type,actor_id,payload
  ) values(
    'commercial_opportunity',v_id,'commercial_opportunity_created',
    public.commercial_audit_actor_type(p_actor_label),
    coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),
    jsonb_build_object('lead_id',p_lead_id,'stage',v_stage,'route',p_route)
  );

  return v_id;
end; $$;

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
declare v_previous text; v_outcome text;
begin
  if public.commercial_stage_number(p_stage) is null then raise exception 'invalid pipeline stage'; end if;

  select pipeline_stage,outcome_status into v_previous,v_outcome
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

  update public.commercial_opportunities set
    pipeline_stage=p_stage,
    owner_label=case when p_stage='P14' then owner_label else nullif(trim(coalesce(p_owner_label,'')),'') end,
    next_action_title=case when p_stage='P14' then null else nullif(trim(coalesce(p_next_action_title,'')),'') end,
    next_action_at=case when p_stage='P14' then null else p_next_action_at end,
    next_action_channel=case when p_stage='P14' then null else nullif(trim(coalesce(p_next_action_channel,'')),'') end,
    stage_changed_at=case when pipeline_stage is distinct from p_stage then now() else stage_changed_at end,
    updated_at=now()
  where id=p_opportunity_id;

  insert into public.commercial_opportunity_events(
    opportunity_id,event_type,from_stage,to_stage,summary,actor_label,payload
  ) values(
    p_opportunity_id,'stage_changed',v_previous,p_stage,nullif(trim(coalesce(p_notes,'')),''),p_actor_label,
    jsonb_build_object(
      'next_action',nullif(trim(coalesce(p_next_action_title,'')),''),
      'next_action_at',p_next_action_at
    )
  );

  insert into public.audit_events(
    entity_type,entity_id,event_type,actor_type,actor_id,payload
  ) values(
    'commercial_opportunity',p_opportunity_id,'commercial_stage_changed',
    public.commercial_audit_actor_type(p_actor_label),
    coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),
    jsonb_build_object('from',v_previous,'to',p_stage,'notes',nullif(trim(coalesce(p_notes,'')),''))
  );

  return p_opportunity_id;
end; $$;

create or replace function public.close_commercial_opportunity(
  p_opportunity_id uuid,
  p_outcome text,
  p_loss_reason text,
  p_loss_notes text,
  p_actor_label text
) returns uuid language plpgsql set search_path=public as $$
declare v_stage text; v_lead_id uuid;
begin
  if p_outcome not in ('won','lost','nurture','disqualified','paused','no_response') then
    raise exception 'invalid opportunity outcome';
  end if;

  select pipeline_stage,lead_id into v_stage,v_lead_id
  from public.commercial_opportunities
  where id=p_opportunity_id
  for update;

  if v_stage is null then raise exception 'opportunity not found'; end if;
  if p_outcome='won' and v_stage<>'P14' then raise exception 'won opportunity must be at P14'; end if;
  if p_outcome='lost' and (
    p_loss_reason is null
    or p_loss_reason not in (
      'price_investment','priority_changed','no_budget','no_response','competitor','solution_mismatch',
      'deadline','postponed','internal_decision','out_of_scope','blinko_capacity','other'
    )
  ) then raise exception 'loss reason is required'; end if;

  update public.commercial_opportunities set
    outcome_status=p_outcome,
    loss_reason=case when p_outcome='lost' then p_loss_reason else null end,
    loss_notes=case when p_outcome='lost' then nullif(trim(coalesce(p_loss_notes,'')),'') else null end,
    next_action_title=null,
    next_action_at=null,
    next_action_channel=null,
    closed_at=now(),
    updated_at=now()
  where id=p_opportunity_id;

  if p_outcome='won' then
    update public.leads set status='won',updated_at=now() where id=v_lead_id;
  elsif p_outcome='lost' then
    update public.leads set status='lost',updated_at=now() where id=v_lead_id;
  end if;

  insert into public.commercial_opportunity_events(
    opportunity_id,event_type,summary,actor_label,payload
  ) values(
    p_opportunity_id,'outcome_changed',p_outcome,p_actor_label,
    jsonb_build_object(
      'outcome',p_outcome,
      'loss_reason',case when p_outcome='lost' then p_loss_reason else null end,
      'loss_notes',case when p_outcome='lost' then nullif(trim(coalesce(p_loss_notes,'')),'') else null end
    )
  );

  insert into public.audit_events(
    entity_type,entity_id,event_type,actor_type,actor_id,payload
  ) values(
    'commercial_opportunity',p_opportunity_id,'commercial_opportunity_'||p_outcome,
    public.commercial_audit_actor_type(p_actor_label),
    coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),
    jsonb_build_object('stage',v_stage,'loss_reason',case when p_outcome='lost' then p_loss_reason else null end)
  );

  return p_opportunity_id;
end; $$;

-- Corrige somente registros inequivocamente automatizados/IA já gravados com actor_type humano.
update public.audit_events
set actor_type=public.commercial_audit_actor_type(actor_id)
where entity_type='commercial_opportunity'
  and lower(trim(actor_id)) in ('system','ai')
  and actor_type is distinct from public.commercial_audit_actor_type(actor_id);
