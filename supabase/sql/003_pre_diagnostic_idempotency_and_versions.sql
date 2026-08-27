-- Blinko OS — Idempotência e versionamento do Pré-Diagnóstico
-- Aplicar depois de 001 e 002 no projeto Supabase EXCLUSIVO da Blinko.

alter table public.pre_diagnostics
  add column if not exists submission_id uuid,
  add column if not exists form_version text not null default 'pre-diagnostic-form-v1',
  add column if not exists consent_version text not null default 'pre-diagnostic-consent-v1',
  add column if not exists source_page text not null default '/diagnostico';

create unique index if not exists pre_diagnostics_submission_id_uidx
  on public.pre_diagnostics (submission_id)
  where submission_id is not null;

-- Substitui a função V1 mantendo a mesma assinatura RPC.
-- Uma mesma submission_id nunca cria dois leads, mesmo se o navegador repetir a requisição.
create or replace function public.create_pre_diagnostic_submission(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
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

  -- Serializa reenvios concorrentes do mesmo formulário dentro da transação.
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
    lead_id,
    submission_id,
    form_version,
    consent_version,
    source_page,
    perceived_blocker,
    perceived_areas,
    pillar_answers,
    operational_signals,
    team_size,
    company_moment,
    openness_to_change,
    investment_intent,
    additional_context,
    raw_answers
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
$$;

revoke all on function public.create_pre_diagnostic_submission(jsonb) from public, anon, authenticated;
grant execute on function public.create_pre_diagnostic_submission(jsonb) to service_role;

comment on column public.pre_diagnostics.submission_id is
'Identificador idempotente gerado pelo navegador; reenvios com o mesmo valor não criam novo lead.';

comment on column public.pre_diagnostics.form_version is
'Versão exata do questionário respondido pelo lead.';

comment on column public.pre_diagnostics.consent_version is
'Versão do texto de consentimento aceito no momento da submissão.';
