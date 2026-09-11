-- Blinko OS — onboarding modular e gate P13→P14.
-- Depende de 025_commercial_formalization_start_gate.sql.
-- Não duplica dados de empresa/diagnóstico/proposta: itens podem apontar para suas fontes.

create table if not exists public.project_onboarding_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  solution_code text,
  module_code text not null,
  label text not null,
  category text not null
    check (category in ('governance','communication','planning','measurement','kickoff','solution','other')),
  requirement text not null default 'required'
    check (requirement in ('required','not_required','to_define')),
  status text not null default 'pending'
    check (status in ('pending','in_progress','blocked','done','waived','not_applicable')),
  source_type text,
  source_reference text,
  responsible_label text,
  due_at timestamptz,
  evidence text,
  blocking_reason text,
  blocking_owner_label text,
  next_check_at timestamptz,
  completed_at timestamptz,
  completed_by_label text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id,module_code),
  check (requirement <> 'required' or status <> 'not_applicable'),
  check (requirement <> 'not_required' or status in ('pending','not_applicable'))
);

create index if not exists project_onboarding_items_gate_idx
  on public.project_onboarding_items(project_id,requirement,status);
create index if not exists project_onboarding_items_blocked_idx
  on public.project_onboarding_items(status,next_check_at)
  where status='blocked';

create or replace function public.ensure_project_onboarding_items(p_project_id uuid)
returns void language plpgsql set search_path=public as $$
declare
  v_company_id uuid;
  v_proposal_id uuid;
  v_diagnostic_id uuid;
begin
  select p.company_id,p.proposal_id,pr.diagnostic_id
  into v_company_id,v_proposal_id,v_diagnostic_id
  from public.projects p
  join public.proposals pr on pr.id=p.proposal_id
  where p.id=p_project_id;

  if v_company_id is null then raise exception 'project not found'; end if;

  insert into public.project_onboarding_items(
    project_id,module_code,label,category,requirement,status,source_type,source_reference
  ) values
    (p_project_id,'operational_owner_confirmed','Responsável operacional confirmado','governance','required','pending','company',v_company_id::text),
    (p_project_id,'communication_flow_defined','Fluxo de comunicação e aprovações definido','communication','required','pending','project',p_project_id::text),
    (p_project_id,'delivery_plan_confirmed','Plano inicial de entregas confirmado','planning','required','pending','proposal',v_proposal_id::text),
    (p_project_id,'measurement_baseline_confirmed','Linha de base/forma de medição confirmada','measurement','required','pending','diagnostic',v_diagnostic_id::text),
    (p_project_id,'kickoff_completed','Kickoff concluído','kickoff','required','pending','project',p_project_id::text),
    (p_project_id,'solution_specific_setup','Configuração específica da solução','solution','to_define','pending','solution',null)
  on conflict (project_id,module_code) do nothing;
end; $$;

create or replace function public.project_onboarding_gate_ready(p_project_id uuid)
returns boolean language sql stable set search_path=public as $$
  select
    exists(select 1 from public.project_onboarding_items where project_id=p_project_id)
    and not exists(
      select 1 from public.project_onboarding_items
      where project_id=p_project_id
        and (
          requirement='to_define'
          or (requirement='required' and status not in ('done','waived'))
        )
    )
$$;

create or replace view public.project_onboarding_readiness as
select
  p.id as project_id,
  count(i.id)::integer as item_count,
  count(*) filter (where i.requirement='to_define')::integer as unresolved_applicability_count,
  count(*) filter (where i.requirement='required' and i.status not in ('done','waived'))::integer as blocking_count,
  count(*) filter (where i.status='blocked')::integer as blocked_item_count,
  coalesce(jsonb_agg(i.module_code order by i.module_code)
    filter (where i.requirement='to_define' or (i.requirement='required' and i.status not in ('done','waived'))),'[]'::jsonb) as pending_modules,
  public.project_onboarding_gate_ready(p.id) as ready_for_operation,
  case when public.project_onboarding_gate_ready(p.id) then 'ready_for_operation' else 'onboarding_incomplete' end as gate_status
from public.projects p
left join public.project_onboarding_items i on i.project_id=p.id
group by p.id;

create or replace function public.refresh_project_onboarding_gate(p_project_id uuid,p_actor_label text)
returns void language plpgsql set search_path=public as $$
declare
  v_opportunity_id uuid;
  v_stage text;
  v_ready boolean;
  v_title text;
  v_previous text;
begin
  select pr.opportunity_id into v_opportunity_id
  from public.projects p join public.proposals pr on pr.id=p.proposal_id
  where p.id=p_project_id;
  if v_opportunity_id is null then return; end if;

  select pipeline_stage into v_stage from public.commercial_opportunities
  where id=v_opportunity_id and outcome_status is null;
  if v_stage<>'P13' then return; end if;

  v_ready:=public.project_onboarding_gate_ready(p_project_id);
  v_title:=case when v_ready then 'Ativar projeto e liberar operação' else 'Concluir onboarding e liberar operação' end;
  select next_action_title into v_previous from public.commercial_opportunities where id=v_opportunity_id;

  update public.commercial_opportunities
  set next_action_title=v_title,next_action_at=now(),next_action_channel='interno',updated_at=now()
  where id=v_opportunity_id;

  if v_previous is distinct from v_title then
    insert into public.commercial_opportunity_events(opportunity_id,event_type,summary,actor_label,payload)
    values(v_opportunity_id,'next_action_changed',v_title,coalesce(nullif(trim(p_actor_label),''),'system'),jsonb_build_object('project_id',p_project_id,'onboarding_ready',v_ready));
  end if;
end; $$;

create or replace function public.set_project_onboarding_item(
  p_project_id uuid,
  p_module_code text,
  p_requirement text,
  p_status text,
  p_evidence text,
  p_responsible_label text,
  p_due_at timestamptz,
  p_blocking_reason text,
  p_blocking_owner_label text,
  p_next_check_at timestamptz,
  p_notes text,
  p_actor_label text
) returns uuid language plpgsql set search_path=public as $$
declare
  v_id uuid;
  v_status text:=p_status;
begin
  perform public.ensure_project_onboarding_items(p_project_id);

  if p_requirement not in ('required','not_required','to_define') then raise exception 'invalid onboarding requirement'; end if;
  if p_status not in ('pending','in_progress','blocked','done','waived','not_applicable') then raise exception 'invalid onboarding status'; end if;
  if p_requirement='required' and p_status='not_applicable' then raise exception 'required onboarding item cannot be not applicable'; end if;
  if p_requirement='not_required' then v_status:='not_applicable'; end if;
  if v_status='done' and nullif(trim(coalesce(p_evidence,'')),'') is null then raise exception 'onboarding completion evidence is required'; end if;
  if v_status='waived' and nullif(trim(coalesce(p_notes,'')),'') is null then raise exception 'waived onboarding item requires notes'; end if;
  if v_status='blocked' and (
    nullif(trim(coalesce(p_blocking_reason,'')),'') is null
    or nullif(trim(coalesce(p_blocking_owner_label,'')),'') is null
    or p_next_check_at is null
  ) then raise exception 'blocked onboarding item requires reason, owner and next check date'; end if;

  update public.project_onboarding_items
  set requirement=p_requirement,
      status=v_status,
      evidence=case when v_status='done' then trim(p_evidence) else nullif(trim(coalesce(p_evidence,'')),'') end,
      responsible_label=nullif(trim(coalesce(p_responsible_label,'')),''),
      due_at=p_due_at,
      blocking_reason=case when v_status='blocked' then trim(p_blocking_reason) else null end,
      blocking_owner_label=case when v_status='blocked' then trim(p_blocking_owner_label) else null end,
      next_check_at=case when v_status='blocked' then p_next_check_at else null end,
      completed_at=case when v_status in ('done','waived','not_applicable') then now() else null end,
      completed_by_label=case when v_status in ('done','waived','not_applicable') then nullif(trim(coalesce(p_actor_label,'')),'') else null end,
      notes=nullif(trim(coalesce(p_notes,'')),''),
      updated_at=now()
  where project_id=p_project_id and module_code=p_module_code
  returning id into v_id;

  if v_id is null then raise exception 'onboarding item not found'; end if;

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('project_onboarding_item',v_id,'project_onboarding_item_updated',
    public.commercial_audit_actor_type(p_actor_label),
    coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),
    jsonb_build_object('project_id',p_project_id,'module_code',p_module_code,'requirement',p_requirement,'status',v_status));

  perform public.refresh_project_onboarding_gate(p_project_id,p_actor_label);
  return v_id;
end; $$;

create or replace function public.project_onboarding_seed_trigger()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.status='onboarding' then
    perform public.ensure_project_onboarding_items(new.id);
    perform public.refresh_project_onboarding_gate(new.id,'system');
  end if;
  return new;
end; $$;

drop trigger if exists project_onboarding_seed_trg on public.projects;
create trigger project_onboarding_seed_trg
  after insert on public.projects
  for each row execute function public.project_onboarding_seed_trigger();

-- Backfill seguro para projetos que já estavam em onboarding quando a migração entrou.
do $$
declare r record;
begin
  for r in select id from public.projects where status='onboarding' loop
    perform public.ensure_project_onboarding_items(r.id);
    perform public.refresh_project_onboarding_gate(r.id,'system');
  end loop;
end $$;

create or replace function public.activate_project(p_project_id uuid,p_actor_label text)
returns uuid language plpgsql set search_path=public as $$
declare
  v_proposal_id uuid;
  v_diagnostic_id uuid;
  v_pre_diagnostic_id uuid;
  v_opportunity_id uuid;
begin
  select pr.proposal_id,p.diagnostic_id,d.pre_diagnostic_id,p.opportunity_id
  into v_proposal_id,v_diagnostic_id,v_pre_diagnostic_id,v_opportunity_id
  from public.projects pr
  join public.proposals p on p.id=pr.proposal_id
  join public.diagnostics d on d.id=p.diagnostic_id
  where pr.id=p_project_id and pr.status='onboarding';

  if v_proposal_id is null then raise exception 'project is not in onboarding'; end if;
  perform public.ensure_project_onboarding_items(p_project_id);

  if not exists(select 1 from public.project_tasks t where t.project_id=p_project_id and t.status<>'cancelled') then
    raise exception 'project requires at least one initial task';
  end if;
  if not public.commercial_start_gate_ready(v_opportunity_id) then
    raise exception 'BLOQUEADO PARA OPERAÇÃO: condições de início não estão válidas';
  end if;
  if not public.project_onboarding_gate_ready(p_project_id) then
    raise exception 'BLOQUEADO PARA OPERAÇÃO: onboarding obrigatório incompleto';
  end if;

  update public.projects set status='active',updated_at=now() where id=p_project_id;

  update public.crm_actions set status='done',completed_at=now()
  where pre_diagnostic_id=v_pre_diagnostic_id and action_type='project_onboarding' and status in ('pending','in_progress');

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('project',p_project_id,'project_activated_after_onboarding_gate',
    public.commercial_audit_actor_type(p_actor_label),
    coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),
    jsonb_build_object('proposal_id',v_proposal_id,'diagnostic_id',v_diagnostic_id,'opportunity_id',v_opportunity_id,'new_status','active'));

  return p_project_id;
end; $$;

-- Defesa contra alteração direta de status do projeto: P14 exige os dois gates.
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
    perform public.ensure_project_onboarding_items(new.id);
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
    if not public.project_onboarding_gate_ready(new.id) then
      raise exception 'BLOQUEADO PARA OPERAÇÃO: onboarding obrigatório incompleto';
    end if;
    perform public.set_commercial_opportunity_stage(v_id,'P14',coalesce(new.created_by_label,'Blinko'),null,null,null,'Projeto liberado para operação após onboarding.','system');
    perform public.close_commercial_opportunity(v_id,'won',null,null,'system');
  end if;
  return new;
end; $$;
