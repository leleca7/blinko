-- Blinko OS — Neon Postgres — Funções Core V1
-- Aplicar depois de 001_core_tables.sql.

create or replace function public.create_pre_diagnostic_submission(payload jsonb)
returns jsonb
language plpgsql
set search_path = public
as $create_submission$
declare
  v_submission_id uuid;
  v_lead_id uuid;
  v_pre_id uuid;
  v_action_id uuid;
  v_score integer;
  v_priority text;
  v_existing_score integer;
  v_existing_priority text;
begin
  begin
    v_submission_id := nullif(payload->>'submission_id', '')::uuid;
  exception when invalid_text_representation then
    raise exception 'invalid submission_id';
  end;

  if v_submission_id is null then
    raise exception 'submission_id is required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_submission_id::text, 0));

  select
    pd.id,
    pd.lead_id,
    l.commercial_score,
    ca.id,
    coalesce(ca.priority, case
      when l.commercial_score >= 8 then 'high'
      when l.commercial_score >= 5 then 'normal'
      else 'low'
    end)
  into
    v_pre_id,
    v_lead_id,
    v_existing_score,
    v_action_id,
    v_existing_priority
  from public.pre_diagnostics pd
  join public.leads l on l.id = pd.lead_id
  left join lateral (
    select id, priority
      from public.crm_actions
     where pre_diagnostic_id = pd.id
     order by created_at asc
     limit 1
  ) ca on true
  where pd.submission_id = v_submission_id
  limit 1;

  if v_pre_id is not null then
    return jsonb_build_object(
      'lead_id', v_lead_id,
      'pre_diagnostic_id', v_pre_id,
      'action_id', v_action_id,
      'commercial_score', v_existing_score,
      'priority', v_existing_priority,
      'duplicate', true
    );
  end if;

  v_score := greatest(0, least(10, coalesce((payload->>'commercial_score')::integer, 0)));
  v_priority := case
    when v_score >= 8 then 'high'
    when v_score >= 5 then 'normal'
    else 'low'
  end;

  insert into public.leads (
    name, email, whatsapp, company_name, company_role, city_state, segment,
    website, social_url, objective, urgency, commercial_score, score_breakdown,
    source, consent_at
  ) values (
    payload->>'name',
    lower(payload->>'email'),
    payload->>'whatsapp',
    payload->>'company_name',
    payload->>'company_role',
    payload->>'city_state',
    payload->>'segment',
    nullif(payload->>'website',''),
    nullif(payload->>'social_url',''),
    payload->>'objective',
    payload->>'urgency',
    v_score,
    coalesce(payload->'score_breakdown','{}'::jsonb),
    coalesce(nullif(payload->>'source',''),'site_pre_diagnostic'),
    now()
  ) returning id into v_lead_id;

  insert into public.pre_diagnostics (
    lead_id, submission_id, form_version, consent_version, source_page,
    perceived_blocker, perceived_areas, pillar_answers, operational_signals,
    team_size, company_moment, openness_to_change, investment_intent,
    additional_context, raw_answers
  ) values (
    v_lead_id,
    v_submission_id,
    coalesce(nullif(payload->>'form_version',''), 'pre-diagnostic-form-v1'),
    coalesce(nullif(payload->>'consent_version',''), 'pre-diagnostic-consent-v1'),
    coalesce(nullif(payload->>'source_page',''), '/diagnostico'),
    payload->>'perceived_blocker',
    coalesce(array(select jsonb_array_elements_text(coalesce(payload->'perceived_areas','[]'::jsonb))), '{}'),
    coalesce(payload->'pillar_answers','{}'::jsonb),
    coalesce(array(select jsonb_array_elements_text(coalesce(payload->'operational_signals','[]'::jsonb))), '{}'),
    payload->>'team_size',
    payload->>'company_moment',
    payload->>'openness_to_change',
    payload->>'investment_intent',
    nullif(payload->>'additional_context',''),
    payload
  ) returning id into v_pre_id;

  insert into public.crm_actions (
    lead_id, pre_diagnostic_id, action_type, priority, title, payload
  ) values (
    v_lead_id,
    v_pre_id,
    'review_pre_diagnostic',
    v_priority,
    'Revisar pré-diagnóstico',
    jsonb_build_object(
      'commercial_score', v_score,
      'form_version', coalesce(nullif(payload->>'form_version',''), 'pre-diagnostic-form-v1')
    )
  ) returning id into v_action_id;

  insert into public.audit_events (
    entity_type, entity_id, event_type, actor_type, actor_id, payload
  ) values (
    'pre_diagnostic',
    v_pre_id,
    'submission_created',
    'system',
    'site-pre-diagnostic',
    jsonb_build_object(
      'submission_id', v_submission_id,
      'form_version', coalesce(nullif(payload->>'form_version',''), 'pre-diagnostic-form-v1'),
      'consent_version', coalesce(nullif(payload->>'consent_version',''), 'pre-diagnostic-consent-v1'),
      'source_page', coalesce(nullif(payload->>'source_page',''), '/diagnostico')
    )
  );

  return jsonb_build_object(
    'lead_id', v_lead_id,
    'pre_diagnostic_id', v_pre_id,
    'action_id', v_action_id,
    'commercial_score', v_score,
    'priority', v_priority,
    'duplicate', false
  );
end;
$create_submission$;

create or replace function public.record_pre_diagnostic_analysis(
  p_pre_diagnostic_id uuid,
  p_status text,
  p_provider text,
  p_model text,
  p_prompt_version text,
  p_input_snapshot jsonb,
  p_output jsonb,
  p_error_code text default null,
  p_error_detail text default null
)
returns uuid
language plpgsql
set search_path = public
as $record_analysis$
declare
  v_run_id uuid;
begin
  if p_status not in ('processing','ready','failed') then
    raise exception 'invalid analysis status';
  end if;

  if not exists (select 1 from public.pre_diagnostics where id = p_pre_diagnostic_id) then
    raise exception 'pre-diagnostic not found';
  end if;

  insert into public.pre_diagnostic_analysis_runs (
    pre_diagnostic_id, status, provider, model, prompt_version,
    input_snapshot, output, error_code, error_detail, completed_at
  ) values (
    p_pre_diagnostic_id,
    p_status,
    nullif(p_provider, ''),
    nullif(p_model, ''),
    coalesce(nullif(p_prompt_version, ''), 'pre-diagnostic-v1'),
    coalesce(p_input_snapshot, '{}'::jsonb),
    p_output,
    p_error_code,
    p_error_detail,
    case when p_status in ('ready','failed') then now() else null end
  ) returning id into v_run_id;

  update public.pre_diagnostics
     set ai_analysis_status = p_status,
         ai_analysis = case when p_status = 'ready' then p_output else ai_analysis end,
         current_ai_analysis_run_id = case when p_status = 'ready' then v_run_id else current_ai_analysis_run_id end,
         updated_at = now()
   where id = p_pre_diagnostic_id;

  insert into public.audit_events (
    entity_type, entity_id, event_type, actor_type, actor_id, payload
  ) values (
    'pre_diagnostic',
    p_pre_diagnostic_id,
    'ai_analysis_' || p_status,
    'ai',
    coalesce(nullif(p_model, ''), nullif(p_provider, ''), 'blinko-ai'),
    jsonb_build_object(
      'analysis_run_id', v_run_id,
      'prompt_version', coalesce(nullif(p_prompt_version, ''), 'pre-diagnostic-v1')
    )
  );

  return v_run_id;
end;
$record_analysis$;

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
as $record_review$
declare
  v_review_id uuid;
begin
  if not exists (select 1 from public.pre_diagnostics where id = p_pre_diagnostic_id) then
    raise exception 'pre-diagnostic not found';
  end if;

  if p_analysis_run_id is not null and not exists (
    select 1 from public.pre_diagnostic_analysis_runs
     where id = p_analysis_run_id
       and pre_diagnostic_id = p_pre_diagnostic_id
  ) then
    raise exception 'analysis run does not belong to pre-diagnostic';
  end if;

  insert into public.pre_diagnostic_review_versions (
    pre_diagnostic_id, analysis_run_id, reviewer_user_id, reviewer_label, decision
  ) values (
    p_pre_diagnostic_id,
    p_analysis_run_id,
    p_reviewer_user_id,
    nullif(p_reviewer_label, ''),
    coalesce(p_decision, '{}'::jsonb)
  ) returning id into v_review_id;

  update public.pre_diagnostics
     set human_review_status = 'reviewed',
         human_review = coalesce(p_decision, '{}'::jsonb),
         current_human_review_id = v_review_id,
         updated_at = now()
   where id = p_pre_diagnostic_id;

  update public.leads l
     set status = case when l.status = 'new' then 'reviewing' else l.status end,
         updated_at = now()
    from public.pre_diagnostics pd
   where pd.id = p_pre_diagnostic_id
     and pd.lead_id = l.id;

  insert into public.audit_events (
    entity_type, entity_id, event_type, actor_type, actor_id, payload
  ) values (
    'pre_diagnostic',
    p_pre_diagnostic_id,
    'human_review_recorded',
    'human',
    coalesce(p_reviewer_user_id::text, nullif(p_reviewer_label, ''), 'unknown'),
    jsonb_build_object('review_id', v_review_id, 'analysis_run_id', p_analysis_run_id)
  );

  return v_review_id;
end;
$record_review$;

create or replace function public.create_pre_diagnostic_initial_reading_draft(
  p_pre_diagnostic_id uuid,
  p_analysis_run_id uuid,
  p_channel text,
  p_subject text,
  p_body text,
  p_content_version text,
  p_created_by_type text,
  p_created_by_id text default null,
  p_supersedes_id uuid default null
)
returns uuid
language plpgsql
set search_path = public
as $create_reading$
declare
  v_reading_id uuid;
  v_lead_id uuid;
begin
  if p_channel not in ('whatsapp','email','manual') then
    raise exception 'invalid channel';
  end if;

  if p_created_by_type not in ('ai','human','system') then
    raise exception 'invalid creator type';
  end if;

  if nullif(trim(coalesce(p_body, '')), '') is null then
    raise exception 'reading body is required';
  end if;

  select lead_id into v_lead_id
    from public.pre_diagnostics
   where id = p_pre_diagnostic_id;

  if v_lead_id is null then
    raise exception 'pre-diagnostic not found';
  end if;

  if p_analysis_run_id is not null and not exists (
    select 1 from public.pre_diagnostic_analysis_runs
     where id = p_analysis_run_id
       and pre_diagnostic_id = p_pre_diagnostic_id
       and status = 'ready'
  ) then
    raise exception 'ready analysis run does not belong to pre-diagnostic';
  end if;

  if p_supersedes_id is not null and not exists (
    select 1 from public.pre_diagnostic_initial_readings
     where id = p_supersedes_id
       and pre_diagnostic_id = p_pre_diagnostic_id
  ) then
    raise exception 'superseded reading does not belong to pre-diagnostic';
  end if;

  insert into public.pre_diagnostic_initial_readings (
    pre_diagnostic_id, analysis_run_id, supersedes_id, channel, status,
    content_version, subject, body, created_by_type, created_by_id
  ) values (
    p_pre_diagnostic_id,
    p_analysis_run_id,
    p_supersedes_id,
    p_channel,
    'pending_approval',
    coalesce(nullif(p_content_version, ''), 'initial-reading-v1'),
    nullif(trim(coalesce(p_subject, '')), ''),
    trim(p_body),
    p_created_by_type,
    nullif(p_created_by_id, '')
  ) returning id into v_reading_id;

  insert into public.crm_actions (
    lead_id, pre_diagnostic_id, action_type, priority, title, payload
  ) values (
    v_lead_id,
    p_pre_diagnostic_id,
    'review_initial_reading',
    'normal',
    'Revisar leitura inicial do pré-diagnóstico',
    jsonb_build_object('initial_reading_id', v_reading_id)
  );

  insert into public.audit_events (
    entity_type, entity_id, event_type, actor_type, actor_id, payload
  ) values (
    'pre_diagnostic_initial_reading',
    v_reading_id,
    'initial_reading_draft_created',
    p_created_by_type,
    coalesce(nullif(p_created_by_id, ''), p_created_by_type),
    jsonb_build_object(
      'pre_diagnostic_id', p_pre_diagnostic_id,
      'analysis_run_id', p_analysis_run_id,
      'channel', p_channel
    )
  );

  return v_reading_id;
end;
$create_reading$;

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
as $approve_reading$
declare
  v_pre_diagnostic_id uuid;
begin
  select pre_diagnostic_id into v_pre_diagnostic_id
    from public.pre_diagnostic_initial_readings
   where id = p_reading_id
     and status in ('draft','pending_approval');

  if v_pre_diagnostic_id is null then
    raise exception 'reading not found or not approvable';
  end if;

  if nullif(trim(coalesce(p_approved_body, '')), '') is null then
    raise exception 'approved body is required';
  end if;

  if not exists (
    select 1 from public.pre_diagnostic_review_versions
     where id = p_human_review_id
       and pre_diagnostic_id = v_pre_diagnostic_id
  ) then
    raise exception 'human review does not belong to pre-diagnostic';
  end if;

  update public.pre_diagnostic_initial_readings
     set status = 'approved',
         human_review_id = p_human_review_id,
         body = trim(p_approved_body),
         subject = nullif(trim(coalesce(p_approved_subject, '')), ''),
         approved_by_user_id = p_reviewer_user_id,
         approved_by_label = nullif(p_reviewer_label, ''),
         approved_at = now(),
         updated_at = now()
   where id = p_reading_id;

  insert into public.audit_events (
    entity_type, entity_id, event_type, actor_type, actor_id, payload
  ) values (
    'pre_diagnostic_initial_reading',
    p_reading_id,
    'initial_reading_approved',
    'human',
    coalesce(p_reviewer_user_id::text, nullif(p_reviewer_label, ''), 'unknown'),
    jsonb_build_object(
      'pre_diagnostic_id', v_pre_diagnostic_id,
      'human_review_id', p_human_review_id
    )
  );

  return p_reading_id;
end;
$approve_reading$;

create or replace function public.record_pre_diagnostic_initial_reading_sent(
  p_reading_id uuid,
  p_delivery_provider text,
  p_delivery_message_id text
)
returns uuid
language plpgsql
set search_path = public
as $record_sent$
declare
  v_pre_diagnostic_id uuid;
begin
  select pre_diagnostic_id into v_pre_diagnostic_id
    from public.pre_diagnostic_initial_readings
   where id = p_reading_id
     and status = 'approved'
     and approved_at is not null;

  if v_pre_diagnostic_id is null then
    raise exception 'reading must be human-approved before send';
  end if;

  update public.pre_diagnostic_initial_readings
     set status = 'sent',
         delivery_provider = nullif(p_delivery_provider, ''),
         delivery_message_id = nullif(p_delivery_message_id, ''),
         delivery_error = null,
         sent_at = now(),
         updated_at = now()
   where id = p_reading_id;

  insert into public.audit_events (
    entity_type, entity_id, event_type, actor_type, actor_id, payload
  ) values (
    'pre_diagnostic_initial_reading',
    p_reading_id,
    'initial_reading_sent',
    'system',
    coalesce(nullif(p_delivery_provider, ''), 'delivery'),
    jsonb_build_object(
      'pre_diagnostic_id', v_pre_diagnostic_id,
      'delivery_message_id', p_delivery_message_id
    )
  );

  return p_reading_id;
end;
$record_sent$;

create or replace function public.record_pre_diagnostic_initial_reading_failed(
  p_reading_id uuid,
  p_delivery_provider text,
  p_error text
)
returns uuid
language plpgsql
set search_path = public
as $record_failed$
declare
  v_pre_diagnostic_id uuid;
begin
  select pre_diagnostic_id into v_pre_diagnostic_id
    from public.pre_diagnostic_initial_readings
   where id = p_reading_id
     and status = 'approved';

  if v_pre_diagnostic_id is null then
    raise exception 'only approved readings can have delivery failure';
  end if;

  update public.pre_diagnostic_initial_readings
     set status = 'failed',
         delivery_provider = nullif(p_delivery_provider, ''),
         delivery_error = left(coalesce(p_error, 'unknown delivery error'), 2000),
         updated_at = now()
   where id = p_reading_id;

  insert into public.audit_events (
    entity_type, entity_id, event_type, actor_type, actor_id, payload
  ) values (
    'pre_diagnostic_initial_reading',
    p_reading_id,
    'initial_reading_delivery_failed',
    'system',
    coalesce(nullif(p_delivery_provider, ''), 'delivery'),
    jsonb_build_object('pre_diagnostic_id', v_pre_diagnostic_id)
  );

  return p_reading_id;
end;
$record_failed$;
