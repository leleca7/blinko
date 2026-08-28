-- Blinko OS — Diagnóstico Blinko — Coleta versionada V1
-- Depende de 003_diagnostic_commercial_flow.sql.
-- Registra coleta interna sem transformar sinal ou hipótese em causa confirmada.

create table if not exists public.diagnostic_collection_versions (
  id uuid primary key default gen_random_uuid(),
  diagnostic_id uuid not null references public.diagnostics(id) on delete cascade,
  version_number integer not null,
  methodology_version text not null default 'blinko-diagnostic-v1',
  company_context jsonb not null default '{}'::jsonb,
  pillars jsonb not null default '{}'::jsonb,
  general_evidence jsonb not null default '[]'::jsonb,
  missing_information jsonb not null default '[]'::jsonb,
  meeting_notes text,
  created_by_label text,
  created_at timestamptz not null default now(),
  unique (diagnostic_id, version_number)
);

create index if not exists diagnostic_collection_versions_idx
  on public.diagnostic_collection_versions (diagnostic_id, version_number desc);

alter table public.diagnostics
  add column if not exists current_collection_version_id uuid;

alter table public.diagnostics
  drop constraint if exists diagnostics_current_collection_version_id_fkey;

alter table public.diagnostics
  add constraint diagnostics_current_collection_version_id_fkey
  foreign key (current_collection_version_id)
  references public.diagnostic_collection_versions(id)
  on delete set null;

create or replace function public.record_diagnostic_collection_version(
  p_diagnostic_id uuid,
  p_actor_label text,
  p_company_context jsonb,
  p_pillars jsonb,
  p_general_evidence jsonb,
  p_missing_information jsonb,
  p_meeting_notes text default null
)
returns uuid
language plpgsql
set search_path = public
as $record_collection$
declare
  v_collection_id uuid;
  v_next_version integer;
  v_status text;
  v_pre_diagnostic_id uuid;
  v_lead_id uuid;
begin
  select status, pre_diagnostic_id, lead_id
    into v_status, v_pre_diagnostic_id, v_lead_id
    from public.diagnostics
   where id = p_diagnostic_id
   limit 1;

  if v_status is null then
    raise exception 'diagnostic not found';
  end if;

  if v_status not in ('collection','analysis') then
    raise exception 'diagnostic is not in collection or analysis';
  end if;

  select coalesce(max(version_number), 0) + 1
    into v_next_version
    from public.diagnostic_collection_versions
   where diagnostic_id = p_diagnostic_id;

  insert into public.diagnostic_collection_versions (
    diagnostic_id,
    version_number,
    methodology_version,
    company_context,
    pillars,
    general_evidence,
    missing_information,
    meeting_notes,
    created_by_label
  ) values (
    p_diagnostic_id,
    v_next_version,
    'blinko-diagnostic-v1',
    coalesce(p_company_context, '{}'::jsonb),
    coalesce(p_pillars, '{}'::jsonb),
    coalesce(p_general_evidence, '[]'::jsonb),
    coalesce(p_missing_information, '[]'::jsonb),
    nullif(trim(coalesce(p_meeting_notes, '')), ''),
    nullif(trim(coalesce(p_actor_label, '')), '')
  ) returning id into v_collection_id;

  update public.diagnostics
     set current_collection_version_id = v_collection_id,
         updated_at = now()
   where id = p_diagnostic_id;

  insert into public.audit_events (
    entity_type, entity_id, event_type, actor_type, actor_id, payload
  ) values (
    'diagnostic',
    p_diagnostic_id,
    'diagnostic_collection_version_recorded',
    'human',
    coalesce(nullif(trim(coalesce(p_actor_label, '')), ''), 'unknown'),
    jsonb_build_object(
      'collection_version_id', v_collection_id,
      'version_number', v_next_version,
      'pre_diagnostic_id', v_pre_diagnostic_id,
      'lead_id', v_lead_id
    )
  );

  return v_collection_id;
end;
$record_collection$;

create or replace function public.advance_diagnostic_to_analysis(
  p_diagnostic_id uuid,
  p_actor_label text
)
returns uuid
language plpgsql
set search_path = public
as $advance_analysis$
declare
  v_collection_id uuid;
  v_pre_diagnostic_id uuid;
  v_lead_id uuid;
begin
  select current_collection_version_id, pre_diagnostic_id, lead_id
    into v_collection_id, v_pre_diagnostic_id, v_lead_id
    from public.diagnostics
   where id = p_diagnostic_id
     and status = 'collection'
   limit 1;

  if v_collection_id is null then
    raise exception 'diagnostic collection is required before analysis';
  end if;

  update public.diagnostics
     set status = 'analysis', updated_at = now()
   where id = p_diagnostic_id;

  update public.crm_actions
     set status = 'done', completed_at = now()
   where pre_diagnostic_id = v_pre_diagnostic_id
     and status in ('pending','in_progress')
     and action_type = 'diagnostic_collection';

  if not exists (
    select 1 from public.crm_actions
     where pre_diagnostic_id = v_pre_diagnostic_id
       and action_type = 'diagnostic_analysis'
       and status in ('pending','in_progress')
  ) then
    insert into public.crm_actions (
      lead_id, pre_diagnostic_id, action_type, status, priority, title, payload
    ) values (
      v_lead_id,
      v_pre_diagnostic_id,
      'diagnostic_analysis',
      'pending',
      'high',
      'Analisar Diagnóstico Blinko',
      jsonb_build_object(
        'diagnostic_id', p_diagnostic_id,
        'collection_version_id', v_collection_id,
        'created_by', p_actor_label,
        'source', 'blinko_os_internal'
      )
    );
  end if;

  insert into public.audit_events (
    entity_type, entity_id, event_type, actor_type, actor_id, payload
  ) values (
    'diagnostic',
    p_diagnostic_id,
    'diagnostic_advanced_to_analysis',
    'human',
    coalesce(nullif(trim(coalesce(p_actor_label, '')), ''), 'unknown'),
    jsonb_build_object('collection_version_id', v_collection_id)
  );

  return p_diagnostic_id;
end;
$advance_analysis$;
