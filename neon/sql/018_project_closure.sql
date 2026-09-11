-- Blinko OS — encerramento controlado de projeto
-- Aplicação inicial: branch de simulação.

create table if not exists public.project_closures (
  project_id uuid primary key references public.projects(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  status text not null default 'prepared' check (status in ('prepared','closed')),
  delivery_summary text not null,
  delivery_evidence_reference text not null,
  result_summary text not null,
  lessons_learned text not null,
  client_feedback_status text not null check (client_feedback_status in ('not_requested','requested','received','unavailable')),
  client_feedback_notes text,
  finance_pending_note text,
  next_step text not null check (next_step in ('none','monitor','reassessment','renewal','new_opportunity')),
  reassessment_required boolean not null default false,
  prepared_by_label text,
  prepared_at timestamptz not null default now(),
  closed_by_label text,
  closed_at timestamptz,
  updated_at timestamptz not null default now()
);

create or replace function public.prepare_project_closure(
  p_project_id uuid,
  p_actor_label text,
  p_delivery_summary text,
  p_delivery_evidence_reference text,
  p_result_summary text,
  p_lessons_learned text,
  p_client_feedback_status text,
  p_client_feedback_notes text,
  p_finance_pending_note text,
  p_next_step text,
  p_reassessment_required boolean
) returns uuid language plpgsql set search_path=public as $$
declare
  v_company_id uuid;
  v_status text;
  v_open_tasks integer;
  v_open_approvals integer;
  v_open_receivables numeric;
  v_open_costs numeric;
  v_evidence_tasks integer;
begin
  select company_id,status into v_company_id,v_status from public.projects where id=p_project_id for update;
  if v_company_id is null then raise exception 'project not found'; end if;
  if v_status not in ('active','waiting_client','at_risk') then raise exception 'project is not eligible for closure preparation'; end if;

  select count(*) into v_open_tasks from public.project_tasks where project_id=p_project_id and status not in ('done','cancelled');
  if v_open_tasks > 0 then raise exception 'project has open tasks'; end if;

  select count(*) into v_open_approvals from public.approvals where project_id=p_project_id and status in ('draft','pending','changes_requested');
  if v_open_approvals > 0 then raise exception 'project has open approvals'; end if;

  select count(*) into v_evidence_tasks from public.project_tasks where project_id=p_project_id and status='done' and nullif(trim(coalesce(completion_evidence,'')),'') is not null;
  if v_evidence_tasks = 0 then raise exception 'project closure requires completion evidence'; end if;

  if not exists(select 1 from public.project_financial_plans where project_id=p_project_id) then raise exception 'project financial plan is required before closure'; end if;
  select coalesce(open_receivables,0),coalesce(open_or_estimated_cost,0) into v_open_receivables,v_open_costs from public.project_financial_summary where project_id=p_project_id;
  if (v_open_receivables > 0 or v_open_costs > 0) and nullif(trim(coalesce(p_finance_pending_note,'')),'') is null then raise exception 'financial pending items require closure note'; end if;

  if nullif(trim(coalesce(p_delivery_summary,'')),'') is null then raise exception 'delivery summary is required'; end if;
  if nullif(trim(coalesce(p_delivery_evidence_reference,'')),'') is null then raise exception 'delivery evidence reference is required'; end if;
  if nullif(trim(coalesce(p_result_summary,'')),'') is null then raise exception 'result summary is required'; end if;
  if nullif(trim(coalesce(p_lessons_learned,'')),'') is null then raise exception 'lessons learned are required'; end if;
  if p_client_feedback_status not in ('not_requested','requested','received','unavailable') then raise exception 'invalid client feedback status'; end if;
  if p_next_step not in ('none','monitor','reassessment','renewal','new_opportunity') then raise exception 'invalid next step'; end if;

  insert into public.project_closures(project_id,company_id,status,delivery_summary,delivery_evidence_reference,result_summary,lessons_learned,client_feedback_status,client_feedback_notes,finance_pending_note,next_step,reassessment_required,prepared_by_label)
  values(p_project_id,v_company_id,'prepared',trim(p_delivery_summary),trim(p_delivery_evidence_reference),trim(p_result_summary),trim(p_lessons_learned),p_client_feedback_status,nullif(trim(coalesce(p_client_feedback_notes,'')),''),nullif(trim(coalesce(p_finance_pending_note,'')),''),p_next_step,coalesce(p_reassessment_required,false),nullif(trim(coalesce(p_actor_label,'')),''))
  on conflict(project_id) do update set status='prepared',delivery_summary=excluded.delivery_summary,delivery_evidence_reference=excluded.delivery_evidence_reference,result_summary=excluded.result_summary,lessons_learned=excluded.lessons_learned,client_feedback_status=excluded.client_feedback_status,client_feedback_notes=excluded.client_feedback_notes,finance_pending_note=excluded.finance_pending_note,next_step=excluded.next_step,reassessment_required=excluded.reassessment_required,prepared_by_label=excluded.prepared_by_label,prepared_at=now(),closed_by_label=null,closed_at=null,updated_at=now();

  update public.projects set status='completed',updated_at=now() where id=p_project_id;
  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('project',p_project_id,'project_closure_prepared','human',coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),jsonb_build_object('open_receivables',v_open_receivables,'open_costs',v_open_costs,'next_step',p_next_step,'reassessment_required',coalesce(p_reassessment_required,false)));
  return p_project_id;
end; $$;

create or replace function public.close_project(p_project_id uuid,p_actor_label text) returns uuid language plpgsql set search_path=public as $$
declare v_status text; v_closure_status text;
begin
  select status into v_status from public.projects where id=p_project_id for update;
  select status into v_closure_status from public.project_closures where project_id=p_project_id for update;
  if v_status <> 'completed' or v_closure_status <> 'prepared' then raise exception 'project closure is not prepared'; end if;
  if exists(select 1 from public.project_tasks where project_id=p_project_id and status not in ('done','cancelled')) then raise exception 'project has reopened tasks'; end if;
  if exists(select 1 from public.approvals where project_id=p_project_id and status in ('draft','pending','changes_requested')) then raise exception 'project has reopened approvals'; end if;
  update public.project_closures set status='closed',closed_by_label=nullif(trim(coalesce(p_actor_label,'')),''),closed_at=now(),updated_at=now() where project_id=p_project_id;
  update public.projects set status='closed',updated_at=now() where id=p_project_id;
  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values('project',p_project_id,'project_closed','human',coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),jsonb_build_object('status','closed'));
  return p_project_id;
end; $$;
