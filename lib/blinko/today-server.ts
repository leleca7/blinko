import "server-only";

import { neon } from "@neondatabase/serverless";

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("neon_not_configured");
  return databaseUrl;
}

function getSql() {
  return neon(getDatabaseUrl());
}

/**
 * Fila operacional consolidada da Blinko.
 * Une ações comerciais/pré-diagnóstico e tarefas reais de projetos.
 * Os quatro buckets oficiais funcionam mesmo antes da migração 012: enquanto
 * não existirem status waiting_partner/blocked, eles simplesmente ficam vazios.
 */
export async function getBlinkoTodayQueue() {
  const sql = getSql();

  const rows = await sql`
    with crm_queue as (
      select jsonb_build_object(
        'source', 'crm',
        'bucket', 'do_now',
        'action_id', a.id,
        'action_type', a.action_type,
        'status', a.status,
        'priority', a.priority,
        'title', a.title,
        'due_at', a.due_at,
        'created_at', a.created_at,
        'lead_id', l.id,
        'pre_diagnostic_id', pd.id,
        'lead_name', l.name,
        'company_name', l.company_name,
        'commercial_score', l.commercial_score,
        'lead_status', l.status,
        'ai_analysis_status', pd.ai_analysis_status,
        'human_review_status', pd.human_review_status,
        'project_id', null,
        'project_status', null,
        'responsible_label', null
      ) as action_row
      from public.crm_actions a
      join public.leads l on l.id = a.lead_id
      left join public.pre_diagnostics pd on pd.id = a.pre_diagnostic_id
      where a.status in ('pending', 'in_progress')
        and not (
          a.action_type = 'review_pre_diagnostic'
          and pd.human_review_status = 'reviewed'
        )
        and not (
          a.action_type = 'review_initial_reading'
          and exists (
            select 1
            from public.pre_diagnostic_initial_readings ir
            where ir.pre_diagnostic_id = pd.id
              and ir.status in ('approved','sent')
          )
        )
    ),
    project_queue as (
      select jsonb_build_object(
        'source', 'project_task',
        'bucket', case
          when t.status = 'waiting_client' then 'waiting_client'
          when t.status = 'waiting_partner' then 'waiting_partner'
          when t.status = 'blocked' then 'blocked'
          else 'do_now'
        end,
        'action_id', t.id,
        'action_type', 'project_task',
        'status', t.status,
        'priority', case when t.priority = 'critical' then 'urgent' else t.priority end,
        'title', t.title,
        'due_at', t.due_at,
        'created_at', t.created_at,
        'lead_id', null,
        'pre_diagnostic_id', null,
        'lead_name', '',
        'company_name', c.name,
        'commercial_score', 0,
        'lead_status', '',
        'ai_analysis_status', null,
        'human_review_status', null,
        'project_id', p.id,
        'project_status', p.status,
        'responsible_label', t.responsible_label
      ) as action_row
      from public.project_tasks t
      join public.projects p on p.id = t.project_id
      join public.companies c on c.id = p.company_id
      where t.status in ('pending', 'in_progress', 'waiting_client', 'waiting_partner', 'blocked')
        and p.status in ('onboarding', 'active', 'waiting_client', 'at_risk')
    ),
    queue as (
      select action_row from crm_queue
      union all
      select action_row from project_queue
    )
    select jsonb_build_object(
      'generated_at', now(),
      'counts', jsonb_build_object(
        'pending_pre_diagnostic_reviews', (
          select count(*) from public.pre_diagnostics
          where human_review_status in ('pending', 'reviewing')
        ),
        'initial_readings_waiting_approval', (
          select count(*) from public.pre_diagnostic_initial_readings
          where status in ('draft', 'pending_approval')
        ),
        'priority_leads', (
          select count(*) from public.leads
          where commercial_score >= 8 and status not in ('won', 'lost', 'archived')
        ),
        'ai_ready_waiting_human', (
          select count(*) from public.pre_diagnostics
          where ai_analysis_status = 'ready' and human_review_status <> 'reviewed'
        ),
        'overdue_project_tasks', (
          select count(*)
          from public.project_tasks t
          join public.projects p on p.id = t.project_id
          where t.status in ('pending', 'in_progress')
            and p.status in ('onboarding', 'active', 'waiting_client', 'at_risk')
            and t.due_at < now()
        ),
        'project_tasks_due_today', (
          select count(*)
          from public.project_tasks t
          join public.projects p on p.id = t.project_id
          where t.status in ('pending', 'in_progress')
            and p.status in ('onboarding', 'active', 'waiting_client', 'at_risk')
            and (t.due_at at time zone 'America/Bahia')::date = (now() at time zone 'America/Bahia')::date
        ),
        'waiting_client_project_tasks', (
          select count(*)
          from public.project_tasks t
          join public.projects p on p.id = t.project_id
          where t.status = 'waiting_client'
            and p.status in ('onboarding', 'active', 'waiting_client', 'at_risk')
        ),
        'waiting_partner_project_tasks', (
          select count(*)
          from public.project_tasks t
          join public.projects p on p.id = t.project_id
          where t.status = 'waiting_partner'
            and p.status in ('onboarding', 'active', 'waiting_client', 'at_risk')
        ),
        'blocked_project_tasks', (
          select count(*)
          from public.project_tasks t
          join public.projects p on p.id = t.project_id
          where t.status = 'blocked'
            and p.status in ('onboarding', 'active', 'waiting_client', 'at_risk')
        )
      ),
      'actions', coalesce((
        select jsonb_agg(action_row order by
          case action_row->>'bucket'
            when 'do_now' then 0
            when 'blocked' then 1
            when 'waiting_client' then 2
            when 'waiting_partner' then 3
            else 4
          end,
          case
            when nullif(action_row->>'due_at', '')::timestamptz < now() then 0
            else 1
          end,
          case action_row->>'priority'
            when 'urgent' then 0
            when 'high' then 1
            when 'normal' then 2
            else 3
          end,
          nullif(action_row->>'due_at', '')::timestamptz nulls last,
          (action_row->>'created_at')::timestamptz
        )
        from queue
      ), '[]'::jsonb)
    ) as result
  `;

  return rows[0]?.result;
}
