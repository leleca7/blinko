-- Blinko OS — controle especializado da rota de execução
-- Depende de 032_project_solution_gate_hardening.sql.
-- O setter genérico de onboarding não pode concluir módulo de rota;
-- somente esta função especializada pode fazê-lo.

create or replace function public.set_project_solution_route(
  p_project_id uuid,
  p_project_solution_id uuid,
  p_route text,
  p_actor_label text
)
returns uuid
language plpgsql
set search_path=public
as $$
declare
  v_blueprint_id uuid;
  v_intervention_id uuid;
  v_code text;
  v_routes text[];
  v_module text;
  v_project_status text;
  v_onboarding_item_id uuid;
begin
  select status into v_project_status from public.projects where id=p_project_id for update;
  if v_project_status is null then raise exception 'project not found'; end if;
  if v_project_status<>'onboarding' then raise exception 'execution route can only be defined during onboarding'; end if;

  perform public.ensure_project_onboarding_items(p_project_id);

  select ps.blueprint_id,ps.intervention_id,ps.solution_code,b.execution_routes
    into v_blueprint_id,v_intervention_id,v_code,v_routes
  from public.project_solutions ps
  join public.solution_blueprints b on b.id=ps.blueprint_id
  where ps.id=p_project_solution_id and ps.project_id=p_project_id
  for update;

  if v_blueprint_id is null then raise exception 'project solution not found'; end if;
  if p_route is null or not (p_route=any(v_routes)) then
    raise exception 'execution route is not allowed for solution %',v_code;
  end if;

  update public.project_solutions
     set selected_route=p_route,route_status='confirmed',updated_at=now()
   where id=p_project_solution_id;

  update public.diagnostic_interventions
     set selected_execution_route=p_route,updated_at=now()
   where id=v_intervention_id;

  v_module:='solution_'||lower(v_code)||'_route';
  update public.project_onboarding_items
     set requirement='required',
         status='done',
         evidence='Rota '||p_route||' confirmada para '||v_code||'.',
         completed_at=now(),
         completed_by_label=nullif(trim(coalesce(p_actor_label,'')),''),
         notes='Rota escolhida entre as permitidas pelo catálogo oficial: '||array_to_string(v_routes,', ')||'.',
         updated_at=now()
   where project_id=p_project_id and module_code=v_module
   returning id into v_onboarding_item_id;

  if v_onboarding_item_id is null then
    raise exception 'solution route onboarding item not found';
  end if;

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values(
    'project_solution',p_project_solution_id,'project_solution_route_confirmed',
    public.commercial_audit_actor_type(p_actor_label),
    coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),
    jsonb_build_object(
      'project_id',p_project_id,
      'solution_code',v_code,
      'route',p_route,
      'onboarding_item_id',v_onboarding_item_id
    )
  );

  perform public.refresh_project_onboarding_gate(p_project_id,p_actor_label);
  return p_project_solution_id;
end;
$$;
