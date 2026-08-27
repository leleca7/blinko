import { neon } from "@neondatabase/serverless";

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("neon_not_configured");
  }

  return databaseUrl;
}

function getSql() {
  return neon(getDatabaseUrl());
}

/**
 * Uso exclusivo do servidor.
 * Nunca importar este módulo em Client Components.
 */
export function isNeonConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export async function createPreDiagnosticSubmission<T>(payload: Record<string, unknown>) {
  const sql = getSql();
  const rows = await sql`
    select public.create_pre_diagnostic_submission(${JSON.stringify(payload)}::jsonb) as result
  `;

  return rows[0]?.result as T;
}

export async function recordPreDiagnosticAnalysis(input: {
  preDiagnosticId: string;
  status: "processing" | "ready" | "failed";
  provider?: string;
  model?: string;
  promptVersion: string;
  inputSnapshot: Record<string, unknown>;
  output?: Record<string, unknown> | null;
  errorCode?: string | null;
  errorDetail?: string | null;
}) {
  const sql = getSql();
  const rows = await sql`
    select public.record_pre_diagnostic_analysis(
      ${input.preDiagnosticId}::uuid,
      ${input.status},
      ${input.provider ?? ""},
      ${input.model ?? ""},
      ${input.promptVersion},
      ${JSON.stringify(input.inputSnapshot)}::jsonb,
      ${input.output ? JSON.stringify(input.output) : null}::jsonb,
      ${input.errorCode ?? null},
      ${input.errorDetail ?? null}
    ) as result
  `;

  return rows[0]?.result as string;
}

export async function recordPreDiagnosticReview(input: {
  preDiagnosticId: string;
  analysisRunId?: string | null;
  reviewerUserId?: string | null;
  reviewerLabel?: string;
  decision: Record<string, unknown>;
}) {
  const sql = getSql();
  const rows = await sql`
    select public.record_pre_diagnostic_review(
      ${input.preDiagnosticId}::uuid,
      ${input.analysisRunId ?? null}::uuid,
      ${input.reviewerUserId ?? null}::uuid,
      ${input.reviewerLabel ?? ""},
      ${JSON.stringify(input.decision)}::jsonb
    ) as result
  `;

  return rows[0]?.result as string;
}

export async function createPreDiagnosticInitialReadingDraft(input: {
  preDiagnosticId: string;
  analysisRunId?: string | null;
  channel: string;
  subject?: string;
  body: string;
  contentVersion: string;
  createdByType: "ai" | "human" | "system";
  createdById?: string | null;
  supersedesId?: string | null;
}) {
  const sql = getSql();
  const rows = await sql`
    select public.create_pre_diagnostic_initial_reading_draft(
      ${input.preDiagnosticId}::uuid,
      ${input.analysisRunId ?? null}::uuid,
      ${input.channel},
      ${input.subject ?? ""},
      ${input.body},
      ${input.contentVersion},
      ${input.createdByType},
      ${input.createdById ?? null},
      ${input.supersedesId ?? null}::uuid
    ) as result
  `;

  return rows[0]?.result as string;
}

export async function approvePreDiagnosticInitialReading(input: {
  readingId: string;
  humanReviewId: string;
  body: string;
  subject?: string;
  reviewerUserId?: string | null;
  reviewerLabel?: string;
}) {
  const sql = getSql();
  const rows = await sql`
    select public.approve_pre_diagnostic_initial_reading(
      ${input.readingId}::uuid,
      ${input.humanReviewId}::uuid,
      ${input.body},
      ${input.subject ?? ""},
      ${input.reviewerUserId ?? null}::uuid,
      ${input.reviewerLabel ?? ""}
    ) as result
  `;

  return rows[0]?.result as string;
}

export async function markPreDiagnosticInitialReadingSent(input: {
  readingId: string;
  deliveryProvider: string;
  deliveryMessageId?: string;
}) {
  const sql = getSql();
  const rows = await sql`
    select public.record_pre_diagnostic_initial_reading_sent(
      ${input.readingId}::uuid,
      ${input.deliveryProvider},
      ${input.deliveryMessageId ?? ""}
    ) as result
  `;

  return rows[0]?.result as string;
}

export async function markPreDiagnosticInitialReadingFailed(input: {
  readingId: string;
  deliveryProvider: string;
  error: string;
}) {
  const sql = getSql();
  const rows = await sql`
    select public.record_pre_diagnostic_initial_reading_failed(
      ${input.readingId}::uuid,
      ${input.deliveryProvider},
      ${input.error}
    ) as result
  `;

  return rows[0]?.result as string;
}

/**
 * Registra que uma pessoa da Blinko iniciou contato. Não envia mensagem.
 * Atualiza o estágio apenas para frente, encerra tarefas de revisão já cumpridas
 * e pode criar uma próxima ação operacional.
 */
export async function recordLeadContact(input: {
  preDiagnosticId: string;
  leadId: string;
  channel: "whatsapp" | "email" | "phone" | "other";
  notes?: string;
  actorLabel: string;
  nextActionTitle?: string;
  nextActionAtLocal?: string;
}) {
  const sql = getSql();
  const rows = await sql`
    with target as (
      select l.id, l.status as old_status
      from public.leads l
      join public.pre_diagnostics pd on pd.lead_id = l.id
      where l.id = ${input.leadId}::uuid
        and pd.id = ${input.preDiagnosticId}::uuid
      limit 1
    ), updated as (
      update public.leads l
         set status = case when l.status in ('new','reviewing') then 'contacted' else l.status end,
             updated_at = now()
        from target t
       where l.id = t.id
      returning l.id, l.status as new_status
    ), closed_actions as (
      update public.crm_actions a
         set status = 'done', completed_at = now()
       where a.pre_diagnostic_id = ${input.preDiagnosticId}::uuid
         and a.status in ('pending','in_progress')
         and a.action_type in ('review_pre_diagnostic','review_initial_reading')
      returning a.id
    ), next_action as (
      insert into public.crm_actions (
        lead_id, pre_diagnostic_id, action_type, status, priority, title, payload, due_at
      )
      select
        ${input.leadId}::uuid,
        ${input.preDiagnosticId}::uuid,
        'follow_up',
        'pending',
        'normal',
        ${input.nextActionTitle ?? ""},
        jsonb_build_object(
          'created_by', ${input.actorLabel},
          'source', 'blinko_os_internal',
          'contact_channel', ${input.channel}
        ),
        case
          when nullif(${input.nextActionAtLocal ?? ""}, '') is null then null
          else (${input.nextActionAtLocal ?? ""}::timestamp at time zone 'America/Bahia')
        end
      where nullif(trim(${input.nextActionTitle ?? ""}), '') is not null
      returning id
    ), audit as (
      insert into public.audit_events (
        entity_type, entity_id, event_type, actor_type, actor_id, payload
      )
      select
        'lead',
        t.id,
        'contact_recorded',
        'human',
        ${input.actorLabel},
        jsonb_build_object(
          'pre_diagnostic_id', ${input.preDiagnosticId}::uuid,
          'channel', ${input.channel},
          'notes', ${input.notes ?? ""},
          'old_status', t.old_status,
          'new_status', u.new_status,
          'next_action_title', nullif(${input.nextActionTitle ?? ""}, ''),
          'next_action_at_local', nullif(${input.nextActionAtLocal ?? ""}, '')
        )
      from target t
      join updated u on u.id = t.id
      returning id
    )
    select jsonb_build_object(
      'ok', exists(select 1 from updated),
      'new_status', (select new_status from updated limit 1),
      'next_action_id', (select id from next_action limit 1)
    ) as result
  `;

  return rows[0]?.result;
}

/**
 * Agenda uma reunião no histórico/CRM. Não cria evento externo de calendário.
 */
export async function scheduleLeadMeeting(input: {
  preDiagnosticId: string;
  leadId: string;
  scheduledAtLocal: string;
  notes?: string;
  actorLabel: string;
}) {
  const sql = getSql();
  const rows = await sql`
    with target as (
      select l.id, l.status as old_status
      from public.leads l
      join public.pre_diagnostics pd on pd.lead_id = l.id
      where l.id = ${input.leadId}::uuid
        and pd.id = ${input.preDiagnosticId}::uuid
      limit 1
    ), updated as (
      update public.leads l
         set status = case when l.status in ('new','reviewing','contacted') then 'meeting' else l.status end,
             updated_at = now()
        from target t
       where l.id = t.id
      returning l.id, l.status as new_status
    ), close_followups as (
      update public.crm_actions a
         set status = 'done', completed_at = now()
       where a.pre_diagnostic_id = ${input.preDiagnosticId}::uuid
         and a.status in ('pending','in_progress')
         and a.action_type = 'follow_up'
      returning a.id
    ), meeting_action as (
      insert into public.crm_actions (
        lead_id, pre_diagnostic_id, action_type, status, priority, title, payload, due_at
      )
      select
        ${input.leadId}::uuid,
        ${input.preDiagnosticId}::uuid,
        'meeting',
        'pending',
        'normal',
        'Reunião com lead',
        jsonb_build_object(
          'created_by', ${input.actorLabel},
          'source', 'blinko_os_internal',
          'notes', ${input.notes ?? ""},
          'scheduled_at_local', ${input.scheduledAtLocal},
          'timezone', 'America/Bahia'
        ),
        (${input.scheduledAtLocal}::timestamp at time zone 'America/Bahia')
      where exists(select 1 from updated)
      returning id
    ), audit as (
      insert into public.audit_events (
        entity_type, entity_id, event_type, actor_type, actor_id, payload
      )
      select
        'lead',
        t.id,
        'meeting_scheduled',
        'human',
        ${input.actorLabel},
        jsonb_build_object(
          'pre_diagnostic_id', ${input.preDiagnosticId}::uuid,
          'scheduled_at_local', ${input.scheduledAtLocal},
          'timezone', 'America/Bahia',
          'notes', ${input.notes ?? ""},
          'old_status', t.old_status,
          'new_status', u.new_status,
          'crm_action_id', (select id from meeting_action limit 1)
        )
      from target t
      join updated u on u.id = t.id
      returning id
    )
    select jsonb_build_object(
      'ok', exists(select 1 from updated),
      'new_status', (select new_status from updated limit 1),
      'meeting_action_id', (select id from meeting_action limit 1)
    ) as result
  `;

  return rows[0]?.result;
}

/**
 * Leitura server-only da fila operacional "Hoje na Blinko".
 * Não expõe tabelas diretamente ao navegador e não substitui autenticação.
 */
export async function getBlinkoTodayQueue() {
  const sql = getSql();
  const rows = await sql`
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
        )
      ),
      'actions', coalesce((
        select jsonb_agg(action_row order by
          case action_row->>'priority'
            when 'urgent' then 0
            when 'high' then 1
            when 'normal' then 2
            else 3
          end,
          nullif(action_row->>'due_at', '')::timestamptz nulls last,
          (action_row->>'created_at')::timestamptz
        )
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
            'pre_diagnostic_id', pd.id,
            'lead_name', l.name,
            'company_name', l.company_name,
            'commercial_score', l.commercial_score,
            'lead_status', l.status,
            'ai_analysis_status', pd.ai_analysis_status,
            'human_review_status', pd.human_review_status
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
          order by a.created_at asc
          limit 50
        ) queue_rows
      ), '[]'::jsonb)
    ) as result
  `;

  return rows[0]?.result;
}

/**
 * Workspace completo de uma revisão, sempre server-only.
 */
export async function getPreDiagnosticReviewWorkspace(preDiagnosticId: string) {
  const sql = getSql();
  const rows = await sql`
    select jsonb_build_object(
      'pre_diagnostic', to_jsonb(pd),
      'lead', to_jsonb(l),
      'current_analysis', case when ar.id is null then null else to_jsonb(ar) end,
      'current_human_review', case when rv.id is null then null else to_jsonb(rv) end,
      'latest_initial_reading', (
        select to_jsonb(ir)
        from public.pre_diagnostic_initial_readings ir
        where ir.pre_diagnostic_id = pd.id
        order by ir.created_at desc
        limit 1
      ),
      'open_actions', coalesce((
        select jsonb_agg(to_jsonb(a) order by a.due_at nulls last, a.created_at asc)
        from public.crm_actions a
        where a.pre_diagnostic_id = pd.id
          and a.status in ('pending', 'in_progress')
          and not (a.action_type = 'review_pre_diagnostic' and pd.human_review_status = 'reviewed')
          and not (
            a.action_type = 'review_initial_reading'
            and exists (
              select 1
              from public.pre_diagnostic_initial_readings ir
              where ir.pre_diagnostic_id = pd.id
                and ir.status in ('approved','sent')
            )
          )
      ), '[]'::jsonb)
    ) as result
    from public.pre_diagnostics pd
    join public.leads l on l.id = pd.lead_id
    left join public.pre_diagnostic_analysis_runs ar on ar.id = pd.current_ai_analysis_run_id
    left join public.pre_diagnostic_review_versions rv on rv.id = pd.current_human_review_id
    where pd.id = ${preDiagnosticId}::uuid
    limit 1
  `;

  return rows[0]?.result ?? null;
}
