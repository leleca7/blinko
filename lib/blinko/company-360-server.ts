import "server-only";

import { neon } from "@neondatabase/serverless";

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("neon_not_configured");
  return neon(databaseUrl);
}

function errorCode(error: unknown) {
  if (!error || typeof error !== "object") return "";
  return typeof (error as { code?: unknown }).code === "string" ? String((error as { code?: string }).code) : "";
}

export function isCompany360SchemaPending(error: unknown) {
  return ["42P01", "42703", "42883"].includes(errorCode(error));
}

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function records(value: unknown) {
  return Array.isArray(value) ? value.map(record).filter(Boolean) as Record<string, unknown>[] : [];
}

export type ContactsOverview = {
  schemaReady: boolean;
  contacts: Record<string, unknown>[];
  companies: Record<string, unknown>[];
};

export async function listContactsOverview(): Promise<ContactsOverview> {
  const sql = getSql();
  try {
    const [contactRows, companyRows] = await Promise.all([
      sql`
        select jsonb_build_object(
          'id',ct.id,
          'name',ct.name,
          'email',ct.email,
          'whatsapp',ct.whatsapp,
          'role_title',ct.role_title,
          'status',ct.status,
          'is_primary',ct.is_primary,
          'preferred_channel',ct.preferred_channel,
          'notes',ct.notes,
          'source_lead_id',ct.source_lead_id,
          'company_id',ct.company_id,
          'company_name',c.name,
          'lead_status',l.status,
          'open_opportunities',(select count(*)::integer from public.commercial_opportunities o where o.contact_id=ct.id and o.outcome_status is null),
          'total_opportunities',(select count(*)::integer from public.commercial_opportunities o where o.contact_id=ct.id),
          'last_opportunity_at',(select max(o.created_at) from public.commercial_opportunities o where o.contact_id=ct.id),
          'created_at',ct.created_at
        ) as result
        from public.contacts ct
        left join public.companies c on c.id=ct.company_id
        left join public.leads l on l.id=ct.source_lead_id
        order by case when ct.company_id is null then 0 else 1 end,lower(ct.name),ct.created_at
      `,
      sql`select jsonb_build_object('id',id,'name',name,'relationship_status',relationship_status) as result from public.companies order by lower(name)`,
    ]);
    return {
      schemaReady: true,
      contacts: contactRows.map((row) => record(row.result)).filter(Boolean) as Record<string, unknown>[],
      companies: companyRows.map((row) => record(row.result)).filter(Boolean) as Record<string, unknown>[],
    };
  } catch (error) {
    if (isCompany360SchemaPending(error)) return { schemaReady: false, contacts: [], companies: [] };
    throw error;
  }
}

export type Company360 = {
  schemaReady: boolean;
  contacts: Record<string, unknown>[];
  opportunities: Record<string, unknown>[];
  diagnostics: Record<string, unknown>[];
  projects: Record<string, unknown>[];
};

export async function getCompany360(companyId: string): Promise<Company360> {
  const sql = getSql();
  try {
    const rows = await sql`
      select jsonb_build_object(
        'contacts',coalesce((
          select jsonb_agg(jsonb_build_object(
            'id',ct.id,'name',ct.name,'email',ct.email,'whatsapp',ct.whatsapp,'role_title',ct.role_title,
            'status',ct.status,'is_primary',ct.is_primary,'preferred_channel',ct.preferred_channel,
            'notes',ct.notes,'source_lead_id',ct.source_lead_id,'created_at',ct.created_at
          ) order by ct.is_primary desc,ct.status,lower(ct.name))
          from public.contacts ct where ct.company_id=${companyId}::uuid
        ),'[]'::jsonb),
        'opportunities',coalesce((
          select jsonb_agg(jsonb_build_object(
            'id',o.id,'pipeline_stage',o.pipeline_stage,'outcome_status',o.outcome_status,'fit',o.fit,
            'stated_need',o.stated_need,'owner_label',o.owner_label,'next_action_title',o.next_action_title,
            'next_action_at',o.next_action_at,'contact_id',o.contact_id,
            'contact_name',coalesce(ct.name,l.name),'proposal_id',p.id,'proposal_status',p.status,
            'project_id',prj.id,'project_status',prj.status,'created_at',o.created_at,'closed_at',o.closed_at
          ) order by case when o.outcome_status is null then 0 else 1 end,o.created_at desc)
          from public.commercial_opportunities o
          join public.leads l on l.id=o.lead_id
          left join public.contacts ct on ct.id=o.contact_id
          left join lateral (select p0.id,p0.status from public.proposals p0 where p0.opportunity_id=o.id order by p0.created_at desc limit 1) p on true
          left join lateral (select p1.id,p1.status from public.projects p1 where p1.proposal_id=p.id order by p1.created_at desc limit 1) prj on true
          where o.company_id=${companyId}::uuid
        ),'[]'::jsonb),
        'diagnostics',coalesce((
          select jsonb_agg(jsonb_build_object(
            'id',d.id,'status',d.status,'methodology_version',d.methodology_version,'lead_id',d.lead_id,
            'pre_diagnostic_id',d.pre_diagnostic_id,'offered_by_label',d.offered_by_label,'offered_at',d.offered_at,
            'payment_confirmed_at',d.payment_confirmed_at,'created_at',d.created_at
          ) order by d.created_at desc)
          from public.diagnostics d where d.company_id=${companyId}::uuid
        ),'[]'::jsonb),
        'projects',coalesce((
          select jsonb_agg(jsonb_build_object(
            'id',prj.id,'proposal_id',prj.proposal_id,'objective',prj.objective,'start_date',prj.start_date,
            'target_timeframe',prj.target_timeframe,'status',prj.status,'next_review_at',prj.next_review_at,
            'created_at',prj.created_at
          ) order by prj.created_at desc)
          from public.projects prj where prj.company_id=${companyId}::uuid
        ),'[]'::jsonb)
      ) as result
    `;
    const result = record(rows[0]?.result) ?? {};
    return {
      schemaReady: true,
      contacts: records(result.contacts),
      opportunities: records(result.opportunities),
      diagnostics: records(result.diagnostics),
      projects: records(result.projects),
    };
  } catch (error) {
    if (isCompany360SchemaPending(error)) return { schemaReady: false, contacts: [], opportunities: [], diagnostics: [], projects: [] };
    throw error;
  }
}

export async function saveCompanyContact(input: {
  contactId?: string | null;
  companyId: string;
  name: string;
  email?: string;
  whatsapp?: string;
  roleTitle?: string;
  isPrimary: boolean;
  preferredChannel?: string;
  notes?: string;
  actorLabel: string;
}) {
  const sql = getSql();
  const rows = await sql`
    select public.save_company_contact(
      ${input.contactId || null}::uuid,${input.companyId}::uuid,${input.name},${input.email ?? ""},${input.whatsapp ?? ""},
      ${input.roleTitle ?? ""},${input.isPrimary},${input.preferredChannel ?? ""},${input.notes ?? ""},${input.actorLabel}
    ) as result
  `;
  return String(rows[0]?.result ?? "");
}

export async function assignContactToCompany(input: {
  contactId: string;
  companyId: string;
  isPrimary: boolean;
  actorLabel: string;
}) {
  const sql = getSql();
  const rows = await sql`
    select public.assign_contact_to_company(${input.contactId}::uuid,${input.companyId}::uuid,${input.isPrimary},${input.actorLabel}) as result
  `;
  return String(rows[0]?.result ?? "");
}
