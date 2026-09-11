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

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function records(value: unknown) {
  return Array.isArray(value) ? value.map(record).filter(Boolean) as Record<string, unknown>[] : [];
}

export async function listPartners() {
  const sql = getSql();
  try {
    const rows = await sql`
      select jsonb_build_object(
        'id',p.id,'official_code',p.official_code,'trade_name',p.trade_name,'area',p.area,
        'status',p.status,'official_status_label',p.official_status_label,'registration_status',p.registration_status,
        'technical_validation_status',p.technical_validation_status,'commercial_validation_status',p.commercial_validation_status,
        'pilot_controlled',p.pilot_controlled,'operational_eligibility',public.partner_operational_eligibility(p.id),
        'capabilities',coalesce(s.capabilities,'[]'::jsonb),
        'current_rule',case when r.id is null then null else jsonb_build_object(
          'id',r.id,'version_number',r.version_number,'remuneration_model',r.remuneration_model,
          'calculation_base_status',r.calculation_base_status,'calculation_base_description',r.calculation_base_description,
          'percentage_value',r.percentage_value,'fixed_amount',r.fixed_amount,'formalization_status',r.formalization_status,
          'formalization_reference',r.formalization_reference,'auto_calculable',public.partner_financial_rule_auto_calculable(r.id)
        ) end,
        'active_assignments',(select count(*) from public.project_partner_assignments pa where pa.partner_id=p.id and pa.status in ('planned','confirmed','in_progress')),
        'committed_cost',(select coalesce(sum(pc.amount),0) from public.project_costs pc where pc.partner_id=p.id and pc.status in ('committed','realized','paid'))
      ) as result
      from public.partners p
      left join lateral (
        select jsonb_agg(jsonb_build_object('solution_code',sb.official_code,'solution_name',sb.name,'status',c.status) order by sb.official_code) capabilities
        from public.partner_solution_capabilities c join public.solution_blueprints sb on sb.id=c.blueprint_id where c.partner_id=p.id
      ) s on true
      left join lateral (
        select r.* from public.partner_financial_rules r where r.partner_id=p.id and r.is_current order by case when r.blueprint_id is null then 1 else 0 end,r.version_number desc limit 1
      ) r on true
      order by coalesce(p.official_code,'ZZZ'),p.trade_name
    `;
    return { schemaReady: true, partners: rows.map((row) => record(row.result)).filter(Boolean) as Record<string, unknown>[] };
  } catch (error) {
    if (["42P01","42703","42883"].includes(errorCode(error))) return { schemaReady: false, partners: [] as Record<string, unknown>[] };
    throw error;
  }
}

export async function getPartner(partnerId: string) {
  const sql = getSql();
  try {
    const rows = await sql`
      select jsonb_build_object(
        'partner',to_jsonb(p) || jsonb_build_object('operational_eligibility',public.partner_operational_eligibility(p.id)),
        'capabilities',coalesce((select jsonb_agg(to_jsonb(c) || jsonb_build_object('solution_code',sb.official_code,'solution_name',sb.name) order by sb.official_code) from public.partner_solution_capabilities c join public.solution_blueprints sb on sb.id=c.blueprint_id where c.partner_id=p.id),'[]'::jsonb),
        'rules',coalesce((select jsonb_agg(to_jsonb(r) || jsonb_build_object('auto_calculable',public.partner_financial_rule_auto_calculable(r.id)) order by r.version_number desc) from public.partner_financial_rules r where r.partner_id=p.id),'[]'::jsonb),
        'assignments',coalesce((select jsonb_agg(jsonb_build_object('id',pa.id,'project_id',pa.project_id,'project_status',prj.status,'company_name',co.name,'solution_code',ps.solution_code,'execution_route',pa.execution_route,'status',pa.status,'quote_reference',pa.quote_reference,'committed_cost_to_blinko',pa.committed_cost_to_blinko,'cost_status',pc.status,'cost_amount',pc.amount) order by pa.created_at desc) from public.project_partner_assignments pa join public.projects prj on prj.id=pa.project_id join public.companies co on co.id=prj.company_id join public.project_solutions ps on ps.id=pa.project_solution_id left join public.project_costs pc on pc.partner_assignment_id=pa.id where pa.partner_id=p.id),'[]'::jsonb)
      ) as result
      from public.partners p where p.id=${partnerId}::uuid limit 1
    `;
    const result = record(rows[0]?.result);
    return { schemaReady: true, partner: record(result?.partner), capabilities: records(result?.capabilities), rules: records(result?.rules), assignments: records(result?.assignments) };
  } catch (error) {
    if (["42P01","42703","42883"].includes(errorCode(error))) return { schemaReady: false, partner: null, capabilities: [], rules: [], assignments: [] };
    throw error;
  }
}
