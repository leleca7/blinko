-- Blinko OS — cobertura mínima para indicadores de contribuição/margem
-- Fonte funcional: Documento 07 — Financeiro e Indicadores.
-- Depende de 041.
-- Regra: custo realizado sem plano financeiro correspondente não pode ser misturado silenciosamente à margem global.
-- Produção/main não deve receber esta migração sem promoção controlada.

create or replace view public.blinko_financial_indicator_coverage as
select
  count(distinct pc.project_id) filter(where pc.status in ('realized','paid'))::bigint as projects_with_realized_cost,
  count(distinct pc.project_id) filter(
    where pc.status in ('realized','paid')
      and not exists(select 1 from public.project_financial_plans fp where fp.project_id=pc.project_id)
  )::bigint as cost_projects_without_financial_plan,
  coalesce(sum(pc.amount) filter(
    where pc.status in ('realized','paid')
      and not exists(select 1 from public.project_financial_plans fp where fp.project_id=pc.project_id)
  ),0) as realized_cost_without_financial_plan
from public.project_costs pc;

create or replace view public.blinko_indicator_snapshot_safe as
select
  s.indicator_code,
  s.domain,
  s.name,
  s.description,
  s.unit,
  s.formula_description,
  s.source_description,
  s.implementation_status,
  s.required_parameter_key,
  s.display_order,
  case
    when s.indicator_code in ('FIN_REALIZED_CONTRIBUTION','FIN_REALIZED_MARGIN_PCT')
      and c.cost_projects_without_financial_plan>0 then null
    else s.value_numeric
  end as value_numeric,
  case
    when s.indicator_code in ('FIN_REALIZED_CONTRIBUTION','FIN_REALIZED_MARGIN_PCT')
      and c.cost_projects_without_financial_plan>0 then 'insufficient_data'
    else s.calculation_status
  end as calculation_status,
  case
    when s.indicator_code in ('FIN_REALIZED_CONTRIBUTION','FIN_REALIZED_MARGIN_PCT')
      and c.cost_projects_without_financial_plan>0 then
      c.cost_projects_without_financial_plan||' projeto(s) possuem custo realizado sem plano financeiro correspondente; contribuição/margem global bloqueadas até completar a cobertura.'
    else s.status_reason
  end as status_reason,
  s.target_status,
  s.target_id,
  s.target_version,
  s.target_operator,
  s.target_value,
  s.target_value_max,
  s.target_evidence_reference,
  case
    when s.indicator_code in ('FIN_REALIZED_CONTRIBUTION','FIN_REALIZED_MARGIN_PCT')
      and c.cost_projects_without_financial_plan>0 then 'unknown'
    else s.performance_status
  end as performance_status
from public.blinko_indicator_snapshot s
cross join public.blinko_financial_indicator_coverage c
order by s.display_order,s.indicator_code;

create or replace view public.blinko_finance_by_company_safe as
with plan_coverage as (
  select c.id as company_id,
    count(fp.project_id)::bigint as financial_plan_count,
    count(distinct pc.project_id) filter(
      where pc.status in ('realized','paid')
        and not exists(select 1 from public.project_financial_plans fp2 where fp2.project_id=pc.project_id)
    )::bigint as cost_projects_without_financial_plan
  from public.companies c
  left join public.project_financial_plans fp on fp.company_id=c.id
  left join public.project_costs pc on pc.company_id=c.id
  group by c.id
)
select
  b.company_id,
  b.company_name,
  b.net_revenue,
  b.realized_cost,
  case when pc.cost_projects_without_financial_plan>0 then null else b.realized_contribution end as realized_contribution,
  case when pc.cost_projects_without_financial_plan>0 then null else b.realized_margin_pct end as realized_margin_pct,
  b.cash_received,
  b.cash_out,
  b.net_cash,
  b.open_receivables,
  b.overdue_receivables,
  pc.financial_plan_count,
  pc.cost_projects_without_financial_plan,
  case when pc.cost_projects_without_financial_plan>0 then 'incomplete' else 'covered' end as financial_coverage_status
from public.blinko_finance_by_company b
join plan_coverage pc on pc.company_id=b.company_id;
