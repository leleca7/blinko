-- Blinko OS — Leitura inicial do Pré-Diagnóstico
-- Aplicar depois de 001, 002 e 003 no projeto Supabase EXCLUSIVO da Blinko.
-- Regra de produto: nenhuma leitura estratégica personalizada pode ser enviada ao lead sem aprovação humana.

create table if not exists public.pre_diagnostic_initial_readings (
  id uuid primary key default gen_random_uuid(),
  pre_diagnostic_id uuid not null references public.pre_diagnostics(id) on delete cascade,
  analysis_run_id uuid references public.pre_diagnostic_analysis_runs(id) on delete set null,
  human_review_id uuid references public.pre_diagnostic_review_versions(id) on delete set null,
  supersedes_id uuid references public.pre_diagnostic_initial_readings(id) on delete set null,
  channel text not null check (channel in ('whatsapp','email','manual')),
  status text not null default 'pending_approval'
    check (status in ('draft','pending_approval','approved','sent','failed','cancelled')),
  content_version text not null default 'initial-reading-v1',
  subject text,
  body text not null,
  created_by_type text not null check (created_by_type in ('ai','human','system')),
  created_by_id text,
  approved_by_user_id uuid,
  approved_by_label text,
  approved_at timestamptz,
  delivery_provider text,
  delivery_message_id text,
  delivery_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pre_diag_initial_readings_queue_idx
  on public.pre_diagnostic_initial_readings (status, created_at);

create index if not exists pre_diag_initial_readings_pre_diag_idx
  on public.pre_diagnostic_initial_readings (pre_diagnostic_id, created_at desc);

alter table public.pre_diagnostic_initial_readings enable row level security;
revoke all on table public.pre_diagnostic_initial_readings from anon, authenticated;

-- Cria um rascunho da leitura inicial e uma ação de revisão humana.
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
security invoker
set search_path = public
as $$
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
    select 1
      from public.pre_diagnostic_analysis_runs
     where id = p_analysis_run_id
       and pre_diagnostic_id = p_pre_diagnostic_id
       and status = 'ready'
  ) then
    raise exception 'ready analysis run does not belong to pre-diagnostic';
  end if;

  if p_supersedes_id is not null and not exists (
    select 1
      from public.pre_diagnostic_initial_readings
     where id = p_supersedes_id
       and pre_diagnostic_id = p_pre_diagnostic_id
  ) then
    raise exception 'superseded reading does not belong to pre-diagnostic';
  end if;

  insert into public.pre_diagnostic_initial_readings (
    pre_diagnostic_id,
    analysis_run_id,
    supersedes_id,
    channel,
    status,
    content_version,
    subject,
    body,
    created_by_type,
    created_by_id
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
    lead_id,
    pre_diagnostic_id,
    action_type,
    priority,
    title,
    payload
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
      'channel', p_channel,
      'content_version', coalesce(nullif(p_content_version, ''), 'initial-reading-v1')
    )
  );

  return v_reading_id;
end;
$$;

-- Aprovação humana obrigatória antes de qualquer envio.
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
security invoker
set search_path = public
as $$
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
    select 1
      from public.pre_diagnostic_review_versions
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
$$;

-- Só registra envio se a leitura estiver aprovada.
create or replace function public.record_pre_diagnostic_initial_reading_sent(
  p_reading_id uuid,
  p_delivery_provider text,
  p_delivery_message_id text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
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
$$;

create or replace function public.record_pre_diagnostic_initial_reading_failed(
  p_reading_id uuid,
  p_delivery_provider text,
  p_error text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
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
$$;

revoke all on function public.create_pre_diagnostic_initial_reading_draft(uuid,uuid,text,text,text,text,text,text,uuid) from public, anon, authenticated;
revoke all on function public.approve_pre_diagnostic_initial_reading(uuid,uuid,text,text,uuid,text) from public, anon, authenticated;
revoke all on function public.record_pre_diagnostic_initial_reading_sent(uuid,text,text) from public, anon, authenticated;
revoke all on function public.record_pre_diagnostic_initial_reading_failed(uuid,text,text) from public, anon, authenticated;

grant execute on function public.create_pre_diagnostic_initial_reading_draft(uuid,uuid,text,text,text,text,text,text,uuid) to service_role;
grant execute on function public.approve_pre_diagnostic_initial_reading(uuid,uuid,text,text,uuid,text) to service_role;
grant execute on function public.record_pre_diagnostic_initial_reading_sent(uuid,text,text) to service_role;
grant execute on function public.record_pre_diagnostic_initial_reading_failed(uuid,text,text) to service_role;

comment on table public.pre_diagnostic_initial_readings is
'Versões das leituras iniciais enviáveis ao lead. Toda mensagem estratégica personalizada exige aprovação humana antes do envio.';
