-- Blinko OS — análise de impacto de Change Request antes da decisão.
-- Depende de 034_project_change_requests.sql.

create unique index if not exists project_change_request_revision_sequence_unique
  on public.project_change_requests(project_id,revision_sequence)
  where classification='in_scope_revision' and decision_status='approved' and revision_sequence is not null;

create or replace function public.update_project_change_request_analysis(
  p_change_request_id uuid,
  p_impact_analysis text,
  p_deadline_impact_status text,
  p_deadline_impact_description text,
  p_proposed_new_due_at timestamptz,
  p_financial_impact_status text,
  p_financial_impact_description text,
  p_financial_reference text,
  p_decision_owner_label text,
  p_actor_label text
)
returns uuid
language plpgsql
set search_path=public
as $$
declare
  v_cr public.project_change_requests%rowtype;
  v_deadline_status text:=coalesce(nullif(trim(p_deadline_impact_status),''),'none');
  v_financial_status text:=coalesce(nullif(trim(p_financial_impact_status),''),'none');
begin
  select * into v_cr from public.project_change_requests where id=p_change_request_id for update;
  if not found then raise exception 'change request not found'; end if;
  if v_cr.decision_status<>'pending' or v_cr.status<>'pending_decision' then
    raise exception 'only pending change request analysis can be edited';
  end if;
  if v_deadline_status not in ('none','possible','confirmed') then raise exception 'invalid deadline impact status'; end if;
  if v_financial_status not in ('none','possible','confirmed') then raise exception 'invalid financial impact status'; end if;
  if nullif(trim(coalesce(p_decision_owner_label,'')),'') is null then raise exception 'decision owner is required'; end if;
  if v_deadline_status='confirmed' and p_proposed_new_due_at is null then
    raise exception 'confirmed deadline impact requires proposed new due date';
  end if;
  if v_financial_status='confirmed' and nullif(trim(coalesce(p_financial_reference,'')),'') is null then
    raise exception 'confirmed financial impact requires financial reference';
  end if;

  update public.project_change_requests
     set impact_analysis=nullif(trim(coalesce(p_impact_analysis,'')),''),
         deadline_impact_status=v_deadline_status,
         deadline_impact_description=nullif(trim(coalesce(p_deadline_impact_description,'')),''),
         proposed_new_due_at=p_proposed_new_due_at,
         financial_impact_status=v_financial_status,
         financial_impact_description=nullif(trim(coalesce(p_financial_impact_description,'')),''),
         financial_reference=nullif(trim(coalesce(p_financial_reference,'')),''),
         decision_owner_label=trim(p_decision_owner_label),
         updated_at=now()
   where id=p_change_request_id;

  insert into public.audit_events(entity_type,entity_id,event_type,actor_type,actor_id,payload)
  values(
    'project_change_request',p_change_request_id,'project_change_request_analysis_updated',
    public.commercial_audit_actor_type(p_actor_label),coalesce(nullif(trim(coalesce(p_actor_label,'')),''),'unknown'),
    jsonb_build_object(
      'project_id',v_cr.project_id,
      'classification',v_cr.classification,
      'deadline_impact_status',v_deadline_status,
      'financial_impact_status',v_financial_status,
      'decision_owner_label',trim(p_decision_owner_label)
    )
  );

  return p_change_request_id;
end;
$$;
