-- Blinko OS — Acesso interno + fila "Hoje na Blinko"
-- Aplicar depois de 001, 002, 003 e 004 no projeto Supabase EXCLUSIVO da Blinko.
--
-- Objetivo desta migração:
-- 1. vincular usuários do Supabase Auth a papéis internos da Blinko;
-- 2. manter leads/pré-diagnósticos fechados para acesso direto;
-- 3. expor apenas funções internas que verificam o usuário antes de retornar dados;
-- 4. preparar a primeira tela operacional "Hoje na Blinko".

create table if not exists public.blinko_team_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('owner','operations','commercial','specialist','viewer')),
  active boolean not null default true,
  can_approve_initial_readings boolean not null default false,
  can_manage_leads boolean not null default false,
  can_manage_settings boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.blinko_team_members enable row level security;
revoke all on table public.blinko_team_members from anon, authenticated;

-- O usuário autenticado pode consultar apenas o próprio perfil interno.
grant select on table public.blinko_team_members to authenticated;

create policy blinko_team_member_can_read_self
on public.blinko_team_members
for select
to authenticated
using (user_id = auth.uid());

create or replace function public.is_blinko_team_member()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.blinko_team_members m
     where m.user_id = auth.uid()
       and m.active = true
  );
$$;

create or replace function public.blinko_has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.blinko_team_members m
     where m.user_id = auth.uid()
       and m.active = true
       and (
         m.role = 'owner'
         or (p_permission = 'view_internal' and m.role in ('operations','commercial','specialist','viewer'))
         or (p_permission = 'manage_leads' and (m.can_manage_leads or m.role in ('operations','commercial')))
         or (p_permission = 'approve_initial_readings' and (m.can_approve_initial_readings or m.role in ('operations','commercial')))
         or (p_permission = 'manage_settings' and m.can_manage_settings)
       )
  );
$$;

revoke all on function public.is_blinko_team_member() from public, anon;
revoke all on function public.blinko_has_permission(text) from public, anon;
grant execute on function public.is_blinko_team_member() to authenticated;
grant execute on function public.blinko_has_permission(text) to authenticated;

-- Primeira leitura operacional do dia.
-- Não concede SELECT direto às tabelas de CRM: os dados passam por esta função controlada.
create or replace function public.get_blinko_today_queue()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not public.blinko_has_permission('view_internal') then
    raise exception 'not authorized';
  end if;

  select jsonb_build_object(
    'generated_at', now(),
    'counts', jsonb_build_object(
      'pending_pre_diagnostic_reviews', (
        select count(*)
          from public.crm_actions a
         where a.status in ('pending','in_progress')
           and a.action_type = 'review_pre_diagnostic'
      ),
      'initial_readings_waiting_approval', (
        select count(*)
          from public.pre_diagnostic_initial_readings r
         where r.status = 'pending_approval'
      ),
      'priority_leads', (
        select count(*)
          from public.leads l
         where l.commercial_score >= 8
           and l.status not in ('won','lost','archived')
      ),
      'ai_ready_waiting_human', (
        select count(*)
          from public.pre_diagnostics p
         where p.ai_analysis_status = 'ready'
           and p.human_review_status <> 'reviewed'
      )
    ),
    'actions', coalesce((
      select jsonb_agg(item order by sort_priority, sort_due, sort_created)
        from (
          select jsonb_build_object(
            'action_id', a.id,
            'action_type', a.action_type,
            'status', a.status,
            'priority', a.priority,
            'title', a.title,
            'due_at', a.due_at,
            'created_at', a.created_at,
            'lead_id', l.id,
            'pre_diagnostic_id', a.pre_diagnostic_id,
            'lead_name', l.name,
            'company_name', l.company_name,
            'commercial_score', l.commercial_score,
            'lead_status', l.status,
            'ai_analysis_status', p.ai_analysis_status,
            'human_review_status', p.human_review_status
          ) as item,
          case a.priority
            when 'urgent' then 1
            when 'high' then 2
            when 'normal' then 3
            else 4
          end as sort_priority,
          coalesce(a.due_at, 'infinity'::timestamptz) as sort_due,
          a.created_at as sort_created
          from public.crm_actions a
          join public.leads l on l.id = a.lead_id
          left join public.pre_diagnostics p on p.id = a.pre_diagnostic_id
         where a.status in ('pending','in_progress')
         order by sort_priority, sort_due, sort_created
         limit 50
        ) q
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- Workspace detalhado usado ao abrir uma revisão do Pré-Diagnóstico.
create or replace function public.get_pre_diagnostic_review_workspace(p_pre_diagnostic_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not public.blinko_has_permission('view_internal') then
    raise exception 'not authorized';
  end if;

  select jsonb_build_object(
    'lead', jsonb_build_object(
      'id', l.id,
      'status', l.status,
      'name', l.name,
      'email', l.email,
      'whatsapp', l.whatsapp,
      'company_name', l.company_name,
      'company_role', l.company_role,
      'city_state', l.city_state,
      'segment', l.segment,
      'website', l.website,
      'social_url', l.social_url,
      'objective', l.objective,
      'urgency', l.urgency,
      'commercial_score', l.commercial_score,
      'score_breakdown', l.score_breakdown,
      'source', l.source,
      'created_at', l.created_at
    ),
    'pre_diagnostic', to_jsonb(p),
    'current_analysis', (
      select to_jsonb(ar)
        from public.pre_diagnostic_analysis_runs ar
       where ar.id = p.current_ai_analysis_run_id
       limit 1
    ),
    'current_human_review', (
      select to_jsonb(rv)
        from public.pre_diagnostic_review_versions rv
       where rv.id = p.current_human_review_id
       limit 1
    ),
    'latest_initial_reading', (
      select to_jsonb(ir)
        from public.pre_diagnostic_initial_readings ir
       where ir.pre_diagnostic_id = p.id
       order by ir.created_at desc
       limit 1
    ),
    'open_actions', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.created_at)
        from public.crm_actions a
       where a.pre_diagnostic_id = p.id
         and a.status in ('pending','in_progress')
    ), '[]'::jsonb)
  ) into v_result
  from public.pre_diagnostics p
  join public.leads l on l.id = p.lead_id
  where p.id = p_pre_diagnostic_id;

  if v_result is null then
    raise exception 'pre-diagnostic not found';
  end if;

  return v_result;
end;
$$;

revoke all on function public.get_blinko_today_queue() from public, anon;
revoke all on function public.get_pre_diagnostic_review_workspace(uuid) from public, anon;
grant execute on function public.get_blinko_today_queue() to authenticated;
grant execute on function public.get_pre_diagnostic_review_workspace(uuid) to authenticated;

comment on table public.blinko_team_members is
'Usuários internos autorizados a acessar o Blinko OS. O cadastro depende de um usuário já existente no Supabase Auth.';

comment on function public.get_blinko_today_queue() is
'Fila operacional resumida do Blinko OS. Requer usuário autenticado e membro interno ativo.';

comment on function public.get_pre_diagnostic_review_workspace(uuid) is
'Bundle de revisão de um Pré-Diagnóstico. Requer usuário autenticado e membro interno ativo.';
