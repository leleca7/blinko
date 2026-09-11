-- Blinko OS — endurecimento dos gates de solução oficial
-- Depende de 030–031.
-- Rota de execução não pode ser concluída pelo checklist genérico;
-- soluções não-ativas exigem validação explícita de viabilidade antes da operação.

create or replace function public.ensure_project_solution_links(p_project_id uuid)
returns void language plpgsql set search_path=public as $$
declare
  v_company_id uuid;v_created_by text;v_project_status text;v_solution_status text;
  v_item text;v_intervention public.diagnostic_interventions%rowtype;
  v_blueprint public.solution_blueprints%rowtype;v_company_solution_id uuid;v_project_solution_id uuid;v_module text;
begin
  select company_id,created_by_label,status into v_company_id,v_created_by,v_project_status
  from public.projects where id=p_project_id;
  if v_company_id is null then raise exception 'project not found'; end if;

  v_solution_status:=case
    when v_project_status='onboarding' then 'onboarding'
    when v_project_status in ('active','waiting_client','at_risk') then 'active'
    when v_project_status='paused' then 'paused'
    when v_project_status in ('completed','closed') then 'completed'
    else 'onboarding'
  end;

  for v_item in select value from jsonb_array_elements_text(coalesce((select intervention_ids from public.projects where id=p_project_id),'[]'::jsonb)) loop
    select * into v_intervention from public.diagnostic_interventions where id=v_item::uuid;
    if v_intervention.id is null then continue; end if;
    if v_intervention.blueprint_id is null and v_intervention.library_key ~* '^S(0[1-9]|[1-3][0-9]|40)$' then
      select id into v_intervention.blueprint_id from public.solution_blueprints where official_code=upper(trim(v_intervention.library_key));
      if v_intervention.blueprint_id is not null then
        update public.diagnostic_interventions set blueprint_id=v_intervention.blueprint_id,updated_at=now() where id=v_intervention.id;
      end if;
    end if;
    if v_intervention.blueprint_id is null then continue; end if;

    select * into v_blueprint from public.solution_blueprints where id=v_intervention.blueprint_id and official_code is not null;
    if v_blueprint.id is null then continue; end if;

    insert into public.company_solutions(company_id,blueprint_id,status,selected_version,notes,selected_by_label)
    values(v_company_id,v_blueprint.id,'selected',coalesce(v_blueprint.source_version,v_blueprint.version),
      'Originada de intervenção validada no Diagnóstico Blinko.',coalesce(v_created_by,'system'))
    on conflict(company_id,blueprint_id) do update set selected_version=excluded.selected_version,updated_at=now()
    returning id into v_company_solution_id;

    insert into public.project_solutions(project_id,intervention_id,blueprint_id,company_solution_id,solution_code,selected_route,route_status,status)
    values(p_project_id,v_intervention.id,v_blueprint.id,v_company_solution_id,v_blueprint.official_code,v_intervention.selected_execution_route,
      case when v_intervention.selected_execution_route is null then 'to_define' else 'confirmed' end,v_solution_status)
    on conflict(project_id,intervention_id) do update
      set blueprint_id=excluded.blueprint_id,company_solution_id=excluded.company_solution_id,solution_code=excluded.solution_code,
          selected_route=coalesce(public.project_solutions.selected_route,excluded.selected_route),
          route_status=case when coalesce(public.project_solutions.selected_route,excluded.selected_route) is null then 'to_define' else 'confirmed' end,
          status=v_solution_status,updated_at=now()
    returning id into v_project_solution_id;

    v_module:='solution_'||lower(v_blueprint.official_code)||'_route';
    insert into public.project_onboarding_items(project_id,solution_code,module_code,label,category,requirement,status,source_type,source_reference,evidence,notes)
    values(p_project_id,v_blueprint.official_code,v_module,v_blueprint.official_code||' · Rota de execução confirmada','solution','required',
      case when v_intervention.selected_execution_route is null then 'pending' else 'done' end,
      'solution',v_blueprint.id::text,
      case when v_intervention.selected_execution_route is null then null else 'Rota '||v_intervention.selected_execution_route||' registrada na intervenção.' end,
      'Rotas permitidas: '||array_to_string(v_blueprint.execution_routes,', '))
    on conflict(project_id,module_code) do update
      set status=case when v_intervention.selected_execution_route is null then 'pending' else 'done' end,
          evidence=case when v_intervention.selected_execution_route is null then null else 'Rota '||v_intervention.selected_execution_route||' registrada na intervenção.' end,
          notes='Rotas permitidas: '||array_to_string(v_blueprint.execution_routes,', '),updated_at=now();

    if jsonb_array_length(v_blueprint.prerequisites)>0 then
      v_module:='solution_'||lower(v_blueprint.official_code)||'_prerequisites';
      insert into public.project_onboarding_items(project_id,solution_code,module_code,label,category,requirement,status,source_type,source_reference,notes)
      values(p_project_id,v_blueprint.official_code,v_module,v_blueprint.official_code||' · Pré-requisitos da solução validados','solution','required','pending','solution',v_blueprint.id::text,v_blueprint.prerequisites::text)
      on conflict(project_id,module_code) do nothing;
    end if;

    if v_blueprint.catalog_status<>'active' then
      v_module:='solution_'||lower(v_blueprint.official_code)||'_viability';
      insert into public.project_onboarding_items(project_id,solution_code,module_code,label,category,requirement,status,source_type,source_reference,notes)
      values(p_project_id,v_blueprint.official_code,v_module,v_blueprint.official_code||' · Viabilidade/status do catálogo validado','solution','required','pending','solution',v_blueprint.id::text,
        'Status oficial: '||coalesce(v_blueprint.official_status,v_blueprint.catalog_status)||'. Validar capacidade, escopo, parceiro e condições aplicáveis antes de liberar operação.')
      on conflict(project_id,module_code) do nothing;
    end if;
  end loop;

  if exists(select 1 from public.project_solutions where project_id=p_project_id) then
    update public.project_onboarding_items
       set requirement='not_required',status='not_applicable',notes='Substituído pelos módulos específicos das soluções oficiais.',updated_at=now()
     where project_id=p_project_id and module_code='solution_specific_setup' and requirement='to_define';
  end if;
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
    and not exists(
      select 1 from public.project_solutions
      where project_id=p_project_id and route_status<>'confirmed'
    )
$$;

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
declare v_id uuid;v_status text:=p_status;
begin
  perform public.ensure_project_onboarding_items(p_project_id);

  if p_module_code ~ '^solution_s(0[1-9]|[1-3][0-9]|40)_route$' then
    raise exception 'solution route must be confirmed through project solution route control';
  end if;
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
  set requirement=p_requirement,status=v_status,
      evidence=case when v_status='done' then trim(p_evidence) else nullif(trim(coalesce(p_evidence,'')),'') end,
      responsible_label=nullif(trim(coalesce(p_responsible_label,'')),''),due_at=p_due_at,
      blocking_reason=case when v_status='blocked' then trim(p_blocking_reason) else null end,
      blocking_owner_label=case when v_status='blocked' then trim(p_blocking_owner_label) else null end,
      next_check_at=case when v_status='blocked' then p_next_check_at else null end,
      completed_at=case when v_status in ('done','waived','not_applicable') then now() else null end,
      completed_by_label=case when v_status in ('done','waived','not_applicable') then nullif(trim(coalesce(p_actor_label,'')),'') else null end,
      notes=nullif(trim(coalesce(p_notes,'')),''),updated_at=now()
  where project_id=p_project_id and module_code=p_module_code
  returning id into v_id;
  if v_id is null then raise exception 'onboarding item not found'; end if;

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('project_onboarding_item',v_id,'project_onboarding_item_updated',public.commercial_audit_actor_type(p_actor_label),
    coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),
    jsonb_build_object('project_id',p_project_id,'module_code',p_module_code,'requirement',p_requirement,'status',v_status));

  perform public.refresh_project_onboarding_gate(p_project_id,p_actor_label);
  return v_id;
end; $$;

-- Reaplica as regras aos projetos existentes sem mudar rotas históricas.
do $$ declare r record; begin
  for r in select id from public.projects loop perform public.ensure_project_onboarding_items(r.id); end loop;
end $$;
