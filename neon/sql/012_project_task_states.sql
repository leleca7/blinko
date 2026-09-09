-- Blinko OS — tarefa operacional completa
-- Alinha project_tasks ao Documento 06/08 sem alterar a lógica comercial.

alter table public.project_tasks
  add column if not exists dependency_note text,
  add column if not exists blocking_reason text,
  add column if not exists blocking_owner_label text,
  add column if not exists blocking_impact text,
  add column if not exists next_check_at timestamptz,
  add column if not exists completed_at timestamptz;

alter table public.project_tasks
  drop constraint if exists project_tasks_status_check;

alter table public.project_tasks
  add constraint project_tasks_status_check
  check (status in (
    'pending',
    'in_progress',
    'waiting_client',
    'waiting_partner',
    'blocked',
    'done',
    'cancelled'
  ));

create index if not exists project_tasks_next_check_idx
  on public.project_tasks (status, next_check_at)
  where status in ('waiting_client', 'waiting_partner', 'blocked');

create or replace function public.update_project_task_state(
  p_task_id uuid,
  p_actor_label text,
  p_new_status text,
  p_dependency_note text default null,
  p_blocking_reason text default null,
  p_blocking_owner_label text default null,
  p_blocking_impact text default null,
  p_next_check_at timestamptz default null,
  p_completion_evidence text default null
)
returns uuid
language plpgsql
set search_path = public
as $update_project_task_state$
declare
  v_previous_status text;
  v_project_id uuid;
begin
  select status, project_id
    into v_previous_status, v_project_id
  from public.project_tasks
  where id = p_task_id
  for update;

  if v_project_id is null then
    raise exception 'project task not found';
  end if;

  if p_new_status not in (
    'pending', 'in_progress', 'waiting_client', 'waiting_partner',
    'blocked', 'done', 'cancelled'
  ) then
    raise exception 'invalid project task status';
  end if;

  if p_new_status in ('waiting_client', 'waiting_partner') then
    if nullif(trim(coalesce(p_dependency_note, '')), '') is null then
      raise exception 'dependency note is required while waiting for an external party';
    end if;
    if p_next_check_at is null then
      raise exception 'next check date is required while waiting for an external party';
    end if;
  end if;

  if p_new_status = 'blocked' then
    if nullif(trim(coalesce(p_blocking_reason, '')), '') is null
       or nullif(trim(coalesce(p_blocking_owner_label, '')), '') is null
       or nullif(trim(coalesce(p_blocking_impact, '')), '') is null
       or p_next_check_at is null then
      raise exception 'blocked task requires reason, unblock owner, impact and next check date';
    end if;
  end if;

  if p_new_status = 'done'
     and nullif(trim(coalesce(p_completion_evidence, '')), '') is null then
    raise exception 'completion evidence is required to finish a task';
  end if;

  update public.project_tasks
     set status = p_new_status,
         dependency_note = case
           when p_new_status in ('waiting_client', 'waiting_partner')
             then nullif(trim(coalesce(p_dependency_note, '')), '')
           else null
         end,
         blocking_reason = case
           when p_new_status = 'blocked'
             then nullif(trim(coalesce(p_blocking_reason, '')), '')
           else null
         end,
         blocking_owner_label = case
           when p_new_status = 'blocked'
             then nullif(trim(coalesce(p_blocking_owner_label, '')), '')
           else null
         end,
         blocking_impact = case
           when p_new_status = 'blocked'
             then nullif(trim(coalesce(p_blocking_impact, '')), '')
           else null
         end,
         next_check_at = case
           when p_new_status in ('waiting_client', 'waiting_partner', 'blocked') then p_next_check_at
           else null
         end,
         completion_evidence = case
           when p_new_status = 'done'
             then trim(p_completion_evidence)
           else completion_evidence
         end,
         completed_at = case
           when p_new_status = 'done' then now()
           when v_previous_status = 'done' and p_new_status <> 'done' then null
           else completed_at
         end,
         updated_at = now()
   where id = p_task_id;

  insert into public.audit_events (
    entity_type,
    entity_id,
    event_type,
    actor_type,
    actor_id,
    payload
  ) values (
    'project_task',
    p_task_id,
    'project_task_state_changed',
    'human',
    coalesce(nullif(trim(coalesce(p_actor_label, '')), ''), 'unknown'),
    jsonb_build_object(
      'project_id', v_project_id,
      'previous_status', v_previous_status,
      'new_status', p_new_status,
      'dependency_note', nullif(trim(coalesce(p_dependency_note, '')), ''),
      'blocking_reason', nullif(trim(coalesce(p_blocking_reason, '')), ''),
      'blocking_owner_label', nullif(trim(coalesce(p_blocking_owner_label, '')), ''),
      'blocking_impact', nullif(trim(coalesce(p_blocking_impact, '')), ''),
      'next_check_at', p_next_check_at,
      'has_completion_evidence', nullif(trim(coalesce(p_completion_evidence, '')), '') is not null
    )
  );

  return p_task_id;
end;
$update_project_task_state$;
