-- Blinko OS — núcleo financeiro geral por projeto
-- Sem regra fixa de margem ou repasse. Aplicação inicial: branch de simulação.

create table if not exists public.project_financial_plans (
  project_id uuid primary key references public.projects(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  contracted_revenue numeric(14,2) not null check (contracted_revenue >= 0),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  planned_internal_cost numeric(14,2) not null default 0 check (planned_internal_cost >= 0),
  planned_partner_cost numeric(14,2) not null default 0 check (planned_partner_cost >= 0),
  planned_other_cost numeric(14,2) not null default 0 check (planned_other_cost >= 0),
  notes text,
  created_by_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.receivables (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  due_date date not null,
  status text not null default 'pending' check (status in ('pending','paid','overdue','cancelled')),
  paid_at timestamptz,
  payment_reference text,
  created_by_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists receivables_project_idx on public.receivables(project_id,status,due_date);
create index if not exists receivables_open_idx on public.receivables(status,due_date) where status in ('pending','overdue');

create table if not exists public.project_costs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  cost_type text not null check (cost_type in ('internal','partner','supplier','logistics','tax_fee','software','other')),
  description text not null,
  amount numeric(14,2) not null check (amount >= 0),
  status text not null default 'estimated' check (status in ('estimated','committed','paid','cancelled')),
  partner_label text,
  due_date date,
  paid_at timestamptz,
  payment_reference text,
  created_by_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_costs_project_idx on public.project_costs(project_id,status,cost_type);

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
  coalesce((select sum(c.amount) from public.project_costs c where c.project_id=p.id and c.status='paid'),0) as cash_cost_paid,
  coalesce((select sum(c.amount) from public.project_costs c where c.project_id=p.id and c.status in ('estimated','committed')),0) as open_or_estimated_cost
from public.projects p
left join public.project_financial_plans fp on fp.project_id=p.id;

create or replace function public.upsert_project_financial_plan(p_project_id uuid,p_contracted_revenue numeric,p_discount_amount numeric,p_planned_internal_cost numeric,p_planned_partner_cost numeric,p_planned_other_cost numeric,p_notes text,p_actor_label text) returns uuid language plpgsql set search_path=public as $$ declare v_company_id uuid; begin select company_id into v_company_id from public.projects where id=p_project_id; if v_company_id is null then raise exception 'project not found'; end if; insert into public.project_financial_plans(project_id,company_id,contracted_revenue,discount_amount,planned_internal_cost,planned_partner_cost,planned_other_cost,notes,created_by_label) values(p_project_id,v_company_id,p_contracted_revenue,coalesce(p_discount_amount,0),coalesce(p_planned_internal_cost,0),coalesce(p_planned_partner_cost,0),coalesce(p_planned_other_cost,0),nullif(trim(coalesce(p_notes,'')),''),nullif(trim(coalesce(p_actor_label,'')),'')) on conflict(project_id) do update set contracted_revenue=excluded.contracted_revenue,discount_amount=excluded.discount_amount,planned_internal_cost=excluded.planned_internal_cost,planned_partner_cost=excluded.planned_partner_cost,planned_other_cost=excluded.planned_other_cost,notes=excluded.notes,updated_at=now(); insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload) values('project',p_project_id,'project_financial_plan_upserted','human',coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),jsonb_build_object('contracted_revenue',p_contracted_revenue,'discount_amount',coalesce(p_discount_amount,0))); return p_project_id; end; $$;

create or replace function public.record_receivable(p_project_id uuid,p_description text,p_amount numeric,p_due_date date,p_actor_label text) returns uuid language plpgsql set search_path=public as $$ declare v_company_id uuid; v_id uuid; begin select company_id into v_company_id from public.projects where id=p_project_id; if v_company_id is null then raise exception 'project not found'; end if; insert into public.receivables(company_id,project_id,description,amount,due_date,created_by_label) values(v_company_id,p_project_id,trim(p_description),p_amount,p_due_date,nullif(trim(coalesce(p_actor_label,'')),'')) returning id into v_id; insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload) values('receivable',v_id,'receivable_recorded','human',coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),jsonb_build_object('project_id',p_project_id,'amount',p_amount,'due_date',p_due_date)); return v_id; end; $$;

create or replace function public.record_project_cost(p_project_id uuid,p_cost_type text,p_description text,p_amount numeric,p_status text,p_partner_label text,p_due_date date,p_actor_label text) returns uuid language plpgsql set search_path=public as $$ declare v_company_id uuid; v_id uuid; begin select company_id into v_company_id from public.projects where id=p_project_id; if v_company_id is null then raise exception 'project not found'; end if; insert into public.project_costs(company_id,project_id,cost_type,description,amount,status,partner_label,due_date,created_by_label) values(v_company_id,p_project_id,p_cost_type,trim(p_description),p_amount,coalesce(nullif(p_status,''),'estimated'),nullif(trim(coalesce(p_partner_label,'')),''),p_due_date,nullif(trim(coalesce(p_actor_label,'')),'')) returning id into v_id; insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload) values('project_cost',v_id,'project_cost_recorded','human',coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),jsonb_build_object('project_id',p_project_id,'cost_type',p_cost_type,'amount',p_amount,'status',coalesce(nullif(p_status,''),'estimated'))); return v_id; end; $$;
