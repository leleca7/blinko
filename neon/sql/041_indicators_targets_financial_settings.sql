-- Blinko OS — Indicadores + metas/configurações governadas
-- Fonte funcional: Documento 07 — BLINKO — FINANCEIRO E INDICADORES.
-- Escopo: indicadores comerciais, operacionais, financeiros e diagnósticos.
-- Regra central: não inventar meta, parâmetro ou cálculo. Valor só é exibido quando a fonte e a fórmula são válidas.
-- Depende de 017, 019–022, 028, 034–040.
-- Produção/main não deve receber esta migração sem promoção controlada.

create table if not exists public.indicator_definitions (
  code text primary key,
  domain text not null check (domain in ('commercial','operation','financial','diagnostic')),
  name text not null,
  description text,
  unit text not null check (unit in ('count','currency','percentage','hours','days','number')),
  formula_description text not null,
  source_description text not null,
  implementation_status text not null default 'implemented'
    check (implementation_status in ('implemented','parameter_required','source_pending')),
  required_parameter_key text,
  target_applicability text not null default 'optional'
    check (target_applicability in ('optional','none')),
  display_order integer not null default 100,
  source_document text not null default '07 — BLINKO — FINANCEIRO E INDICADORES',
  source_version text not null default 'v1.0 — 09/09/2026',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (nullif(trim(code),'') is not null),
  check (nullif(trim(name),'') is not null),
  check (implementation_status <> 'parameter_required' or nullif(trim(coalesce(required_parameter_key,'')),'') is not null)
);

create table if not exists public.indicator_targets (
  id uuid primary key default gen_random_uuid(),
  indicator_code text not null references public.indicator_definitions(code) on delete restrict,
  scope_type text not null default 'global' check (scope_type in ('global','company','solution')),
  scope_id uuid,
  version_number integer not null check (version_number > 0),
  is_current boolean not null default true,
  target_operator text not null check (target_operator in ('gte','lte','eq','between')),
  target_value numeric(18,4) not null,
  target_value_max numeric(18,4),
  status text not null default 'active' check (status in ('active','retired')),
  valid_from date,
  valid_until date,
  evidence_reference text not null,
  approved_by_label text not null,
  approved_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((scope_type='global' and scope_id is null) or (scope_type<>'global' and scope_id is not null)),
  check (valid_until is null or valid_from is null or valid_until >= valid_from),
  check (target_operator <> 'between' or (target_value_max is not null and target_value_max >= target_value)),
  check (nullif(trim(evidence_reference),'') is not null),
  check (nullif(trim(approved_by_label),'') is not null)
);

create unique index if not exists indicator_targets_global_version_uidx
  on public.indicator_targets(indicator_code,version_number)
  where scope_type='global' and scope_id is null;
create unique index if not exists indicator_targets_global_current_uidx
  on public.indicator_targets(indicator_code)
  where scope_type='global' and scope_id is null and is_current;
create unique index if not exists indicator_targets_scoped_version_uidx
  on public.indicator_targets(indicator_code,scope_type,scope_id,version_number)
  where scope_id is not null;
create unique index if not exists indicator_targets_scoped_current_uidx
  on public.indicator_targets(indicator_code,scope_type,scope_id)
  where scope_id is not null and is_current;

create table if not exists public.indicator_parameters (
  id uuid primary key default gen_random_uuid(),
  indicator_code text not null references public.indicator_definitions(code) on delete restrict,
  parameter_key text not null,
  version_number integer not null check (version_number > 0),
  is_current boolean not null default true,
  value_json jsonb not null,
  status text not null default 'active' check (status in ('active','retired')),
  evidence_reference text not null,
  approved_by_label text not null,
  approved_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (nullif(trim(parameter_key),'') is not null),
  check (nullif(trim(evidence_reference),'') is not null),
  check (nullif(trim(approved_by_label),'') is not null)
);

create unique index if not exists indicator_parameters_version_uidx
  on public.indicator_parameters(indicator_code,parameter_key,version_number);
create unique index if not exists indicator_parameters_current_uidx
  on public.indicator_parameters(indicator_code,parameter_key)
  where is_current;

insert into public.indicator_definitions(code,domain,name,description,unit,formula_description,source_description,implementation_status,required_parameter_key,target_applicability,display_order)
values
  ('COM_LEADS_TOTAL','commercial','Leads','Entradas comerciais registradas.','count','Contagem de leads.','public.leads','implemented',null,'optional',10),
  ('COM_QUALIFIED_OPPORTUNITIES','commercial','Oportunidades qualificadas','Oportunidades que estão ou chegaram ao estágio P04 ou posterior.','count','Contagem de oportunidades cuja etapa atual é P04–P14.','public.commercial_opportunities.pipeline_stage','implemented',null,'optional',20),
  ('COM_DIAGNOSTICS_TOTAL','commercial','Diagnósticos','Diagnósticos formalmente criados no OS.','count','Contagem de diagnostics.','public.diagnostics','implemented',null,'optional',30),
  ('COM_PROPOSALS_TOTAL','commercial','Propostas','Propostas formalmente criadas no OS.','count','Contagem de proposals.','public.proposals','implemented',null,'optional',40),
  ('COM_ACCEPTED_PROPOSALS','commercial','Propostas aceitas','Propostas com aceite comercial registrado.','count','Contagem de proposals com status accepted.','public.proposals.status','implemented',null,'optional',50),
  ('COM_CONVERSION_PCT','commercial','Conversão comercial','Percentual de oportunidades encerradas como ganho.','percentage','Oportunidades won ÷ oportunidades com outcome final × 100.','public.commercial_opportunities.outcome_status','implemented',null,'optional',60),
  ('COM_PROPOSED_VALUE','commercial','Valor proposto','Valor monetário efetivamente apresentado em proposta.','currency','Soma do valor monetário normalizado das propostas atuais.','proposal_versions.investment ainda é texto livre e não pode ser somado com segurança.','source_pending',null,'optional',70),
  ('COM_CONTRACTED_VALUE','commercial','Valor contratado','Receita líquida contratada registrada nos planos financeiros de projeto.','currency','Soma de contracted_revenue - discount_amount.','public.project_financial_plans','implemented',null,'optional',80),
  ('COM_STAGE_TIME_AVG_HOURS','commercial','Tempo médio entre etapas','Tempo médio entre mudanças de etapa comercial registradas.','hours','Média do intervalo entre eventos consecutivos stage_changed da mesma oportunidade.','public.commercial_opportunity_events','implemented',null,'optional',90),
  ('COM_WITHOUT_NEXT_ACTION','commercial','Oportunidades sem próxima ação','Oportunidades ativas P01–P13 sem próxima ação ou data.','count','Contagem de oportunidades ativas com next_action_title ou next_action_at ausente.','public.commercial_opportunities','implemented',null,'optional',100),
  ('COM_OVERDUE_FOLLOWUPS','commercial','Follow-ups vencidos','Próximas ações comerciais cuja data já passou.','count','Contagem de oportunidades ativas com next_action_at < now().','public.commercial_opportunities','implemented',null,'optional',110),
  ('COM_WEIGHTED_FORECAST','commercial','Forecast ponderado','Valor estimado do pipeline ponderado por probabilidade configurada por etapa.','currency','Soma de estimated_value × peso configurado para a etapa P01–P13.','public.commercial_opportunities + indicador parameter stage_weights','parameter_required','stage_weights','optional',120),

  ('OPS_TASKS_ON_TIME_PCT','operation','Tarefas concluídas no prazo','Percentual de tarefas com prazo concluídas até due_at.','percentage','Tarefas done com completed_at <= due_at ÷ tarefas done com due_at/completed_at × 100.','public.project_tasks','implemented',null,'optional',210),
  ('OPS_OVERDUE_TASKS','operation','Tarefas vencidas','Tarefas abertas com prazo passado.','count','Contagem de tarefas não done/cancelled com due_at < now().','public.project_tasks','implemented',null,'optional',220),
  ('OPS_BLOCKED_TASKS','operation','Tarefas bloqueadas','Tarefas atualmente em estado bloqueado/aguardando terceiro.','count','Contagem de tarefas em blocked, waiting_client ou waiting_partner.','public.project_tasks.status','implemented',null,'optional',230),
  ('OPS_BLOCKED_TIME_HOURS','operation','Tempo bloqueado','Tempo acumulado em estado de bloqueio.','hours','Soma dos intervalos de entrada/saída de estados bloqueados.','O schema atual preserva o estado corrente, mas não possui histórico temporal normalizado suficiente.','source_pending',null,'optional',240),
  ('OPS_APPROVAL_TIME_AVG_HOURS','operation','Tempo médio de aprovação','Tempo médio entre solicitação e resposta de aprovações.','hours','Média de responded_at - requested_at quando ambos existem.','public.approvals','implemented',null,'optional',250),
  ('OPS_REWORK_COUNT','operation','Retrabalho por correção','Solicitações classificadas como correção por erro.','count','Contagem de project_change_requests classification=error_correction.','public.project_change_requests','implemented',null,'optional',260),
  ('OPS_INCIDENTS_COUNT','operation','Incidentes','Incidentes operacionais formalmente registrados.','count','Contagem de incidentes vinculados à operação.','Ainda não existe entidade geral de incidentes com fonte operacional única.','source_pending',null,'optional',270),
  ('OPS_PARTNER_DELAY_COUNT','operation','Atrasos de parceiro','Entregas de parceiro concluídas após prazo comprometido.','count','Contagem de compromissos de parceiro entregues após prazo.','Os compromissos atuais possuem cotação/validade, mas não um marco de entrega normalizado comparável ao concluído.','source_pending',null,'optional',280),
  ('OPS_SCOPE_CHANGE_COUNT','operation','Mudanças de escopo','Solicitações classificadas como mudança de escopo.','count','Contagem de project_change_requests classification=scope_change.','public.project_change_requests','implemented',null,'optional',290),
  ('OPS_PROJECTS_COMPLETED','operation','Projetos concluídos','Projetos definitivamente encerrados.','count','Contagem de project_closures status=closed.','public.project_closures','implemented',null,'optional',300),
  ('OPS_PROJECT_CYCLE_AVG_DAYS','operation','Tempo médio de ciclo de projeto','Dias entre início planejado e fechamento definitivo.','days','Média de closed_at - start_date para projetos encerrados.','public.projects + public.project_closures','implemented',null,'optional',310),

  ('FIN_NET_CONTRACTED_REVENUE','financial','Receita líquida contratada','Receita contratada menos descontos registrados.','currency','Soma de contracted_revenue - discount_amount.','public.project_financial_plans','implemented',null,'optional',410),
  ('FIN_REALIZED_COSTS','financial','Custos realizados','Custos internos realizados e custos de caixa pagos.','currency','Soma de project_costs em realized ou paid.','public.project_costs','implemented',null,'optional',420),
  ('FIN_REALIZED_CONTRIBUTION','financial','Contribuição realizada','Receita líquida contratada menos custos realizados.','currency','FIN_NET_CONTRACTED_REVENUE - FIN_REALIZED_COSTS.','public.project_financial_plans + public.project_costs','implemented',null,'optional',430),
  ('FIN_REALIZED_MARGIN_PCT','financial','Margem realizada','Contribuição realizada como percentual da receita líquida contratada.','percentage','Contribuição realizada ÷ receita líquida contratada × 100.','public.project_financial_plans + public.project_costs','implemented',null,'optional',440),
  ('FIN_OPEN_RECEIVABLES','financial','Recebíveis abertos','Valores ainda não recebidos e não cancelados.','currency','Soma de receivables pending ou overdue.','public.receivables','implemented',null,'optional',450),
  ('FIN_OVERDUE_RECEIVABLES','financial','Inadimplência vencida','Recebíveis vencidos ainda não pagos.','currency','Soma de receivables overdue ou pending com due_date anterior a current_date.','public.receivables','implemented',null,'optional',460),
  ('FIN_CASH_RECEIVED','financial','Caixa recebido','Entradas de caixa confirmadas.','currency','Soma de receivables status=paid.','public.receivables','implemented',null,'optional',470),
  ('FIN_CASH_OUT','financial','Saídas de caixa','Custos com efeito caixa efetivamente pagos.','currency','Soma de project_costs status=paid e cash_effect=true.','public.project_costs','implemented',null,'optional',480),
  ('FIN_NET_CASH','financial','Caixa líquido','Entradas confirmadas menos saídas confirmadas.','currency','FIN_CASH_RECEIVED - FIN_CASH_OUT.','public.receivables + public.project_costs','implemented',null,'optional',490),
  ('FIN_PARTNER_REPASSES_PAID','financial','Pagamentos a parceiros','Custos de parceiro efetivamente pagos após gate de liberação.','currency','Soma de project_costs cost_type=partner e status=paid.','public.project_costs + public.partner_payment_releases','implemented',null,'optional',500),
  ('FIN_SOLUTION_PROFITABILITY','financial','Rentabilidade por solução','Receita, custo e margem por solução contratada.','percentage','Receita atribuída à solução menos custos atribuídos, dividido pela receita da solução.','Custos já podem apontar para solução, mas a receita contratada ainda não é alocada por solução.','source_pending',null,'optional',510),

  ('DIAG_AVG_MATURITY','diagnostic','Maturidade média atual','Média do índice de maturidade das versões diagnósticas atuais.','percentage','Média de maturity_index das current_collection_version_id.','public.diagnostic_overall_scores + public.diagnostics','implemented',null,'optional',610),
  ('DIAG_AVG_COMPLETENESS','diagnostic','Completude média atual','Média de completude das versões diagnósticas atuais.','percentage','Média de completeness_pct das current_collection_version_id.','public.diagnostic_overall_scores + public.diagnostics','implemented',null,'optional',620),
  ('DIAG_CRITICAL_FINDINGS','diagnostic','Achados críticos atuais','Achados críticos ainda não resolvidos/descartados nas versões atuais.','count','Contagem de findings critical nas coleções atuais, excluindo resolved/discarded.','public.diagnostic_findings_scored + public.diagnostics','implemented',null,'optional',630),
  ('DIAG_REASSESSMENT_EVOLUTION','diagnostic','Evolução na reavaliação','Variação média de maturidade entre os dois diagnósticos mais recentes da mesma empresa.','percentage','Média de maturity_index mais recente - maturity_index anterior para empresas com pelo menos duas medições.','public.diagnostics + public.diagnostic_overall_scores','implemented',null,'optional',640)
on conflict (code) do update set
  domain=excluded.domain,name=excluded.name,description=excluded.description,unit=excluded.unit,
  formula_description=excluded.formula_description,source_description=excluded.source_description,
  implementation_status=excluded.implementation_status,required_parameter_key=excluded.required_parameter_key,
  target_applicability=excluded.target_applicability,display_order=excluded.display_order,updated_at=now();

create or replace function public.validate_indicator_parameter_value()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  v_stage text;
  v_value numeric;
begin
  if new.indicator_code='COM_WEIGHTED_FORECAST' and new.parameter_key='stage_weights' then
    if jsonb_typeof(new.value_json)<>'object' then
      raise exception 'stage_weights must be a JSON object';
    end if;
    foreach v_stage in array array['P01','P02','P03','P04','P05','P06','P07','P08','P09','P10','P11','P12','P13'] loop
      if not (new.value_json ? v_stage) then raise exception 'stage_weights missing %',v_stage; end if;
      begin
        v_value := (new.value_json->>v_stage)::numeric;
      exception when others then
        raise exception 'stage_weights % must be numeric',v_stage;
      end;
      if v_value < 0 or v_value > 1 then raise exception 'stage_weights % must be between 0 and 1',v_stage; end if;
    end loop;
    if exists(select 1 from jsonb_object_keys(new.value_json) k where k <> all(array['P01','P02','P03','P04','P05','P06','P07','P08','P09','P10','P11','P12','P13'])) then
      raise exception 'stage_weights contains unsupported pipeline stage';
    end if;
  else
    raise exception 'unsupported indicator calculation parameter';
  end if;
  return new;
end;
$$;

drop trigger if exists indicator_parameters_validate_trg on public.indicator_parameters;
create trigger indicator_parameters_validate_trg
before insert or update of indicator_code,parameter_key,value_json on public.indicator_parameters
for each row execute function public.validate_indicator_parameter_value();

create or replace function public.set_global_indicator_target(
  p_indicator_code text,
  p_target_operator text,
  p_target_value numeric,
  p_target_value_max numeric,
  p_valid_from date,
  p_valid_until date,
  p_evidence_reference text,
  p_notes text,
  p_actor_label text
) returns uuid
language plpgsql
set search_path=public
as $$
declare
  v_definition public.indicator_definitions%rowtype;
  v_version integer;
  v_id uuid;
begin
  select * into v_definition from public.indicator_definitions where code=p_indicator_code;
  if not found then raise exception 'indicator definition not found'; end if;
  if v_definition.target_applicability='none' then raise exception 'indicator does not accept targets'; end if;
  if p_target_operator not in ('gte','lte','eq','between') then raise exception 'invalid target operator'; end if;
  if p_target_value is null then raise exception 'target value is required'; end if;
  if p_target_operator='between' and (p_target_value_max is null or p_target_value_max<p_target_value) then raise exception 'between target requires a valid maximum'; end if;
  if nullif(trim(coalesce(p_evidence_reference,'')),'') is null then raise exception 'target requires evidence/reference'; end if;
  if nullif(trim(coalesce(p_actor_label,'')),'') is null then raise exception 'target approver is required'; end if;
  if p_valid_until is not null and p_valid_from is not null and p_valid_until<p_valid_from then raise exception 'invalid target validity'; end if;

  update public.indicator_targets
    set is_current=false,status='retired',updated_at=now()
    where indicator_code=p_indicator_code and scope_type='global' and scope_id is null and is_current;

  select coalesce(max(version_number),0)+1 into v_version
  from public.indicator_targets
  where indicator_code=p_indicator_code and scope_type='global' and scope_id is null;

  insert into public.indicator_targets(
    indicator_code,scope_type,scope_id,version_number,is_current,target_operator,target_value,target_value_max,
    status,valid_from,valid_until,evidence_reference,approved_by_label,approved_at,notes
  ) values(
    p_indicator_code,'global',null,v_version,true,p_target_operator,p_target_value,
    case when p_target_operator='between' then p_target_value_max else null end,
    'active',p_valid_from,p_valid_until,trim(p_evidence_reference),trim(p_actor_label),now(),nullif(trim(coalesce(p_notes,'')),'')
  ) returning id into v_id;

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('indicator_target',v_id,'indicator_target_configured',public.commercial_audit_actor_type(p_actor_label),trim(p_actor_label),
    jsonb_build_object('indicator_code',p_indicator_code,'scope','global','version_number',v_version,'operator',p_target_operator,
      'target_value',p_target_value,'target_value_max',case when p_target_operator='between' then p_target_value_max else null end,
      'valid_from',p_valid_from,'valid_until',p_valid_until,'evidence_reference',trim(p_evidence_reference)));
  return v_id;
end;
$$;

create or replace function public.set_indicator_calculation_parameter(
  p_indicator_code text,
  p_parameter_key text,
  p_value_json jsonb,
  p_evidence_reference text,
  p_notes text,
  p_actor_label text
) returns uuid
language plpgsql
set search_path=public
as $$
declare
  v_definition public.indicator_definitions%rowtype;
  v_version integer;
  v_id uuid;
begin
  select * into v_definition from public.indicator_definitions where code=p_indicator_code;
  if not found then raise exception 'indicator definition not found'; end if;
  if v_definition.implementation_status<>'parameter_required' or v_definition.required_parameter_key is distinct from p_parameter_key then
    raise exception 'indicator does not accept this calculation parameter';
  end if;
  if p_value_json is null then raise exception 'parameter value is required'; end if;
  if nullif(trim(coalesce(p_evidence_reference,'')),'') is null then raise exception 'parameter requires evidence/reference'; end if;
  if nullif(trim(coalesce(p_actor_label,'')),'') is null then raise exception 'parameter approver is required'; end if;

  update public.indicator_parameters
    set is_current=false,status='retired',updated_at=now()
    where indicator_code=p_indicator_code and parameter_key=p_parameter_key and is_current;

  select coalesce(max(version_number),0)+1 into v_version
  from public.indicator_parameters where indicator_code=p_indicator_code and parameter_key=p_parameter_key;

  insert into public.indicator_parameters(
    indicator_code,parameter_key,version_number,is_current,value_json,status,evidence_reference,approved_by_label,approved_at,notes
  ) values(
    p_indicator_code,p_parameter_key,v_version,true,p_value_json,'active',trim(p_evidence_reference),trim(p_actor_label),now(),nullif(trim(coalesce(p_notes,'')),'')
  ) returning id into v_id;

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('indicator_parameter',v_id,'indicator_parameter_configured',public.commercial_audit_actor_type(p_actor_label),trim(p_actor_label),
    jsonb_build_object('indicator_code',p_indicator_code,'parameter_key',p_parameter_key,'version_number',v_version,
      'evidence_reference',trim(p_evidence_reference)));
  return v_id;
end;
$$;

create or replace view public.current_indicator_targets as
select t.*
from public.indicator_targets t
where t.is_current and t.status='active'
  and (t.valid_from is null or t.valid_from<=current_date)
  and (t.valid_until is null or t.valid_until>=current_date);

create or replace function public.current_indicator_parameter_json(p_indicator_code text,p_parameter_key text)
returns jsonb
language sql
stable
set search_path=public
as $$
  select p.value_json
  from public.indicator_parameters p
  where p.indicator_code=p_indicator_code and p.parameter_key=p_parameter_key and p.is_current and p.status='active'
  order by p.version_number desc
  limit 1
$$;

create or replace function public.current_commercial_weighted_forecast()
returns numeric
language plpgsql
stable
set search_path=public
as $$
declare
  v_weights jsonb;
  v_result numeric;
begin
  v_weights := public.current_indicator_parameter_json('COM_WEIGHTED_FORECAST','stage_weights');
  if v_weights is null then return null; end if;
  select coalesce(sum(coalesce(o.estimated_value,0) * ((v_weights->>o.pipeline_stage)::numeric)),0)
  into v_result
  from public.commercial_opportunities o
  where o.outcome_status is null and o.pipeline_stage in ('P01','P02','P03','P04','P05','P06','P07','P08','P09','P10','P11','P12','P13');
  return round(v_result,2);
end;
$$;

create or replace view public.blinko_indicator_values as
with
opp as (
  select
    count(*) filter (where substring(pipeline_stage from 2)::integer>=4) as qualified_or_beyond,
    count(*) filter (where outcome_status is not null) as closed_total,
    count(*) filter (where outcome_status='won') as won_total,
    count(*) filter (where outcome_status is null and (next_action_title is null or next_action_at is null)) as missing_next_action,
    count(*) filter (where outcome_status is null and next_action_at<now()) as overdue_followups
  from public.commercial_opportunities
),
stage_intervals as (
  select opportunity_id,occurred_at,lead(occurred_at) over(partition by opportunity_id order by occurred_at,id) as next_at
  from public.commercial_opportunity_events
  where event_type='stage_changed'
),
stage_stats as (
  select count(*) filter(where next_at is not null) as interval_count,
    avg(extract(epoch from (next_at-occurred_at))/3600.0) filter(where next_at is not null) as avg_hours
  from stage_intervals
),
task_stats as (
  select
    count(*) filter(where status='done' and due_at is not null and completed_at is not null) as completed_with_due,
    count(*) filter(where status='done' and due_at is not null and completed_at is not null and completed_at<=due_at) as completed_on_time,
    count(*) filter(where status not in ('done','cancelled') and due_at is not null and due_at<now()) as overdue,
    count(*) filter(where status in ('blocked','waiting_client','waiting_partner')) as blocked
  from public.project_tasks
),
approval_stats as (
  select count(*) filter(where requested_at is not null and responded_at is not null) as responded_count,
    avg(extract(epoch from (responded_at-requested_at))/3600.0) filter(where requested_at is not null and responded_at is not null) as avg_hours
  from public.approvals
),
project_stats as (
  select count(*) filter(where pc.status='closed') as closed_count,
    avg(extract(epoch from (pc.closed_at - p.start_date::timestamp))/86400.0) filter(where pc.status='closed' and pc.closed_at is not null and p.start_date is not null) as avg_cycle_days
  from public.projects p left join public.project_closures pc on pc.project_id=p.id
),
finance as (
  select
    (select count(*) from public.project_financial_plans) as plan_count,
    (select coalesce(sum(contracted_revenue-discount_amount),0) from public.project_financial_plans) as net_revenue,
    (select coalesce(sum(amount),0) from public.project_costs where status in ('realized','paid')) as realized_cost,
    (select coalesce(sum(amount),0) from public.receivables where status in ('pending','overdue')) as open_receivables,
    (select coalesce(sum(amount),0) from public.receivables where status in ('pending','overdue') and (status='overdue' or due_date<current_date)) as overdue_receivables,
    (select coalesce(sum(amount),0) from public.receivables where status='paid') as cash_received,
    (select coalesce(sum(amount),0) from public.project_costs where status='paid' and cash_effect) as cash_out,
    (select coalesce(sum(amount),0) from public.project_costs where status='paid' and cost_type='partner') as partner_paid
),
current_diag as (
  select dos.diagnostic_id,d.company_id,d.created_at,dos.maturity_index,dos.completeness_pct
  from public.diagnostic_overall_scores dos
  join public.diagnostics d on d.id=dos.diagnostic_id and d.current_collection_version_id=dos.collection_version_id
),
diag_stats as (
  select count(*) as score_count,avg(maturity_index) as avg_maturity,avg(completeness_pct) as avg_completeness from current_diag
),
ranked_diag as (
  select company_id,maturity_index,row_number() over(partition by company_id order by created_at desc,diagnostic_id desc) as rn
  from current_diag where company_id is not null and maturity_index is not null
),
reassessment as (
  select count(*) as company_count,avg(latest-previous) as avg_delta
  from (
    select company_id,max(maturity_index) filter(where rn=1) as latest,max(maturity_index) filter(where rn=2) as previous
    from ranked_diag where rn<=2 group by company_id
  ) x where previous is not null
),
critical_findings as (
  select count(*) as critical_count
  from public.diagnostic_findings_scored f
  join public.diagnostics d on d.id=f.diagnostic_id and d.current_collection_version_id=f.collection_version_id
  where f.criticality_band='critical' and f.status not in ('resolved','discarded')
)
select 'COM_LEADS_TOTAL'::text as indicator_code,(select count(*)::numeric from public.leads) as value_numeric,'calculated'::text as calculation_status,null::text as status_reason
union all select 'COM_QUALIFIED_OPPORTUNITIES',qualified_or_beyond::numeric,'calculated',null from opp
union all select 'COM_DIAGNOSTICS_TOTAL',(select count(*)::numeric from public.diagnostics),'calculated',null
union all select 'COM_PROPOSALS_TOTAL',(select count(*)::numeric from public.proposals),'calculated',null
union all select 'COM_ACCEPTED_PROPOSALS',(select count(*)::numeric from public.proposals where status='accepted'),'calculated',null
union all select 'COM_CONVERSION_PCT',case when closed_total>0 then round(won_total::numeric*100.0/closed_total,2) else null end,case when closed_total>0 then 'calculated' else 'insufficient_data' end,case when closed_total=0 then 'Nenhuma oportunidade possui outcome final.' else null end from opp
union all select 'COM_CONTRACTED_VALUE',case when plan_count>0 then net_revenue else null end,case when plan_count>0 then 'calculated' else 'insufficient_data' end,case when plan_count=0 then 'Nenhum plano financeiro de projeto foi registrado.' else null end from finance
union all select 'COM_STAGE_TIME_AVG_HOURS',case when interval_count>0 then round(avg_hours::numeric,2) else null end,case when interval_count>0 then 'calculated' else 'insufficient_data' end,case when interval_count=0 then 'Não existem dois eventos consecutivos de mudança de etapa para medir intervalo.' else null end from stage_stats
union all select 'COM_WITHOUT_NEXT_ACTION',missing_next_action::numeric,'calculated',null from opp
union all select 'COM_OVERDUE_FOLLOWUPS',overdue_followups::numeric,'calculated',null from opp
union all select 'COM_WEIGHTED_FORECAST',public.current_commercial_weighted_forecast(),case when public.current_indicator_parameter_json('COM_WEIGHTED_FORECAST','stage_weights') is null then 'parameter_not_configured' else 'calculated' end,case when public.current_indicator_parameter_json('COM_WEIGHTED_FORECAST','stage_weights') is null then 'Pesos P01–P13 ainda não foram formalmente configurados.' else null end
union all select 'OPS_TASKS_ON_TIME_PCT',case when completed_with_due>0 then round(completed_on_time::numeric*100.0/completed_with_due,2) else null end,case when completed_with_due>0 then 'calculated' else 'insufficient_data' end,case when completed_with_due=0 then 'Nenhuma tarefa concluída possui prazo e data de conclusão comparáveis.' else null end from task_stats
union all select 'OPS_OVERDUE_TASKS',overdue::numeric,'calculated',null from task_stats
union all select 'OPS_BLOCKED_TASKS',blocked::numeric,'calculated',null from task_stats
union all select 'OPS_APPROVAL_TIME_AVG_HOURS',case when responded_count>0 then round(avg_hours::numeric,2) else null end,case when responded_count>0 then 'calculated' else 'insufficient_data' end,case when responded_count=0 then 'Nenhuma aprovação respondida possui timestamps comparáveis.' else null end from approval_stats
union all select 'OPS_REWORK_COUNT',(select count(*)::numeric from public.project_change_requests where classification='error_correction'),'calculated',null
union all select 'OPS_SCOPE_CHANGE_COUNT',(select count(*)::numeric from public.project_change_requests where classification='scope_change'),'calculated',null
union all select 'OPS_PROJECTS_COMPLETED',closed_count::numeric,'calculated',null from project_stats
union all select 'OPS_PROJECT_CYCLE_AVG_DAYS',case when closed_count>0 and avg_cycle_days is not null then round(avg_cycle_days::numeric,2) else null end,case when closed_count>0 and avg_cycle_days is not null then 'calculated' else 'insufficient_data' end,case when closed_count=0 or avg_cycle_days is null then 'Nenhum projeto encerrado possui início e fechamento comparáveis.' else null end from project_stats
union all select 'FIN_NET_CONTRACTED_REVENUE',case when plan_count>0 then net_revenue else null end,case when plan_count>0 then 'calculated' else 'insufficient_data' end,case when plan_count=0 then 'Nenhum plano financeiro de projeto foi registrado.' else null end from finance
union all select 'FIN_REALIZED_COSTS',case when plan_count>0 then realized_cost else null end,case when plan_count>0 then 'calculated' else 'insufficient_data' end,case when plan_count=0 then 'Nenhum plano financeiro de projeto foi registrado.' else null end from finance
union all select 'FIN_REALIZED_CONTRIBUTION',case when plan_count>0 then net_revenue-realized_cost else null end,case when plan_count>0 then 'calculated' else 'insufficient_data' end,case when plan_count=0 then 'Nenhum plano financeiro de projeto foi registrado.' else null end from finance
union all select 'FIN_REALIZED_MARGIN_PCT',case when plan_count>0 and net_revenue>0 then round((net_revenue-realized_cost)*100.0/net_revenue,2) else null end,case when plan_count>0 and net_revenue>0 then 'calculated' else 'insufficient_data' end,case when plan_count=0 then 'Nenhum plano financeiro de projeto foi registrado.' when net_revenue<=0 then 'Receita líquida contratada precisa ser maior que zero para calcular margem.' else null end from finance
union all select 'FIN_OPEN_RECEIVABLES',open_receivables,'calculated',null from finance
union all select 'FIN_OVERDUE_RECEIVABLES',overdue_receivables,'calculated',null from finance
union all select 'FIN_CASH_RECEIVED',cash_received,'calculated',null from finance
union all select 'FIN_CASH_OUT',cash_out,'calculated',null from finance
union all select 'FIN_NET_CASH',cash_received-cash_out,'calculated',null from finance
union all select 'FIN_PARTNER_REPASSES_PAID',partner_paid,'calculated',null from finance
union all select 'DIAG_AVG_MATURITY',case when score_count>0 then round(avg_maturity::numeric,2) else null end,case when score_count>0 then 'calculated' else 'insufficient_data' end,case when score_count=0 then 'Nenhum diagnóstico possui score da coleção atual.' else null end from diag_stats
union all select 'DIAG_AVG_COMPLETENESS',case when score_count>0 then round(avg_completeness::numeric,2) else null end,case when score_count>0 then 'calculated' else 'insufficient_data' end,case when score_count=0 then 'Nenhum diagnóstico possui score da coleção atual.' else null end from diag_stats
union all select 'DIAG_CRITICAL_FINDINGS',critical_count::numeric,'calculated',null from critical_findings
union all select 'DIAG_REASSESSMENT_EVOLUTION',case when company_count>0 then round(avg_delta::numeric,2) else null end,case when company_count>0 then 'calculated' else 'insufficient_data' end,case when company_count=0 then 'Nenhuma empresa possui duas medições diagnósticas atuais comparáveis.' else null end from reassessment;

create or replace view public.blinko_indicator_snapshot as
select
  d.code as indicator_code,
  d.domain,
  d.name,
  d.description,
  d.unit,
  d.formula_description,
  d.source_description,
  d.implementation_status,
  d.required_parameter_key,
  d.display_order,
  case
    when d.implementation_status='source_pending' then null
    else v.value_numeric
  end as value_numeric,
  case
    when d.implementation_status='source_pending' then 'source_not_available'
    when v.indicator_code is null then 'source_not_available'
    else v.calculation_status
  end as calculation_status,
  case
    when d.implementation_status='source_pending' then d.source_description
    when v.indicator_code is null then 'Indicador sem implementação de cálculo vinculada.'
    else v.status_reason
  end as status_reason,
  case
    when d.target_applicability='none' then 'not_applicable'
    when t.id is null then 'not_configured'
    else 'configured'
  end as target_status,
  t.id as target_id,
  t.version_number as target_version,
  t.target_operator,
  t.target_value,
  t.target_value_max,
  t.evidence_reference as target_evidence_reference,
  case
    when (case when d.implementation_status='source_pending' then 'source_not_available' when v.indicator_code is null then 'source_not_available' else v.calculation_status end)<>'calculated' then 'unknown'
    when d.target_applicability='none' or t.id is null then 'unknown'
    when t.target_operator='gte' and v.value_numeric>=t.target_value then 'on_target'
    when t.target_operator='lte' and v.value_numeric<=t.target_value then 'on_target'
    when t.target_operator='eq' and v.value_numeric=t.target_value then 'on_target'
    when t.target_operator='between' and v.value_numeric between t.target_value and t.target_value_max then 'on_target'
    else 'off_target'
  end as performance_status
from public.indicator_definitions d
left join public.blinko_indicator_values v on v.indicator_code=d.code
left join public.current_indicator_targets t on t.indicator_code=d.code and t.scope_type='global' and t.scope_id is null
order by d.display_order,d.code;

create or replace view public.blinko_leads_by_source as
select coalesce(nullif(trim(source),''),'não informado') as source,count(*)::bigint as lead_count
from public.leads group by 1 order by lead_count desc,source;

create or replace view public.blinko_losses_by_reason as
select coalesce(loss_reason,'sem motivo categorizado') as loss_reason,count(*)::bigint as opportunity_count
from public.commercial_opportunities
where outcome_status='lost'
group by 1 order by opportunity_count desc,loss_reason;

create or replace view public.blinko_operational_block_breakdown as
select
  case status when 'waiting_client' then 'cliente' when 'waiting_partner' then 'parceiro' when 'blocked' then 'interno/outro' else status end as blocking_source,
  count(*)::bigint as task_count
from public.project_tasks
where status in ('blocked','waiting_client','waiting_partner')
group by 1 order by task_count desc,blocking_source;

create or replace view public.blinko_finance_by_project as
select
  p.id as project_id,
  p.company_id,
  c.name as company_name,
  p.objective,
  p.status as project_status,
  fs.contracted_revenue,
  fs.discount_amount,
  fs.realized_total_cost,
  fs.realized_contribution,
  fs.realized_margin_pct,
  fs.cash_received,
  fs.cash_cost_paid,
  fs.open_receivables,
  fs.open_or_estimated_cost
from public.projects p
join public.companies c on c.id=p.company_id
left join public.project_financial_summary fs on fs.project_id=p.id;

create or replace view public.blinko_finance_by_company as
with revenue as (
  select company_id,sum(contracted_revenue-discount_amount) as net_revenue from public.project_financial_plans group by company_id
),costs as (
  select company_id,sum(amount) filter(where status in ('realized','paid')) as realized_cost,
    sum(amount) filter(where status='paid' and cash_effect) as cash_out
  from public.project_costs group by company_id
),receipts as (
  select company_id,sum(amount) filter(where status='paid') as cash_received,
    sum(amount) filter(where status in ('pending','overdue')) as open_receivables,
    sum(amount) filter(where status in ('pending','overdue') and (status='overdue' or due_date<current_date)) as overdue_receivables
  from public.receivables group by company_id
)
select c.id as company_id,c.name as company_name,
  coalesce(r.net_revenue,0) as net_revenue,
  coalesce(k.realized_cost,0) as realized_cost,
  coalesce(r.net_revenue,0)-coalesce(k.realized_cost,0) as realized_contribution,
  case when coalesce(r.net_revenue,0)>0 then round((coalesce(r.net_revenue,0)-coalesce(k.realized_cost,0))*100.0/r.net_revenue,2) else null end as realized_margin_pct,
  coalesce(rc.cash_received,0) as cash_received,
  coalesce(k.cash_out,0) as cash_out,
  coalesce(rc.cash_received,0)-coalesce(k.cash_out,0) as net_cash,
  coalesce(rc.open_receivables,0) as open_receivables,
  coalesce(rc.overdue_receivables,0) as overdue_receivables
from public.companies c
left join revenue r on r.company_id=c.id
left join costs k on k.company_id=c.id
left join receipts rc on rc.company_id=c.id
where r.company_id is not null or k.company_id is not null or rc.company_id is not null;

create or replace view public.blinko_diagnostic_by_pillar as
select ps.pillar_code,ps.name,
  count(*)::bigint as diagnostic_count,
  round(avg(ps.maturity_index)::numeric,2) as avg_maturity,
  round(avg(ps.completeness_pct)::numeric,2) as avg_completeness,
  count(*) filter(where ps.pillar_status='INCONCLUSIVE')::bigint as inconclusive_count
from public.diagnostic_pillar_scores ps
join public.diagnostics d on d.id=ps.diagnostic_id and d.current_collection_version_id=ps.collection_version_id
group by ps.pillar_code,ps.name,ps.position
order by ps.position;
