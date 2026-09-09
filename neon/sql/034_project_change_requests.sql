-- Blinko OS — Solicitações de alteração / Change Requests
-- Fonte: Documento 06 — Operação e Qualidade, seções 19 e 20.
-- Depende de 021–033.
-- Produção/main não deve receber esta migração sem promoção controlada.

create table if not exists public.project_change_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  project_solution_id uuid references public.project_solutions(id) on delete set null,
  requester_type text not null default 'client'
    check (requester_type in ('client','blinko','partner','internal','other')),
  requester_label text not null,
  requested_at timestamptz not null default now(),
  description text not null,
  classification text not null
    check (classification in ('error_correction','in_scope_revision','scope_change','new_demand')),
  affected_deliverable_key text,
  affected_version_label text,
  scope_reference text,
  impact_analysis text,
  deadline_impact_status text not null default 'none'
    check (deadline_impact_status in ('none','possible','confirmed')),
  deadline_impact_description text,
  proposed_new_due_at timestamptz,
  financial_impact_status text not null default 'none'
    check (financial_impact_status in ('none','possible','confirmed')),
  financial_impact_description text,
  financial_reference text,
  decision_owner_label text not null,
  decision_status text not null default 'pending'
    check (decision_status in ('pending','approved','rejected','routed','cancelled')),
  decision_notes text,
  approval_id uuid references public.approvals(id) on delete set null,
  approval_evidence text,
  decided_at timestamptz,
  decided_by_label text,
  consumes_revision boolean not null default false,
  revision_sequence integer check (revision_sequence is null or revision_sequence > 0),
  routed_opportunity_id uuid references public.commercial_opportunities(id) on delete set null,
  routed_project_id uuid references public.projects(id) on delete set null,
  implemented_at timestamptz,
  closed_at timestamptz,
  status text not null default 'pending_decision'
    check (status in ('pending_decision','approved_for_execution','rejected','routed','in_execution','implemented','closed','cancelled')),
  created_by_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (nullif(trim(description),'') is not null),
  check (nullif(trim(requester_label),'') is not null),
  check (nullif(trim(decision_owner_label),'') is not null),
  check (classification <> 'error_correction' or consumes_revision = false),
  check (classification <> 'new_demand' or consumes_revision = false)
);

create index if not exists project_change_requests_project_idx
  on public.project_change_requests(project_id,status,requested_at desc);
create index if not exists project_change_requests_decision_idx
  on public.project_change_requests(decision_status,requested_at desc);
create index if not exists project_change_requests_classification_idx
  on public.project_change_requests(project_id,classification,requested_at desc);

create table if not exists public.project_change_request_decisions (
  id uuid primary key default gen_random_uuid(),
  change_request_id uuid not null references public.project_change_requests(id) on delete cascade,
  from_decision_status text,
  to_decision_status text not null
    check (to_decision_status in ('pending','approved','rejected','routed','cancelled')),
  decision_notes text,
  approval_id uuid references public.approvals(id) on delete set null,
  approval_evidence text,
  actor_label text not null,
  decided_at timestamptz not null default now()
);

create index if not exists project_change_request_decisions_idx
  on public.project_change_request_decisions(change_request_id,decided_at);

alter table public.project_tasks
  add column if not exists change_request_id uuid references public.project_change_requests(id) on delete set null;

create index if not exists project_tasks_change_request_idx
  on public.project_tasks(change_request_id,status) where change_request_id is not null;

create or replace function public.change_request_approval_is_valid(
  p_project_id uuid,
  p_approval_id uuid
)
returns boolean
language sql
stable
set search_path=public
as $$
  select case
    when p_approval_id is null then false
    else exists(
      select 1
      from public.approvals a
      where a.id=p_approval_id
        and a.project_id=p_project_id
        and a.status='approved'
        and a.responded_at is not null
    )
  end
$$;

create or replace function public.create_project_change_request(
  p_project_id uuid,
  p_project_solution_id uuid,
  p_requester_type text,
  p_requester_label text,
  p_description text,
  p_classification text,
  p_affected_deliverable_key text,
  p_affected_version_label text,
  p_scope_reference text,
  p_impact_analysis text,
  p_deadline_impact_status text,
  p_deadline_impact_description text,
  p_proposed_new_due_at timestamptz,
  p_financial_impact_status text,
  p_financial_impact_description text,
  p_financial_reference text,
  p_decision_owner_label text,
  p_actor_label text
)
returns uuid
language plpgsql
set search_path=public
as $$
declare
  v_id uuid;
  v_project_status text;
  v_requester_type text:=coalesce(nullif(trim(p_requester_type),''),'client');
  v_deadline_status text:=coalesce(nullif(trim(p_deadline_impact_status),''),'none');
  v_financial_status text:=coalesce(nullif(trim(p_financial_impact_status),''),'none');
begin
  select status into v_project_status from public.projects where id=p_project_id;
  if v_project_status is null then raise exception 'project not found'; end if;
  if v_project_status not in ('active','waiting_client','at_risk','paused') then
    raise exception 'change request requires an operational project';
  end if;

  if p_classification not in ('error_correction','in_scope_revision','scope_change','new_demand') then
    raise exception 'change request classification is required';
  end if;
  if v_requester_type not in ('client','blinko','partner','internal','other') then raise exception 'invalid requester type'; end if;
  if v_deadline_status not in ('none','possible','confirmed') then raise exception 'invalid deadline impact status'; end if;
  if v_financial_status not in ('none','possible','confirmed') then raise exception 'invalid financial impact status'; end if;
  if nullif(trim(coalesce(p_requester_label,'')),'') is null then raise exception 'requester is required'; end if;
  if nullif(trim(coalesce(p_description,'')),'') is null then raise exception 'change description is required'; end if;
  if nullif(trim(coalesce(p_decision_owner_label,'')),'') is null then raise exception 'decision owner is required'; end if;

  if p_project_solution_id is not null and not exists(
    select 1 from public.project_solutions ps where ps.id=p_project_solution_id and ps.project_id=p_project_id
  ) then raise exception 'project solution does not belong to project'; end if;

  if v_deadline_status='confirmed' and p_proposed_new_due_at is null then
    raise exception 'confirmed deadline impact requires proposed new due date';
  end if;
  if v_financial_status='confirmed' and nullif(trim(coalesce(p_financial_reference,'')),'') is null then
    raise exception 'confirmed financial impact requires financial reference';
  end if;

  insert into public.project_change_requests(
    project_id,project_solution_id,requester_type,requester_label,description,classification,
    affected_deliverable_key,affected_version_label,scope_reference,impact_analysis,
    deadline_impact_status,deadline_impact_description,proposed_new_due_at,
    financial_impact_status,financial_impact_description,financial_reference,
    decision_owner_label,consumes_revision,status,created_by_label
  ) values(
    p_project_id,p_project_solution_id,v_requester_type,trim(p_requester_label),trim(p_description),p_classification,
    nullif(trim(coalesce(p_affected_deliverable_key,'')),''),nullif(trim(coalesce(p_affected_version_label,'')),''),
    nullif(trim(coalesce(p_scope_reference,'')),''),nullif(trim(coalesce(p_impact_analysis,'')),''),
    v_deadline_status,nullif(trim(coalesce(p_deadline_impact_description,'')),''),p_proposed_new_due_at,
    v_financial_status,nullif(trim(coalesce(p_financial_impact_description,'')),''),nullif(trim(coalesce(p_financial_reference,'')),''),
    trim(p_decision_owner_label),false,'pending_decision',nullif(trim(coalesce(p_actor_label,'')),'')
  ) returning id into v_id;

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values(
    'project_change_request',v_id,'project_change_request_created',
    public.commercial_audit_actor_type(p_actor_label),coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),
    jsonb_build_object('project_id',p_project_id,'classification',p_classification,'requester_type',v_requester_type,
      'deadline_impact_status',v_deadline_status,'financial_impact_status',v_financial_status)
  );

  return v_id;
end;
$$;

create or replace function public.decide_project_change_request(
  p_change_request_id uuid,
  p_decision text,
  p_decision_notes text,
  p_approval_id uuid,
  p_approval_evidence text,
  p_actor_label text
)
returns uuid
language plpgsql
set search_path=public
as $$
declare
  v_cr public.project_change_requests%rowtype;
  v_revision_sequence integer;
  v_valid_approval boolean;
begin
  select * into v_cr from public.project_change_requests where id=p_change_request_id for update;
  if not found then raise exception 'change request not found'; end if;
  if v_cr.status in ('implemented','closed','cancelled','routed') then raise exception 'change request is already finalized'; end if;
  if p_decision not in ('approved','rejected','cancelled') then raise exception 'invalid change request decision'; end if;
  if v_cr.classification='new_demand' and p_decision='approved' then
    raise exception 'new demand cannot be approved inside the current project; route it to a new opportunity or project';
  end if;

  v_valid_approval:=public.change_request_approval_is_valid(v_cr.project_id,p_approval_id);

  if p_decision='approved' then
    if v_cr.classification='scope_change' then
      if nullif(trim(coalesce(v_cr.impact_analysis,'')),'') is null then
        raise exception 'scope change requires impact analysis before approval';
      end if;
      if not v_valid_approval and nullif(trim(coalesce(p_approval_evidence,'')),'') is null then
        raise exception 'scope change requires approval evidence';
      end if;
      if v_cr.deadline_impact_status='confirmed' and v_cr.proposed_new_due_at is null then
        raise exception 'confirmed deadline impact requires new due date';
      end if;
      if v_cr.financial_impact_status='confirmed' and nullif(trim(coalesce(v_cr.financial_reference,'')),'') is null then
        raise exception 'confirmed financial impact requires financial reference';
      end if;
    end if;

    if v_cr.classification='in_scope_revision' then
      select coalesce(max(cr.revision_sequence),0)+1 into v_revision_sequence
      from public.project_change_requests cr
      where cr.project_id=v_cr.project_id
        and cr.classification='in_scope_revision'
        and cr.decision_status='approved';
    end if;

    update public.project_change_requests
       set decision_status='approved',
           status='approved_for_execution',
           decision_notes=nullif(trim(coalesce(p_decision_notes,'')),''),
           approval_id=p_approval_id,
           approval_evidence=coalesce(nullif(trim(coalesce(p_approval_evidence,'')),''),case when v_valid_approval then p_approval_id::text else null end),
           decided_at=now(),decided_by_label=nullif(trim(coalesce(p_actor_label,'')),''),
           consumes_revision=(classification='in_scope_revision'),
           revision_sequence=case when classification='in_scope_revision' then v_revision_sequence else null end,
           updated_at=now()
     where id=p_change_request_id;
  elsif p_decision='rejected' then
    update public.project_change_requests
       set decision_status='rejected',status='rejected',decision_notes=nullif(trim(coalesce(p_decision_notes,'')),''),
           approval_id=p_approval_id,approval_evidence=nullif(trim(coalesce(p_approval_evidence,'')),''),
           decided_at=now(),decided_by_label=nullif(trim(coalesce(p_actor_label,'')),''),updated_at=now()
     where id=p_change_request_id;
  else
    update public.project_change_requests
       set decision_status='cancelled',status='cancelled',decision_notes=nullif(trim(coalesce(p_decision_notes,'')),''),
           decided_at=now(),decided_by_label=nullif(trim(coalesce(p_actor_label,'')),''),closed_at=now(),updated_at=now()
     where id=p_change_request_id;
  end if;

  insert into public.project_change_request_decisions(
    change_request_id,from_decision_status,to_decision_status,decision_notes,approval_id,approval_evidence,actor_label
  ) values(
    p_change_request_id,v_cr.decision_status,p_decision,nullif(trim(coalesce(p_decision_notes,'')),''),p_approval_id,
    coalesce(nullif(trim(coalesce(p_approval_evidence,'')),''),case when v_valid_approval then p_approval_id::text else null end),
    coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown')
  );

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values(
    'project_change_request',p_change_request_id,'project_change_request_decided',
    public.commercial_audit_actor_type(p_actor_label),coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),
    jsonb_build_object('project_id',v_cr.project_id,'classification',v_cr.classification,'decision',p_decision,
      'approval_id',p_approval_id,'consumes_revision',v_cr.classification='in_scope_revision')
  );

  return p_change_request_id;
end;
$$;

create or replace function public.route_new_demand_change_request(
  p_change_request_id uuid,
  p_route text,
  p_next_action_at timestamptz,
  p_actor_label text
)
returns uuid
language plpgsql
set search_path=public
as $$
declare
  v_cr public.project_change_requests%rowtype;
  v_source_opportunity public.commercial_opportunities%rowtype;
  v_proposal_id uuid;
  v_opportunity_id uuid;
begin
  select * into v_cr from public.project_change_requests where id=p_change_request_id for update;
  if not found then raise exception 'change request not found'; end if;
  if v_cr.classification<>'new_demand' then raise exception 'only new demand can be routed to a new opportunity'; end if;
  if v_cr.decision_status<>'pending' or v_cr.status<>'pending_decision' then raise exception 'new demand is not pending routing'; end if;
  if p_route not in ('strategic','transactional') then raise exception 'invalid commercial route'; end if;
  if p_next_action_at is null then raise exception 'next action date is required'; end if;

  select p.proposal_id into v_proposal_id from public.projects p where p.id=v_cr.project_id;
  select o.* into v_source_opportunity
  from public.proposals pr join public.commercial_opportunities o on o.id=pr.opportunity_id
  where pr.id=v_proposal_id;
  if v_source_opportunity.id is null then raise exception 'source commercial opportunity not found'; end if;

  insert into public.commercial_opportunities(
    lead_id,company_id,contact_id,route,pipeline_stage,fit,stated_need,owner_label,
    next_action_title,next_action_at,next_action_channel,last_interaction_at,last_interaction_summary,
    source,created_by_label
  ) values(
    v_source_opportunity.lead_id,v_cr.project_id::text::uuid,v_source_opportunity.contact_id,p_route,'P01',v_source_opportunity.fit,
    v_cr.description,coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'Blinko'),
    'Qualificar nova demanda originada do projeto',p_next_action_at,'interno',now(),
    'Nova demanda separada do projeto atual via Change Request.','project_change_request',nullif(trim(coalesce(p_actor_label,'')),'')
  ) returning id into v_opportunity_id;

  -- Corrige company_id com a empresa real do projeto (mantido separado da origem comercial).
  update public.commercial_opportunities o
     set company_id=p.company_id,updated_at=now()
    from public.projects p
   where o.id=v_opportunity_id and p.id=v_cr.project_id;

  update public.project_change_requests
     set decision_status='routed',status='routed',routed_opportunity_id=v_opportunity_id,
         decision_notes='Nova demanda encaminhada para nova oportunidade comercial.',
         decided_at=now(),decided_by_label=nullif(trim(coalesce(p_actor_label,'')),''),closed_at=now(),updated_at=now()
   where id=p_change_request_id;

  insert into public.project_change_request_decisions(change_request_id,from_decision_status,to_decision_status,decision_notes,actor_label)
  values(p_change_request_id,'pending','routed','Nova demanda encaminhada para nova oportunidade comercial.',coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'));

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('project_change_request',p_change_request_id,'project_change_request_routed',
    public.commercial_audit_actor_type(p_actor_label),coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),
    jsonb_build_object('project_id',v_cr.project_id,'routed_opportunity_id',v_opportunity_id,'commercial_route',p_route));

  return v_opportunity_id;
end;
$$;

create or replace function public.project_change_request_task_guard()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  v_cr public.project_change_requests%rowtype;
begin
  if new.change_request_id is null then return new; end if;

  select * into v_cr from public.project_change_requests where id=new.change_request_id;
  if not found then raise exception 'change request not found'; end if;
  if v_cr.project_id<>new.project_id then raise exception 'change request task must belong to the same project'; end if;
  if v_cr.classification='new_demand' then raise exception 'new demand cannot be executed as a task in the current project'; end if;

  if new.status in ('in_progress','done') and v_cr.decision_status<>'approved' then
    raise exception 'change request task cannot execute before human approval';
  end if;

  return new;
end;
$$;

create trigger project_change_request_task_guard_trg
  before insert or update of change_request_id,project_id,status on public.project_tasks
  for each row execute function public.project_change_request_task_guard();

create or replace function public.record_change_request_task(
  p_change_request_id uuid,
  p_title text,
  p_responsible_label text,
  p_due_at timestamptz,
  p_priority text,
  p_estimate text,
  p_approval_required boolean,
  p_actor_label text
)
returns uuid
language plpgsql
set search_path=public
as $$
declare
  v_cr public.project_change_requests%rowtype;
  v_task_id uuid;
begin
  select * into v_cr from public.project_change_requests where id=p_change_request_id;
  if not found then raise exception 'change request not found'; end if;
  if v_cr.classification='new_demand' then raise exception 'new demand cannot create a task in the current project'; end if;
  if v_cr.decision_status<>'approved' then raise exception 'change request must be approved before execution task is created'; end if;
  if nullif(trim(coalesce(p_title,'')),'') is null then raise exception 'task title is required'; end if;
  if p_priority not in ('low','normal','high','critical') then raise exception 'invalid task priority'; end if;

  insert into public.project_tasks(
    project_id,intervention_id,change_request_id,title,responsible_label,due_at,dependencies,status,priority,estimate,
    approval_required,created_by_label
  ) values(
    v_cr.project_id,null,p_change_request_id,trim(p_title),nullif(trim(coalesce(p_responsible_label,'')),''),p_due_at,'[]'::jsonb,
    'pending',p_priority,nullif(trim(coalesce(p_estimate,'')),''),coalesce(p_approval_required,false),nullif(trim(coalesce(p_actor_label,'')),'')
  ) returning id into v_task_id;

  update public.project_change_requests set status='in_execution',updated_at=now() where id=p_change_request_id;

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('project_task',v_task_id,'change_request_task_created',
    public.commercial_audit_actor_type(p_actor_label),coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),
    jsonb_build_object('project_id',v_cr.project_id,'change_request_id',p_change_request_id,'classification',v_cr.classification));

  return v_task_id;
end;
$$;

create or replace function public.close_project_change_request(
  p_change_request_id uuid,
  p_implementation_evidence text,
  p_actor_label text
)
returns uuid
language plpgsql
set search_path=public
as $$
declare
  v_cr public.project_change_requests%rowtype;
begin
  select * into v_cr from public.project_change_requests where id=p_change_request_id for update;
  if not found then raise exception 'change request not found'; end if;
  if v_cr.classification='new_demand' then raise exception 'new demand closes through routing, not implementation'; end if;
  if v_cr.decision_status<>'approved' then raise exception 'only approved change request can be implemented'; end if;
  if nullif(trim(coalesce(p_implementation_evidence,'')),'') is null then raise exception 'implementation evidence is required'; end if;
  if exists(
    select 1 from public.project_tasks t
    where t.change_request_id=p_change_request_id and t.status not in ('done','cancelled')
  ) then raise exception 'change request still has open execution tasks'; end if;
  if not exists(select 1 from public.project_tasks t where t.change_request_id=p_change_request_id and t.status='done') then
    raise exception 'change request requires at least one completed execution task';
  end if;

  update public.project_change_requests
     set status='closed',implemented_at=coalesce(implemented_at,now()),closed_at=now(),
         decision_notes=concat_ws(E'\n',decision_notes,'Evidência de implementação: '||trim(p_implementation_evidence)),updated_at=now()
   where id=p_change_request_id;

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('project_change_request',p_change_request_id,'project_change_request_closed',
    public.commercial_audit_actor_type(p_actor_label),coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),
    jsonb_build_object('project_id',v_cr.project_id,'classification',v_cr.classification,'implementation_evidence',trim(p_implementation_evidence)));

  return p_change_request_id;
end;
$$;

create or replace view public.project_change_request_summary as
select
  cr.*,
  p.company_id,
  ps.solution_code,
  sb.name as solution_name,
  a.status as approval_status,
  coalesce((select count(*)::integer from public.project_tasks t where t.change_request_id=cr.id),0) as task_count,
  coalesce((select count(*)::integer from public.project_tasks t where t.change_request_id=cr.id and t.status='done'),0) as completed_task_count,
  case
    when cr.classification='new_demand' and cr.decision_status='pending' then 'ROTEAR NOVA DEMANDA'
    when cr.decision_status='pending' then 'AGUARDANDO DECISÃO'
    when cr.decision_status='approved' and cr.status in ('approved_for_execution','in_execution') then 'LIBERADO PARA EXECUÇÃO'
    when cr.decision_status='routed' then 'ROTEADO'
    when cr.decision_status='rejected' then 'REJEITADO'
    when cr.decision_status='cancelled' then 'CANCELADO'
    when cr.status='closed' then 'CONCLUÍDO'
    else upper(cr.status)
  end as operational_label
from public.project_change_requests cr
join public.projects p on p.id=cr.project_id
left join public.project_solutions ps on ps.id=cr.project_solution_id
left join public.solution_blueprints sb on sb.id=ps.blueprint_id
left join public.approvals a on a.id=cr.approval_id;
