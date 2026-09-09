-- Blinko OS — Comercial oficial / Oportunidades P00–P14
-- Fonte funcional: Documento 05 — Comercial e Jornada do Cliente.
-- Aplicação inicial: branch de simulação. Produção somente após validação.

create table if not exists public.commercial_opportunities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete restrict,
  company_id uuid references public.companies(id) on delete set null,
  pre_diagnostic_id uuid references public.pre_diagnostics(id) on delete set null,
  diagnostic_id uuid references public.diagnostics(id) on delete set null,
  route text not null check (route in ('strategic','transactional')),
  pipeline_stage text not null default 'P00' check (pipeline_stage ~ '^P(0[0-9]|1[0-4])$'),
  outcome_status text check (outcome_status in ('won','lost','nurture','disqualified','paused','no_response')),
  fit text check (fit in ('high','medium','low')),
  stated_need text,
  owner_label text,
  next_action_title text,
  next_action_at timestamptz,
  next_action_channel text,
  last_interaction_at timestamptz,
  last_interaction_summary text,
  estimated_value numeric(14,2) check (estimated_value is null or estimated_value >= 0),
  expected_close_date date,
  loss_reason text check (loss_reason is null or loss_reason in (
    'price_investment','priority_changed','no_budget','no_response','competitor',
    'solution_mismatch','deadline','postponed','internal_decision','out_of_scope',
    'blinko_capacity','other'
  )),
  loss_notes text,
  source text,
  opened_at timestamptz not null default now(),
  stage_changed_at timestamptz not null default now(),
  closed_at timestamptz,
  created_by_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    outcome_status is not null
    or pipeline_stage in ('P00','P14')
    or (
      nullif(trim(coalesce(owner_label,'')),'') is not null
      and nullif(trim(coalesce(next_action_title,'')),'') is not null
      and next_action_at is not null
    )
  ),
  check (outcome_status <> 'lost' or loss_reason is not null),
  check (outcome_status <> 'won' or pipeline_stage = 'P14')
);

create unique index if not exists commercial_opportunities_pre_diag_unique
  on public.commercial_opportunities(pre_diagnostic_id) where pre_diagnostic_id is not null;
create unique index if not exists commercial_opportunities_diagnostic_unique
  on public.commercial_opportunities(diagnostic_id) where diagnostic_id is not null;
create index if not exists commercial_opportunities_pipeline_idx
  on public.commercial_opportunities(outcome_status,pipeline_stage,next_action_at);
create index if not exists commercial_opportunities_company_idx
  on public.commercial_opportunities(company_id,created_at desc) where company_id is not null;
create index if not exists commercial_opportunities_lead_idx
  on public.commercial_opportunities(lead_id,created_at desc);

create table if not exists public.commercial_opportunity_events (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.commercial_opportunities(id) on delete cascade,
  event_type text not null check (event_type in ('created','stage_changed','interaction','next_action_changed','outcome_changed','entity_linked','note')),
  from_stage text,
  to_stage text,
  channel text,
  summary text,
  payload jsonb not null default '{}'::jsonb,
  actor_label text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists commercial_opportunity_events_idx
  on public.commercial_opportunity_events(opportunity_id,occurred_at desc);

alter table public.proposals add column if not exists opportunity_id uuid references public.commercial_opportunities(id) on delete set null;
create index if not exists proposals_opportunity_idx on public.proposals(opportunity_id) where opportunity_id is not null;

create or replace function public.commercial_stage_number(p_stage text)
returns integer language sql immutable as $$
  select case when p_stage ~ '^P(0[0-9]|1[0-4])$' then substring(p_stage from 2)::integer else null end
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
declare
  v_id uuid;
  v_source text;
  v_stage text := coalesce(nullif(trim(p_stage),''),'P01');
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
  ) values (
    p_lead_id,p_route,v_stage,p_fit,nullif(trim(coalesce(p_stated_need,'')),''),
    nullif(trim(coalesce(p_owner_label,'')),''),nullif(trim(coalesce(p_next_action_title,'')),''),p_next_action_at,
    nullif(trim(coalesce(p_next_action_channel,'')),''),v_source,nullif(trim(coalesce(p_actor_label,'')),'')
  ) returning id into v_id;

  insert into public.commercial_opportunity_events(opportunity_id,event_type,to_stage,summary,actor_label,payload)
  values(v_id,'created',v_stage,'Oportunidade comercial criada.',nullif(trim(coalesce(p_actor_label,'')),''),jsonb_build_object('route',p_route,'fit',p_fit));
  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('commercial_opportunity',v_id,'commercial_opportunity_created','human',coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),jsonb_build_object('lead_id',p_lead_id,'stage',v_stage,'route',p_route));
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
declare
  v_previous text;
  v_outcome text;
begin
  if public.commercial_stage_number(p_stage) is null then raise exception 'invalid pipeline stage'; end if;
  select pipeline_stage,outcome_status into v_previous,v_outcome from public.commercial_opportunities where id=p_opportunity_id for update;
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

  insert into public.commercial_opportunity_events(opportunity_id,event_type,from_stage,to_stage,summary,actor_label,payload)
  values(p_opportunity_id,'stage_changed',v_previous,p_stage,nullif(trim(coalesce(p_notes,'')),''),nullif(trim(coalesce(p_actor_label,'')),''),jsonb_build_object('next_action',nullif(trim(coalesce(p_next_action_title,'')),''),'next_action_at',p_next_action_at));
  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('commercial_opportunity',p_opportunity_id,'commercial_stage_changed','human',coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),jsonb_build_object('from',v_previous,'to',p_stage,'notes',nullif(trim(coalesce(p_notes,'')),'')));
  return p_opportunity_id;
end; $$;

create or replace function public.record_commercial_interaction(
  p_opportunity_id uuid,
  p_channel text,
  p_summary text,
  p_next_action_title text,
  p_next_action_at timestamptz,
  p_next_action_channel text,
  p_actor_label text
) returns uuid language plpgsql set search_path=public as $$
declare v_stage text; v_outcome text;
begin
  select pipeline_stage,outcome_status into v_stage,v_outcome from public.commercial_opportunities where id=p_opportunity_id for update;
  if v_stage is null then raise exception 'opportunity not found'; end if;
  if v_outcome is not null then raise exception 'closed opportunity cannot receive active follow-up'; end if;
  if v_stage not in ('P00','P14') and (
    nullif(trim(coalesce(p_next_action_title,'')),'') is null or p_next_action_at is null
  ) then raise exception 'next action and date are required'; end if;
  update public.commercial_opportunities set
    last_interaction_at=now(),last_interaction_summary=nullif(trim(coalesce(p_summary,'')),''),
    next_action_title=case when v_stage in ('P00','P14') then null else nullif(trim(coalesce(p_next_action_title,'')),'') end,
    next_action_at=case when v_stage in ('P00','P14') then null else p_next_action_at end,
    next_action_channel=case when v_stage in ('P00','P14') then null else nullif(trim(coalesce(p_next_action_channel,'')),'') end,
    updated_at=now()
  where id=p_opportunity_id;
  insert into public.commercial_opportunity_events(opportunity_id,event_type,channel,summary,actor_label,payload)
  values(p_opportunity_id,'interaction',nullif(trim(coalesce(p_channel,'')),''),nullif(trim(coalesce(p_summary,'')),''),nullif(trim(coalesce(p_actor_label,'')),''),jsonb_build_object('next_action',nullif(trim(coalesce(p_next_action_title,'')),''),'next_action_at',p_next_action_at,'next_action_channel',nullif(trim(coalesce(p_next_action_channel,'')),'')));
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
  if p_outcome not in ('won','lost','nurture','disqualified','paused','no_response') then raise exception 'invalid opportunity outcome'; end if;
  select pipeline_stage,lead_id into v_stage,v_lead_id from public.commercial_opportunities where id=p_opportunity_id for update;
  if v_stage is null then raise exception 'opportunity not found'; end if;
  if p_outcome='won' and v_stage<>'P14' then raise exception 'won opportunity must be at P14'; end if;
  if p_outcome='lost' and p_loss_reason not in ('price_investment','priority_changed','no_budget','no_response','competitor','solution_mismatch','deadline','postponed','internal_decision','out_of_scope','blinko_capacity','other') then raise exception 'loss reason is required'; end if;
  update public.commercial_opportunities set
    outcome_status=p_outcome,
    loss_reason=case when p_outcome='lost' then p_loss_reason else null end,
    loss_notes=case when p_outcome='lost' then nullif(trim(coalesce(p_loss_notes,'')),'') else null end,
    next_action_title=null,next_action_at=null,next_action_channel=null,
    closed_at=now(),updated_at=now()
  where id=p_opportunity_id;
  if p_outcome='won' then update public.leads set status='won',updated_at=now() where id=v_lead_id;
  elsif p_outcome='lost' then update public.leads set status='lost',updated_at=now() where id=v_lead_id;
  end if;
  insert into public.commercial_opportunity_events(opportunity_id,event_type,summary,actor_label,payload)
  values(p_opportunity_id,'outcome_changed',p_outcome,nullif(trim(coalesce(p_actor_label,'')),''),jsonb_build_object('outcome',p_outcome,'loss_reason',case when p_outcome='lost' then p_loss_reason else null end,'loss_notes',case when p_outcome='lost' then nullif(trim(coalesce(p_loss_notes,'')),'') else null end));
  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('commercial_opportunity',p_opportunity_id,'commercial_opportunity_'||p_outcome,'human',coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),jsonb_build_object('stage',v_stage,'loss_reason',case when p_outcome='lost' then p_loss_reason else null end));
  return p_opportunity_id;
end; $$;

create or replace function public.commercial_create_from_pre_diagnostic()
returns trigger language plpgsql set search_path=public as $$
declare v_lead public.leads%rowtype; v_fit text; v_id uuid;
begin
  if exists(select 1 from public.commercial_opportunities where pre_diagnostic_id=new.id) then return new; end if;
  select * into v_lead from public.leads where id=new.lead_id;
  v_fit := case when v_lead.commercial_score>=8 then 'high' when v_lead.commercial_score>=5 then 'medium' else 'low' end;
  insert into public.commercial_opportunities(
    lead_id,pre_diagnostic_id,route,pipeline_stage,fit,stated_need,owner_label,next_action_title,next_action_at,next_action_channel,source,created_by_label
  ) values (
    new.lead_id,new.id,'strategic','P01',v_fit,v_lead.objective,'Blinko','Revisar pré-diagnóstico',now(),'interno',v_lead.source,'system'
  ) returning id into v_id;
  insert into public.commercial_opportunity_events(opportunity_id,event_type,to_stage,summary,actor_label,payload)
  values(v_id,'created','P01','Criada automaticamente a partir do pré-diagnóstico.','system',jsonb_build_object('pre_diagnostic_id',new.id));
  return new;
end; $$;
drop trigger if exists commercial_create_from_pre_diagnostic_trg on public.pre_diagnostics;
create trigger commercial_create_from_pre_diagnostic_trg after insert on public.pre_diagnostics
for each row execute function public.commercial_create_from_pre_diagnostic();

create or replace function public.commercial_sync_from_diagnostic()
returns trigger language plpgsql set search_path=public as $$
declare v_id uuid; v_current text; v_target text; v_action text;
begin
  select id,pipeline_stage into v_id,v_current from public.commercial_opportunities
  where (pre_diagnostic_id=new.pre_diagnostic_id and new.pre_diagnostic_id is not null) or lead_id=new.lead_id
  order by created_at desc limit 1;
  if v_id is null then return new; end if;
  update public.commercial_opportunities set diagnostic_id=new.id,company_id=coalesce(new.company_id,company_id),updated_at=now() where id=v_id;
  if exists(select 1 from public.commercial_opportunities where id=v_id and outcome_status is not null) then return new; end if;
  if new.status in ('ready_for_presentation','presented','completed') then v_target:='P06'; v_action:='Definir próxima solução/proposta';
  else v_target:='P05'; v_action:=case when new.status='awaiting_payment' then 'Confirmar condição do diagnóstico' else 'Concluir diagnóstico e recomendações' end;
  end if;
  if public.commercial_stage_number(v_current) <= public.commercial_stage_number(v_target) then
    perform public.set_commercial_opportunity_stage(v_id,v_target,coalesce(new.offered_by_label,'Blinko'),v_action,now(),'interno','Sincronização automática pelo diagnóstico.','system');
  end if;
  return new;
end; $$;
drop trigger if exists commercial_sync_from_diagnostic_trg on public.diagnostics;
create trigger commercial_sync_from_diagnostic_trg after insert or update of status,company_id on public.diagnostics
for each row execute function public.commercial_sync_from_diagnostic();

create or replace function public.commercial_link_proposal()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.opportunity_id is null then
    select id into new.opportunity_id from public.commercial_opportunities where diagnostic_id=new.diagnostic_id order by created_at desc limit 1;
  end if;
  return new;
end; $$;
drop trigger if exists commercial_link_proposal_trg on public.proposals;
create trigger commercial_link_proposal_trg before insert or update of diagnostic_id on public.proposals
for each row execute function public.commercial_link_proposal();

create or replace function public.commercial_sync_from_proposal()
returns trigger language plpgsql set search_path=public as $$
declare v_id uuid; v_current text; v_target text; v_action text;
begin
  v_id:=new.opportunity_id;
  if v_id is null then return new; end if;
  select pipeline_stage into v_current from public.commercial_opportunities where id=v_id and outcome_status is null;
  if v_current is null then return new; end if;
  if new.status in ('draft','internal_review','approved_internal') then v_target:='P07'; v_action:=case when new.status='approved_internal' then 'Registrar envio da proposta' else 'Concluir preparação/revisão da proposta' end;
  elsif new.status='sent' then v_target:='P08'; v_action:='Fazer follow-up da proposta';
  elsif new.status='negotiation' then v_target:='P09'; v_action:='Executar próxima ação da negociação';
  elsif new.status='accepted' then v_target:='P10'; v_action:='Formalizar contratação e condições de início';
  elsif new.status in ('refused','expired') then v_target:=v_current; v_action:='Registrar motivo de perda ou definir nutrição';
  else return new; end if;
  if public.commercial_stage_number(v_current) <= public.commercial_stage_number(v_target) or new.status in ('refused','expired') then
    perform public.set_commercial_opportunity_stage(v_id,v_target,coalesce(new.approved_by_label,new.created_by_label,'Blinko'),v_action,now(),'interno','Sincronização automática pela proposta: '||new.status,'system');
  end if;
  return new;
end; $$;
drop trigger if exists commercial_sync_from_proposal_trg on public.proposals;
create trigger commercial_sync_from_proposal_trg after insert or update of status on public.proposals
for each row execute function public.commercial_sync_from_proposal();

create or replace function public.commercial_sync_from_project()
returns trigger language plpgsql set search_path=public as $$
declare v_id uuid; v_current text;
begin
  select opportunity_id into v_id from public.proposals where id=new.proposal_id;
  if v_id is null then return new; end if;
  select pipeline_stage into v_current from public.commercial_opportunities where id=v_id and outcome_status is null;
  if v_current is null then return new; end if;
  if new.status='onboarding' then
    perform public.set_commercial_opportunity_stage(v_id,'P13',coalesce(new.created_by_label,'Blinko'),'Concluir onboarding e liberar operação',now(),'interno','Projeto criado e entrou em onboarding.','system');
  elsif new.status in ('active','waiting_client','at_risk','paused','completed','closed') then
    perform public.set_commercial_opportunity_stage(v_id,'P14',coalesce(new.created_by_label,'Blinko'),null,null,null,'Projeto liberado para operação.','system');
    perform public.close_commercial_opportunity(v_id,'won',null,null,'system');
  end if;
  return new;
end; $$;
drop trigger if exists commercial_sync_from_project_trg on public.projects;
create trigger commercial_sync_from_project_trg after insert or update of status on public.projects
for each row execute function public.commercial_sync_from_project();

-- Migração/backfill dos registros já existentes.
with latest_pd as (
  select distinct on (lead_id) id,lead_id,human_review_status,created_at from public.pre_diagnostics order by lead_id,created_at desc
), latest_d as (
  select distinct on (lead_id) id,lead_id,pre_diagnostic_id,company_id,status,created_at from public.diagnostics order by lead_id,created_at desc
), latest_p as (
  select distinct on (d.lead_id) p.id,p.diagnostic_id,p.company_id,p.status,d.lead_id,p.created_at
  from public.proposals p join public.diagnostics d on d.id=p.diagnostic_id order by d.lead_id,p.created_at desc
), latest_prj as (
  select distinct on (d.lead_id) prj.id,prj.status,prj.proposal_id,d.lead_id,prj.created_at
  from public.projects prj join public.proposals p on p.id=prj.proposal_id join public.diagnostics d on d.id=p.diagnostic_id
  order by d.lead_id,prj.created_at desc
), next_crm as (
  select distinct on (lead_id) lead_id,title,due_at from public.crm_actions where status in ('pending','in_progress') order by lead_id,created_at asc
), finance as (
  select distinct on (d.lead_id) d.lead_id,fp.contracted_revenue
  from public.project_financial_plans fp join public.projects prj on prj.id=fp.project_id join public.proposals p on p.id=prj.proposal_id join public.diagnostics d on d.id=p.diagnostic_id
  order by d.lead_id,fp.updated_at desc
)
insert into public.commercial_opportunities(
  lead_id,company_id,pre_diagnostic_id,diagnostic_id,route,pipeline_stage,outcome_status,fit,stated_need,
  owner_label,next_action_title,next_action_at,next_action_channel,estimated_value,source,created_by_label,closed_at
)
select
  l.id,coalesce(d.company_id,p.company_id),pd.id,d.id,'strategic',
  case
    when prj.status in ('active','waiting_client','at_risk','paused','completed','closed') then 'P14'
    when prj.status='onboarding' then 'P13'
    when p.status='accepted' then 'P10'
    when p.status='negotiation' then 'P09'
    when p.status in ('sent','refused','expired') then 'P08'
    when p.status in ('draft','internal_review','approved_internal') then 'P07'
    when d.status in ('ready_for_presentation','presented','completed') then 'P06'
    when d.id is not null then 'P05'
    when pd.human_review_status='reviewed' then 'P04'
    when pd.id is not null then 'P03'
    else 'P01'
  end,
  case when prj.status in ('active','waiting_client','at_risk','paused','completed','closed') or l.status='won' then 'won'
       when l.status='lost' then 'lost' else null end,
  case when l.commercial_score>=8 then 'high' when l.commercial_score>=5 then 'medium' else 'low' end,
  l.objective,
  case when prj.status in ('active','waiting_client','at_risk','paused','completed','closed') or l.status in ('won','lost') then null else 'Blinko' end,
  case
    when prj.status in ('active','waiting_client','at_risk','paused','completed','closed') or l.status in ('won','lost') then null
    when crm.title is not null then crm.title
    when prj.status='onboarding' then 'Concluir onboarding e liberar operação'
    when p.status='accepted' then 'Formalizar contratação e condições de início'
    when p.status='negotiation' then 'Executar próxima ação da negociação'
    when p.status in ('sent','refused','expired') then 'Fazer follow-up / registrar decisão da proposta'
    when p.id is not null then 'Concluir preparação/revisão da proposta'
    when d.status in ('ready_for_presentation','presented','completed') then 'Definir próxima solução/proposta'
    when d.id is not null then 'Concluir diagnóstico e recomendações'
    when pd.id is not null then 'Revisar/qualificar pré-diagnóstico'
    else 'Realizar primeiro contato'
  end,
  case when prj.status in ('active','waiting_client','at_risk','paused','completed','closed') or l.status in ('won','lost') then null else coalesce(crm.due_at,now()) end,
  case when prj.status in ('active','waiting_client','at_risk','paused','completed','closed') or l.status in ('won','lost') then null else 'interno' end,
  f.contracted_revenue,l.source,'migration-021',
  case when prj.status in ('active','waiting_client','at_risk','paused','completed','closed') or l.status in ('won','lost') then now() else null end
from public.leads l
left join latest_pd pd on pd.lead_id=l.id
left join latest_d d on d.lead_id=l.id
left join latest_p p on p.lead_id=l.id
left join latest_prj prj on prj.lead_id=l.id
left join next_crm crm on crm.lead_id=l.id
left join finance f on f.lead_id=l.id
where not exists(select 1 from public.commercial_opportunities o where o.lead_id=l.id)
on conflict do nothing;

update public.commercial_opportunities o set loss_reason='other',loss_notes='Migrado de lead legado já marcado como perdido.',updated_at=now()
from public.leads l where l.id=o.lead_id and o.outcome_status='lost' and o.loss_reason is null;

update public.proposals p set opportunity_id=o.id
from public.commercial_opportunities o where o.diagnostic_id=p.diagnostic_id and p.opportunity_id is null;

insert into public.commercial_opportunity_events(opportunity_id,event_type,to_stage,summary,actor_label,payload)
select id,'created',pipeline_stage,'Oportunidade criada por migração do histórico existente.','migration-021',jsonb_build_object('outcome_status',outcome_status)
from public.commercial_opportunities o
where not exists(select 1 from public.commercial_opportunity_events e where e.opportunity_id=o.id);

create or replace view public.commercial_pipeline as
select
  o.*,
  l.name as contact_name,l.email,l.whatsapp,l.company_name as lead_company_name,l.segment,l.commercial_score,
  c.name as company_name,
  p.id as proposal_id,p.status as proposal_status,
  prj.id as project_id,prj.status as project_status,
  case
    when o.outcome_status is not null then 'closed'
    when o.pipeline_stage not in ('P00','P14') and o.next_action_at is null then 'missing_next_action'
    when o.pipeline_stage not in ('P00','P14') and nullif(trim(coalesce(o.owner_label,'')),'') is null then 'missing_owner'
    when o.next_action_at < now() then 'overdue'
    else 'healthy'
  end as health,
  greatest(0,floor(extract(epoch from (now()-o.stage_changed_at))/86400))::integer as days_in_stage
from public.commercial_opportunities o
join public.leads l on l.id=o.lead_id
left join public.companies c on c.id=o.company_id
left join lateral (select p0.* from public.proposals p0 where p0.opportunity_id=o.id order by p0.created_at desc limit 1) p on true
left join lateral (select p1.* from public.projects p1 where p1.proposal_id=p.id order by p1.created_at desc limit 1) prj on true;

create or replace view public.commercial_pipeline_summary as
select pipeline_stage,outcome_status,count(*)::integer as opportunities,
       coalesce(sum(estimated_value),0)::numeric(14,2) as estimated_value
from public.commercial_opportunities
group by pipeline_stage,outcome_status;

create or replace view public.commercial_forecast as
select date_trunc('month',expected_close_date::timestamp)::date as month,
       pipeline_stage,count(*)::integer as opportunities,
       coalesce(sum(estimated_value),0)::numeric(14,2) as estimated_value
from public.commercial_opportunities
where outcome_status is null and expected_close_date is not null
group by 1,pipeline_stage;
