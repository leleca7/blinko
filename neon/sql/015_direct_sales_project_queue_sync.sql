-- Blinko OS — Venda direta — sincronização da fila ao criar projeto
-- Garante que a ação "criar projeto" não permaneça pendente depois que o projeto existe.

create or replace function public.sync_direct_project_creation_action()
returns trigger
language plpgsql
set search_path = public
as $sync_direct_project_creation_action$
declare
  v_lead_id uuid;
begin
  if new.direct_opportunity_id is null then
    return new;
  end if;

  select lead_id into v_lead_id
  from public.direct_opportunities
  where id = new.direct_opportunity_id;

  if v_lead_id is not null then
    update public.crm_actions
       set status = 'done', completed_at = now()
     where lead_id = v_lead_id
       and action_type = 'direct_opportunity_create_project'
       and status in ('pending','in_progress')
       and payload->>'direct_opportunity_id' = new.direct_opportunity_id::text;
  end if;

  return new;
end;
$sync_direct_project_creation_action$;

drop trigger if exists projects_sync_direct_creation_action on public.projects;

create trigger projects_sync_direct_creation_action
after insert or update of direct_opportunity_id on public.projects
for each row
when (new.direct_opportunity_id is not null)
execute function public.sync_direct_project_creation_action();
