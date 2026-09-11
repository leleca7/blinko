-- Blinko OS — ciclos recorrentes, renovação e reavaliação diagnóstica.
-- Fontes: Documento 06 — BLINKO — OPERAÇÃO E QUALIDADE; Documento 07 — BLINKO — FINANCEIRO E INDICADORES; Documento 08 — BLINKO — SISTEMA E AUTOMAÇÃO.
-- Regra central: projeto/contrato recorrente permanece estável; cada período é um ciclo próprio, com fechamento e continuidade explícitos.
-- Nenhuma data de renovação ou reavaliação deve ser inventada. Ausência = A DEFINIR.
-- Produção/main não deve receber esta migração sem promoção controlada.

create table if not exists public.recurring_service_plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete restrict,
  contract_id uuid not null references public.contracts(id) on delete restrict,
  supersedes_id uuid references public.recurring_service_plans(id) on delete set null,
  version_number integer not null check (version_number > 0),
  is_current boolean not null default true,
  status text not null default 'draft' check (status in ('draft','active','paused','ended')),
  cadence_unit text not null check (cadence_unit in ('day','week','month','custom')),
  cadence_count integer not null default 1 check (cadence_count > 0),
  first_period_start date not null,
  first_period_end date not null,
  contract_valid_until date,
  renewal_review_at timestamptz,
  expected_deliverables jsonb not null default '[]'::jsonb,
  source_reference text not null,
  evidence_reference text not null,
  owner_label text not null,
  notes text,
  created_by_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id,version_number),
  check (first_period_end >= first_period_start),
  check (contract_valid_until is null or contract_valid_until >= first_period_start),
  check (jsonb_typeof(expected_deliverables)='array'),
  check (status <> 'active' or jsonb_array_length(expected_deliverables) > 0),
  check (nullif(trim(source_reference),'') is not null),
  check (nullif(trim(evidence_reference),'') is not null),
  check (nullif(trim(owner_label),'') is not null)
);

create unique index if not exists recurring_service_plans_current_uidx on public.recurring_service_plans(project_id) where is_current;
create index if not exists recurring_service_plans_company_idx on public.recurring_service_plans(company_id,status,is_current);
create index if not exists recurring_service_plans_renewal_idx on public.recurring_service_plans(renewal_review_at) where is_current and status='active';

create table if not exists public.service_cycles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete restrict,
  plan_id uuid not null references public.recurring_service_plans(id) on delete restrict,
  contract_id uuid not null references public.contracts(id) on delete restrict,
  sequence_number integer not null check (sequence_number > 0),
  previous_cycle_id uuid references public.service_cycles(id) on delete set null,
  period_start date not null,
  period_end date not null,
  expected_deliverables jsonb not null default '[]'::jsonb,
  pending_items jsonb not null default '[]'::jsonb,
  status text not null default 'planned' check (status in ('planned','active','closed','cancelled')),
  started_at timestamptz,
  delivery_summary text,
  delivery_evidence_reference text,
  indicator_snapshot jsonb not null default '{}'::jsonb,
  finance_pending_note text,
  carry_over_items jsonb not null default '[]'::jsonb,
  carry_over_justification text,
  continuation_status text not null default 'pending' check (continuation_status in ('pending','approved','blocked','not_applicable')),
  continuation_evidence text,
  closed_by_label text,
  closed_at timestamptz,
  created_by_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id,sequence_number),
  unique(previous_cycle_id),
  check (period_end >= period_start),
  check (jsonb_typeof(expected_deliverables)='array'),
  check (jsonb_typeof(pending_items)='array'),
  check (jsonb_typeof(indicator_snapshot)='object'),
  check (jsonb_typeof(carry_over_items)='array'),
  check (jsonb_array_length(carry_over_items)=0 or nullif(trim(coalesce(carry_over_justification,'')),'') is not null),
  check (continuation_status not in ('approved','blocked') or nullif(trim(coalesce(continuation_evidence,'')),'') is not null),
  check (status<>'closed' or (closed_at is not null and nullif(trim(coalesce(delivery_summary,'')),'') is not null and nullif(trim(coalesce(delivery_evidence_reference,'')),'') is not null))
);

create index if not exists service_cycles_project_idx on public.service_cycles(project_id,sequence_number desc);
create index if not exists service_cycles_period_idx on public.service_cycles(period_start,period_end,status);

alter table public.project_tasks add column if not exists service_cycle_id uuid references public.service_cycles(id) on delete set null;
alter table public.approvals add column if not exists service_cycle_id uuid references public.service_cycles(id) on delete set null;
alter table public.receivables add column if not exists service_cycle_id uuid references public.service_cycles(id) on delete set null;
alter table public.project_costs add column if not exists service_cycle_id uuid references public.service_cycles(id) on delete set null;
create index if not exists project_tasks_cycle_idx on public.project_tasks(service_cycle_id) where service_cycle_id is not null;
create index if not exists approvals_cycle_idx on public.approvals(service_cycle_id) where service_cycle_id is not null;
create index if not exists receivables_cycle_idx on public.receivables(service_cycle_id) where service_cycle_id is not null;
create index if not exists project_costs_cycle_idx on public.project_costs(service_cycle_id) where service_cycle_id is not null;

create or replace function public.guard_service_cycle_link()
returns trigger language plpgsql set search_path=public as $$
declare
  v_project_id uuid;
  v_company_id uuid;
begin
  if new.service_cycle_id is null then return new; end if;
  select project_id,company_id into v_project_id,v_company_id from public.service_cycles where id=new.service_cycle_id;
  if v_project_id is null then raise exception 'service cycle not found'; end if;
  if new.project_id is distinct from v_project_id then raise exception 'service cycle belongs to another project'; end if;
  if tg_table_name in ('receivables','project_costs') and new.company_id is distinct from v_company_id then raise exception 'service cycle belongs to another company'; end if;
  return new;
end; $$;

drop trigger if exists project_tasks_cycle_guard_trg on public.project_tasks;
create trigger project_tasks_cycle_guard_trg before insert or update of service_cycle_id,project_id on public.project_tasks for each row execute function public.guard_service_cycle_link();
drop trigger if exists approvals_cycle_guard_trg on public.approvals;
create trigger approvals_cycle_guard_trg before insert or update of service_cycle_id,project_id on public.approvals for each row execute function public.guard_service_cycle_link();
drop trigger if exists receivables_cycle_guard_trg on public.receivables;
create trigger receivables_cycle_guard_trg before insert or update of service_cycle_id,project_id,company_id on public.receivables for each row execute function public.guard_service_cycle_link();
drop trigger if exists project_costs_cycle_guard_trg on public.project_costs;
create trigger project_costs_cycle_guard_trg before insert or update of service_cycle_id,project_id,company_id on public.project_costs for each row execute function public.guard_service_cycle_link();

create table if not exists public.contract_renewal_reviews (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.recurring_service_plans(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete restrict,
  contract_id uuid not null references public.contracts(id) on delete restrict,
  due_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','routed','resolved','waived')),
  decision text not null default 'to_define' check (decision in ('to_define','renew','expand','close')),
  opportunity_id uuid references public.commercial_opportunities(id) on delete set null,
  owner_label text not null,
  decision_evidence text,
  notes text,
  opened_by_label text,
  opened_at timestamptz not null default now(),
  resolved_by_label text,
  resolved_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(plan_id),
  check (nullif(trim(owner_label),'') is not null),
  check (status not in ('resolved','waived') or nullif(trim(coalesce(decision_evidence,'')),'') is not null),
  check (status<>'resolved' or decision<>'to_define')
);
create index if not exists contract_renewal_reviews_queue_idx on public.contract_renewal_reviews(status,due_at);

alter table public.diagnostics add column if not exists previous_diagnostic_id uuid references public.diagnostics(id) on delete set null;
alter table public.diagnostics add column if not exists assessment_cycle_number integer not null default 1 check (assessment_cycle_number > 0);

create table if not exists public.diagnostic_reassessment_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  source_diagnostic_id uuid not null references public.diagnostics(id) on delete restrict,
  due_at timestamptz not null,
  reason text not null,
  status text not null default 'scheduled' check (status in ('scheduled','pending','in_progress','completed','waived','cancelled')),
  route text not null default 'to_define' check (route in ('to_define','included_in_contract','commercial_required')),
  route_evidence text,
  owner_label text not null,
  source_reference text not null,
  opportunity_id uuid references public.commercial_opportunities(id) on delete set null,
  new_diagnostic_id uuid references public.diagnostics(id) on delete set null,
  notes text,
  scheduled_by_label text,
  scheduled_at timestamptz not null default now(),
  route_decided_by_label text,
  route_decided_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (nullif(trim(reason),'') is not null),
  check (nullif(trim(owner_label),'') is not null),
  check (nullif(trim(source_reference),'') is not null),
  check (route='to_define' or nullif(trim(coalesce(route_evidence,'')),'') is not null),
  check (status<>'in_progress' or new_diagnostic_id is not null)
);
create index if not exists diagnostic_reassessment_queue_idx on public.diagnostic_reassessment_requests(status,due_at);
create index if not exists diagnostic_reassessment_company_idx on public.diagnostic_reassessment_requests(company_id,scheduled_at desc);

alter table public.diagnostics add column if not exists reassessment_request_id uuid references public.diagnostic_reassessment_requests(id) on delete set null;
create unique index if not exists diagnostics_reassessment_request_uidx on public.diagnostics(reassessment_request_id) where reassessment_request_id is not null;

create or replace function public.current_valid_contract_for_project(p_project_id uuid)
returns uuid language sql stable set search_path=public as $$
  select c.id
  from public.projects p
  join public.proposals pr on pr.id=p.proposal_id
  join public.contracts c on c.proposal_id=pr.id and c.opportunity_id=pr.opportunity_id and c.is_current
  where p.id=p_project_id and public.contract_is_valid(c.id)
  order by c.created_at desc limit 1
$$;

create or replace function public.set_recurring_service_plan(
  p_project_id uuid,
  p_status text,
  p_cadence_unit text,
  p_cadence_count integer,
  p_first_period_start date,
  p_first_period_end date,
  p_contract_valid_until date,
  p_renewal_review_at timestamptz,
  p_expected_deliverables jsonb,
  p_source_reference text,
  p_evidence_reference text,
  p_owner_label text,
  p_notes text,
  p_actor_label text
) returns uuid language plpgsql set search_path=public as $$
declare
  v_company_id uuid;
  v_project_status text;
  v_contract_id uuid;
  v_previous_id uuid;
  v_version integer;
  v_id uuid;
begin
  if p_status not in ('draft','active','paused','ended') then raise exception 'invalid recurring plan status'; end if;
  if p_cadence_unit not in ('day','week','month','custom') then raise exception 'invalid recurring cadence'; end if;
  if coalesce(p_cadence_count,0)<1 then raise exception 'recurring cadence count must be positive'; end if;
  if p_first_period_start is null or p_first_period_end is null or p_first_period_end<p_first_period_start then raise exception 'invalid first recurring period'; end if;
  if p_cadence_unit='custom' and p_cadence_count<>1 then raise exception 'custom cadence uses explicit periods and cadence_count=1'; end if;
  if p_expected_deliverables is null or jsonb_typeof(p_expected_deliverables)<>'array' then raise exception 'expected deliverables must be an array'; end if;
  if p_status='active' and jsonb_array_length(p_expected_deliverables)=0 then raise exception 'active recurring plan requires expected deliverables'; end if;
  if nullif(trim(coalesce(p_source_reference,'')),'') is null then raise exception 'recurring plan requires source reference'; end if;
  if nullif(trim(coalesce(p_evidence_reference,'')),'') is null then raise exception 'recurring plan requires evidence'; end if;
  if nullif(trim(coalesce(p_owner_label,'')),'') is null then raise exception 'recurring plan requires owner'; end if;

  select company_id,status into v_company_id,v_project_status from public.projects where id=p_project_id for update;
  if v_company_id is null then raise exception 'project not found'; end if;
  if p_status in ('active','paused') and v_project_status not in ('onboarding','active','waiting_client','at_risk','paused') then raise exception 'project is not eligible for recurring operation'; end if;

  v_contract_id:=public.current_valid_contract_for_project(p_project_id);
  if p_status in ('active','paused') and v_contract_id is null then raise exception 'recurring operation requires a current valid contract'; end if;
  if v_contract_id is null then
    select c.id into v_contract_id from public.projects p join public.proposals pr on pr.id=p.proposal_id join public.contracts c on c.proposal_id=pr.id and c.is_current where p.id=p_project_id order by c.created_at desc limit 1;
  end if;
  if v_contract_id is null then raise exception 'recurring plan requires contract reference'; end if;
  if p_contract_valid_until is not null and p_contract_valid_until<p_first_period_start then raise exception 'contract validity cannot end before first period'; end if;

  select id into v_previous_id from public.recurring_service_plans where project_id=p_project_id and is_current for update;
  if v_previous_id is not null and exists(select 1 from public.contract_renewal_reviews where plan_id=v_previous_id and status in ('pending','routed')) then
    raise exception 'resolve current renewal review before versioning recurring plan';
  end if;
  update public.recurring_service_plans set is_current=false,updated_at=now() where project_id=p_project_id and is_current;
  select coalesce(max(version_number),0)+1 into v_version from public.recurring_service_plans where project_id=p_project_id;

  insert into public.recurring_service_plans(project_id,company_id,contract_id,supersedes_id,version_number,is_current,status,cadence_unit,cadence_count,first_period_start,first_period_end,contract_valid_until,renewal_review_at,expected_deliverables,source_reference,evidence_reference,owner_label,notes,created_by_label)
  values(p_project_id,v_company_id,v_contract_id,v_previous_id,v_version,true,p_status,p_cadence_unit,p_cadence_count,p_first_period_start,p_first_period_end,p_contract_valid_until,p_renewal_review_at,p_expected_deliverables,trim(p_source_reference),trim(p_evidence_reference),trim(p_owner_label),nullif(trim(coalesce(p_notes,'')),''),nullif(trim(coalesce(p_actor_label,'')),''))
  returning id into v_id;

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('recurring_service_plan',v_id,'recurring_service_plan_version_created',public.commercial_audit_actor_type(p_actor_label),coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),jsonb_build_object('project_id',p_project_id,'version_number',v_version,'status',p_status,'cadence_unit',p_cadence_unit,'cadence_count',p_cadence_count,'renewal_review_at',p_renewal_review_at));
  return v_id;
end; $$;

create or replace function public.create_first_service_cycle(p_project_id uuid,p_actor_label text)
returns uuid language plpgsql set search_path=public as $$
declare
  v_plan public.recurring_service_plans%rowtype;
  v_id uuid;
begin
  select * into v_plan from public.recurring_service_plans where project_id=p_project_id and is_current and status='active' for update;
  if not found then raise exception 'active recurring plan not found'; end if;
  if public.current_valid_contract_for_project(p_project_id) is distinct from v_plan.contract_id then raise exception 'recurring plan contract is no longer current/valid'; end if;
  if exists(select 1 from public.service_cycles where project_id=p_project_id) then raise exception 'first cycle already exists'; end if;

  insert into public.service_cycles(project_id,company_id,plan_id,contract_id,sequence_number,period_start,period_end,expected_deliverables,created_by_label)
  values(v_plan.project_id,v_plan.company_id,v_plan.id,v_plan.contract_id,1,v_plan.first_period_start,v_plan.first_period_end,v_plan.expected_deliverables,nullif(trim(coalesce(p_actor_label,'')),'')) returning id into v_id;

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('service_cycle',v_id,'service_cycle_created',public.commercial_audit_actor_type(p_actor_label),coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),jsonb_build_object('project_id',p_project_id,'sequence_number',1,'period_start',v_plan.first_period_start,'period_end',v_plan.first_period_end));
  return v_id;
end; $$;

create or replace function public.start_service_cycle(p_cycle_id uuid,p_actor_label text)
returns uuid language plpgsql set search_path=public as $$
declare
  v_cycle public.service_cycles%rowtype;
  v_plan public.recurring_service_plans%rowtype;
begin
  select * into v_cycle from public.service_cycles where id=p_cycle_id for update;
  if not found then raise exception 'service cycle not found'; end if;
  if v_cycle.status<>'planned' then raise exception 'only planned service cycle can start'; end if;
  select * into v_plan from public.recurring_service_plans where id=v_cycle.plan_id;
  if v_plan.status<>'active' then raise exception 'recurring plan is not active'; end if;
  if public.current_valid_contract_for_project(v_cycle.project_id) is distinct from v_cycle.contract_id then raise exception 'service cycle contract is no longer current/valid'; end if;
  if exists(select 1 from public.service_cycles where project_id=v_cycle.project_id and status='active' and id<>p_cycle_id) then raise exception 'another service cycle is already active'; end if;

  update public.service_cycles set status='active',started_at=now(),updated_at=now() where id=p_cycle_id;
  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('service_cycle',p_cycle_id,'service_cycle_started',public.commercial_audit_actor_type(p_actor_label),coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),jsonb_build_object('project_id',v_cycle.project_id,'sequence_number',v_cycle.sequence_number));
  return p_cycle_id;
end; $$;

create or replace function public.close_service_cycle(
  p_cycle_id uuid,
  p_delivery_summary text,
  p_delivery_evidence_reference text,
  p_indicator_snapshot jsonb,
  p_pending_items jsonb,
  p_finance_pending_note text,
  p_carry_over_items jsonb,
  p_carry_over_justification text,
  p_continuation_status text,
  p_continuation_evidence text,
  p_actor_label text
) returns uuid language plpgsql set search_path=public as $$
declare
  v_cycle public.service_cycles%rowtype;
  v_open_tasks integer;
  v_open_approvals integer;
  v_open_receivables numeric;
  v_open_costs numeric;
begin
  select * into v_cycle from public.service_cycles where id=p_cycle_id for update;
  if not found then raise exception 'service cycle not found'; end if;
  if v_cycle.status not in ('planned','active') then raise exception 'service cycle is not open'; end if;
  if nullif(trim(coalesce(p_delivery_summary,'')),'') is null then raise exception 'cycle delivery summary is required'; end if;
  if nullif(trim(coalesce(p_delivery_evidence_reference,'')),'') is null then raise exception 'cycle delivery evidence is required'; end if;
  if p_indicator_snapshot is null or jsonb_typeof(p_indicator_snapshot)<>'object' then raise exception 'cycle indicator snapshot must be an object'; end if;
  if p_pending_items is null or jsonb_typeof(p_pending_items)<>'array' then raise exception 'cycle pending items must be an array'; end if;
  if p_carry_over_items is null or jsonb_typeof(p_carry_over_items)<>'array' then raise exception 'cycle carry-over must be an array'; end if;
  if jsonb_array_length(p_carry_over_items)>0 and nullif(trim(coalesce(p_carry_over_justification,'')),'') is null then raise exception 'carry-over requires justification'; end if;
  if p_continuation_status not in ('approved','blocked','not_applicable') then raise exception 'cycle continuation must be explicitly decided before closure'; end if;
  if p_continuation_status in ('approved','blocked') and nullif(trim(coalesce(p_continuation_evidence,'')),'') is null then raise exception 'cycle continuation decision requires evidence'; end if;

  select count(*) into v_open_tasks from public.project_tasks where service_cycle_id=p_cycle_id and status not in ('done','cancelled');
  if v_open_tasks>0 then raise exception 'service cycle has open tasks'; end if;
  select count(*) into v_open_approvals from public.approvals where service_cycle_id=p_cycle_id and status in ('draft','pending','changes_requested');
  if v_open_approvals>0 then raise exception 'service cycle has open approvals'; end if;
  select coalesce(sum(amount),0) into v_open_receivables from public.receivables where service_cycle_id=p_cycle_id and status not in ('paid','cancelled');
  select coalesce(sum(amount),0) into v_open_costs from public.project_costs where service_cycle_id=p_cycle_id and status in ('estimated','committed','realized');
  if (v_open_receivables>0 or v_open_costs>0) and nullif(trim(coalesce(p_finance_pending_note,'')),'') is null then raise exception 'cycle financial pending items require closure note'; end if;

  update public.service_cycles
  set status='closed',delivery_summary=trim(p_delivery_summary),delivery_evidence_reference=trim(p_delivery_evidence_reference),
      indicator_snapshot=p_indicator_snapshot,pending_items=p_pending_items,finance_pending_note=nullif(trim(coalesce(p_finance_pending_note,'')),''),
      carry_over_items=p_carry_over_items,carry_over_justification=nullif(trim(coalesce(p_carry_over_justification,'')),''),
      continuation_status=p_continuation_status,continuation_evidence=nullif(trim(coalesce(p_continuation_evidence,'')),''),
      closed_by_label=nullif(trim(coalesce(p_actor_label,'')),''),closed_at=now(),updated_at=now()
  where id=p_cycle_id;

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('service_cycle',p_cycle_id,'service_cycle_closed',public.commercial_audit_actor_type(p_actor_label),coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),jsonb_build_object('project_id',v_cycle.project_id,'sequence_number',v_cycle.sequence_number,'open_receivables',v_open_receivables,'open_costs',v_open_costs,'carry_over_count',jsonb_array_length(p_carry_over_items),'continuation_status',p_continuation_status));
  return p_cycle_id;
end; $$;

create or replace function public.open_recurring_renewal_review(p_plan_id uuid,p_owner_label text,p_notes text,p_actor_label text)
returns uuid language plpgsql set search_path=public as $$
declare
  v_plan public.recurring_service_plans%rowtype;
  v_id uuid;
begin
  select * into v_plan from public.recurring_service_plans where id=p_plan_id for update;
  if not found then raise exception 'recurring plan not found'; end if;
  if not v_plan.is_current or v_plan.status not in ('active','paused') then raise exception 'renewal review requires current recurring plan'; end if;
  if v_plan.renewal_review_at is null then raise exception 'renewal review date is A DEFINIR; configure it before opening review'; end if;
  if nullif(trim(coalesce(p_owner_label,'')),'') is null then raise exception 'renewal review requires owner'; end if;

  insert into public.contract_renewal_reviews(plan_id,project_id,company_id,contract_id,due_at,status,decision,owner_label,notes,opened_by_label)
  values(v_plan.id,v_plan.project_id,v_plan.company_id,v_plan.contract_id,v_plan.renewal_review_at,'pending','to_define',trim(p_owner_label),nullif(trim(coalesce(p_notes,'')),''),nullif(trim(coalesce(p_actor_label,'')),''))
  on conflict(plan_id) do update set owner_label=excluded.owner_label,notes=excluded.notes,updated_at=now()
  returning id into v_id;

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('contract_renewal_review',v_id,'renewal_review_opened',public.commercial_audit_actor_type(p_actor_label),coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),jsonb_build_object('plan_id',v_plan.id,'project_id',v_plan.project_id,'due_at',v_plan.renewal_review_at));
  return v_id;
end; $$;

create or replace function public.route_recurring_renewal_to_commercial(
  p_review_id uuid,
  p_decision text,
  p_route text,
  p_fit text,
  p_owner_label text,
  p_next_action_title text,
  p_next_action_at timestamptz,
  p_next_action_channel text,
  p_notes text,
  p_actor_label text
) returns uuid language plpgsql set search_path=public as $$
declare
  v_review public.contract_renewal_reviews%rowtype;
  v_lead_id uuid;
  v_contact_id uuid;
  v_source_opportunity_id uuid;
  v_opportunity_id uuid;
begin
  if p_decision not in ('renew','expand') then raise exception 'only renewal/expansion can be routed to commercial'; end if;
  select * into v_review from public.contract_renewal_reviews where id=p_review_id for update;
  if not found then raise exception 'renewal review not found'; end if;
  if v_review.status not in ('pending','routed') then raise exception 'renewal review is already final'; end if;
  if v_review.opportunity_id is not null then return v_review.opportunity_id; end if;

  select o.id,o.lead_id,o.contact_id into v_source_opportunity_id,v_lead_id,v_contact_id
  from public.projects pj join public.proposals pr on pr.id=pj.proposal_id join public.commercial_opportunities o on o.id=pr.opportunity_id
  where pj.id=v_review.project_id;
  if v_lead_id is null then raise exception 'source commercial context not found'; end if;

  v_opportunity_id:=public.create_commercial_opportunity(v_lead_id,p_route,p_fit,'Renovação de contrato/serviço recorrente',p_owner_label,p_next_action_title,p_next_action_at,p_next_action_channel,p_actor_label,'P01');
  update public.commercial_opportunities set company_id=v_review.company_id,contact_id=v_contact_id,source='renewal',updated_at=now() where id=v_opportunity_id;
  update public.contract_renewal_reviews set status='routed',decision=p_decision,opportunity_id=v_opportunity_id,notes=coalesce(nullif(trim(coalesce(p_notes,'')),''),notes),updated_at=now() where id=p_review_id;

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('contract_renewal_review',p_review_id,'renewal_routed_to_commercial',public.commercial_audit_actor_type(p_actor_label),coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),jsonb_build_object('source_opportunity_id',v_source_opportunity_id,'new_opportunity_id',v_opportunity_id,'decision',p_decision));
  return v_opportunity_id;
end; $$;

create or replace function public.resolve_recurring_renewal_review(p_review_id uuid,p_decision text,p_status text,p_evidence text,p_notes text,p_actor_label text)
returns uuid language plpgsql set search_path=public as $$;
declare v_review public.contract_renewal_reviews%rowtype;
begin
  if p_decision not in ('renew','expand','close') then raise exception 'invalid renewal decision'; end if;
  if p_status not in ('resolved','waived') then raise exception 'invalid renewal resolution status'; end if;
  if nullif(trim(coalesce(p_evidence,'')),'') is null then raise exception 'renewal resolution requires evidence'; end if;
  select * into v_review from public.contract_renewal_reviews where id=p_review_id for update;
  if not found then raise exception 'renewal review not found'; end if;
  if v_review.status in ('resolved','waived') then raise exception 'renewal review is already final'; end if;
  if p_decision in ('renew','expand') and v_review.opportunity_id is null and v_review.status='routed' then raise exception 'routed renewal lost commercial opportunity reference'; end if;

  update public.contract_renewal_reviews set status=p_status,decision=p_decision,decision_evidence=trim(p_evidence),notes=coalesce(nullif(trim(coalesce(p_notes,'')),''),notes),resolved_by_label=nullif(trim(coalesce(p_actor_label,'')),''),resolved_at=now(),updated_at=now() where id=p_review_id;
  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('contract_renewal_review',p_review_id,'renewal_review_'||p_status,public.commercial_audit_actor_type(p_actor_label),coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),jsonb_build_object('decision',p_decision,'evidence',trim(p_evidence),'opportunity_id',v_review.opportunity_id));
  return p_review_id;
end; $$;

create or replace function public.create_next_service_cycle(p_previous_cycle_id uuid,p_custom_period_start date,p_custom_period_end date,p_actor_label text)
returns uuid language plpgsql set search_path=public as $$;
declare
  v_previous public.service_cycles%rowtype;
  v_plan public.recurring_service_plans%rowtype;
  v_start date;
  v_end date;
  v_id uuid;
  v_renewal public.contract_renewal_reviews%rowtype;
begin
  select * into v_previous from public.service_cycles where id=p_previous_cycle_id for update;
  if not found then raise exception 'previous service cycle not found'; end if;
  if v_previous.status<>'closed' then raise exception 'previous service cycle must be closed'; end if;
  if v_previous.continuation_status<>'approved' then raise exception 'previous cycle continuation is not approved'; end if;
  if exists(select 1 from public.service_cycles where previous_cycle_id=p_previous_cycle_id) then raise exception 'next service cycle already exists'; end if;

  select * into v_plan from public.recurring_service_plans where project_id=v_previous.project_id and is_current for update;
  if not found or v_plan.status<>'active' then raise exception 'current recurring plan is not active'; end if;
  if public.current_valid_contract_for_project(v_previous.project_id) is distinct from v_plan.contract_id then raise exception 'current contract is not valid for next cycle'; end if;

  if v_plan.cadence_unit='day' then
    v_start:=v_previous.period_end+1; v_end:=v_start+(v_plan.cadence_count-1);
  elsif v_plan.cadence_unit='week' then
    v_start:=v_previous.period_end+1; v_end:=v_start+(v_plan.cadence_count*7-1);
  elsif v_plan.cadence_unit='month' then
    v_start:=v_previous.period_end+1; v_end:=(v_start+(v_plan.cadence_count||' months')::interval-interval '1 day')::date;
  else
    if p_custom_period_start is null or p_custom_period_end is null or p_custom_period_end<p_custom_period_start then raise exception 'custom next cycle requires explicit valid period'; end if;
    if p_custom_period_start<=v_previous.period_end then raise exception 'custom next cycle must start after previous cycle'; end if;
    v_start:=p_custom_period_start; v_end:=p_custom_period_end;
  end if;

  if v_plan.contract_valid_until is not null and v_end>v_plan.contract_valid_until then raise exception 'next cycle exceeds recorded contract validity'; end if;
  if v_plan.renewal_review_at is not null and v_plan.renewal_review_at <= v_start::timestamptz then
    select * into v_renewal from public.contract_renewal_reviews where plan_id=v_plan.id;
    if not found or v_renewal.status not in ('resolved','waived') or v_renewal.decision not in ('renew','expand') then
      raise exception 'renewal review is due before next cycle';
    end if;
  end if;

  insert into public.service_cycles(project_id,company_id,plan_id,contract_id,sequence_number,previous_cycle_id,period_start,period_end,expected_deliverables,pending_items,created_by_label)
  values(v_previous.project_id,v_plan.company_id,v_plan.id,v_plan.contract_id,v_previous.sequence_number+1,v_previous.id,v_start,v_end,v_plan.expected_deliverables,v_previous.carry_over_items,nullif(trim(coalesce(p_actor_label,'')),'')) returning id into v_id;

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('service_cycle',v_id,'service_cycle_created_from_previous',public.commercial_audit_actor_type(p_actor_label),coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),jsonb_build_object('project_id',v_previous.project_id,'previous_cycle_id',v_previous.id,'sequence_number',v_previous.sequence_number+1,'period_start',v_start,'period_end',v_end,'carry_over_count',jsonb_array_length(v_previous.carry_over_items)));
  return v_id;
end; $$;

create or replace function public.schedule_diagnostic_reassessment(p_source_diagnostic_id uuid,p_project_id uuid,p_due_at timestamptz,p_reason text,p_owner_label text,p_source_reference text,p_notes text,p_actor_label text)
returns uuid language plpgsql set search_path=public as $$;
declare
  v_source public.diagnostics%rowtype;
  v_project_company uuid;
  v_id uuid;
begin
  select * into v_source from public.diagnostics where id=p_source_diagnostic_id;
  if not found then raise exception 'source diagnostic not found'; end if;
  if v_source.status not in ('presented','completed') then raise exception 'reassessment requires a presented/completed diagnostic'; end if;
  if v_source.company_id is null then raise exception 'source diagnostic requires company'; end if;
  if p_project_id is not null then
    select company_id into v_project_company from public.projects where id=p_project_id;
    if v_project_company is null or v_project_company<>v_source.company_id then raise exception 'reassessment project belongs to another company'; end if;
  end if;
  if p_due_at is null then raise exception 'reassessment date must be explicitly defined'; end if;
  if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'reassessment reason is required'; end if;
  if nullif(trim(coalesce(p_owner_label,'')),'') is null then raise exception 'reassessment owner is required'; end if;
  if nullif(trim(coalesce(p_source_reference,'')),'') is null then raise exception 'reassessment source reference is required'; end if;

  insert into public.diagnostic_reassessment_requests(company_id,project_id,source_diagnostic_id,due_at,reason,status,route,owner_label,source_reference,notes,scheduled_by_label)
  values(v_source.company_id,p_project_id,p_source_diagnostic_id,p_due_at,trim(p_reason),'scheduled','to_define',trim(p_owner_label),trim(p_source_reference),nullif(trim(coalesce(p_notes,'')),''),nullif(trim(coalesce(p_actor_label,'')),'')) returning id into v_id;

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('diagnostic_reassessment',v_id,'diagnostic_reassessment_scheduled',public.commercial_audit_actor_type(p_actor_label),coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),jsonb_build_object('company_id',v_source.company_id,'source_diagnostic_id',p_source_diagnostic_id,'project_id',p_project_id,'due_at',p_due_at));
  return v_id;
end; $$;

create or replace function public.set_diagnostic_reassessment_route(p_request_id uuid,p_route text,p_evidence text,p_notes text,p_actor_label text)
returns uuid language plpgsql set search_path=public as $$;
declare v_request public.diagnostic_reassessment_requests%rowtype;
begin
  if p_route not in ('included_in_contract','commercial_required') then raise exception 'invalid reassessment route'; end if;
  if nullif(trim(coalesce(p_evidence,'')),'') is null then raise exception 'reassessment route requires evidence'; end if;
  select * into v_request from public.diagnostic_reassessment_requests where id=p_request_id for update;
  if not found then raise exception 'reassessment request not found'; end if;
  if v_request.status in ('completed','waived','cancelled') or v_request.new_diagnostic_id is not null or v_request.opportunity_id is not null then raise exception 'reassessment route is immutable after execution starts'; end if;

  update public.diagnostic_reassessment_requests set route=p_route,route_evidence=trim(p_evidence),route_decided_by_label=nullif(trim(coalesce(p_actor_label,'')),''),route_decided_at=now(),status='pending',notes=coalesce(nullif(trim(coalesce(p_notes,'')),''),notes),updated_at=now() where id=p_request_id;
  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('diagnostic_reassessment',p_request_id,'diagnostic_reassessment_route_decided',public.commercial_audit_actor_type(p_actor_label),coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),jsonb_build_object('route',p_route,'evidence',trim(p_evidence)));
  return p_request_id;
end; $$;

create or replace function public.start_included_diagnostic_reassessment(p_request_id uuid,p_actor_label text)
returns uuid language plpgsql set search_path=public as $$;
declare
  v_request public.diagnostic_reassessment_requests%rowtype;
  v_source public.diagnostics%rowtype;
  v_new_id uuid;
  v_next_cycle integer;
begin
  select * into v_request from public.diagnostic_reassessment_requests where id=p_request_id for update;
  if not found then raise exception 'reassessment request not found'; end if;
  if v_request.route<>'included_in_contract' or nullif(trim(coalesce(v_request.route_evidence,'')),'') is null then raise exception 'included reassessment requires validated contractual evidence'; end if;
  if v_request.status not in ('scheduled','pending') then raise exception 'reassessment is not ready to start'; end if;
  if v_request.new_diagnostic_id is not null then return v_request.new_diagnostic_id; end if;
  select * into v_source from public.diagnostics where id=v_request.source_diagnostic_id;
  v_next_cycle:=coalesce(v_source.assessment_cycle_number,1)+1;

  insert into public.diagnostics(lead_id,pre_diagnostic_id,company_id,status,methodology_version,offer_notes,offered_by_label,offered_at,previous_diagnostic_id,assessment_cycle_number,reassessment_request_id)
  values(v_source.lead_id,null,v_source.company_id,'collection',v_source.methodology_version,'Reavaliação diagnóstica — ciclo '||v_next_cycle,nullif(trim(coalesce(p_actor_label,'')),''),now(),v_source.id,v_next_cycle,p_request_id)
  returning id into v_new_id;

  update public.diagnostic_reassessment_requests set status='in_progress',new_diagnostic_id=v_new_id,updated_at=now() where id=p_request_id;
  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('diagnostic_reassessment',p_request_id,'diagnostic_reassessment_started',public.commercial_audit_actor_type(p_actor_label),coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),jsonb_build_object('source_diagnostic_id',v_source.id,'new_diagnostic_id',v_new_id,'assessment_cycle_number',v_next_cycle));
  return v_new_id;
end; $$;

create or replace function public.route_diagnostic_reassessment_to_commercial(p_request_id uuid,p_route text,p_fit text,p_owner_label text,p_next_action_title text,p_next_action_at timestamptz,p_next_action_channel text,p_notes text,p_actor_label text)
returns uuid language plpgsql set search_path=public as $$;
declare
  v_request public.diagnostic_reassessment_requests%rowtype;
  v_source public.diagnostics%rowtype;
  v_contact_id uuid;
  v_opportunity_id uuid;
begin
  select * into v_request from public.diagnostic_reassessment_requests where id=p_request_id for update;
  if not found then raise exception 'reassessment request not found'; end if;
  if v_request.route<>'commercial_required' or nullif(trim(coalesce(v_request.route_evidence,'')),'') is null then raise exception 'commercial reassessment requires validated route evidence'; end if;
  if v_request.status not in ('scheduled','pending') then raise exception 'reassessment is not available for commercial routing'; end if;
  if v_request.opportunity_id is not null then return v_request.opportunity_id; end if;
  select * into v_source from public.diagnostics where id=v_request.source_diagnostic_id;
  select contact_id into v_contact_id from public.commercial_opportunities where diagnostic_id=v_source.id order by created_at desc limit 1;

  v_opportunity_id:=public.create_commercial_opportunity(v_source.lead_id,p_route,p_fit,'Reavaliação diagnóstica',p_owner_label,p_next_action_title,p_next_action_at,p_next_action_channel,p_actor_label,'P01');
  update public.commercial_opportunities set company_id=v_request.company_id,contact_id=v_contact_id,source='diagnostic_reassessment',updated_at=now() where id=v_opportunity_id;
  update public.diagnostic_reassessment_requests set status='pending',opportunity_id=v_opportunity_id,notes=coalesce(nullif(trim(coalesce(p_notes,'')),''),notes),updated_at=now() where id=p_request_id;
  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('diagnostic_reassessment',p_request_id,'diagnostic_reassessment_routed_to_commercial',public.commercial_audit_actor_type(p_actor_label),coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),jsonb_build_object('opportunity_id',v_opportunity_id,'source_diagnostic_id',v_source.id));
  return v_opportunity_id;
end; $$;

create or replace function public.resolve_diagnostic_reassessment(p_request_id uuid,p_status text,p_evidence text,p_notes text,p_actor_label text)
returns uuid language plpgsql set search_path=public as $$;
declare v_request public.diagnostic_reassessment_requests%rowtype;
begin
  if p_status not in ('completed','waived','cancelled') then raise exception 'invalid reassessment final status'; end if;
  if p_status in ('completed','waived') and nullif(trim(coalesce(p_evidence,'')),'') is null then raise exception 'reassessment completion/waiver requires evidence'; end if;
  select * into v_request from public.diagnostic_reassessment_requests where id=p_request_id for update;
  if not found then raise exception 'reassessment request not found'; end if;
  if v_request.status in ('completed','waived','cancelled') then raise exception 'reassessment request is already final'; end if;
  update public.diagnostic_reassessment_requests set status=p_status,notes=concat_ws(E'\n',notes,nullif(trim(coalesce(p_notes,'')),''),case when nullif(trim(coalesce(p_evidence,'')),'') is not null then 'Evidência: '||trim(p_evidence) else null end),completed_at=now(),updated_at=now() where id=p_request_id;
  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('diagnostic_reassessment',p_request_id,'diagnostic_reassessment_'||p_status,public.commercial_audit_actor_type(p_actor_label),coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),jsonb_build_object('source_diagnostic_id',v_request.source_diagnostic_id,'new_diagnostic_id',v_request.new_diagnostic_id,'opportunity_id',v_request.opportunity_id,'evidence',nullif(trim(coalesce(p_evidence,'')),'')));
  return p_request_id;
end; $$;

create or replace function public.sync_reassessment_from_diagnostic()
returns trigger language plpgsql set search_path=public as $$;
begin
  if new.reassessment_request_id is null then return new; end if;
  if new.status='completed' then
    update public.diagnostic_reassessment_requests set status='completed',completed_at=coalesce(completed_at,now()),updated_at=now() where id=new.reassessment_request_id and status='in_progress';
  elsif new.status='cancelled' then
    update public.diagnostic_reassessment_requests set status='cancelled',completed_at=coalesce(completed_at,now()),updated_at=now() where id=new.reassessment_request_id and status='in_progress';
  end if;
  return new;
end; $$;
drop trigger if exists sync_reassessment_from_diagnostic_trg on public.diagnostics;
create trigger sync_reassessment_from_diagnostic_trg after update of status on public.diagnostics for each row execute function public.sync_reassessment_from_diagnostic();

-- Hardening: diagnóstico de reavaliação incluído no contrato não deve sequestrar/reabrir oportunidade histórica.
create or replace function public.commercial_sync_from_diagnostic() returns trigger language plpgsql set search_path=public as $$
declare v_id uuid; v_current text; v_target text; v_action text;
begin
  if new.reassessment_request_id is not null then return new; end if;
  select id,pipeline_stage into v_id,v_current from public.commercial_opportunities where (pre_diagnostic_id=new.pre_diagnostic_id and new.pre_diagnostic_id is not null) or lead_id=new.lead_id order by created_at desc limit 1;
  if v_id is null then return new; end if;
  update public.commercial_opportunities set diagnostic_id=new.id,company_id=coalesce(new.company_id,company_id),updated_at=now() where id=v_id;
  if exists(select 1 from public.commercial_opportunities where id=v_id and outcome_status is not null) then return new; end if;
  if new.status in ('ready_for_presentation','presented','completed') then v_target:='P06';v_action:='Definir próxima solução/proposta'; else v_target:='P05';v_action:=case when new.status='awaiting_payment' then 'Confirmar condição do diagnóstico' else 'Concluir diagnóstico e recomendações' end; end if;
  if public.commercial_stage_number(v_current)<=public.commercial_stage_number(v_target) then perform public.set_commercial_opportunity_stage(v_id,v_target,coalesce(new.offered_by_label,'Blinko'),v_action,now(),'interno','Sincronização automática pelo diagnóstico.','system'); end if;
  return new;
end; $$;

create or replace view public.recurring_service_cycle_summary as
select sc.id,sc.project_id,sc.company_id,sc.plan_id,sc.contract_id,sc.sequence_number,sc.previous_cycle_id,sc.period_start,sc.period_end,sc.status,sc.expected_deliverables,sc.pending_items,sc.carry_over_items,sc.carry_over_justification,sc.continuation_status,sc.continuation_evidence,sc.started_at,sc.closed_at,sc.delivery_summary,sc.delivery_evidence_reference,sc.indicator_snapshot,sc.finance_pending_note,
       (select count(*) from public.project_tasks t where t.service_cycle_id=sc.id and t.status not in ('done','cancelled'))::integer as open_task_count,
       (select count(*) from public.approvals a where a.service_cycle_id=sc.id and a.status in ('draft','pending','changes_requested'))::integer as open_approval_count,
       (select coalesce(sum(r.amount),0) from public.receivables r where r.service_cycle_id=sc.id and r.status<>'cancelled') as cycle_receivable_total,
       (select coalesce(sum(r.amount),0) from public.receivables r where r.service_cycle_id=sc.id and r.status='paid') as cycle_received_total,
       (select coalesce(sum(pc.amount),0) from public.project_costs pc where pc.service_cycle_id=sc.id and pc.status<>'cancelled') as cycle_cost_total
from public.service_cycles sc;

create or replace view public.recurring_renewal_queue as
select rp.id as plan_id,rp.project_id,rp.company_id,rp.contract_id,rp.version_number,rp.status as plan_status,rp.contract_valid_until,rp.renewal_review_at as due_at,
       rr.id as review_id,rr.status as review_status,rr.decision,rr.owner_label,rr.opportunity_id,rr.decision_evidence,
       case when rp.renewal_review_at is null then 'not_scheduled'
            when rr.status in ('resolved','waived') then 'resolved'
            when rr.status='routed' then 'commercial_followup'
            when rr.status='pending' then 'pending_decision'
            when rp.renewal_review_at<=now() then 'due_to_open'
            else 'scheduled' end as queue_status
from public.recurring_service_plans rp left join public.contract_renewal_reviews rr on rr.plan_id=rp.id
where rp.is_current and rp.status in ('active','paused');

create or replace view public.diagnostic_reassessment_queue as
select r.id,r.company_id,r.project_id,r.source_diagnostic_id,r.new_diagnostic_id,r.due_at,r.reason,r.status,r.route,r.owner_label,r.opportunity_id,r.scheduled_at,
       case when r.status in ('completed','waived','cancelled') then r.status
            when r.status='in_progress' then 'in_progress'
            when r.due_at<=now() then 'due'
            when r.route='to_define' then 'route_to_define'
            when r.route='commercial_required' and r.opportunity_id is not null then 'commercial_followup'
            else 'scheduled' end as queue_status
from public.diagnostic_reassessment_requests r;
