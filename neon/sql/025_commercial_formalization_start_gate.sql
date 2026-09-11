-- Blinko OS — formalização, condições de início e gate P10→P13.
-- Depende de 021–024. Produção/main não deve receber esta migração sem promoção controlada.

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.commercial_opportunities(id) on delete restrict,
  proposal_id uuid not null references public.proposals(id) on delete restrict,
  company_id uuid not null references public.companies(id) on delete restrict,
  supersedes_id uuid references public.contracts(id) on delete set null,
  is_current boolean not null default true,
  status text not null default 'draft'
    check (status in ('draft','sent','accepted','signed','rejected','cancelled','expired')),
  acceptance_method text
    check (acceptance_method is null or acceptance_method in ('signature','digital_acceptance','email','platform','manual_record')),
  external_reference text,
  document_reference text,
  valid_from timestamptz,
  accepted_at timestamptz,
  accepted_by_label text,
  notes text,
  created_by_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    status not in ('accepted','signed')
    or (
      accepted_at is not null
      and (nullif(trim(coalesce(external_reference,'')),'') is not null
        or nullif(trim(coalesce(document_reference,'')),'') is not null)
    )
  )
);

create unique index if not exists contracts_current_proposal_unique
  on public.contracts(proposal_id) where is_current;
create index if not exists contracts_opportunity_idx
  on public.contracts(opportunity_id,is_current,status,created_at desc);
create index if not exists contracts_company_idx
  on public.contracts(company_id,created_at desc);

create table if not exists public.commercial_start_conditions (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.commercial_opportunities(id) on delete cascade,
  condition_code text not null,
  label text not null,
  category text not null
    check (category in ('formalization','financial','company','briefing','access','materials','authorization','partner','capacity','solution','other')),
  requirement text not null default 'to_define'
    check (requirement in ('required','not_required','to_define')),
  status text not null default 'pending'
    check (status in ('pending','satisfied','waived','not_applicable')),
  source_type text,
  source_reference text,
  evidence text,
  owner_label text,
  due_at timestamptz,
  satisfied_at timestamptz,
  satisfied_by_label text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(opportunity_id,condition_code),
  check (requirement <> 'required' or status <> 'not_applicable'),
  check (requirement <> 'not_required' or status in ('pending','not_applicable'))
);

create index if not exists commercial_start_conditions_gate_idx
  on public.commercial_start_conditions(opportunity_id,requirement,status);

create or replace function public.contract_is_valid(p_contract_id uuid)
returns boolean language sql stable set search_path=public as $$
  select coalesce((
    select c.is_current
      and c.status in ('accepted','signed')
      and c.accepted_at is not null
      and (
        nullif(trim(coalesce(c.external_reference,'')),'') is not null
        or nullif(trim(coalesce(c.document_reference,'')),'') is not null
      )
    from public.contracts c where c.id=p_contract_id
  ),false)
$$;

create or replace function public.ensure_commercial_start_conditions(p_opportunity_id uuid)
returns void language plpgsql set search_path=public as $$
begin
  if not exists(select 1 from public.commercial_opportunities where id=p_opportunity_id) then
    raise exception 'opportunity not found';
  end if;

  insert into public.commercial_start_conditions(opportunity_id,condition_code,label,category,requirement,status,source_type)
  values
    (p_opportunity_id,'contract_valid','Contrato/aceite válido','formalization','required','pending','contract'),
    (p_opportunity_id,'financial_condition','Pagamento/sinal ou condição financeira de início','financial','to_define','pending','finance'),
    (p_opportunity_id,'company_registration','Cadastro mínimo da empresa confirmado','company','required','pending','company'),
    (p_opportunity_id,'briefing_minimum','Briefing mínimo confirmado','briefing','required','pending','diagnostic'),
    (p_opportunity_id,'accesses','Acessos necessários disponíveis','access','to_define','pending','manual'),
    (p_opportunity_id,'materials','Materiais necessários disponíveis','materials','to_define','pending','manual'),
    (p_opportunity_id,'authorizations','Autorizações necessárias confirmadas','authorization','to_define','pending','manual'),
    (p_opportunity_id,'partner_validation','Parceiro validado quando necessário','partner','to_define','pending','partner'),
    (p_opportunity_id,'operational_capacity','Capacidade operacional confirmada','capacity','required','pending','manual'),
    (p_opportunity_id,'solution_prerequisites','Pré-requisitos da solução confirmados','solution','required','pending','solution')
  on conflict (opportunity_id,condition_code) do nothing;

  update public.commercial_start_conditions sc
  set status='satisfied',
      requirement='required',
      source_reference=c.id::text,
      evidence=coalesce(nullif(trim(c.external_reference),''),nullif(trim(c.document_reference),''),c.id::text),
      satisfied_at=coalesce(c.accepted_at,now()),
      satisfied_by_label=coalesce(nullif(trim(c.accepted_by_label),''),'system'),
      updated_at=now()
  from public.contracts c
  where sc.opportunity_id=p_opportunity_id
    and sc.condition_code='contract_valid'
    and c.opportunity_id=p_opportunity_id
    and c.is_current
    and public.contract_is_valid(c.id);
end; $$;

create or replace function public.commercial_start_gate_ready(p_opportunity_id uuid)
returns boolean language sql stable set search_path=public as $$
  select
    exists(select 1 from public.commercial_start_conditions where opportunity_id=p_opportunity_id)
    and not exists(
      select 1 from public.commercial_start_conditions
      where opportunity_id=p_opportunity_id
        and (
          requirement='to_define'
          or (requirement='required' and status not in ('satisfied','waived'))
        )
    )
    and exists(
      select 1 from public.contracts c
      where c.opportunity_id=p_opportunity_id and c.is_current and public.contract_is_valid(c.id)
    )
$$;

create or replace view public.commercial_start_readiness as
select
  o.id as opportunity_id,
  count(sc.id)::integer as condition_count,
  count(*) filter (where sc.requirement='to_define')::integer as unresolved_applicability_count,
  count(*) filter (where sc.requirement='required' and sc.status not in ('satisfied','waived'))::integer as blocking_count,
  coalesce(jsonb_agg(sc.condition_code order by sc.condition_code)
    filter (where sc.requirement='to_define' or (sc.requirement='required' and sc.status not in ('satisfied','waived'))),'[]'::jsonb) as pending_codes,
  public.commercial_start_gate_ready(o.id) as ready_for_onboarding,
  case when public.commercial_start_gate_ready(o.id) then 'ready_for_onboarding' else 'blocked_for_start' end as gate_status
from public.commercial_opportunities o
left join public.commercial_start_conditions sc on sc.opportunity_id=o.id
group by o.id;

create or replace function public.refresh_commercial_start_gate(p_opportunity_id uuid,p_actor_label text)
returns void language plpgsql set search_path=public as $$
declare
  v_stage text;
  v_ready boolean;
  v_title text;
  v_previous text;
begin
  select pipeline_stage into v_stage from public.commercial_opportunities
  where id=p_opportunity_id and outcome_status is null;
  if v_stage is null or v_stage<>'P12' then return; end if;

  v_ready:=public.commercial_start_gate_ready(p_opportunity_id);
  v_title:=case when v_ready then 'Criar projeto e iniciar onboarding' else 'Resolver condições de início pendentes' end;

  select next_action_title into v_previous from public.commercial_opportunities where id=p_opportunity_id;
  update public.commercial_opportunities
  set next_action_title=v_title,next_action_at=now(),next_action_channel='interno',updated_at=now()
  where id=p_opportunity_id;

  if v_previous is distinct from v_title then
    insert into public.commercial_opportunity_events(opportunity_id,event_type,summary,actor_label,payload)
    values(p_opportunity_id,'next_action_changed',v_title,coalesce(nullif(trim(p_actor_label),''),'system'),jsonb_build_object('gate_ready',v_ready));
  end if;
end; $$;

create or replace function public.set_commercial_start_condition(
  p_opportunity_id uuid,
  p_condition_code text,
  p_requirement text,
  p_status text,
  p_evidence text,
  p_owner_label text,
  p_due_at timestamptz,
  p_notes text,
  p_actor_label text
) returns uuid language plpgsql set search_path=public as $$
declare v_id uuid; v_status text:=p_status;
begin
  perform public.ensure_commercial_start_conditions(p_opportunity_id);

  if p_requirement not in ('required','not_required','to_define') then raise exception 'invalid condition requirement'; end if;
  if p_status not in ('pending','satisfied','waived','not_applicable') then raise exception 'invalid condition status'; end if;
  if p_requirement='required' and p_status='not_applicable' then raise exception 'required condition cannot be not applicable'; end if;
  if p_requirement='not_required' then v_status:='not_applicable'; end if;
  if v_status='waived' and nullif(trim(coalesce(p_notes,'')),'') is null then raise exception 'waived condition requires notes'; end if;

  update public.commercial_start_conditions
  set requirement=p_requirement,
      status=v_status,
      evidence=nullif(trim(coalesce(p_evidence,'')),''),
      owner_label=nullif(trim(coalesce(p_owner_label,'')),''),
      due_at=p_due_at,
      satisfied_at=case when v_status in ('satisfied','waived','not_applicable') then now() else null end,
      satisfied_by_label=case when v_status in ('satisfied','waived','not_applicable') then nullif(trim(coalesce(p_actor_label,'')),'') else null end,
      notes=nullif(trim(coalesce(p_notes,'')),''),
      updated_at=now()
  where opportunity_id=p_opportunity_id and condition_code=p_condition_code
  returning id into v_id;

  if v_id is null then raise exception 'start condition not found'; end if;

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('commercial_start_condition',v_id,'commercial_start_condition_updated',
    public.commercial_audit_actor_type(p_actor_label),
    coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),
    jsonb_build_object('opportunity_id',p_opportunity_id,'condition_code',p_condition_code,'requirement',p_requirement,'status',v_status));

  perform public.refresh_commercial_start_gate(p_opportunity_id,p_actor_label);
  return v_id;
end; $$;

create or replace function public.record_commercial_contract(
  p_proposal_id uuid,
  p_status text,
  p_acceptance_method text,
  p_external_reference text,
  p_document_reference text,
  p_accepted_at timestamptz,
  p_accepted_by_label text,
  p_notes text,
  p_actor_label text
) returns uuid language plpgsql set search_path=public as $$
declare
  v_opportunity_id uuid;
  v_company_id uuid;
  v_previous_id uuid;
  v_id uuid;
begin
  if p_status not in ('draft','sent','accepted','signed','rejected','cancelled','expired') then raise exception 'invalid contract status'; end if;
  if p_acceptance_method is not null and p_acceptance_method not in ('signature','digital_acceptance','email','platform','manual_record') then raise exception 'invalid acceptance method'; end if;

  select opportunity_id,company_id into v_opportunity_id,v_company_id
  from public.proposals where id=p_proposal_id and status='accepted';
  if v_opportunity_id is null or v_company_id is null then raise exception 'accepted proposal linked to opportunity is required'; end if;

  if p_status in ('accepted','signed') and (
    p_accepted_at is null
    or (nullif(trim(coalesce(p_external_reference,'')),'') is null and nullif(trim(coalesce(p_document_reference,'')),'') is null)
  ) then raise exception 'valid contract requires acceptance date and reference'; end if;

  select id into v_previous_id from public.contracts where proposal_id=p_proposal_id and is_current for update;
  if v_previous_id is not null then update public.contracts set is_current=false,updated_at=now() where id=v_previous_id; end if;

  insert into public.contracts(
    opportunity_id,proposal_id,company_id,supersedes_id,is_current,status,acceptance_method,
    external_reference,document_reference,valid_from,accepted_at,accepted_by_label,notes,created_by_label
  ) values(
    v_opportunity_id,p_proposal_id,v_company_id,v_previous_id,true,p_status,p_acceptance_method,
    nullif(trim(coalesce(p_external_reference,'')),''),nullif(trim(coalesce(p_document_reference,'')),''),
    case when p_status in ('accepted','signed') then coalesce(p_accepted_at,now()) else null end,
    p_accepted_at,nullif(trim(coalesce(p_accepted_by_label,'')),''),nullif(trim(coalesce(p_notes,'')),''),
    nullif(trim(coalesce(p_actor_label,'')),'')
  ) returning id into v_id;

  return v_id;
end; $$;

create or replace function public.commercial_sync_from_contract()
returns trigger language plpgsql set search_path=public as $$
declare
  v_current text;
  v_actor text;
  v_valid boolean;
begin
  if not new.is_current then return new; end if;
  v_actor:=coalesce(nullif(trim(new.created_by_label),''),nullif(trim(new.accepted_by_label),''),'system');

  perform public.ensure_commercial_start_conditions(new.opportunity_id);
  v_valid:=public.contract_is_valid(new.id);

  update public.commercial_start_conditions
  set status=case when v_valid then 'satisfied' else 'pending' end,
      requirement='required',
      source_reference=new.id::text,
      evidence=case when v_valid then coalesce(nullif(trim(new.external_reference),''),nullif(trim(new.document_reference),''),new.id::text) else null end,
      satisfied_at=case when v_valid then coalesce(new.accepted_at,now()) else null end,
      satisfied_by_label=case when v_valid then coalesce(nullif(trim(new.accepted_by_label),''),v_actor) else null end,
      updated_at=now()
  where opportunity_id=new.opportunity_id and condition_code='contract_valid';

  select pipeline_stage into v_current from public.commercial_opportunities
  where id=new.opportunity_id and outcome_status is null;
  if v_current is null then return new; end if;

  if public.commercial_stage_number(v_current)<=10 then
    perform public.set_commercial_opportunity_stage(
      new.opportunity_id,'P11',coalesce(nullif(trim(new.accepted_by_label),''),nullif(trim(new.created_by_label),''),'Blinko'),
      'Concluir formalização/aceite do contrato',now(),'interno','Contrato registrado; formalização iniciada.','system'
    );
    v_current:='P11';
  end if;

  if v_valid and public.commercial_stage_number(v_current)<=12 then
    perform public.set_commercial_opportunity_stage(
      new.opportunity_id,'P12',coalesce(nullif(trim(new.accepted_by_label),''),nullif(trim(new.created_by_label),''),'Blinko'),
      'Resolver condições de início pendentes',now(),'interno','Contrato/aceite válido; verificar condições de início.','system'
    );
    perform public.refresh_commercial_start_gate(new.opportunity_id,'system');
  elsif not v_valid and v_current in ('P11','P12') then
    perform public.set_commercial_opportunity_stage(
      new.opportunity_id,'P11',coalesce(nullif(trim(new.created_by_label),''),'Blinko'),
      'Concluir formalização/aceite do contrato',now(),'interno','Contrato atual ainda não é válido para início.','system'
    );
  end if;

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('contract',new.id,'contract_status_recorded',public.commercial_audit_actor_type(v_actor),v_actor,
    jsonb_build_object('opportunity_id',new.opportunity_id,'proposal_id',new.proposal_id,'status',new.status,'valid',v_valid,'is_current',new.is_current));

  return new;
end; $$;

drop trigger if exists commercial_sync_from_contract_trg on public.contracts;
create trigger commercial_sync_from_contract_trg
  after insert or update of status,is_current,accepted_at,external_reference,document_reference on public.contracts
  for each row execute function public.commercial_sync_from_contract();

-- Substitui a confirmação textual antiga por gate real, preservando a assinatura usada pelo app.
create or replace function public.create_project_from_accepted_proposal(
  p_proposal_id uuid,
  p_actor_label text,
  p_objective text,
  p_start_date date,
  p_target_timeframe text,
  p_contract_reference text,
  p_next_review_at timestamptz default null
) returns uuid language plpgsql set search_path=public as $$
declare
  v_company_id uuid;
  v_diagnostic_id uuid;
  v_pre_diagnostic_id uuid;
  v_lead_id uuid;
  v_current_version_id uuid;
  v_opportunity_id uuid;
  v_priority_ids jsonb;
  v_intervention_ids jsonb;
  v_project_id uuid;
  v_contract_id uuid;
  v_contract_reference text;
begin
  select p.company_id,p.diagnostic_id,p.current_version_id,p.opportunity_id,d.pre_diagnostic_id,d.lead_id
  into v_company_id,v_diagnostic_id,v_current_version_id,v_opportunity_id,v_pre_diagnostic_id,v_lead_id
  from public.proposals p join public.diagnostics d on d.id=p.diagnostic_id
  where p.id=p_proposal_id and p.status='accepted';

  if v_company_id is null or v_current_version_id is null or v_opportunity_id is null then
    raise exception 'accepted proposal with current version and opportunity is required';
  end if;
  if nullif(trim(coalesce(p_objective,'')),'') is null or p_start_date is null or nullif(trim(coalesce(p_target_timeframe,'')),'') is null then
    raise exception 'project definition is incomplete';
  end if;

  perform public.ensure_commercial_start_conditions(v_opportunity_id);
  if not public.commercial_start_gate_ready(v_opportunity_id) then
    raise exception 'BLOQUEADO PARA INÍCIO: condições obrigatórias pendentes';
  end if;

  select c.id,coalesce(nullif(trim(c.external_reference),''),nullif(trim(c.document_reference),''),c.id::text)
  into v_contract_id,v_contract_reference
  from public.contracts c
  where c.opportunity_id=v_opportunity_id and c.proposal_id=p_proposal_id and c.is_current and public.contract_is_valid(c.id)
  order by c.created_at desc limit 1;
  if v_contract_id is null then raise exception 'BLOQUEADO PARA INÍCIO: contrato/aceite válido ausente'; end if;

  select priority_ids,intervention_ids into v_priority_ids,v_intervention_ids
  from public.proposal_versions where id=v_current_version_id;

  insert into public.projects(
    company_id,proposal_id,objective,start_date,target_timeframe,priority_ids,intervention_ids,status,next_review_at,contract_reference,created_by_label
  ) values(
    v_company_id,p_proposal_id,trim(p_objective),p_start_date,trim(p_target_timeframe),
    coalesce(v_priority_ids,'[]'::jsonb),coalesce(v_intervention_ids,'[]'::jsonb),'onboarding',p_next_review_at,
    v_contract_reference,nullif(trim(coalesce(p_actor_label,'')),'')
  )
  on conflict (proposal_id) do update set
    objective=excluded.objective,start_date=excluded.start_date,target_timeframe=excluded.target_timeframe,
    next_review_at=excluded.next_review_at,contract_reference=excluded.contract_reference,updated_at=now()
  returning id into v_project_id;

  update public.diagnostics set status='completed',updated_at=now()
  where id=v_diagnostic_id and status='presented';

  update public.crm_actions set status='done',completed_at=now()
  where pre_diagnostic_id=v_pre_diagnostic_id and action_type='execution_contract_confirmation' and status in ('pending','in_progress');

  if v_pre_diagnostic_id is not null and not exists(
    select 1 from public.crm_actions where pre_diagnostic_id=v_pre_diagnostic_id and action_type='project_onboarding' and status in ('pending','in_progress')
  ) then
    insert into public.crm_actions(lead_id,pre_diagnostic_id,action_type,status,priority,title,payload)
    values(v_lead_id,v_pre_diagnostic_id,'project_onboarding','pending','high','Iniciar onboarding da execução contratada',
      jsonb_build_object('project_id',v_project_id,'proposal_id',p_proposal_id,'contract_id',v_contract_id,'created_by',p_actor_label,'source','blinko_os_internal'));
  end if;

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('project',v_project_id,'project_created_after_start_gate','human',
    coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),
    jsonb_build_object('proposal_id',p_proposal_id,'diagnostic_id',v_diagnostic_id,'opportunity_id',v_opportunity_id,'contract_id',v_contract_id,'status','onboarding'));

  return v_project_id;
end; $$;

-- Defesa no banco: inserção direta de projeto não pode pular P11/P12.
create or replace function public.commercial_sync_from_project()
returns trigger language plpgsql set search_path=public as $$
declare v_id uuid;v_current text;
begin
  select opportunity_id into v_id from public.proposals where id=new.proposal_id;
  if v_id is null then return new; end if;
  select pipeline_stage into v_current from public.commercial_opportunities where id=v_id and outcome_status is null;
  if v_current is null then return new; end if;

  if new.status='onboarding' then
    perform public.ensure_commercial_start_conditions(v_id);
    if not public.commercial_start_gate_ready(v_id) then
      raise exception 'BLOQUEADO PARA INÍCIO: condições obrigatórias pendentes';
    end if;
    if public.commercial_stage_number(v_current)<12 then
      raise exception 'BLOQUEADO PARA INÍCIO: oportunidade ainda não concluiu formalização/condições de início';
    end if;
    if public.commercial_stage_number(v_current)<=13 then
      perform public.set_commercial_opportunity_stage(v_id,'P13',coalesce(new.created_by_label,'Blinko'),'Concluir onboarding e liberar operação',now(),'interno','Gate de início concluído; projeto entrou em onboarding.','system');
    end if;
  elsif new.status in ('active','waiting_client','at_risk','paused','completed','closed') then
    if not public.commercial_start_gate_ready(v_id) then
      raise exception 'BLOQUEADO PARA OPERAÇÃO: condições de início deixaram de estar válidas';
    end if;
    perform public.set_commercial_opportunity_stage(v_id,'P14',coalesce(new.created_by_label,'Blinko'),null,null,null,'Projeto liberado para operação.','system');
    perform public.close_commercial_opportunity(v_id,'won',null,null,'system');
  end if;
  return new;
end; $$;
