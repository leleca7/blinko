-- Blinko OS — Gate de liberação de pagamentos a parceiros
-- Fonte: Documento 07 — Financeiro e Indicadores, seção 14.
-- Depende de 039.
-- Produção/main não deve receber esta migração sem promoção controlada.

create table if not exists public.partner_payment_releases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  project_cost_id uuid not null references public.project_costs(id) on delete restrict,
  partner_assignment_id uuid not null references public.project_partner_assignments(id) on delete restrict,
  partner_id uuid not null references public.partners(id) on delete restrict,
  amount numeric(14,2) not null check (amount >= 0),
  due_date date not null,
  release_condition_evidence text not null,
  cash_impact_status text not null
    check (cash_impact_status in ('reviewed_no_block','attention','blocked')),
  cash_impact_notes text not null,
  internal_approval_evidence text,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','paid','cancelled')),
  requested_by_label text not null,
  requested_at timestamptz not null default now(),
  approved_by_label text,
  approved_at timestamptz,
  rejected_by_label text,
  rejected_at timestamptz,
  rejection_reason text,
  paid_at timestamptz,
  payment_reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (nullif(trim(release_condition_evidence),'') is not null),
  check (nullif(trim(cash_impact_notes),'') is not null),
  check (nullif(trim(requested_by_label),'') is not null),
  check (status <> 'approved' or (approved_at is not null and nullif(trim(coalesce(internal_approval_evidence,'')),'') is not null)),
  check (status <> 'paid' or (paid_at is not null and nullif(trim(coalesce(payment_reference,'')),'') is not null))
);

create unique index if not exists partner_payment_releases_open_cost_uidx
  on public.partner_payment_releases(project_cost_id)
  where status in ('pending','approved');
create index if not exists partner_payment_releases_project_idx
  on public.partner_payment_releases(project_id,status,due_date);
create index if not exists partner_payment_releases_partner_idx
  on public.partner_payment_releases(partner_id,status,due_date);

create or replace function public.request_partner_payment_release(
  p_project_cost_id uuid,
  p_due_date date,
  p_release_condition_evidence text,
  p_cash_impact_status text,
  p_cash_impact_notes text,
  p_notes text,
  p_actor_label text
) returns uuid
language plpgsql
set search_path=public
as $$
declare
  v_cost public.project_costs%rowtype;
  v_assignment public.project_partner_assignments%rowtype;
  v_id uuid;
begin
  select * into v_cost from public.project_costs where id=p_project_cost_id for update;
  if not found then raise exception 'project cost not found'; end if;
  if v_cost.cost_type<>'partner' or v_cost.partner_assignment_id is null or v_cost.partner_id is null then
    raise exception 'payment release requires a partner cost linked to an approved commitment';
  end if;
  if v_cost.status not in ('committed','realized') then raise exception 'partner cost is not awaiting payment'; end if;
  if p_due_date is null then raise exception 'partner payment due date is required'; end if;
  if nullif(trim(coalesce(p_release_condition_evidence,'')),'') is null then raise exception 'payment release requires delivery/condition evidence'; end if;
  if p_cash_impact_status not in ('reviewed_no_block','attention','blocked') then raise exception 'invalid cash impact status'; end if;
  if nullif(trim(coalesce(p_cash_impact_notes,'')),'') is null then raise exception 'cash impact review notes are required'; end if;
  if nullif(trim(coalesce(p_actor_label,'')),'') is null then raise exception 'requester is required'; end if;

  select * into v_assignment from public.project_partner_assignments where id=v_cost.partner_assignment_id;
  if not found or v_assignment.project_id<>v_cost.project_id or v_assignment.partner_id<>v_cost.partner_id then
    raise exception 'partner assignment does not match project cost';
  end if;
  if not v_assignment.blinko_payment_obligation then raise exception 'assignment does not create a Blinko payment obligation'; end if;
  if v_assignment.committed_cost_to_blinko is distinct from v_cost.amount then
    raise exception 'partner cost differs from committed proposal amount; review scope/financial commitment before payment';
  end if;
  if exists(select 1 from public.partner_payment_releases where project_cost_id=v_cost.id and status in ('pending','approved')) then
    raise exception 'an open payment release already exists for this partner cost';
  end if;

  insert into public.partner_payment_releases(
    project_id,project_cost_id,partner_assignment_id,partner_id,amount,due_date,
    release_condition_evidence,cash_impact_status,cash_impact_notes,requested_by_label,notes
  ) values(
    v_cost.project_id,v_cost.id,v_assignment.id,v_cost.partner_id,v_cost.amount,p_due_date,
    trim(p_release_condition_evidence),p_cash_impact_status,trim(p_cash_impact_notes),trim(p_actor_label),
    nullif(trim(coalesce(p_notes,'')),'')
  ) returning id into v_id;

  update public.project_costs set due_date=p_due_date,updated_at=now() where id=v_cost.id;

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('partner_payment_release',v_id,'partner_payment_release_requested',public.commercial_audit_actor_type(p_actor_label),
    trim(p_actor_label),jsonb_build_object('project_id',v_cost.project_id,'project_cost_id',v_cost.id,'partner_id',v_cost.partner_id,
      'amount',v_cost.amount,'due_date',p_due_date,'cash_impact_status',p_cash_impact_status));
  return v_id;
end;
$$;

create or replace function public.approve_partner_payment_release(
  p_release_id uuid,
  p_internal_approval_evidence text,
  p_actor_label text
) returns uuid
language plpgsql
set search_path=public
as $$
declare v_release public.partner_payment_releases%rowtype;v_cost public.project_costs%rowtype;
begin
  select * into v_release from public.partner_payment_releases where id=p_release_id for update;
  if not found then raise exception 'partner payment release not found'; end if;
  if v_release.status<>'pending' then raise exception 'partner payment release is not pending'; end if;
  if v_release.cash_impact_status='blocked' then raise exception 'BLOQUEADO: revisão de caixa impede liberação do pagamento'; end if;
  if nullif(trim(coalesce(p_internal_approval_evidence,'')),'') is null then raise exception 'internal payment approval evidence is required'; end if;
  if nullif(trim(coalesce(p_actor_label,'')),'') is null then raise exception 'approver is required'; end if;

  select * into v_cost from public.project_costs where id=v_release.project_cost_id for update;
  if not found or v_cost.status not in ('committed','realized') then raise exception 'partner cost is no longer awaiting payment'; end if;
  if v_cost.amount<>v_release.amount then raise exception 'payment amount no longer matches committed cost'; end if;

  update public.partner_payment_releases set status='approved',internal_approval_evidence=trim(p_internal_approval_evidence),
    approved_by_label=trim(p_actor_label),approved_at=now(),updated_at=now() where id=p_release_id;

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('partner_payment_release',p_release_id,'partner_payment_release_approved',public.commercial_audit_actor_type(p_actor_label),
    trim(p_actor_label),jsonb_build_object('project_id',v_release.project_id,'project_cost_id',v_release.project_cost_id,
      'partner_id',v_release.partner_id,'amount',v_release.amount,'cash_impact_status',v_release.cash_impact_status));
  return p_release_id;
end;
$$;

create or replace function public.reject_partner_payment_release(
  p_release_id uuid,p_reason text,p_actor_label text
) returns uuid
language plpgsql
set search_path=public
as $$
declare v_release public.partner_payment_releases%rowtype;
begin
  select * into v_release from public.partner_payment_releases where id=p_release_id for update;
  if not found then raise exception 'partner payment release not found'; end if;
  if v_release.status<>'pending' then raise exception 'partner payment release is not pending'; end if;
  if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'rejection reason is required'; end if;
  update public.partner_payment_releases set status='rejected',rejection_reason=trim(p_reason),rejected_by_label=nullif(trim(coalesce(p_actor_label,'')),''),rejected_at=now(),updated_at=now() where id=p_release_id;
  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('partner_payment_release',p_release_id,'partner_payment_release_rejected',public.commercial_audit_actor_type(p_actor_label),
    coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),jsonb_build_object('project_id',v_release.project_id,'project_cost_id',v_release.project_cost_id,'reason',trim(p_reason)));
  return p_release_id;
end;
$$;

-- Um custo de parceiro só pode virar pago após liberação aprovada.
create or replace function public.mark_project_cost_realized(
  p_cost_id uuid,p_actor_label text,p_occurred_at timestamptz,p_payment_reference text
) returns uuid
language plpgsql
set search_path=public
as $$
declare
  v_previous text;v_project_id uuid;v_amount numeric;v_cash_effect boolean;v_new_status text;v_cost_type text;v_release_id uuid;
begin
  select status,project_id,amount,cash_effect,cost_type into v_previous,v_project_id,v_amount,v_cash_effect,v_cost_type
  from public.project_costs where id=p_cost_id for update;
  if v_project_id is null then raise exception 'project cost not found'; end if;
  if v_previous not in ('estimated','committed') then raise exception 'project cost is not open'; end if;
  v_new_status:=case when v_cash_effect then 'paid' else 'realized' end;
  if v_cash_effect and nullif(trim(coalesce(p_payment_reference,'')),'') is null then raise exception 'payment reference is required for cash cost'; end if;

  if v_cost_type='partner' then
    select id into v_release_id from public.partner_payment_releases
    where project_cost_id=p_cost_id and status='approved' order by approved_at desc limit 1 for update;
    if v_release_id is null then raise exception 'BLOQUEADO: pagamento de parceiro exige liberação interna aprovada'; end if;
  end if;

  update public.project_costs set status=v_new_status,paid_at=coalesce(p_occurred_at,now()),
    payment_reference=case when v_cash_effect then trim(p_payment_reference) else null end,updated_at=now() where id=p_cost_id;

  if v_release_id is not null then
    update public.partner_payment_releases set status='paid',paid_at=coalesce(p_occurred_at,now()),payment_reference=trim(p_payment_reference),updated_at=now()
    where id=v_release_id;
  end if;

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('project_cost',p_cost_id,'project_cost_realized',public.commercial_audit_actor_type(p_actor_label),
    coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),
    jsonb_build_object('project_id',v_project_id,'amount',v_amount,'previous_status',v_previous,'new_status',v_new_status,
      'cash_effect',v_cash_effect,'partner_payment_release_id',v_release_id));
  return p_cost_id;
end;
$$;

create or replace view public.partner_payment_release_summary as
select
  r.*,
  pt.official_code as partner_code,
  pt.trade_name as partner_name,
  ps.solution_code,
  pa.execution_route,
  pc.description as cost_description,
  pc.status as cost_status,
  pc.source_quote_reference
from public.partner_payment_releases r
join public.project_costs pc on pc.id=r.project_cost_id
join public.project_partner_assignments pa on pa.id=r.partner_assignment_id
join public.partners pt on pt.id=r.partner_id
join public.project_solutions ps on ps.id=pa.project_solution_id;
