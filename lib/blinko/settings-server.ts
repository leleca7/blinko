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

export function isSettingsSchemaPending(error: unknown) {
  return ["42P01", "42703", "42883"].includes(errorCode(error));
}

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export async function getSettingsWorkspace() {
  const sql = getSql();
  try {
    const [parameterRows, ruleRows, templateRows, executionRows] = await Promise.all([
      sql`select to_jsonb(p) as result from public.os_parameter_catalog p order by p.domain,p.parameter_key`,
      sql`select to_jsonb(r) as result from public.automation_rule_catalog r order by r.display_order,r.code`,
      sql`select to_jsonb(t) as result from public.document_template_catalog t order by t.display_order,t.code`,
      sql`
        select jsonb_build_object(
          'id',e.id,'rule_code',r.code,'rule_name',r.name,'version_number',v.version_number,
          'status',e.status,'entity_type',e.entity_type,'entity_id',e.entity_id,
          'idempotency_key',e.idempotency_key,'started_at',e.started_at,'completed_at',e.completed_at,
          'started_by_label',e.started_by_label,'completed_by_label',e.completed_by_label,
          'error_detail',e.error_detail
        ) as result
        from public.automation_rule_executions e
        join public.automation_rules r on r.id=e.rule_id
        join public.automation_rule_versions v on v.id=e.rule_version_id
        order by e.started_at desc
        limit 30
      `,
    ]);
    return {
      schemaReady: true,
      parameters: parameterRows.map((row) => record(row.result)).filter(Boolean) as Record<string, unknown>[],
      rules: ruleRows.map((row) => record(row.result)).filter(Boolean) as Record<string, unknown>[],
      templates: templateRows.map((row) => record(row.result)).filter(Boolean) as Record<string, unknown>[],
      executions: executionRows.map((row) => record(row.result)).filter(Boolean) as Record<string, unknown>[],
    };
  } catch (error) {
    if (isSettingsSchemaPending(error)) return { schemaReady: false, parameters: [], rules: [], templates: [], executions: [] };
    throw error;
  }
}

export async function setOsParameterVersion(input: {
  parameterKey: string;
  domain: string;
  name: string;
  description: string;
  valueKind: string;
  sensitivity: string;
  value: unknown;
  validFrom: string | null;
  validUntil: string | null;
  evidenceReference: string;
  sourceDocument: string;
  sourceVersion: string;
  notes: string;
  actorLabel: string;
}) {
  const sql = getSql();
  const rows = await sql`
    select public.set_os_parameter_version(
      ${input.parameterKey},${input.domain},${input.name},${input.description},${input.valueKind},${input.sensitivity},
      ${JSON.stringify(input.value)}::jsonb,${input.validFrom}::date,${input.validUntil}::date,${input.evidenceReference},
      ${input.sourceDocument},${input.sourceVersion},${input.notes},${input.actorLabel}
    ) as result
  `;
  return String(rows[0]?.result ?? "");
}

export async function setAutomationRuleVersion(input: {
  ruleCode: string;
  status: string;
  executionMode: string;
  runtimeBinding: string;
  triggerDescription: string;
  conditions: unknown[];
  actions: unknown[];
  exceptions: unknown[];
  ownerLabel: string;
  expectedResult: string;
  retryPolicy: string;
  evidenceReference: string;
  notes: string;
  actorLabel: string;
}) {
  const sql = getSql();
  const rows = await sql`
    select public.set_automation_rule_version(
      ${input.ruleCode},${input.status},${input.executionMode},${input.runtimeBinding},${input.triggerDescription},
      ${JSON.stringify(input.conditions)}::jsonb,${JSON.stringify(input.actions)}::jsonb,${JSON.stringify(input.exceptions)}::jsonb,
      ${input.ownerLabel},${input.expectedResult},${input.retryPolicy},${input.evidenceReference},${input.notes},${input.actorLabel}
    ) as result
  `;
  return String(rows[0]?.result ?? "");
}

export async function setDocumentTemplateVersion(input: {
  templateCode: string;
  status: string;
  audience: string;
  contentReference: string;
  reusableFields: unknown[];
  dataSources: unknown[];
  ownerLabel: string;
  reviewedAt: string;
  evidenceReference: string;
  notes: string;
  actorLabel: string;
}) {
  const sql = getSql();
  const rows = await sql`
    select public.set_document_template_version(
      ${input.templateCode},${input.status},${input.audience},${input.contentReference},
      ${JSON.stringify(input.reusableFields)}::jsonb,${JSON.stringify(input.dataSources)}::jsonb,
      ${input.ownerLabel},${input.reviewedAt}::timestamptz,${input.evidenceReference},${input.notes},${input.actorLabel}
    ) as result
  `;
  return String(rows[0]?.result ?? "");
}
