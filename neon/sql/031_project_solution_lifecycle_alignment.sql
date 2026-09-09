-- Blinko OS — alinhamento do ciclo de solução com o ciclo do projeto
-- Depende de 030_official_solution_catalog.sql.
-- Não inventa rota para projeto histórico: ausência permanece como lacuna histórica.

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
    on conflict(project_id,module_code) do nothing;

    if jsonb_array_length(v_blueprint.prerequisites)>0 then
      v_module:='solution_'||lower(v_blueprint.official_code)||'_prerequisites';
      insert into public.project_onboarding_items(project_id,solution_code,module_code,label,category,requirement,status,source_type,source_reference,notes)
      values(p_project_id,v_blueprint.official_code,v_module,v_blueprint.official_code||' · Pré-requisitos da solução validados','solution','required','pending','solution',v_blueprint.id::text,v_blueprint.prerequisites::text)
      on conflict(project_id,module_code) do nothing;
    end if;
  end loop;

  if exists(select 1 from public.project_solutions where project_id=p_project_id) then
    update public.project_onboarding_items
       set requirement='not_required',status='not_applicable',notes='Substituído pelos módulos específicos das soluções oficiais.',updated_at=now()
     where project_id=p_project_id and module_code='solution_specific_setup' and requirement='to_define';
  end if;
end; $$;

create or replace function public.set_project_solution_route(p_project_id uuid,p_project_solution_id uuid,p_route text,p_actor_label text)
returns uuid language plpgsql set search_path=public as $$
declare v_blueprint_id uuid;v_intervention_id uuid;v_code text;v_routes text[];v_module text;v_project_status text;
begin
  select status into v_project_status from public.projects where id=p_project_id for update;
  if v_project_status is null then raise exception 'project not found'; end if;
  if v_project_status<>'onboarding' then raise exception 'execution route can only be defined during onboarding'; end if;

  perform public.ensure_project_onboarding_items(p_project_id);
  select ps.blueprint_id,ps.intervention_id,ps.solution_code,b.execution_routes
    into v_blueprint_id,v_intervention_id,v_code,v_routes
  from public.project_solutions ps join public.solution_blueprints b on b.id=ps.blueprint_id
  where ps.id=p_project_solution_id and ps.project_id=p_project_id for update;
  if v_blueprint_id is null then raise exception 'project solution not found'; end if;
  if p_route is null or not (p_route=any(v_routes)) then raise exception 'execution route is not allowed for solution %',v_code; end if;

  update public.project_solutions set selected_route=p_route,route_status='confirmed',updated_at=now() where id=p_project_solution_id;
  update public.diagnostic_interventions set selected_execution_route=p_route,updated_at=now() where id=v_intervention_id;
  v_module:='solution_'||lower(v_code)||'_route';
  perform public.set_project_onboarding_item(p_project_id,v_module,'required','done','Rota '||p_route||' confirmada para '||v_code||'.',p_actor_label,null,null,null,null,'Rota escolhida entre as permitidas pelo catálogo oficial.',p_actor_label);

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('project_solution',p_project_solution_id,'project_solution_route_confirmed',public.commercial_audit_actor_type(p_actor_label),
    coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),jsonb_build_object('project_id',p_project_id,'solution_code',v_code,'route',p_route));
  return p_project_solution_id;
end; $$;

create or replace function public.project_solution_sync_from_project()
returns trigger language plpgsql set search_path=public as $$
begin
  perform public.ensure_project_solution_links(new.id);
  if new.status in ('active','waiting_client','at_risk') then
    update public.project_solutions set status='active',updated_at=now() where project_id=new.id and status in ('onboarding','paused');
  elsif new.status='paused' then
    update public.project_solutions set status='paused',updated_at=now() where project_id=new.id and status in ('onboarding','active');
  elsif new.status in ('completed','closed') then
    update public.project_solutions set status='completed',updated_at=now() where project_id=new.id and status not in ('completed','cancelled');
  end if;
  return new;
end; $$;

-- Corrige apenas o status derivado do projeto; selected_route permanece intacta/null.
update public.project_solutions ps
set status=case
      when p.status='onboarding' then 'onboarding'
      when p.status in ('active','waiting_client','at_risk') then 'active'
      when p.status='paused' then 'paused'
      when p.status in ('completed','closed') then 'completed'
      else ps.status
    end,
    updated_at=now()
from public.projects p
where p.id=ps.project_id;
