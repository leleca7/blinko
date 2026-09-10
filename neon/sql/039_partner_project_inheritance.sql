-- Blinko OS — Herança operacional/financeira de parceiro para o Projeto
-- Fontes: Documento 04 — Catálogo de Soluções e Parceiros; Documento 07 — Financeiro e Indicadores.
-- Depende de 038.
-- Produção/main não deve receber esta migração sem promoção controlada.

create table if not exists public.project_partner_assignments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  project_solution_id uuid not null references public.project_solutions(id) on delete restrict,
  source_commitment_id uuid not null unique references public.proposal_partner_commitments(id) on delete restrict,
  partner_id uuid not null references public.partners(id) on delete restrict,
  financial_rule_id uuid references public.partner_financial_rules(id) on delete restrict,
  execution_route text not null check (execution_route in ('R2','R3','R5')),
  blinko_role text not null,
  quote_reference text not null,
  quoted_at timestamptz not null,
  quote_valid_until timestamptz,
  committed_cost_to_blinko numeric(14,2) check (committed_cost_to_blinko is null or committed_cost_to_blinko >= 0),
  blinko_payment_obligation boolean not null default false,
  payment_terms_snapshot text,
  status text not null default 'confirmed'
    check (status in ('planned','confirmed','in_progress','completed','cancelled')),
  created_by_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (nullif(trim(blinko_role),'') is not null),
  check (nullif(trim(quote_reference),'') is not null),
  check (not blinko_payment_obligation or committed_cost_to_blinko is not null)
);

create index if not exists project_partner_assignments_project_idx
  on public.project_partner_assignments(project_id,status,created_at);
create index if not exists project_partner_assignments_partner_idx
  on public.project_partner_assignments(partner_id,status,created_at desc);

alter table public.project_costs
  add column if not exists partner_id uuid references public.partners(id) on delete restrict,
  add column if not exists partner_financial_rule_id uuid references public.partner_financial_rules(id) on delete restrict,
  add column if not exists project_solution_id uuid references public.project_solutions(id) on delete set null,
  add column if not exists partner_assignment_id uuid references public.project_partner_assignments(id) on delete restrict,
  add column if not exists source_quote_reference text;

create unique index if not exists project_costs_partner_assignment_uidx
  on public.project_costs(partner_assignment_id)
  where partner_assignment_id is not null;
create index if not exists project_costs_partner_idx
  on public.project_costs(partner_id,project_id,status)
  where partner_id is not null;

create or replace function public.inherit_partner_commitments_into_project(p_project_id uuid,p_actor_label text default 'system')
returns void
language plpgsql
set search_path=public
as $$
declare
  v_project public.projects%rowtype;
  v_proposal public.proposals%rowtype;
  v_pc public.proposal_partner_commitments%rowtype;
  v_project_solution_id uuid;
  v_assignment_id uuid;
  v_partner_name text;
begin
  select * into v_project from public.projects where id=p_project_id;
  if not found then raise exception 'project not found'; end if;
  select * into v_proposal from public.proposals where id=v_project.proposal_id;
  if not found or v_proposal.current_version_id is null then raise exception 'project proposal/current version not found'; end if;

  if not public.proposal_partner_requirements_ready(v_proposal.id) then
    raise exception 'BLOQUEADO PARA INÍCIO: compromisso de parceiro/cotação não está válido';
  end if;

  perform public.ensure_project_solution_links(p_project_id);

  for v_pc in
    select * from public.proposal_partner_commitments
    where proposal_version_id=v_proposal.current_version_id and is_current and validation_status='approved'
    order by created_at
  loop
    if not public.proposal_partner_commitment_is_ready(v_pc.id) then
      raise exception 'BLOQUEADO PARA INÍCIO: compromisso de parceiro % deixou de estar válido',v_pc.id;
    end if;

    select id into v_project_solution_id
    from public.project_solutions
    where project_id=p_project_id and intervention_id=v_pc.intervention_id
    limit 1;
    if v_project_solution_id is null then raise exception 'project solution not found for partner commitment'; end if;

    insert into public.project_partner_assignments(
      project_id,project_solution_id,source_commitment_id,partner_id,financial_rule_id,execution_route,
      blinko_role,quote_reference,quoted_at,quote_valid_until,committed_cost_to_blinko,
      blinko_payment_obligation,payment_terms_snapshot,status,created_by_label
    ) values(
      p_project_id,v_project_solution_id,v_pc.id,v_pc.partner_id,v_pc.financial_rule_id,v_pc.execution_route,
      v_pc.blinko_role,v_pc.quote_reference,v_pc.quoted_at,v_pc.quote_valid_until,v_pc.quoted_cost_to_blinko,
      v_pc.blinko_payment_obligation,v_pc.payment_terms_snapshot,'confirmed',nullif(trim(coalesce(p_actor_label,'')),'')
    ) on conflict(source_commitment_id) do update set
      financial_rule_id=excluded.financial_rule_id,quote_reference=excluded.quote_reference,quoted_at=excluded.quoted_at,
      quote_valid_until=excluded.quote_valid_until,committed_cost_to_blinko=excluded.committed_cost_to_blinko,
      blinko_payment_obligation=excluded.blinko_payment_obligation,payment_terms_snapshot=excluded.payment_terms_snapshot,updated_at=now()
    returning id into v_assignment_id;

    select trade_name into v_partner_name from public.partners where id=v_pc.partner_id;

    if v_pc.blinko_payment_obligation then
      insert into public.project_costs(
        company_id,project_id,cost_type,description,amount,status,partner_label,cash_effect,created_by_label,
        partner_id,partner_financial_rule_id,project_solution_id,partner_assignment_id,source_quote_reference
      ) values(
        v_project.company_id,p_project_id,'partner',
        'Compromisso com parceiro — '||coalesce(v_partner_name,'Parceiro'),coalesce(v_pc.quoted_cost_to_blinko,0),
        'committed',v_partner_name,true,nullif(trim(coalesce(p_actor_label,'')),''),
        v_pc.partner_id,v_pc.financial_rule_id,v_project_solution_id,v_assignment_id,v_pc.quote_reference
      ) on conflict(partner_assignment_id) where partner_assignment_id is not null do update set
        amount=excluded.amount,partner_label=excluded.partner_label,partner_id=excluded.partner_id,
        partner_financial_rule_id=excluded.partner_financial_rule_id,project_solution_id=excluded.project_solution_id,
        source_quote_reference=excluded.source_quote_reference,updated_at=now();
    end if;

    insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
    values('project_partner_assignment',v_assignment_id,'partner_commitment_inherited_to_project',
      public.commercial_audit_actor_type(p_actor_label),coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),
      jsonb_build_object('project_id',p_project_id,'proposal_partner_commitment_id',v_pc.id,'partner_id',v_pc.partner_id,
        'route',v_pc.execution_route,'blinko_payment_obligation',v_pc.blinko_payment_obligation,'quoted_cost_to_blinko',v_pc.quoted_cost_to_blinko));
  end loop;
end;
$$;

-- Custos de parceiro devem nascer do compromisso aprovado, não de texto livre.
create or replace function public.record_project_cost(
  p_project_id uuid,p_cost_type text,p_description text,p_amount numeric,p_status text,p_partner_label text,p_due_date date,p_actor_label text
) returns uuid
language plpgsql
set search_path=public
as $$
declare v_company_id uuid;v_id uuid;v_status text;v_cash_effect boolean;
begin
  select company_id into v_company_id from public.projects where id=p_project_id;
  if v_company_id is null then raise exception 'project not found'; end if;
  if p_cost_type='partner' then
    raise exception 'BLOQUEADO: custo de parceiro deve nascer de compromisso aprovado e vinculado ao projeto';
  end if;
  v_cash_effect:=case when p_cost_type='internal' then false else true end;
  v_status:=coalesce(nullif(p_status,''),'estimated');
  if v_status not in ('estimated','committed','realized','paid','cancelled') then raise exception 'invalid project cost status'; end if;
  if p_cost_type='internal' and v_status='paid' then v_status:='realized'; end if;
  insert into public.project_costs(company_id,project_id,cost_type,description,amount,status,partner_label,due_date,cash_effect,created_by_label)
  values(v_company_id,p_project_id,p_cost_type,trim(p_description),p_amount,v_status,nullif(trim(coalesce(p_partner_label,'')),''),p_due_date,v_cash_effect,nullif(trim(coalesce(p_actor_label,'')),''))
  returning id into v_id;
  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('project_cost',v_id,'project_cost_recorded',public.commercial_audit_actor_type(p_actor_label),
    coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),jsonb_build_object('project_id',p_project_id,'cost_type',p_cost_type,'amount',p_amount,'status',v_status,'cash_effect',v_cash_effect));
  return v_id;
end;
$$;

-- Revalidação simples permite renovar a validade da mesma cotação sem trocar parceiro/valor/escopo.
create or replace function public.refresh_proposal_partner_quote_validity(
  p_commitment_id uuid,p_quote_reference text,p_quoted_at timestamptz,p_quote_valid_until timestamptz,p_evidence text,p_actor_label text
) returns uuid
language plpgsql
set search_path=public
as $$
declare v_pc public.proposal_partner_commitments%rowtype;v_proposal_status text;
begin
  select * into v_pc from public.proposal_partner_commitments where id=p_commitment_id for update;
  if not found then raise exception 'partner commitment not found'; end if;
  if not v_pc.is_current or v_pc.validation_status<>'approved' then raise exception 'only an approved current commitment can be revalidated'; end if;
  select status into v_proposal_status from public.proposals where id=v_pc.proposal_id;
  if v_proposal_status not in ('approved_internal','sent','negotiation','accepted') then raise exception 'proposal is not in a revalidation stage'; end if;
  if nullif(trim(coalesce(p_quote_reference,'')),'') is null or p_quoted_at is null then raise exception 'quote reference and date are required'; end if;
  if p_quote_valid_until is not null and p_quote_valid_until < p_quoted_at then raise exception 'invalid quote validity'; end if;
  if nullif(trim(coalesce(p_evidence,'')),'') is null then raise exception 'quote revalidation requires evidence'; end if;

  update public.proposal_partner_commitments set quote_reference=trim(p_quote_reference),quoted_at=p_quoted_at,quote_valid_until=p_quote_valid_until,
    condition_evidence=concat_ws(' | ',condition_evidence,trim(p_evidence)),updated_at=now() where id=p_commitment_id;

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('proposal_partner_commitment',p_commitment_id,'partner_quote_revalidated',public.commercial_audit_actor_type(p_actor_label),
    coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),
    jsonb_build_object('proposal_id',v_pc.proposal_id,'partner_id',v_pc.partner_id,'previous_quote_reference',v_pc.quote_reference,
      'quote_reference',trim(p_quote_reference),'quoted_at',p_quoted_at,'quote_valid_until',p_quote_valid_until));
  perform public.sync_commercial_partner_start_conditions(v_pc.opportunity_id,p_actor_label);
  return p_commitment_id;
end;
$$;

-- Envio e aceite externo revalidam as rotas/compromissos para impedir condição de parceiro vencida.
create or replace function public.record_proposal_external_event(
  p_proposal_id uuid,p_actor_label text,p_event_type text,p_channel text,p_external_reference text,p_notes text,p_occurred_at timestamptz
) returns uuid
language plpgsql
set search_path=public
as $$
declare v_current_status text;v_event_id uuid;v_diagnostic_id uuid;v_pre_diagnostic_id uuid;v_lead_id uuid;
begin
  select p.status,p.diagnostic_id,d.pre_diagnostic_id,d.lead_id into v_current_status,v_diagnostic_id,v_pre_diagnostic_id,v_lead_id
  from public.proposals p join public.diagnostics d on d.id=p.diagnostic_id where p.id=p_proposal_id;
  if v_current_status is null then raise exception 'proposal not found'; end if;
  if p_event_type not in ('sent','negotiation','accepted','refused','expired') then raise exception 'invalid proposal external event'; end if;
  if p_event_type='sent' and v_current_status<>'approved_internal' then raise exception 'proposal must be approved internally before sent record'; end if;
  if p_event_type='negotiation' and v_current_status not in ('sent','negotiation') then raise exception 'negotiation requires sent proposal'; end if;
  if p_event_type='accepted' and v_current_status not in ('sent','negotiation') then raise exception 'acceptance requires sent proposal'; end if;
  if p_event_type='refused' and v_current_status not in ('sent','negotiation') then raise exception 'refusal requires sent proposal'; end if;
  if p_event_type='expired' and v_current_status not in ('approved_internal','sent','negotiation') then raise exception 'proposal cannot expire from current status'; end if;
  if p_event_type in ('sent','accepted') and not public.proposal_partner_requirements_ready(p_proposal_id) then
    raise exception 'BLOQUEADO: rotas, parceiro ou cotação deixaram de estar válidos para envio/aceite';
  end if;
  if nullif(trim(coalesce(p_external_reference,'')),'') is null then raise exception 'external reference is required'; end if;

  insert into public.proposal_external_events(proposal_id,event_type,channel,external_reference,notes,occurred_at,recorded_by_label)
  values(p_proposal_id,p_event_type,nullif(trim(coalesce(p_channel,'')),''),trim(p_external_reference),nullif(trim(coalesce(p_notes,'')),''),
    coalesce(p_occurred_at,now()),nullif(trim(coalesce(p_actor_label,'')),'')) returning id into v_event_id;
  update public.proposals set status=p_event_type,updated_at=now() where id=p_proposal_id;
  if p_event_type='sent' then
    update public.crm_actions set status='done',completed_at=now() where pre_diagnostic_id=v_pre_diagnostic_id and action_type='proposal_external_decision' and status in ('pending','in_progress');
  end if;
  if p_event_type='accepted' and not exists(select 1 from public.crm_actions where pre_diagnostic_id=v_pre_diagnostic_id and action_type='execution_contract_confirmation' and status in ('pending','in_progress')) then
    insert into public.crm_actions(lead_id,pre_diagnostic_id,action_type,status,priority,title,payload)
    values(v_lead_id,v_pre_diagnostic_id,'execution_contract_confirmation','pending','high','Confirmar contratação da execução antes de criar o projeto',
      jsonb_build_object('proposal_id',p_proposal_id,'diagnostic_id',v_diagnostic_id,'created_by',p_actor_label,'source','blinko_os_internal'));
  end if;
  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('proposal',p_proposal_id,'proposal_external_'||p_event_type,public.commercial_audit_actor_type(p_actor_label),
    coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),
    jsonb_build_object('external_event_id',v_event_id,'previous_status',v_current_status,'external_reference',trim(p_external_reference),
      'channel',nullif(trim(coalesce(p_channel,'')),''),'partner_requirements_ready',case when p_event_type in ('sent','accepted') then true else null end));
  return v_event_id;
end;
$$;

create or replace function public.create_project_from_accepted_proposal(
  p_proposal_id uuid,p_actor_label text,p_objective text,p_start_date date,p_target_timeframe text,p_contract_reference text,p_next_review_at timestamptz default null
) returns uuid
language plpgsql
set search_path=public
as $$
declare v_company_id uuid;v_diagnostic_id uuid;v_pre_diagnostic_id uuid;v_lead_id uuid;v_current_version_id uuid;v_opportunity_id uuid;v_priority_ids jsonb;v_intervention_ids jsonb;v_project_id uuid;v_contract_id uuid;v_contract_reference text;
begin
  select p.company_id,p.diagnostic_id,p.current_version_id,p.opportunity_id,d.pre_diagnostic_id,d.lead_id
  into v_company_id,v_diagnostic_id,v_current_version_id,v_opportunity_id,v_pre_diagnostic_id,v_lead_id
  from public.proposals p join public.diagnostics d on d.id=p.diagnostic_id where p.id=p_proposal_id and p.status='accepted';
  if v_company_id is null or v_current_version_id is null or v_opportunity_id is null then raise exception 'accepted proposal with current version and opportunity is required'; end if;
  if nullif(trim(coalesce(p_objective,'')),'') is null or p_start_date is null or nullif(trim(coalesce(p_target_timeframe,'')),'') is null then raise exception 'project definition is incomplete'; end if;
  if not public.proposal_partner_requirements_ready(p_proposal_id) then raise exception 'BLOQUEADO PARA INÍCIO: rotas/parceiros/cotações da proposta não estão válidos'; end if;
  perform public.ensure_commercial_start_conditions(v_opportunity_id);
  if not public.commercial_start_gate_ready(v_opportunity_id) then raise exception 'BLOQUEADO PARA INÍCIO: condições obrigatórias pendentes'; end if;
  select c.id,coalesce(nullif(trim(c.external_reference),''),nullif(trim(c.document_reference),''),c.id::text)
    into v_contract_id,v_contract_reference from public.contracts c
  where c.opportunity_id=v_opportunity_id and c.proposal_id=p_proposal_id and c.is_current and public.contract_is_valid(c.id)
  order by c.created_at desc limit 1;
  if v_contract_id is null then raise exception 'BLOQUEADO PARA INÍCIO: contrato/aceite válido ausente'; end if;
  select priority_ids,intervention_ids into v_priority_ids,v_intervention_ids from public.proposal_versions where id=v_current_version_id;

  insert into public.projects(company_id,proposal_id,objective,start_date,target_timeframe,priority_ids,intervention_ids,status,next_review_at,contract_reference,created_by_label)
  values(v_company_id,p_proposal_id,trim(p_objective),p_start_date,trim(p_target_timeframe),coalesce(v_priority_ids,'[]'::jsonb),coalesce(v_intervention_ids,'[]'::jsonb),'onboarding',p_next_review_at,v_contract_reference,nullif(trim(coalesce(p_actor_label,'')),''))
  on conflict(proposal_id) do update set objective=excluded.objective,start_date=excluded.start_date,target_timeframe=excluded.target_timeframe,next_review_at=excluded.next_review_at,contract_reference=excluded.contract_reference,updated_at=now()
  returning id into v_project_id;

  perform public.ensure_project_solution_links(v_project_id);
  perform public.inherit_partner_commitments_into_project(v_project_id,p_actor_label);

  update public.diagnostics set status='completed',updated_at=now() where id=v_diagnostic_id and status='presented';
  update public.crm_actions set status='done',completed_at=now() where pre_diagnostic_id=v_pre_diagnostic_id and action_type='execution_contract_confirmation' and status in ('pending','in_progress');
  if v_pre_diagnostic_id is not null and not exists(select 1 from public.crm_actions where pre_diagnostic_id=v_pre_diagnostic_id and action_type='project_onboarding' and status in ('pending','in_progress')) then
    insert into public.crm_actions(lead_id,pre_diagnostic_id,action_type,status,priority,title,payload)
    values(v_lead_id,v_pre_diagnostic_id,'project_onboarding','pending','high','Iniciar onboarding da execução contratada',
      jsonb_build_object('project_id',v_project_id,'proposal_id',p_proposal_id,'contract_id',v_contract_id,'created_by',p_actor_label,'source','blinko_os_internal'));
  end if;
  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('project',v_project_id,'project_created_after_start_gate',public.commercial_audit_actor_type(p_actor_label),
    coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),
    jsonb_build_object('proposal_id',p_proposal_id,'diagnostic_id',v_diagnostic_id,'opportunity_id',v_opportunity_id,'contract_id',v_contract_id,
      'status','onboarding','partner_commitments_inherited',true));
  return v_project_id;
end;
$$;
