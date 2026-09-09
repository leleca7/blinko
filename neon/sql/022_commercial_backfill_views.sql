-- Blinko OS — Comercial oficial / backfill e views
-- Executar depois de 021.

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
  owner_label,next_action_title,next_action_at,next_action_channel,estimated_value,loss_reason,loss_notes,
  source,created_by_label,closed_at
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
  f.contracted_revenue,
  case when l.status='lost' then 'other' else null end,
  case when l.status='lost' then 'Migrado de lead legado já marcado como perdido.' else null end,
  l.source,'migration-022',
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

update public.proposals p set opportunity_id=o.id
from public.commercial_opportunities o where o.diagnostic_id=p.diagnostic_id and p.opportunity_id is null;

insert into public.commercial_opportunity_events(opportunity_id,event_type,to_stage,summary,actor_label,payload)
select id,'created',pipeline_stage,'Oportunidade criada por migração do histórico existente.','migration-022',jsonb_build_object('outcome_status',outcome_status)
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
select pipeline_stage,outcome_status,count(*)::integer as opportunities,coalesce(sum(estimated_value),0)::numeric(14,2) as estimated_value
from public.commercial_opportunities group by pipeline_stage,outcome_status;

create or replace view public.commercial_forecast as
select date_trunc('month',expected_close_date::timestamp)::date as month,pipeline_stage,count(*)::integer as opportunities,coalesce(sum(estimated_value),0)::numeric(14,2) as estimated_value
from public.commercial_opportunities
where outcome_status is null and expected_close_date is not null
group by 1,pipeline_stage;
