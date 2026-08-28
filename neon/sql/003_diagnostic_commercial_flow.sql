-- Blinko OS — Diagnóstico Blinko — Fluxo comercial inicial
-- Etapas cobertas: diagnóstico oferecido -> pagamento confirmado -> coleta.
-- Nenhum preço, cobrança ou envio ao cliente é automatizado por esta migração.

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  source_lead_id uuid unique references public.leads(id) on delete set null,
  name text not null,
  segment text,
  city_state text,
  website text,
  social_url text,
  objective text,
  relationship_status text not null default 'active'
    check (relationship_status in ('active','paused','closed')),
  responsible_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists companies_name_idx on public.companies (lower(name));
create index if not exists companies_relationship_idx
  on public.companies (relationship_status, created_at desc);

create table if not exists public.diagnostics (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete restrict,
  pre_diagnostic_id uuid references public.pre_diagnostics(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  status text not null default 'awaiting_payment'
    check (status in (
      'awaiting_payment','collection','analysis','review',
      'ready_for_presentation','presented','completed','paused','cancelled'
    )),
  methodology_version text not null default 'blinko-diagnostic-v1',
  offer_notes text,
  offered_by_label text,
  offered_at timestamptz not null default now(),
  payment_confirmed_by_label text,
  payment_reference text,
  payment_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists diagnostics_active_pre_diag_uidx
  on public.diagnostics (pre_diagnostic_id)
  where pre_diagnostic_id is not null and status <> 'cancelled';
create index if not exists diagnostics_status_idx
  on public.diagnostics (status, created_at desc);
create index if not exists diagnostics_company_idx
  on public.diagnostics (company_id, created_at desc);

create or replace function public.offer_blinko_diagnostic(
  p_pre_diagnostic_id uuid,
  p_actor_label text,
  p_notes text default null
)
returns uuid
language plpgsql
set search_path = public
as $offer_diagnostic$
declare
  v_lead_id uuid;
  v_diagnostic_id uuid;
  v_old_status text;
begin
  select l.id, l.status
    into v_lead_id, v_old_status
    from public.pre_diagnostics pd
    join public.leads l on l.id = pd.lead_id
   where pd.id = p_pre_diagnostic_id
   limit 1;

  if v_lead_id is null then
    raise exception 'pre-diagnostic not found';
  end if;

  select id into v_diagnostic_id
    from public.diagnostics
   where pre_diagnostic_id = p_pre_diagnostic_id
     and status <> 'cancelled'
   order by created_at desc
   limit 1;

  if v_diagnostic_id is null then
    insert into public.diagnostics (
      lead_id, pre_diagnostic_id, status, methodology_version,
      offer_notes, offered_by_label, offered_at
    ) values (
      v_lead_id,
      p_pre_diagnostic_id,
      'awaiting_payment',
      'blinko-diagnostic-v1',
      nullif(trim(coalesce(p_notes, '')), ''),
      nullif(trim(coalesce(p_actor_label, '')), ''),
      now()
    ) returning id into v_diagnostic_id;
  end if;

  update public.leads
     set status = case
       when status in ('new','reviewing','contacted','meeting','qualified')
         then 'diagnostic_offered'
       else status
     end,
     updated_at = now()
   where id = v_lead_id;

  update public.crm_actions
     set status = 'done', completed_at = now()
   where pre_diagnostic_id = p_pre_diagnostic_id
     and status in ('pending','in_progress')
     and action_type = 'meeting';

  if not exists (
    select 1 from public.crm_actions
     where pre_diagnostic_id = p_pre_diagnostic_id
       and action_type = 'diagnostic_payment_followup'
       and status in ('pending','in_progress')
  ) then
    insert into public.crm_actions (
      lead_id, pre_diagnostic_id, action_type, status, priority, title, payload
    ) values (
      v_lead_id,
      p_pre_diagnostic_id,
      'diagnostic_payment_followup',
      'pending',
      'normal',
      'Acompanhar decisão sobre Diagnóstico Blinko',
      jsonb_build_object(
        'diagnostic_id', v_diagnostic_id,
        'created_by', p_actor_label,
        'source', 'blinko_os_internal'
      )
    );
  end if;

  insert into public.audit_events (
    entity_type, entity_id, event_type, actor_type, actor_id, payload
  ) values (
    'diagnostic',
    v_diagnostic_id,
    'diagnostic_offered',
    'human',
    coalesce(nullif(trim(coalesce(p_actor_label, '')), ''), 'unknown'),
    jsonb_build_object(
      'pre_diagnostic_id', p_pre_diagnostic_id,
      'lead_id', v_lead_id,
      'lead_old_status', v_old_status,
      'notes', nullif(trim(coalesce(p_notes, '')), '')
    )
  );

  return v_diagnostic_id;
end;
$offer_diagnostic$;

create or replace function public.confirm_blinko_diagnostic_payment(
  p_diagnostic_id uuid,
  p_actor_label text,
  p_payment_reference text default null
)
returns uuid
language plpgsql
set search_path = public
as $confirm_diagnostic_payment$
declare
  v_lead public.leads%rowtype;
  v_lead_id uuid;
  v_pre_diagnostic_id uuid;
  v_company_id uuid;
  v_status text;
begin
  select d.lead_id, d.pre_diagnostic_id, d.status
    into v_lead_id, v_pre_diagnostic_id, v_status
    from public.diagnostics d
   where d.id = p_diagnostic_id
   limit 1;

  if v_lead_id is null then
    raise exception 'diagnostic not found';
  end if;

  if v_status <> 'awaiting_payment' then
    raise exception 'diagnostic is not awaiting payment';
  end if;

  select * into v_lead
    from public.leads
   where id = v_lead_id;

  insert into public.companies (
    source_lead_id, name, segment, city_state, website, social_url, objective,
    relationship_status, responsible_label
  ) values (
    v_lead.id,
    v_lead.company_name,
    v_lead.segment,
    v_lead.city_state,
    v_lead.website,
    v_lead.social_url,
    v_lead.objective,
    'active',
    nullif(trim(coalesce(p_actor_label, '')), '')
  )
  on conflict (source_lead_id) do update
    set name = excluded.name,
        segment = excluded.segment,
        city_state = excluded.city_state,
        website = excluded.website,
        social_url = excluded.social_url,
        objective = excluded.objective,
        responsible_label = coalesce(excluded.responsible_label, public.companies.responsible_label),
        updated_at = now()
  returning id into v_company_id;

  update public.diagnostics
     set company_id = v_company_id,
         status = 'collection',
         payment_confirmed_by_label = nullif(trim(coalesce(p_actor_label, '')), ''),
         payment_reference = nullif(trim(coalesce(p_payment_reference, '')), ''),
         payment_confirmed_at = now(),
         updated_at = now()
   where id = p_diagnostic_id;

  update public.leads
     set status = 'diagnostic_paid', updated_at = now()
   where id = v_lead.id;

  update public.crm_actions
     set status = 'done', completed_at = now()
   where pre_diagnostic_id = v_pre_diagnostic_id
     and status in ('pending','in_progress')
     and action_type = 'diagnostic_payment_followup';

  if not exists (
    select 1 from public.crm_actions
     where pre_diagnostic_id = v_pre_diagnostic_id
       and action_type = 'diagnostic_collection'
       and status in ('pending','in_progress')
  ) then
    insert into public.crm_actions (
      lead_id, pre_diagnostic_id, action_type, status, priority, title, payload
    ) values (
      v_lead.id,
      v_pre_diagnostic_id,
      'diagnostic_collection',
      'pending',
      'high',
      'Iniciar coleta do Diagnóstico Blinko',
      jsonb_build_object(
        'diagnostic_id', p_diagnostic_id,
        'company_id', v_company_id,
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
    'diagnostic_payment_confirmed',
    'human',
    coalesce(nullif(trim(coalesce(p_actor_label, '')), ''), 'unknown'),
    jsonb_build_object(
      'lead_id', v_lead.id,
      'company_id', v_company_id,
      'pre_diagnostic_id', v_pre_diagnostic_id,
      'payment_reference', nullif(trim(coalesce(p_payment_reference, '')), '')
    )
  );

  return p_diagnostic_id;
end;
$confirm_diagnostic_payment$;