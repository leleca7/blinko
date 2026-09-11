-- Blinko OS — Reuso seguro de Empresa pelo Contato permanente
-- Depende de 028_contacts_company_360.sql.

create or replace function public.confirm_blinko_diagnostic_payment(
  p_diagnostic_id uuid,
  p_actor_label text,
  p_payment_reference text default null
)
returns uuid
language plpgsql
set search_path=public
as $confirm_diagnostic_payment$
declare
  v_lead public.leads%rowtype;
  v_lead_id uuid;
  v_pre_diagnostic_id uuid;
  v_contact_id uuid;
  v_company_id uuid;
  v_status text;
begin
  select d.lead_id,d.pre_diagnostic_id,d.status
    into v_lead_id,v_pre_diagnostic_id,v_status
    from public.diagnostics d where d.id=p_diagnostic_id limit 1;

  if v_lead_id is null then raise exception 'diagnostic not found'; end if;
  if v_status <> 'awaiting_payment' then raise exception 'diagnostic is not awaiting payment'; end if;

  select * into v_lead from public.leads where id=v_lead_id;
  v_contact_id:=v_lead.contact_id;

  if v_contact_id is not null then
    select company_id into v_company_id from public.contacts where id=v_contact_id;
  end if;

  if v_company_id is null then
    select id into v_company_id from public.companies where source_lead_id=v_lead.id limit 1;
  end if;

  if v_company_id is null then
    insert into public.companies(
      source_lead_id,name,segment,city_state,website,social_url,objective,relationship_status,responsible_label
    ) values (
      v_lead.id,v_lead.company_name,v_lead.segment,v_lead.city_state,v_lead.website,v_lead.social_url,
      v_lead.objective,'active',nullif(trim(coalesce(p_actor_label,'')),'')
    ) returning id into v_company_id;
  else
    update public.companies
       set responsible_label=coalesce(nullif(trim(coalesce(p_actor_label,'')),''),responsible_label),updated_at=now()
     where id=v_company_id;
  end if;

  if v_contact_id is not null then
    update public.contacts
       set company_id=coalesce(company_id,v_company_id),
           is_primary=case
             when company_id is null
              and not exists(select 1 from public.contacts p where p.company_id=v_company_id and p.status='active' and p.is_primary=true)
             then true else is_primary end,
           updated_at=now()
     where id=v_contact_id;
  end if;

  update public.diagnostics
     set company_id=v_company_id,status='collection',
         payment_confirmed_by_label=nullif(trim(coalesce(p_actor_label,'')),''),
         payment_reference=nullif(trim(coalesce(p_payment_reference,'')),''),
         payment_confirmed_at=now(),updated_at=now()
   where id=p_diagnostic_id;

  update public.commercial_opportunities
     set company_id=coalesce(company_id,v_company_id),contact_id=coalesce(contact_id,v_contact_id),updated_at=now()
   where lead_id=v_lead.id and outcome_status is null;

  update public.leads set status='diagnostic_paid',updated_at=now() where id=v_lead.id;

  update public.crm_actions set status='done',completed_at=now()
   where pre_diagnostic_id=v_pre_diagnostic_id
     and status in ('pending','in_progress')
     and action_type='diagnostic_payment_followup';

  if not exists(
    select 1 from public.crm_actions
     where pre_diagnostic_id=v_pre_diagnostic_id
       and action_type='diagnostic_collection'
       and status in ('pending','in_progress')
  ) then
    insert into public.crm_actions(lead_id,pre_diagnostic_id,action_type,status,priority,title,payload)
    values(v_lead.id,v_pre_diagnostic_id,'diagnostic_collection','pending','high','Iniciar coleta do Diagnóstico Blinko',
      jsonb_build_object('diagnostic_id',p_diagnostic_id,'company_id',v_company_id,'created_by',p_actor_label,'source','blinko_os_internal'));
  end if;

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('diagnostic',p_diagnostic_id,'diagnostic_payment_confirmed','human',
    coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),
    jsonb_build_object('lead_id',v_lead.id,'contact_id',v_contact_id,'company_id',v_company_id,
      'pre_diagnostic_id',v_pre_diagnostic_id,'payment_reference',nullif(trim(coalesce(p_payment_reference,'')),'')));

  return p_diagnostic_id;
end;
$confirm_diagnostic_payment$;

-- Mantém exatamente as 40 colunas existentes da view; apenas troca a fonte
-- de nome/e-mail/WhatsApp para o Contato permanente quando disponível.
create or replace view public.commercial_pipeline as
select
  o.id,o.lead_id,o.company_id,o.pre_diagnostic_id,o.diagnostic_id,o.route,o.pipeline_stage,o.outcome_status,o.fit,o.stated_need,
  o.owner_label,o.next_action_title,o.next_action_at,o.next_action_channel,o.last_interaction_at,o.last_interaction_summary,
  o.estimated_value,o.expected_close_date,o.loss_reason,o.loss_notes,o.source,o.opened_at,o.stage_changed_at,o.closed_at,
  o.created_by_label,o.created_at,o.updated_at,
  coalesce(ct.name,l.name) as contact_name,
  coalesce(ct.email,l.email) as email,
  coalesce(ct.whatsapp,l.whatsapp) as whatsapp,
  l.company_name as lead_company_name,l.segment,l.commercial_score,
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
left join public.contacts ct on ct.id=o.contact_id
left join public.companies c on c.id=o.company_id
left join lateral (select p0.* from public.proposals p0 where p0.opportunity_id=o.id order by p0.created_at desc limit 1) p on true
left join lateral (select p1.* from public.projects p1 where p1.proposal_id=p.id order by p1.created_at desc limit 1) prj on true;
