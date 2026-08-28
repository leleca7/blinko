-- Blinko OS — Diagnóstico Blinko — análise manual V1
-- Depende de 003, 004 e 005.
-- Permite que a operação siga sem provedor de IA, preservando o mesmo histórico de análise e revisão.

create or replace function public.record_manual_diagnostic_analysis(
  p_diagnostic_id uuid,
  p_collection_version_id uuid,
  p_actor_label text,
  p_input_snapshot jsonb,
  p_output jsonb
)
returns uuid
language plpgsql
set search_path = public
as $record_manual_diagnostic_analysis$
declare
  v_run_id uuid;
  v_summary text;
begin
  v_summary := nullif(trim(coalesce(p_output->>'summary', '')), '');
  if v_summary is null then
    raise exception 'manual analysis summary is required';
  end if;

  if not exists (
    select 1
      from public.diagnostics d
     where d.id = p_diagnostic_id
       and d.status = 'analysis'
       and d.current_collection_version_id = p_collection_version_id
  ) then
    raise exception 'diagnostic is not in analysis or collection version is not current';
  end if;

  if not exists (
    select 1
      from public.diagnostic_collection_versions cv
     where cv.id = p_collection_version_id
       and cv.diagnostic_id = p_diagnostic_id
  ) then
    raise exception 'collection version does not belong to diagnostic';
  end if;

  insert into public.diagnostic_analysis_runs (
    diagnostic_id,
    collection_version_id,
    status,
    provider,
    model,
    prompt_version,
    input_snapshot,
    output,
    completed_at
  ) values (
    p_diagnostic_id,
    p_collection_version_id,
    'ready',
    'manual-human',
    null,
    'manual-analysis-v1',
    coalesce(p_input_snapshot, '{}'::jsonb),
    p_output,
    now()
  ) returning id into v_run_id;

  update public.diagnostics
     set current_analysis_run_id = v_run_id,
         current_analysis_review_id = null,
         updated_at = now()
   where id = p_diagnostic_id;

  insert into public.audit_events (
    entity_type,
    entity_id,
    event_type,
    actor_type,
    actor_id,
    payload
  ) values (
    'diagnostic',
    p_diagnostic_id,
    'diagnostic_manual_analysis_recorded',
    'human',
    coalesce(nullif(trim(coalesce(p_actor_label, '')), ''), 'unknown'),
    jsonb_build_object(
      'analysis_run_id', v_run_id,
      'collection_version_id', p_collection_version_id,
      'source', 'blinko_os_internal'
    )
  );

  return v_run_id;
end;
$record_manual_diagnostic_analysis$;
