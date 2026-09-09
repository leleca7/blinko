-- Blinko OS — consistência das ações CRM concluídas
-- Preparado a partir da Simulação 001.
-- NÃO aplicar em produção sem validação em branch temporária.

create or replace function public.record_pre_diagnostic_review(
  p_pre_diagnostic_id uuid,
  p_analysis_run_id uuid,
  p_reviewer_user_id uuid,
  p_reviewer_label text,
  p_decision jsonb
)
returns uuid
language plpgsql
set search_path = public
as $record_pre_diagnostic_review$
declare
  v_review_id uuid;
begin
  if not exists (select 1 from public.pre_diagnostics where id=p_pre_diagnostic_id) then
    raise exception 'pre-diagnostic not found';
  end if;

  if p_analysis_run_id is not null and not exists (
    select 1 from public.pre_diagnostic_analysis_runs
    where id=p_analysis_run_id and pre_diagnostic_id=p_pre_diagnostic_id
  ) then
    raise exception 'analysis run does not belong to pre-diagnostic';
  end if;

  insert into public.pre_diagnostic_review_versions (
    pre_diagnostic_id, analysis_run_id, reviewer_user_id, reviewer_label, decision
  ) values (
    p_pre_diagnostic_id, p_analysis_run_id, p_reviewer_user_id,
    nullif(p_reviewer_label,''), coalesce(p_decision,'{}'::jsonb)
  ) returning id into v_review_id;

  update public.pre_diagnostics
     set human_review_status='reviewed',
         human_review=coalesce(p_decision,'{}'::jsonb),
         current_human_review_id=v_review_id,
         updated_at=now()
   where id=p_pre_diagnostic_id;

  update public.leads l
     set status=case when l.status='new' then 'reviewing' else l.status end,
         updated_at=now()
    from public.pre_diagnostics pd
   where pd.id=p_pre_diagnostic_id and pd.lead_id=l.id;

  update public.crm_actions
     set status='done', completed_at=now()
   where pre_diagnostic_id=p_pre_diagnostic_id
     and action_type='review_pre_diagnostic'
     and status in ('pending','in_progress');

  insert into public.audit_events (entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values (
    'pre_diagnostic', p_pre_diagnostic_id, 'human_review_recorded', 'human',
    coalesce(p_reviewer_user_id::text,nullif(p_reviewer_label,''),'unknown'),
    jsonb_build_object('review_id',v_review_id,'analysis_run_id',p_analysis_run_id)
  );

  return v_review_id;
end;
$record_pre_diagnostic_review$;

create or replace function public.approve_pre_diagnostic_initial_reading(
  p_reading_id uuid,
  p_human_review_id uuid,
  p_approved_body text,
  p_approved_subject text,
  p_reviewer_user_id uuid,
  p_reviewer_label text
)
returns uuid
language plpgsql
set search_path = public
as $approve_pre_diagnostic_initial_reading$
declare
  v_pre_diagnostic_id uuid;
begin
  select pre_diagnostic_id into v_pre_diagnostic_id
  from public.pre_diagnostic_initial_readings
  where id=p_reading_id and status in ('draft','pending_approval');

  if v_pre_diagnostic_id is null then raise exception 'reading not found or not approvable'; end if;
  if nullif(trim(coalesce(p_approved_body,'')),'') is null then raise exception 'approved body is required'; end if;
  if not exists (
    select 1 from public.pre_diagnostic_review_versions
    where id=p_human_review_id and pre_diagnostic_id=v_pre_diagnostic_id
  ) then raise exception 'human review does not belong to pre-diagnostic'; end if;

  update public.pre_diagnostic_initial_readings
     set status='approved',
         human_review_id=p_human_review_id,
         body=trim(p_approved_body),
         subject=nullif(trim(coalesce(p_approved_subject,'')),''),
         approved_by_user_id=p_reviewer_user_id,
         approved_by_label=nullif(p_reviewer_label,''),
         approved_at=now(),
         updated_at=now()
   where id=p_reading_id;

  update public.crm_actions
     set status='done', completed_at=now()
   where pre_diagnostic_id=v_pre_diagnostic_id
     and action_type='review_initial_reading'
     and status in ('pending','in_progress');

  insert into public.audit_events (entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values (
    'pre_diagnostic_initial_reading', p_reading_id, 'initial_reading_approved', 'human',
    coalesce(p_reviewer_user_id::text,nullif(p_reviewer_label,''),'unknown'),
    jsonb_build_object('pre_diagnostic_id',v_pre_diagnostic_id,'human_review_id',p_human_review_id)
  );

  return p_reading_id;
end;
$approve_pre_diagnostic_initial_reading$;
