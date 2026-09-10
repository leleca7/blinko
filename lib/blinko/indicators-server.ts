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

export function isIndicatorsSchemaPending(error: unknown) {
  return ["42P01", "42703", "42883"].includes(errorCode(error));
}

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export type IndicatorsDashboard = {
  schemaReady: boolean;
  indicators: Record<string, unknown>[];
  leadsBySource: Record<string, unknown>[];
  lossesByReason: Record<string, unknown>[];
  blocksBySource: Record<string, unknown>[];
  financeByProject: Record<string, unknown>[];
  financeByCompany: Record<string, unknown>[];
  diagnosticByPillar: Record<string, unknown>[];
  forecastWeights: Record<string, unknown> | null;
};

const emptyDashboard: IndicatorsDashboard = {
  schemaReady: false,
  indicators: [],
  leadsBySource: [],
  lossesByReason: [],
  blocksBySource: [],
  financeByProject: [],
  financeByCompany: [],
  diagnosticByPillar: [],
  forecastWeights: null,
};

export async function getIndicatorsDashboard(): Promise<IndicatorsDashboard> {
  const sql = getSql();
  try {
    const [indicatorRows, sourceRows, lossRows, blockRows, projectRows, companyRows, pillarRows, parameterRows] = await Promise.all([
      sql`select to_jsonb(i) as result from public.blinko_indicator_snapshot_safe i order by i.display_order,i.indicator_code`,
      sql`select to_jsonb(x) as result from public.blinko_leads_by_source x`,
      sql`select to_jsonb(x) as result from public.blinko_losses_by_reason x`,
      sql`select to_jsonb(x) as result from public.blinko_operational_block_breakdown x`,
      sql`select to_jsonb(x) as result from public.blinko_finance_by_project x order by x.company_name,x.project_id`,
      sql`select to_jsonb(x) as result from public.blinko_finance_by_company_safe x order by x.company_name`,
      sql`select to_jsonb(x) as result from public.blinko_diagnostic_by_pillar x`,
      sql`select public.current_indicator_parameter_json('COM_WEIGHTED_FORECAST','stage_weights') as result`,
    ]);

    return {
      schemaReady: true,
      indicators: indicatorRows.map((row) => record(row.result)).filter(Boolean) as Record<string, unknown>[],
      leadsBySource: sourceRows.map((row) => record(row.result)).filter(Boolean) as Record<string, unknown>[],
      lossesByReason: lossRows.map((row) => record(row.result)).filter(Boolean) as Record<string, unknown>[],
      blocksBySource: blockRows.map((row) => record(row.result)).filter(Boolean) as Record<string, unknown>[],
      financeByProject: projectRows.map((row) => record(row.result)).filter(Boolean) as Record<string, unknown>[],
      financeByCompany: companyRows.map((row) => record(row.result)).filter(Boolean) as Record<string, unknown>[],
      diagnosticByPillar: pillarRows.map((row) => record(row.result)).filter(Boolean) as Record<string, unknown>[],
      forecastWeights: record(parameterRows[0]?.result),
    };
  } catch (error) {
    if (isIndicatorsSchemaPending(error)) return emptyDashboard;
    throw error;
  }
}

export async function setGlobalIndicatorTarget(input: {
  indicatorCode: string;
  operator: string;
  targetValue: number;
  targetValueMax?: number | null;
  validFrom?: string | null;
  validUntil?: string | null;
  evidenceReference: string;
  notes?: string;
  actorLabel: string;
}) {
  const sql = getSql();
  const targetValueMax = input.targetValueMax ?? null;
  const validFrom = input.validFrom || null;
  const validUntil = input.validUntil || null;
  const rows = await sql`
    select public.set_global_indicator_target(
      ${input.indicatorCode},${input.operator},${input.targetValue}::numeric,${targetValueMax}::numeric,
      ${validFrom}::date,${validUntil}::date,${input.evidenceReference},${input.notes ?? ""},${input.actorLabel}
    ) as result
  `;
  return String(rows[0]?.result ?? "");
}

export async function setForecastStageWeights(input: {
  weights: Record<string, number>;
  evidenceReference: string;
  notes?: string;
  actorLabel: string;
}) {
  const sql = getSql();
  const rows = await sql`
    select public.set_indicator_calculation_parameter(
      'COM_WEIGHTED_FORECAST','stage_weights',${JSON.stringify(input.weights)}::jsonb,
      ${input.evidenceReference},${input.notes ?? ""},${input.actorLabel}
    ) as result
  `;
  return String(rows[0]?.result ?? "");
}
