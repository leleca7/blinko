-- Blinko OS — Regras financeiras de parceiro + compromisso pré-projeto
-- Fontes: Documento 04 — Catálogo de Soluções e Parceiros; Documento 07 — Financeiro e Indicadores.
-- Depende de 025, 027, 030–033 e 037.
-- Produção/main não deve receber esta migração sem promoção controlada.

create table if not exists public.partner_financial_rules (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete restrict,
  blueprint_id uuid references public.solution_blueprints(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  is_current boolean not null default true,
  remuneration_model text not null default 'to_define'
    check (remuneration_model in ('to_define','PRF01','PRF02','PRF03','PRF04','PRF05','PRF06','PRF07')),
  calculation_base_status text not null default 'to_define'
    check (calculation_base_status in ('to_define','defined','not_applicable')),
  calculation_base_description text,
  percentage_value numeric(8,4) check (percentage_value is null or (percentage_value >= 0 and percentage_value <= 100)),
  fixed_amount numeric(14,2) check (fixed_amount is null or fixed_amount >= 0),
  client_billing_party text not null default 'to_define'
    check (client_billing_party in ('blinko','partner','shared','other','to_define')),
  supplier_payment_party text not null default 'to_define'
    check (supplier_payment_party in ('blinko','partner','shared','other','to_define')),
  transfer_timing text,
  release_condition text,
  required_document text,
  extra_cost_responsibility text,
  cancellation_refund_rule text,
  valid_from date,
  valid_until date,
  formalization_status text not null default 'pending'
    check (formalization_status in ('draft','pending','approved','expired','cancelled')),
  formalization_reference text,
  approval_evidence text,
  approved_by_label text,
  approved_at timestamptz,
  notes text,
  source_document text not null default '07 — BLINKO — FINANCEIRO E INDICADORES',
  source_version text not null default 'v1.0 — 09/09/2026',
  created_by_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until is null or valid_from is null or valid_until >= valid_from),
  check (formalization_status <> 'approved' or (approved_at is not null and nullif(trim(coalesce(approval_evidence,'')),'') is not null))
);

create unique index if not exists partner_financial_rules_version_solution_uidx
  on public.partner_financial_rules(partner_id,blueprint_id,version_number)
  where blueprint_id is not null;
create unique index if not exists partner_financial_rules_version_general_uidx
  on public.partner_financial_rules(partner_id,version_number)
  where blueprint_id is null;
create unique index if not exists partner_financial_rules_current_solution_uidx
  on public.partner_financial_rules(partner_id,blueprint_id)
  where is_current and blueprint_id is not null;
create unique index if not exists partner_financial_rules_current_general_uidx
  on public.partner_financial_rules(partner_id)
  where is_current and blueprint_id is null;
create index if not exists partner_financial_rules_lookup_idx
  on public.partner_financial_rules(partner_id,formalization_status,is_current,valid_until);

create or replace function public.partner_financial_rule_is_current_valid(p_rule_id uuid)
returns boolean
language sql
stable
set search_path=public
as $$
  select coalesce((
    select r.is_current
      and r.formalization_status='approved'
      and (r.valid_from is null or r.valid_from <= current_date)
      and (r.valid_until is null or r.valid_until >= current_date)
      and r.remuneration_model <> 'to_define'
    from public.partner_financial_rules r where r.id=p_rule_id
  ),false)
$$;

create or replace function public.partner_financial_rule_auto_calculable(p_rule_id uuid)
returns boolean
language sql
stable
set search_path=public
as $$
  select coalesce((
    select public.partner_financial_rule_is_current_valid(r.id)
      and case
        when r.remuneration_model in ('PRF01','PRF04') then r.fixed_amount is not null
        when r.remuneration_model in ('PRF02','PRF03','PRF05') then
          r.percentage_value is not null
          and r.calculation_base_status='defined'
          and nullif(trim(coalesce(r.calculation_base_description,'')),'') is not null
        else false
      end
    from public.partner_financial_rules r where r.id=p_rule_id
  ),false)
$$;

create or replace function public.calculate_partner_rule_amount(p_rule_id uuid,p_base_amount numeric)
returns numeric
language plpgsql
stable
set search_path=public
as $$
declare v_rule public.partner_financial_rules%rowtype;
begin
  select * into v_rule from public.partner_financial_rules where id=p_rule_id;
  if not found then raise exception 'partner financial rule not found'; end if;
  if not public.partner_financial_rule_auto_calculable(p_rule_id) then
    raise exception 'BLOQUEADO: cálculo automático de repasse indisponível enquanto a regra financeira estiver incompleta';
  end if;

  if v_rule.remuneration_model in ('PRF01','PRF04') then return v_rule.fixed_amount; end if;
  if p_base_amount is null or p_base_amount < 0 then raise exception 'calculation base amount is required'; end if;
  if v_rule.remuneration_model in ('PRF02','PRF03','PRF05') then
    return round(p_base_amount * v_rule.percentage_value / 100.0,2);
  end if;
  raise exception 'automatic calculation is not implemented for remuneration model %',v_rule.remuneration_model;
end;
$$;

create table if not exists public.proposal_partner_commitments (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.commercial_opportunities(id) on delete restrict,
  proposal_id uuid not null references public.proposals(id) on delete restrict,
  proposal_version_id uuid not null references public.proposal_versions(id) on delete restrict,
  intervention_id uuid not null references public.diagnostic_interventions(id) on delete restrict,
  blueprint_id uuid not null references public.solution_blueprints(id) on delete restrict,
  partner_id uuid not null references public.partners(id) on delete restrict,
  partner_capability_id uuid references public.partner_solution_capabilities(id) on delete restrict,
  financial_rule_id uuid references public.partner_financial_rules(id) on delete restrict,
  execution_route text not null check (execution_route in ('R2','R3','R5')),
  blinko_role text not null,
  quote_reference text not null,
  quoted_at timestamptz not null,
  quote_valid_until timestamptz,
  quoted_cost_to_blinko numeric(14,2) check (quoted_cost_to_blinko is null or quoted_cost_to_blinko >= 0),
  blinko_payment_obligation boolean not null default false,
  payment_terms_snapshot text,
  condition_evidence text,
  approval_scope text not null default 'standard'
    check (approval_scope in ('standard','pilot_exception','restricted_exception')),
  validation_status text not null default 'pending'
    check (validation_status in ('pending','approved','rejected','expired','cancelled')),
  validation_evidence text,
  approved_by_label text,
  approved_at timestamptz,
  is_current boolean not null default true,
  notes text,
  created_by_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (nullif(trim(blinko_role),'') is not null),
  check (nullif(trim(quote_reference),'') is not null),
  check (quote_valid_until is null or quote_valid_until >= quoted_at),
  check (not blinko_payment_obligation or quoted_cost_to_blinko is not null),
  check (validation_status <> 'approved' or (approved_at is not null and nullif(trim(coalesce(validation_evidence,'')),'') is not null))
);

create unique index if not exists proposal_partner_commitments_current_intervention_uidx
  on public.proposal_partner_commitments(proposal_version_id,intervention_id)
  where is_current;
create index if not exists proposal_partner_commitments_opportunity_idx
  on public.proposal_partner_commitments(opportunity_id,validation_status,is_current);
create index if not exists proposal_partner_commitments_partner_idx
  on public.proposal_partner_commitments(partner_id,created_at desc);

create or replace function public.proposal_route_requires_external_partner(p_route text)
returns boolean language sql immutable as $$
  select p_route in ('R2','R3','R5')
$$;

create or replace function public.proposal_intervention_route_is_ready(p_proposal_id uuid,p_intervention_id uuid)
returns boolean
language sql
stable
set search_path=public
as $$
  select coalesce((
    select i.selected_execution_route is not null
      and i.selected_execution_route = any(b.execution_routes)
    from public.proposals p
    join public.proposal_versions pv on pv.id=p.current_version_id
    join public.diagnostic_interventions i on i.id=p_intervention_id
    join public.solution_blueprints b on b.id=i.blueprint_id
    where p.id=p_proposal_id
      and i.id in (select value::uuid from jsonb_array_elements_text(pv.intervention_ids))
  ),false)
$$;

create or replace function public.proposal_partner_commitment_is_ready(p_commitment_id uuid)
returns boolean
language sql
stable
set search_path=public
as $$
  select coalesce((
    select pc.is_current
      and pc.validation_status='approved'
      and (pc.quote_valid_until is null or pc.quote_valid_until >= now())
      and pc.execution_route in ('R2','R3','R5')
      and pc.execution_route=i.selected_execution_route
      and pc.blueprint_id=i.blueprint_id
      and pc.partner_id=cap.partner_id
      and cap.blueprint_id=pc.blueprint_id
      and cap.status in ('pilot','enabled','restricted')
      and (cap.valid_from is null or cap.valid_from <= current_date)
      and (cap.valid_until is null or cap.valid_until >= current_date)
      and public.partner_operational_eligibility(pc.partner_id) in ('eligible','pilot_requires_project_approval','restricted_requires_scope_check')
      and case public.partner_operational_eligibility(pc.partner_id)
        when 'eligible' then pc.approval_scope='standard'
        when 'pilot_requires_project_approval' then pc.approval_scope='pilot_exception'
        when 'restricted_requires_scope_check' then pc.approval_scope='restricted_exception'
        else false
      end
      and (pc.financial_rule_id is null or exists(
        select 1 from public.partner_financial_rules r
        where r.id=pc.financial_rule_id
          and r.partner_id=pc.partner_id
          and (r.blueprint_id is null or r.blueprint_id=pc.blueprint_id)
      ))
    from public.proposal_partner_commitments pc
    join public.diagnostic_interventions i on i.id=pc.intervention_id
    join public.partner_solution_capabilities cap on cap.id=pc.partner_capability_id
    where pc.id=p_commitment_id
  ),false)
$$;

create or replace function public.proposal_partner_requirements_ready(p_proposal_id uuid)
returns boolean
language plpgsql
stable
set search_path=public
as $$
declare v_version_id uuid;v_item text;v_route text;v_commitment_id uuid;
begin
  select current_version_id into v_version_id from public.proposals where id=p_proposal_id;
  if v_version_id is null then return false; end if;

  for v_item in select value from jsonb_array_elements_text((select intervention_ids from public.proposal_versions where id=v_version_id)) loop
    if not public.proposal_intervention_route_is_ready(p_proposal_id,v_item::uuid) then return false; end if;
    select selected_execution_route into v_route from public.diagnostic_interventions where id=v_item::uuid;
    if public.proposal_route_requires_external_partner(v_route) then
      select id into v_commitment_id
      from public.proposal_partner_commitments
      where proposal_version_id=v_version_id and intervention_id=v_item::uuid and is_current
      limit 1;
      if v_commitment_id is null or not public.proposal_partner_commitment_is_ready(v_commitment_id) then return false; end if;
    end if;
  end loop;
  return true;
end;
$$;

create or replace function public.set_proposal_intervention_route(
  p_proposal_id uuid,p_intervention_id uuid,p_route text,p_actor_label text
) returns uuid
language plpgsql
set search_path=public
as $$
declare v_status text;v_version_id uuid;v_blueprint_id uuid;v_allowed text[];v_opportunity_id uuid;
begin
  select status,current_version_id,opportunity_id into v_status,v_version_id,v_opportunity_id
  from public.proposals where id=p_proposal_id for update;
  if v_version_id is null then raise exception 'proposal with current version is required'; end if;
  if v_status not in ('draft','internal_review') then raise exception 'execution route can only be changed before internal approval'; end if;

  select i.blueprint_id,b.execution_routes into v_blueprint_id,v_allowed
  from public.diagnostic_interventions i
  join public.solution_blueprints b on b.id=i.blueprint_id
  where i.id=p_intervention_id
    and i.id in (select value::uuid from jsonb_array_elements_text((select intervention_ids from public.proposal_versions where id=v_version_id)));
  if v_blueprint_id is null then raise exception 'proposal intervention with official solution is required'; end if;
  if p_route is null or not (p_route=any(v_allowed)) then raise exception 'execution route is not allowed for this solution'; end if;

  update public.diagnostic_interventions set selected_execution_route=p_route,updated_at=now() where id=p_intervention_id;

  update public.proposal_partner_commitments
    set is_current=false,validation_status=case when validation_status='approved' then 'cancelled' else validation_status end,
        notes=concat_ws(' | ',notes,'Superseded because proposal execution route changed.'),updated_at=now()
  where proposal_version_id=v_version_id and intervention_id=p_intervention_id and is_current and execution_route<>p_route;

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('proposal',p_proposal_id,'proposal_execution_route_selected',public.commercial_audit_actor_type(p_actor_label),
    coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),
    jsonb_build_object('proposal_version_id',v_version_id,'intervention_id',p_intervention_id,'route',p_route));

  if v_opportunity_id is not null then
    perform public.sync_commercial_partner_start_conditions(v_opportunity_id,p_actor_label);
  end if;
  return p_intervention_id;
end;
$$;

create or replace function public.record_proposal_partner_commitment(
  p_proposal_id uuid,
  p_intervention_id uuid,
  p_partner_id uuid,
  p_execution_route text,
  p_blinko_role text,
  p_quote_reference text,
  p_quoted_at timestamptz,
  p_quote_valid_until timestamptz,
  p_quoted_cost_to_blinko numeric,
  p_blinko_payment_obligation boolean,
  p_payment_terms_snapshot text,
  p_financial_rule_id uuid,
  p_approval_scope text,
  p_condition_evidence text,
  p_notes text,
  p_actor_label text
) returns uuid
language plpgsql
set search_path=public
as $$
declare
  v_status text;v_version_id uuid;v_opportunity_id uuid;v_blueprint_id uuid;v_route text;v_capability_id uuid;v_id uuid;
begin
  select status,current_version_id,opportunity_id into v_status,v_version_id,v_opportunity_id
  from public.proposals where id=p_proposal_id for update;
  if v_version_id is null or v_opportunity_id is null then raise exception 'proposal linked to opportunity with current version is required'; end if;
  if v_status not in ('draft','internal_review') then raise exception 'partner commitment can only be recorded before internal approval'; end if;
  if p_execution_route not in ('R2','R3','R5') then raise exception 'partner commitment requires external execution route R2, R3 or R5'; end if;
  if p_approval_scope not in ('standard','pilot_exception','restricted_exception') then raise exception 'invalid partner approval scope'; end if;
  if nullif(trim(coalesce(p_blinko_role,'')),'') is null then raise exception 'Blinko role is required'; end if;
  if nullif(trim(coalesce(p_quote_reference,'')),'') is null or p_quoted_at is null then raise exception 'partner quote reference and date are required'; end if;
  if p_quote_valid_until is not null and p_quote_valid_until < p_quoted_at then raise exception 'invalid quote validity'; end if;
  if coalesce(p_blinko_payment_obligation,false) and p_quoted_cost_to_blinko is null then raise exception 'Blinko payment obligation requires quoted partner cost'; end if;

  select i.blueprint_id,i.selected_execution_route into v_blueprint_id,v_route
  from public.diagnostic_interventions i
  where i.id=p_intervention_id
    and i.id in (select value::uuid from jsonb_array_elements_text((select intervention_ids from public.proposal_versions where id=v_version_id)));
  if v_blueprint_id is null then raise exception 'proposal intervention with official solution is required'; end if;
  if v_route is distinct from p_execution_route then raise exception 'partner commitment route must match selected proposal route'; end if;

  select id into v_capability_id from public.partner_solution_capabilities
  where partner_id=p_partner_id and blueprint_id=v_blueprint_id limit 1;
  if v_capability_id is null then raise exception 'partner is not registered for this solution'; end if;

  if p_financial_rule_id is not null and not exists(
    select 1 from public.partner_financial_rules r
    where r.id=p_financial_rule_id and r.partner_id=p_partner_id and (r.blueprint_id is null or r.blueprint_id=v_blueprint_id)
  ) then raise exception 'financial rule does not belong to partner/solution'; end if;

  update public.proposal_partner_commitments set is_current=false,updated_at=now()
  where proposal_version_id=v_version_id and intervention_id=p_intervention_id and is_current;

  insert into public.proposal_partner_commitments(
    opportunity_id,proposal_id,proposal_version_id,intervention_id,blueprint_id,partner_id,partner_capability_id,
    financial_rule_id,execution_route,blinko_role,quote_reference,quoted_at,quote_valid_until,quoted_cost_to_blinko,
    blinko_payment_obligation,payment_terms_snapshot,condition_evidence,approval_scope,validation_status,is_current,notes,created_by_label
  ) values(
    v_opportunity_id,p_proposal_id,v_version_id,p_intervention_id,v_blueprint_id,p_partner_id,v_capability_id,
    p_financial_rule_id,p_execution_route,trim(p_blinko_role),trim(p_quote_reference),p_quoted_at,p_quote_valid_until,p_quoted_cost_to_blinko,
    coalesce(p_blinko_payment_obligation,false),nullif(trim(coalesce(p_payment_terms_snapshot,'')),''),
    nullif(trim(coalesce(p_condition_evidence,'')),''),p_approval_scope,'pending',true,
    nullif(trim(coalesce(p_notes,'')),''),nullif(trim(coalesce(p_actor_label,'')),'')
  ) returning id into v_id;

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('proposal_partner_commitment',v_id,'proposal_partner_commitment_recorded',public.commercial_audit_actor_type(p_actor_label),
    coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),
    jsonb_build_object('proposal_id',p_proposal_id,'proposal_version_id',v_version_id,'intervention_id',p_intervention_id,
      'partner_id',p_partner_id,'route',p_execution_route,'quote_reference',p_quote_reference,'blinko_payment_obligation',coalesce(p_blinko_payment_obligation,false)));

  perform public.sync_commercial_partner_start_conditions(v_opportunity_id,p_actor_label);
  return v_id;
end;
$$;

create or replace function public.approve_proposal_partner_commitment(
  p_commitment_id uuid,p_validation_evidence text,p_actor_label text
) returns uuid
language plpgsql
set search_path=public
as $$
declare v_pc public.proposal_partner_commitments%rowtype;v_eligibility text;v_cap_status text;v_partner_registration text;
begin
  select * into v_pc from public.proposal_partner_commitments where id=p_commitment_id for update;
  if not found then raise exception 'partner commitment not found'; end if;
  if not v_pc.is_current or v_pc.validation_status<>'pending' then raise exception 'partner commitment is not pending current validation'; end if;
  if nullif(trim(coalesce(p_validation_evidence,'')),'') is null then raise exception 'partner approval requires validation evidence'; end if;
  if v_pc.quote_valid_until is not null and v_pc.quote_valid_until < now() then
    update public.proposal_partner_commitments set validation_status='expired',updated_at=now() where id=v_pc.id;
    raise exception 'partner quote is expired';
  end if;

  v_eligibility:=public.partner_operational_eligibility(v_pc.partner_id);
  select status into v_cap_status from public.partner_solution_capabilities where id=v_pc.partner_capability_id;
  select registration_status into v_partner_registration from public.partners where id=v_pc.partner_id;

  if v_partner_registration='pending' or v_eligibility in ('registration_pending','validation_incomplete','blocked','not_found') then
    raise exception 'BLOQUEADO: parceiro ainda não possui elegibilidade mínima para este compromisso';
  end if;
  if v_cap_status not in ('pilot','enabled','restricted') then raise exception 'BLOQUEADO: capacidade do parceiro não está liberada para esta solução'; end if;
  if v_eligibility='eligible' and v_pc.approval_scope<>'standard' then raise exception 'eligible partner must use standard approval'; end if;
  if v_eligibility='pilot_requires_project_approval' and v_pc.approval_scope<>'pilot_exception' then raise exception 'pilot partner requires explicit pilot exception'; end if;
  if v_eligibility='restricted_requires_scope_check' and v_pc.approval_scope<>'restricted_exception' then raise exception 'restricted partner requires explicit restricted-scope approval'; end if;

  update public.proposal_partner_commitments
  set validation_status='approved',validation_evidence=trim(p_validation_evidence),approved_by_label=nullif(trim(coalesce(p_actor_label,'')),''),approved_at=now(),updated_at=now()
  where id=v_pc.id;

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('proposal_partner_commitment',v_pc.id,'proposal_partner_commitment_approved',public.commercial_audit_actor_type(p_actor_label),
    coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),
    jsonb_build_object('proposal_id',v_pc.proposal_id,'partner_id',v_pc.partner_id,'route',v_pc.execution_route,
      'approval_scope',v_pc.approval_scope,'operational_eligibility',v_eligibility));

  perform public.sync_commercial_partner_start_conditions(v_pc.opportunity_id,p_actor_label);
  return v_pc.id;
end;
$$;

create or replace function public.sync_commercial_partner_start_conditions(p_opportunity_id uuid,p_actor_label text default 'system')
returns void
language plpgsql
set search_path=public
as $$
declare v_proposal_id uuid;v_version_id uuid;v_routes_complete boolean:=false;v_partner_required boolean:=false;v_partner_ready boolean:=false;v_count integer:=0;v_ready_count integer:=0;
begin
  select p.id,p.current_version_id into v_proposal_id,v_version_id
  from public.proposals p where p.opportunity_id=p_opportunity_id order by p.created_at desc limit 1;

  insert into public.commercial_start_conditions(opportunity_id,condition_code,label,category,requirement,status,source_type)
  values
    (p_opportunity_id,'execution_routes','Rotas de execução definidas','solution','required','pending','proposal'),
    (p_opportunity_id,'partner_validation','Parceiro/custo/condição validados quando necessário','partner','to_define','pending','partner')
  on conflict(opportunity_id,condition_code) do nothing;

  if v_proposal_id is null or v_version_id is null then
    update public.commercial_start_conditions set requirement='required',status='pending',evidence=null,source_reference=null,satisfied_at=null,satisfied_by_label=null,updated_at=now()
      where opportunity_id=p_opportunity_id and condition_code='execution_routes';
    update public.commercial_start_conditions set requirement='to_define',status='pending',evidence=null,source_reference=null,satisfied_at=null,satisfied_by_label=null,updated_at=now()
      where opportunity_id=p_opportunity_id and condition_code='partner_validation';
    return;
  end if;

  select count(*) into v_count from jsonb_array_elements_text((select intervention_ids from public.proposal_versions where id=v_version_id));
  select count(*) into v_ready_count
  from jsonb_array_elements_text((select intervention_ids from public.proposal_versions where id=v_version_id)) x
  join public.diagnostic_interventions i on i.id=x.value::uuid
  join public.solution_blueprints b on b.id=i.blueprint_id
  where i.selected_execution_route is not null and i.selected_execution_route=any(b.execution_routes);
  v_routes_complete:=v_count>0 and v_count=v_ready_count;

  update public.commercial_start_conditions
  set requirement='required',status=case when v_routes_complete then 'satisfied' else 'pending' end,
      source_reference=v_version_id::text,
      evidence=case when v_routes_complete then 'Todas as intervenções da proposta possuem rota de execução compatível com o catálogo oficial.' else null end,
      satisfied_at=case when v_routes_complete then now() else null end,
      satisfied_by_label=case when v_routes_complete then coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'system') else null end,
      updated_at=now()
  where opportunity_id=p_opportunity_id and condition_code='execution_routes';

  if not v_routes_complete then
    update public.commercial_start_conditions set requirement='to_define',status='pending',source_reference=v_version_id::text,evidence=null,satisfied_at=null,satisfied_by_label=null,updated_at=now()
      where opportunity_id=p_opportunity_id and condition_code='partner_validation';
    return;
  end if;

  select exists(
    select 1 from jsonb_array_elements_text((select intervention_ids from public.proposal_versions where id=v_version_id)) x
    join public.diagnostic_interventions i on i.id=x.value::uuid
    where public.proposal_route_requires_external_partner(i.selected_execution_route)
  ) into v_partner_required;

  if not v_partner_required then
    update public.commercial_start_conditions
    set requirement='not_required',status='not_applicable',source_reference=v_version_id::text,
        evidence='As rotas escolhidas não exigem parceiro/terceiro comprometido antes do projeto.',satisfied_at=now(),
        satisfied_by_label=coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'system'),updated_at=now()
    where opportunity_id=p_opportunity_id and condition_code='partner_validation';
    return;
  end if;

  select not exists(
    select 1
    from jsonb_array_elements_text((select intervention_ids from public.proposal_versions where id=v_version_id)) x
    join public.diagnostic_interventions i on i.id=x.value::uuid
    where public.proposal_route_requires_external_partner(i.selected_execution_route)
      and not exists(
        select 1 from public.proposal_partner_commitments pc
        where pc.proposal_version_id=v_version_id and pc.intervention_id=i.id and pc.is_current
          and public.proposal_partner_commitment_is_ready(pc.id)
      )
  ) into v_partner_ready;

  update public.commercial_start_conditions
  set requirement='required',status=case when v_partner_ready then 'satisfied' else 'pending' end,
      source_reference=v_version_id::text,
      evidence=case when v_partner_ready then 'Todos os terceiros exigidos pela rota possuem compromisso aprovado, cotação vigente e validação compatível com o status do parceiro.' else null end,
      satisfied_at=case when v_partner_ready then now() else null end,
      satisfied_by_label=case when v_partner_ready then coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'system') else null end,
      updated_at=now()
  where opportunity_id=p_opportunity_id and condition_code='partner_validation';
end;
$$;

-- Recria o ensure para acrescentar os gates automáticos de rota/parceiro e preservar os gates anteriores.
create or replace function public.ensure_commercial_start_conditions(p_opportunity_id uuid)
returns void language plpgsql set search_path=public as $$
begin
  if not exists(select 1 from public.commercial_opportunities where id=p_opportunity_id) then raise exception 'opportunity not found'; end if;
  insert into public.commercial_start_conditions(opportunity_id,condition_code,label,category,requirement,status,source_type)
  values
    (p_opportunity_id,'contract_valid','Contrato/aceite válido','formalization','required','pending','contract'),
    (p_opportunity_id,'financial_condition','Pagamento/sinal ou condição financeira de início','financial','to_define','pending','finance'),
    (p_opportunity_id,'company_registration','Cadastro mínimo da empresa confirmado','company','required','pending','company'),
    (p_opportunity_id,'briefing_minimum','Briefing mínimo confirmado','briefing','required','pending','diagnostic'),
    (p_opportunity_id,'accesses','Acessos necessários disponíveis','access','to_define','pending','manual'),
    (p_opportunity_id,'materials','Materiais necessários disponíveis','materials','to_define','pending','manual'),
    (p_opportunity_id,'authorizations','Autorizações necessárias confirmadas','authorization','to_define','pending','manual'),
    (p_opportunity_id,'partner_validation','Parceiro/custo/condição validados quando necessário','partner','to_define','pending','partner'),
    (p_opportunity_id,'execution_routes','Rotas de execução definidas','solution','required','pending','proposal'),
    (p_opportunity_id,'operational_capacity','Capacidade operacional confirmada','capacity','required','pending','manual'),
    (p_opportunity_id,'solution_prerequisites','Pré-requisitos da solução confirmados','solution','required','pending','solution')
  on conflict(opportunity_id,condition_code) do nothing;

  update public.commercial_start_conditions sc
  set status='satisfied',requirement='required',source_reference=c.id::text,
      evidence=coalesce(nullif(trim(c.external_reference),''),nullif(trim(c.document_reference),''),c.id::text),
      satisfied_at=coalesce(c.accepted_at,now()),satisfied_by_label=coalesce(nullif(trim(c.accepted_by_label),''),'system'),updated_at=now()
  from public.contracts c
  where sc.opportunity_id=p_opportunity_id and sc.condition_code='contract_valid'
    and c.opportunity_id=p_opportunity_id and c.is_current and public.contract_is_valid(c.id);

  perform public.sync_commercial_partner_start_conditions(p_opportunity_id,'system');
end;
$$;

-- Gates automáticos não podem ser marcados manualmente como satisfeitos.
create or replace function public.set_commercial_start_condition(
  p_opportunity_id uuid,p_condition_code text,p_requirement text,p_status text,p_evidence text,p_owner_label text,
  p_due_at timestamptz,p_notes text,p_actor_label text
) returns uuid language plpgsql set search_path=public as $$
declare v_id uuid;v_status text:=p_status;
begin
  perform public.ensure_commercial_start_conditions(p_opportunity_id);
  if p_condition_code in ('contract_valid','execution_routes','partner_validation') then
    raise exception 'Esta condição é controlada automaticamente pela fonte oficial correspondente';
  end if;
  if p_requirement not in ('required','not_required','to_define') then raise exception 'invalid condition requirement'; end if;
  if p_status not in ('pending','satisfied','waived','not_applicable') then raise exception 'invalid condition status'; end if;
  if p_requirement='required' and p_status='not_applicable' then raise exception 'required condition cannot be not applicable'; end if;
  if p_requirement='not_required' then v_status:='not_applicable'; end if;
  if v_status='waived' and nullif(trim(coalesce(p_notes,'')),'') is null then raise exception 'waived condition requires notes'; end if;

  update public.commercial_start_conditions set requirement=p_requirement,status=v_status,
    evidence=nullif(trim(coalesce(p_evidence,'')),''),owner_label=nullif(trim(coalesce(p_owner_label,'')),''),due_at=p_due_at,
    satisfied_at=case when v_status in ('satisfied','waived','not_applicable') then now() else null end,
    satisfied_by_label=case when v_status in ('satisfied','waived','not_applicable') then nullif(trim(coalesce(p_actor_label,'')),'') else null end,
    notes=nullif(trim(coalesce(p_notes,'')),''),updated_at=now()
  where opportunity_id=p_opportunity_id and condition_code=p_condition_code returning id into v_id;
  if v_id is null then raise exception 'start condition not found'; end if;

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('commercial_start_condition',v_id,'commercial_start_condition_updated',public.commercial_audit_actor_type(p_actor_label),
    coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),
    jsonb_build_object('opportunity_id',p_opportunity_id,'condition_code',p_condition_code,'requirement',p_requirement,'status',v_status));
  perform public.refresh_commercial_start_gate(p_opportunity_id,p_actor_label);
  return v_id;
end;
$$;

-- A proposta só pode receber aprovação interna quando rota e compromissos externos estão coerentes.
create or replace function public.approve_proposal_internally(p_proposal_id uuid,p_actor_label text)
returns uuid
language plpgsql
set search_path=public
as $$
declare v_diagnostic_id uuid;v_pre_diagnostic_id uuid;v_lead_id uuid;v_opportunity_id uuid;
begin
  select p.diagnostic_id,d.pre_diagnostic_id,d.lead_id,p.opportunity_id
  into v_diagnostic_id,v_pre_diagnostic_id,v_lead_id,v_opportunity_id
  from public.proposals p join public.diagnostics d on d.id=p.diagnostic_id
  where p.id=p_proposal_id and p.status='internal_review' and p.current_version_id is not null;
  if v_diagnostic_id is null then raise exception 'proposal is not in internal review'; end if;
  if not public.proposal_partner_requirements_ready(p_proposal_id) then
    raise exception 'BLOQUEADO: defina as rotas e valide parceiros/custos aplicáveis antes da aprovação interna';
  end if;

  update public.proposals set status='approved_internal',approved_by_label=nullif(trim(coalesce(p_actor_label,'')),''),approved_at=now(),updated_at=now()
  where id=p_proposal_id;
  update public.crm_actions set status='done',completed_at=now()
  where pre_diagnostic_id=v_pre_diagnostic_id and action_type='diagnostic_prepare_proposal' and status in ('pending','in_progress');
  if not exists(select 1 from public.crm_actions where pre_diagnostic_id=v_pre_diagnostic_id and action_type='proposal_external_decision' and status in ('pending','in_progress')) then
    insert into public.crm_actions(lead_id,pre_diagnostic_id,action_type,status,priority,title,payload)
    values(v_lead_id,v_pre_diagnostic_id,'proposal_external_decision','pending','high','Decidir envio externo da proposta aprovada',
      jsonb_build_object('diagnostic_id',v_diagnostic_id,'proposal_id',p_proposal_id,'created_by',p_actor_label,'source','blinko_os_internal'));
  end if;
  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('proposal',p_proposal_id,'proposal_approved_internally',public.commercial_audit_actor_type(p_actor_label),
    coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),jsonb_build_object('diagnostic_id',v_diagnostic_id,'external_send_enabled',false,'partner_requirements_ready',true));
  if v_opportunity_id is not null then perform public.sync_commercial_partner_start_conditions(v_opportunity_id,p_actor_label); end if;
  return p_proposal_id;
end;
$$;

-- Regra conhecida da parceria gráfica: percentual informado, base ainda indefinida, cálculo automático bloqueado.
insert into public.partner_financial_rules(
  partner_id,blueprint_id,version_number,is_current,remuneration_model,calculation_base_status,
  calculation_base_description,percentage_value,client_billing_party,supplier_payment_party,
  formalization_status,notes,created_by_label
)
select p.id,b.id,1,true,'to_define','to_define','A DEFINIR — base de incidência dos 50% ainda não formalizada.',50,
  'to_define','to_define','pending',
  'Percentual de 50% registrado como informação existente. Não autoriza cálculo automático enquanto base, modelo, cobrança, pagamento e formalização estiverem pendentes.',
  'migration-038'
from public.partners p join public.solution_blueprints b on b.official_code='S24'
where p.official_code='P01'
  and not exists(select 1 from public.partner_financial_rules r where r.partner_id=p.id and r.blueprint_id=b.id and r.version_number=1);
