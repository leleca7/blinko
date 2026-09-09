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

function errorCode(error: unknown) {
  if (!error || typeof error !== "object") return "";
  return typeof (error as { code?: unknown }).code === "string" ? String((error as { code?: string }).code) : "";
}

function object(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function list(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function numeric(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return 0;
}

/**
 * Fila operacional consolidada da Blinko.
 * O núcleo (CRM + tarefas) funciona no schema antigo. Aprovações, financeiro e
 * encerramento são carregados como extensões: se as migrações 014/016/018 ainda
 * não existirem no ambiente, a tela continua funcionando com contadores zerados.
 */
export async function getBlinkoTodayQueue() {
  const sql = getSql();

  const baseRows = await sql`
    with crm_queue as (
      select jsonb_build_object(
        'source', 'crm', 'bucket', 'do_now', 'action_id', a.id,
        'action_type', a.action_type, 'status', a.status, 'priority', a.priority,
        'title', a.title, 'due_at', a.due_at, 'created_at', a.created_at,
        'lead_id', l.id, 'pre_diagnostic_id', pd.id, 'lead_name', l.name,
        'company_name', l.company_name, 'commercial_score', l.commercial_score,
        'lead_status', l.status, 'ai_analysis_status', pd.ai_analysis_status,
        'human_review_status', pd.human_review_status, 'project_id', null,
        'project_status', null, 'responsible_label', null
      ) as action_row
      from public.crm_actions a
      join public.leads l on l.id = a.lead_id
      left join public.pre_diagnostics pd on pd.id = a.pre_diagnostic_id
      where a.status in ('pending', 'in_progress')
        and not (a.action_type = 'review_pre_diagnostic' and pd.human_review_status = 'reviewed')
        and not (
          a.action_type = 'review_initial_reading'
          and exists (
            select 1 from public.pre_diagnostic_initial_readings ir
            where ir.pre_diagnostic_id = pd.id and ir.status in ('approved','sent')
          )
        )
    ),
    project_queue as (
      select jsonb_build_object(
        'source', 'project_task',
        'bucket', case when t.status='waiting_client' then 'waiting_client' when t.status='waiting_partner' then 'waiting_partner' when t.status='blocked' then 'blocked' else 'do_now' end,
        'action_id', t.id, 'action_type', 'project_task', 'status', t.status,
        'priority', case when t.priority='critical' then 'urgent' else t.priority end,
        'title', t.title, 'due_at', t.due_at, 'created_at', t.created_at,
        'lead_id', null, 'pre_diagnostic_id', null, 'lead_name', '', 'company_name', c.name,
        'commercial_score', 0, 'lead_status', '', 'ai_analysis_status', null,
        'human_review_status', null, 'project_id', p.id, 'project_status', p.status,
        'responsible_label', t.responsible_label
      ) as action_row
      from public.project_tasks t
      join public.projects p on p.id=t.project_id
      join public.companies c on c.id=p.company_id
      where t.status in ('pending','in_progress','waiting_client','waiting_partner','blocked')
        and p.status in ('onboarding','active','waiting_client','at_risk')
    ),
    queue as (
      select action_row from crm_queue union all select action_row from project_queue
    )
    select jsonb_build_object(
      'generated_at', now(),
      'counts', jsonb_build_object(
        'pending_pre_diagnostic_reviews',(select count(*) from public.pre_diagnostics where human_review_status in ('pending','reviewing')),
        'initial_readings_waiting_approval',(select count(*) from public.pre_diagnostic_initial_readings where status in ('draft','pending_approval')),
        'priority_leads',(select count(*) from public.leads where commercial_score>=8 and status not in ('won','lost','archived')),
        'ai_ready_waiting_human',(select count(*) from public.pre_diagnostics where ai_analysis_status='ready' and human_review_status<>'reviewed'),
        'overdue_project_tasks',(select count(*) from public.project_tasks t join public.projects p on p.id=t.project_id where t.status in ('pending','in_progress') and p.status in ('onboarding','active','waiting_client','at_risk') and t.due_at<now()),
        'project_tasks_due_today',(select count(*) from public.project_tasks t join public.projects p on p.id=t.project_id where t.status in ('pending','in_progress') and p.status in ('onboarding','active','waiting_client','at_risk') and (t.due_at at time zone 'America/Bahia')::date=(now() at time zone 'America/Bahia')::date),
        'waiting_client_project_tasks',(select count(*) from public.project_tasks t join public.projects p on p.id=t.project_id where t.status='waiting_client' and p.status in ('onboarding','active','waiting_client','at_risk')),
        'waiting_partner_project_tasks',(select count(*) from public.project_tasks t join public.projects p on p.id=t.project_id where t.status='waiting_partner' and p.status in ('onboarding','active','waiting_client','at_risk')),
        'blocked_project_tasks',(select count(*) from public.project_tasks t join public.projects p on p.id=t.project_id where t.status='blocked' and p.status in ('onboarding','active','waiting_client','at_risk'))
      ),
      'actions',coalesce((select jsonb_agg(action_row order by case action_row->>'bucket' when 'do_now' then 0 when 'blocked' then 1 when 'waiting_client' then 2 when 'waiting_partner' then 3 else 4 end,case when nullif(action_row->>'due_at','')::timestamptz<now() then 0 else 1 end,case action_row->>'priority' when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end,nullif(action_row->>'due_at','')::timestamptz nulls last,(action_row->>'created_at')::timestamptz) from queue),'[]'::jsonb)
    ) as result
  `;

  const base = object(baseRows[0]?.result) ?? { generated_at: new Date().toISOString(), counts: {}, actions: [] };

  let extensions: Record<string, unknown> = { counts: {}, actions: [] };
  try {
    const extensionRows = await sql`
      with approval_queue as (
        select jsonb_build_object(
          'source','approval',
          'bucket',case when a.status='pending' then 'waiting_client' else 'do_now' end,
          'action_id',a.id,'action_type',case when a.status='changes_requested' then 'approval_changes_requested' else 'approval_pending' end,
          'status',case when a.status='pending' then 'waiting_client' else 'in_progress' end,
          'priority',case when a.status='changes_requested' then 'high' when a.due_at<now() then 'urgent' else 'normal' end,
          'title',case when a.status='changes_requested' then 'Revisar ajustes solicitados: '||a.title else 'Aprovação aguardando cliente: '||a.title end,
          'due_at',a.due_at,'created_at',a.created_at,'lead_id',null,'pre_diagnostic_id',null,'lead_name','',
          'company_name',c.name,'commercial_score',0,'lead_status','','ai_analysis_status',null,'human_review_status',null,
          'project_id',p.id,'project_status',p.status,'responsible_label',coalesce(a.requested_by_label,'')
        ) as action_row
        from public.approvals a
        join public.projects p on p.id=a.project_id
        join public.companies c on c.id=p.company_id
        where a.status in ('pending','changes_requested') and p.status in ('onboarding','active','waiting_client','at_risk','completed')
      ),
      finance_queue as (
        select jsonb_build_object(
          'source','finance','bucket','do_now','action_id',r.id,'action_type','receivable_followup','status','pending',
          'priority',case when r.status='overdue' or r.due_date<(now() at time zone 'America/Bahia')::date then 'urgent' else 'high' end,
          'title',case when r.status='overdue' or r.due_date<(now() at time zone 'America/Bahia')::date then 'Cobrar recebível vencido: '||r.description else 'Recebível vence hoje: '||r.description end,
          'due_at',(r.due_date::timestamp at time zone 'America/Bahia'),'created_at',r.created_at,'lead_id',null,'pre_diagnostic_id',null,'lead_name','',
          'company_name',c.name,'commercial_score',0,'lead_status','','ai_analysis_status',null,'human_review_status',null,
          'project_id',p.id,'project_status',p.status,'responsible_label','Financeiro'
        ) as action_row
        from public.receivables r
        join public.projects p on p.id=r.project_id
        join public.companies c on c.id=p.company_id
        where r.status in ('pending','overdue') and r.due_date <= (now() at time zone 'America/Bahia')::date
      ),
      closure_queue as (
        select jsonb_build_object(
          'source','project_closure','bucket','do_now','action_id',p.id,'action_type','project_closure','status','pending','priority','normal',
          'title','Preparar encerramento do projeto','due_at',p.next_review_at,'created_at',p.created_at,'lead_id',null,'pre_diagnostic_id',null,'lead_name','',
          'company_name',c.name,'commercial_score',0,'lead_status','','ai_analysis_status',null,'human_review_status',null,
          'project_id',p.id,'project_status',p.status,'responsible_label','Operação'
        ) as action_row
        from public.projects p join public.companies c on c.id=p.company_id
        where p.status in ('active','waiting_client','at_risk')
          and not exists(select 1 from public.project_tasks t where t.project_id=p.id and t.status not in ('done','cancelled'))
          and not exists(select 1 from public.approvals a where a.project_id=p.id and a.status in ('draft','pending','changes_requested'))
          and exists(select 1 from public.project_financial_plans fp where fp.project_id=p.id)
      ),
      queue as (
        select action_row from approval_queue union all select action_row from finance_queue union all select action_row from closure_queue
      )
      select jsonb_build_object(
        'counts',jsonb_build_object(
          'pending_approvals',(select count(*) from public.approvals where status='pending'),
          'approvals_changes_requested',(select count(*) from public.approvals where status='changes_requested'),
          'overdue_receivables',(select count(*) from public.receivables where status='overdue' or (status='pending' and due_date<(now() at time zone 'America/Bahia')::date)),
          'receivables_due_today',(select count(*) from public.receivables where status='pending' and due_date=(now() at time zone 'America/Bahia')::date),
          'projects_ready_to_close',(select count(*) from public.projects p where p.status in ('active','waiting_client','at_risk') and not exists(select 1 from public.project_tasks t where t.project_id=p.id and t.status not in ('done','cancelled')) and not exists(select 1 from public.approvals a where a.project_id=p.id and a.status in ('draft','pending','changes_requested')) and exists(select 1 from public.project_financial_plans fp where fp.project_id=p.id))
        ),
        'actions',coalesce((select jsonb_agg(action_row) from queue),'[]'::jsonb)
      ) as result
    `;
    extensions = object(extensionRows[0]?.result) ?? extensions;
  } catch (error) {
    if (!["42P01","42703","42883"].includes(errorCode(error))) throw error;
  }

  const baseCounts = object(base.counts) ?? {};
  const extensionCounts = object(extensions.counts) ?? {};
  const mergedCounts = {
    ...baseCounts,
    pending_approvals: numeric(extensionCounts.pending_approvals),
    approvals_changes_requested: numeric(extensionCounts.approvals_changes_requested),
    overdue_receivables: numeric(extensionCounts.overdue_receivables),
    receivables_due_today: numeric(extensionCounts.receivables_due_today),
    projects_ready_to_close: numeric(extensionCounts.projects_ready_to_close),
  };

  const actions = [...list(base.actions), ...list(extensions.actions)].sort((a, b) => {
    const aa = object(a) ?? {};
    const bb = object(b) ?? {};
    const bucketRank = (value: unknown) => ({ do_now: 0, blocked: 1, waiting_client: 2, waiting_partner: 3 }[String(value) as "do_now"] ?? 4);
    const priorityRank = (value: unknown) => ({ urgent: 0, high: 1, normal: 2, low: 3 }[String(value) as "urgent"] ?? 4);
    return bucketRank(aa.bucket) - bucketRank(bb.bucket) || priorityRank(aa.priority) - priorityRank(bb.priority);
  });

  return {
    generated_at: String(base.generated_at ?? new Date().toISOString()),
    counts: mergedCounts,
    actions,
  };
}
