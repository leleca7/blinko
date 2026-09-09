-- Blinko OS — arquivos/Drive + aprovações gerais
-- Destinado primeiro à branch de simulação. Não aplicar em produção sem validação.

create table if not exists public.drive_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  task_id uuid references public.project_tasks(id) on delete set null,
  parent_item_id uuid references public.drive_items(id) on delete set null,
  drive_file_id text not null unique,
  drive_url text not null,
  item_kind text not null check (item_kind in ('folder','file')),
  context_type text not null check (context_type in ('company_root','client_area','project_root','project_area','briefing','input','working_file','approval_file','delivery','evidence','partner','finance','report','other')),
  title text not null,
  mime_type text,
  logical_path text,
  version_label text,
  status text not null default 'active' check (status in ('active','superseded','archived')),
  created_by_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists drive_items_company_idx on public.drive_items(company_id, context_type, status);
create index if not exists drive_items_project_idx on public.drive_items(project_id, context_type, status) where project_id is not null;

create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid references public.project_tasks(id) on delete set null,
  drive_item_id uuid references public.drive_items(id) on delete set null,
  deliverable_key text,
  title text not null,
  version_label text not null,
  status text not null default 'draft' check (status in ('draft','pending','approved','changes_requested','cancelled')),
  requested_by_label text,
  requested_at timestamptz,
  due_at timestamptz,
  responded_by_label text,
  responded_at timestamptz,
  response_notes text,
  evidence_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists approvals_project_idx on public.approvals(project_id, status, due_at);
create index if not exists approvals_pending_idx on public.approvals(status, due_at) where status = 'pending';

create or replace function public.register_drive_item(
  p_company_id uuid,
  p_project_id uuid,
  p_task_id uuid,
  p_parent_item_id uuid,
  p_drive_file_id text,
  p_drive_url text,
  p_item_kind text,
  p_context_type text,
  p_title text,
  p_mime_type text,
  p_logical_path text,
  p_version_label text,
  p_actor_label text
) returns uuid
language plpgsql
set search_path=public
as $$
declare v_id uuid;
begin
  insert into public.drive_items(company_id,project_id,task_id,parent_item_id,drive_file_id,drive_url,item_kind,context_type,title,mime_type,logical_path,version_label,created_by_label)
  values(p_company_id,p_project_id,p_task_id,p_parent_item_id,trim(p_drive_file_id),trim(p_drive_url),p_item_kind,p_context_type,trim(p_title),nullif(trim(coalesce(p_mime_type,'')),''),nullif(trim(coalesce(p_logical_path,'')),''),nullif(trim(coalesce(p_version_label,'')),''),nullif(trim(coalesce(p_actor_label,'')),''))
  on conflict (drive_file_id) do update set
    company_id=excluded.company_id, project_id=excluded.project_id, task_id=excluded.task_id,
    parent_item_id=excluded.parent_item_id, drive_url=excluded.drive_url, item_kind=excluded.item_kind,
    context_type=excluded.context_type, title=excluded.title, mime_type=excluded.mime_type,
    logical_path=excluded.logical_path, version_label=excluded.version_label, status='active', updated_at=now()
  returning id into v_id;
  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('drive_item',v_id,'drive_item_registered','human',coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),jsonb_build_object('company_id',p_company_id,'project_id',p_project_id,'drive_file_id',p_drive_file_id,'context_type',p_context_type));
  return v_id;
end; $$;

create or replace function public.request_approval(
  p_project_id uuid,
  p_task_id uuid,
  p_drive_item_id uuid,
  p_deliverable_key text,
  p_title text,
  p_version_label text,
  p_actor_label text,
  p_due_at timestamptz
) returns uuid
language plpgsql
set search_path=public
as $$
declare v_id uuid; v_company_id uuid;
begin
  select company_id into v_company_id from public.projects where id=p_project_id;
  if v_company_id is null then raise exception 'project not found'; end if;
  if p_drive_item_id is not null and not exists(select 1 from public.drive_items where id=p_drive_item_id and project_id=p_project_id) then raise exception 'drive item does not belong to project'; end if;
  insert into public.approvals(company_id,project_id,task_id,drive_item_id,deliverable_key,title,version_label,status,requested_by_label,requested_at,due_at)
  values(v_company_id,p_project_id,p_task_id,p_drive_item_id,nullif(trim(coalesce(p_deliverable_key,'')),''),trim(p_title),trim(p_version_label),'pending',nullif(trim(coalesce(p_actor_label,'')),''),now(),p_due_at)
  returning id into v_id;
  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('approval',v_id,'approval_requested','human',coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),jsonb_build_object('project_id',p_project_id,'task_id',p_task_id,'drive_item_id',p_drive_item_id,'version_label',p_version_label));
  return v_id;
end; $$;

create or replace function public.record_approval_decision(
  p_approval_id uuid,
  p_decision text,
  p_actor_label text,
  p_notes text,
  p_evidence_reference text
) returns uuid
language plpgsql
set search_path=public
as $$
declare v_previous text;
begin
  select status into v_previous from public.approvals where id=p_approval_id for update;
  if v_previous <> 'pending' then raise exception 'approval is not pending'; end if;
  if p_decision not in ('approved','changes_requested') then raise exception 'invalid approval decision'; end if;
  update public.approvals set status=p_decision, responded_by_label=nullif(trim(coalesce(p_actor_label,'')),''), responded_at=now(), response_notes=nullif(trim(coalesce(p_notes,'')),''), evidence_reference=nullif(trim(coalesce(p_evidence_reference,'')),''), updated_at=now() where id=p_approval_id;
  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('approval',p_approval_id,'approval_'||p_decision,'human',coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),jsonb_build_object('previous_status',v_previous,'notes',nullif(trim(coalesce(p_notes,'')),''),'evidence_reference',nullif(trim(coalesce(p_evidence_reference,'')),'')));
  return p_approval_id;
end; $$;
