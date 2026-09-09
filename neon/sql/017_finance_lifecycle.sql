-- Blinko OS — ciclo financeiro e separação rentabilidade x caixa
-- Aplicação inicial: branch de simulação.

alter table public.project_costs add column if not exists cash_effect boolean not null default true;

update public.project_costs set cash_effect = false where cost_type = 'internal';

alter table public.project_costs drop constraint if exists project_costs_status_check;
alter table public.project_costs add constraint project_costs_status_check check (status in ('estimated','committed','realized','paid','cancelled'));

create or replace function public.record_project_cost(p_project_id uuid,p_cost_type text,p_description text,p_amount numeric,p_status text,p_partner_label text,p_due_date date,p_actor_label text) returns uuid language plpgsql set search_path=public as $$
declare v_company_id uuid; v_id uuid; v_status text; v_cash_effect boolean;
begin
  select company_id into v_company_id from public.projects where id=p_project_id;
  if v_company_id is null then raise exception 'project not found'; end if;
  v_cash_effect := case when p_cost_type='internal' then false else true end;
  v_status := coalesce(nullif(p_status,''),'estimated');
  if v_status not in ('estimated','committed','realized','paid','cancelled') then raise exception 'invalid project cost status'; end if;
  if p_cost_type='internal' and v_status='paid' then v_status := 'realized'; end if;
  insert into public.project_costs(company_id,project_id,cost_type,description,amount,status,partner_label,due_date,cash_effect,created_by_label)
  values(v_company_id,p_project_id,p_cost_type,trim(p_description),p_amount,v_status,nullif(trim(coalesce(p_partner_label,'')),''),p_due_date,v_cash_effect,nullif(trim(coalesce(p_actor_label,'')),''))
  returning id into v_id;
  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('project_cost',v_id,'project_cost_recorded','human',coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),jsonb_build_object('project_id',p_project_id,'cost_type',p_cost_type,'amount',p_amount,'status',v_status,'cash_effect',v_cash_effect));
  return v_id;
end; $$;

create or replace function public.mark_receivable_paid(p_receivable_id uuid,p_actor_label text,p_paid_at timestamptz,p_payment_reference text) returns uuid language plpgsql set search_path=public as $$
declare v_previous text; v_project_id uuid; v_amount numeric;
begin
  select status,project_id,amount into v_previous,v_project_id,v_amount from public.receivables where id=p_receivable_id for update;
  if v_project_id is null then raise exception 'receivable not found'; end if;
  if v_previous not in ('pending','overdue') then raise exception 'receivable is not open'; end if;
  if nullif(trim(coalesce(p_payment_reference,'')),'') is null then raise exception 'payment reference is required'; end if;
  update public.receivables set status='paid',paid_at=coalesce(p_paid_at,now()),payment_reference=trim(p_payment_reference),updated_at=now() where id=p_receivable_id;
  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('receivable',p_receivable_id,'receivable_paid','human',coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),jsonb_build_object('project_id',v_project_id,'amount',v_amount,'previous_status',v_previous,'payment_reference',trim(p_payment_reference)));
  return p_receivable_id;
end; $$;

create or replace function public.mark_project_cost_realized(p_cost_id uuid,p_actor_label text,p_occurred_at timestamptz,p_payment_reference text) returns uuid language plpgsql set search_path=public as $$
declare v_previous text; v_project_id uuid; v_amount numeric; v_cash_effect boolean; v_new_status text;
begin
  select status,project_id,amount,cash_effect into v_previous,v_project_id,v_amount,v_cash_effect from public.project_costs where id=p_cost_id for update;
  if v_project_id is null then raise exception 'project cost not found'; end if;
  if v_previous not in ('estimated','committed') then raise exception 'project cost is not open'; end if;
  v_new_status := case when v_cash_effect then 'paid' else 'realized' end;
  if v_cash_effect and nullif(trim(coalesce(p_payment_reference,'')),'') is null then raise exception 'payment reference is required for cash cost'; end if;
  update public.project_costs set status=v_new_status,paid_at=coalesce(p_occurred_at,now()),payment_reference=case when v_cash_effect then trim(p_payment_reference) else null end,updated_at=now() where id=p_cost_id;
  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('project_cost',p_cost_id,'project_cost_realized','human',coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),jsonb_build_object('project_id',v_project_id,'amount',v_amount,'previous_status',v_previous,'new_status',v_new_status,'cash_effect',v_cash_effect));
  return p_cost_id;
end; $$;

create or replace function public.refresh_overdue_receivables(p_actor_label text) returns integer language plpgsql set search_path=public as $$
declare v_count integer;
begin
  update public.receivables set status='overdue',updated_at=now() where status='pending' and due_date < current_date;
  get diagnostics v_count = row_count;
  if v_count > 0 then
    insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
    values('finance',gen_random_uuid(),'receivables_overdue_refreshed','system',coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'system'),jsonb_build_object('updated_count',v_count));
  end if;
  return v_count;
end; $$;

create or replace view public.project_financial_summary as
select
  p.id as project_id,
  p.company_id,
  fp.contracted_revenue,
  fp.discount_amount,
  fp.planned_internal_cost,
  fp.planned_partner_cost,
  fp.planned_other_cost,
  (fp.planned_internal_cost + fp.planned_partner_cost + fp.planned_other_cost) as planned_total_cost,
  (fp.contracted_revenue - fp.discount_amount - fp.planned_internal_cost - fp.planned_partner_cost - fp.planned_other_cost) as projected_contribution,
  case when (fp.contracted_revenue - fp.discount_amount) > 0 then round(((fp.contracted_revenue - fp.discount_amount - fp.planned_internal_cost - fp.planned_partner_cost - fp.planned_other_cost) / (fp.contracted_revenue - fp.discount_amount))*100,2) else null end as projected_margin_pct,
  coalesce((select sum(r.amount) from public.receivables r where r.project_id=p.id and r.status='paid'),0) as cash_received,
  coalesce((select sum(r.amount) from public.receivables r where r.project_id=p.id and r.status in ('pending','overdue')),0) as open_receivables,
  coalesce((select sum(c.amount) from public.project_costs c where c.project_id=p.id and c.status='paid' and c.cash_effect),0) as cash_cost_paid,
  coalesce((select sum(c.amount) from public.project_costs c where c.project_id=p.id and c.status in ('estimated','committed')),0) as open_or_estimated_cost,
  coalesce((select sum(c.amount) from public.project_costs c where c.project_id=p.id and c.status in ('realized','paid')),0) as realized_total_cost,
  ((fp.contracted_revenue - fp.discount_amount) - coalesce((select sum(c.amount) from public.project_costs c where c.project_id=p.id and c.status in ('realized','paid')),0)) as realized_contribution,
  case when (fp.contracted_revenue - fp.discount_amount) > 0 then round((((fp.contracted_revenue - fp.discount_amount) - coalesce((select sum(c.amount) from public.project_costs c where c.project_id=p.id and c.status in ('realized','paid')),0)) / (fp.contracted_revenue - fp.discount_amount))*100,2) else null end as realized_margin_pct
from public.projects p
left join public.project_financial_plans fp on fp.project_id=p.id;
