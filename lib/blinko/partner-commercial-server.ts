import "server-only";

import { neon } from "@neondatabase/serverless";
import { getInternalSession, hasInternalPermission } from "./internal-auth";

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("neon_not_configured");
  return databaseUrl;
}
function getSql() { return neon(getDatabaseUrl()); }
function errorCode(error: unknown) {
  if (!error || typeof error !== "object") return "";
  return typeof (error as { code?: unknown }).code === "string" ? String((error as { code?: string }).code) : "";
}
export function isPartnerCommercialSchemaPending(error: unknown) { return ["42P01", "42703", "42883"].includes(errorCode(error)); }
function record(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function records(value: unknown) { return Array.isArray(value) ? value.map(record).filter(Boolean) as Record<string, unknown>[] : []; }
async function financialAllowed() { const session = await getInternalSession(); return Boolean(session && hasInternalPermission(session, "finance.view")); }

export type ProposalPartnerContext = { schemaReady: boolean; requirementsReady: boolean; interventions: Record<string, unknown>[] };

export async function getProposalPartnerContext(proposalId: string): Promise<ProposalPartnerContext> {
  if (!proposalId) return { schemaReady: true, requirementsReady: false, interventions: [] };
  const sql = getSql();
  const canViewFinancial = await financialAllowed();
  try {
    const rows = await sql`
      select jsonb_build_object(
        'requirements_ready', public.proposal_partner_requirements_ready(p.id),
        'interventions', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id',i.id,'title',i.title,'solution_code',b.official_code,'solution_name',b.name,
            'selected_route',i.selected_execution_route,'allowed_routes',to_jsonb(b.execution_routes),
            'partner_required',public.proposal_route_requires_external_partner(i.selected_execution_route),
            'commitment',(
              select jsonb_build_object(
                'id',pc.id,'validation_status',pc.validation_status,'approval_scope',pc.approval_scope,
                'execution_route',pc.execution_route,'blinko_role',pc.blinko_role,'quote_reference',pc.quote_reference,
                'quoted_at',pc.quoted_at,'quote_valid_until',pc.quote_valid_until,
                'quoted_cost_to_blinko',case when ${canViewFinancial} then pc.quoted_cost_to_blinko else null end,
                'blinko_payment_obligation',case when ${canViewFinancial} then pc.blinko_payment_obligation else null end,
                'payment_terms_snapshot',case when ${canViewFinancial} then pc.payment_terms_snapshot else null end,
                'condition_evidence',pc.condition_evidence,'validation_evidence',pc.validation_evidence,
                'partner_id',pt.id,'partner_code',pt.official_code,'partner_name',pt.trade_name,
                'partner_eligibility',public.partner_operational_eligibility(pt.id),
                'financial_rule_id',case when ${canViewFinancial} then pc.financial_rule_id else null end,
                'financial_rule_auto_calculable',case when ${canViewFinancial} and pc.financial_rule_id is not null then public.partner_financial_rule_auto_calculable(pc.financial_rule_id) else false end,
                'financial_data_visible',${canViewFinancial},'ready',public.proposal_partner_commitment_is_ready(pc.id)
              )
              from public.proposal_partner_commitments pc join public.partners pt on pt.id=pc.partner_id
              where pc.proposal_version_id=p.current_version_id and pc.intervention_id=i.id and pc.is_current limit 1
            ),
            'partner_options',coalesce((
              select jsonb_agg(jsonb_build_object(
                'partner_id',pt.id,'partner_code',pt.official_code,'partner_name',pt.trade_name,
                'partner_status',pt.status,'registration_status',pt.registration_status,
                'eligibility',public.partner_operational_eligibility(pt.id),'capability_status',cap.status,
                'financial_rule_id',case when ${canViewFinancial} then fr.id else null end,
                'financial_rule_model',case when ${canViewFinancial} then fr.remuneration_model else null end,
                'financial_rule_status',case when ${canViewFinancial} then fr.formalization_status else null end,
                'financial_rule_percentage',case when ${canViewFinancial} then fr.percentage_value else null end,
                'financial_rule_base_status',case when ${canViewFinancial} then fr.calculation_base_status else null end,
                'financial_rule_auto_calculable',case when ${canViewFinancial} and fr.id is not null then public.partner_financial_rule_auto_calculable(fr.id) else false end,
                'financial_data_visible',${canViewFinancial}
              ) order by coalesce(pt.official_code,'ZZZ'),pt.trade_name)
              from public.partner_solution_capabilities cap
              join public.partners pt on pt.id=cap.partner_id
              left join lateral (
                select r.* from public.partner_financial_rules r
                where r.partner_id=pt.id and r.is_current and (r.blueprint_id=b.id or r.blueprint_id is null)
                order by case when r.blueprint_id=b.id then 0 else 1 end,r.version_number desc limit 1
              ) fr on true
              where cap.blueprint_id=b.id
            ),'[]'::jsonb)
          ) order by i.created_at)
          from jsonb_array_elements_text(pv.intervention_ids) x
          join public.diagnostic_interventions i on i.id=x.value::uuid
          join public.solution_blueprints b on b.id=i.blueprint_id
        ),'[]'::jsonb)
      ) as result
      from public.proposals p join public.proposal_versions pv on pv.id=p.current_version_id
      where p.id=${proposalId}::uuid limit 1
    `;
    const result = record(rows[0]?.result);
    return { schemaReady: true, requirementsReady: result?.requirements_ready === true, interventions: records(result?.interventions) };
  } catch (error) {
    if (isPartnerCommercialSchemaPending(error)) return { schemaReady: false, requirementsReady: false, interventions: [] };
    throw error;
  }
}

export async function setProposalInterventionRoute(input: { proposalId: string; interventionId: string; route: string; actorLabel: string }) {
  const sql = getSql();
  const rows = await sql`select public.set_proposal_intervention_route(${input.proposalId}::uuid,${input.interventionId}::uuid,${input.route},${input.actorLabel}) as result`;
  return rows[0]?.result as string;
}

export async function recordProposalPartnerCommitment(input: {
  proposalId: string; interventionId: string; partnerId: string; executionRoute: string; blinkoRole: string;
  quoteReference: string; quotedAt: string; quoteValidUntil?: string | null; quotedCostToBlinko?: number | null;
  blinkoPaymentObligation: boolean; paymentTermsSnapshot?: string; financialRuleId?: string | null;
  approvalScope: string; conditionEvidence?: string; notes?: string; actorLabel: string;
}) {
  const sql = getSql();
  const quoteValidUntil = input.quoteValidUntil || null;
  const financialRuleId = input.financialRuleId || null;
  const quotedCost = input.quotedCostToBlinko ?? null;
  const rows = await sql`
    select public.record_proposal_partner_commitment(
      ${input.proposalId}::uuid,${input.interventionId}::uuid,${input.partnerId}::uuid,${input.executionRoute},
      ${input.blinkoRole},${input.quoteReference},${input.quotedAt}::timestamptz,${quoteValidUntil}::timestamptz,
      ${quotedCost}::numeric,${input.blinkoPaymentObligation},${input.paymentTermsSnapshot ?? ""},${financialRuleId}::uuid,
      ${input.approvalScope},${input.conditionEvidence ?? ""},${input.notes ?? ""},${input.actorLabel}
    ) as result
  `;
  return rows[0]?.result as string;
}

export async function approveProposalPartnerCommitment(input: { commitmentId: string; validationEvidence: string; actorLabel: string }) {
  const sql = getSql();
  const rows = await sql`select public.approve_proposal_partner_commitment(${input.commitmentId}::uuid,${input.validationEvidence},${input.actorLabel}) as result`;
  return rows[0]?.result as string;
}

export async function refreshProposalPartnerQuote(input: { commitmentId: string; quoteReference: string; quotedAt: string; quoteValidUntil?: string | null; evidence: string; actorLabel: string }) {
  const sql = getSql();
  const quoteValidUntil = input.quoteValidUntil || null;
  const rows = await sql`select public.refresh_proposal_partner_quote_validity(${input.commitmentId}::uuid,${input.quoteReference},${input.quotedAt}::timestamptz,${quoteValidUntil}::timestamptz,${input.evidence},${input.actorLabel}) as result`;
  return rows[0]?.result as string;
}

export type ProjectPartnerContext = { schemaReady: boolean; assignments: Record<string, unknown>[] };

export async function getProjectPartnerContext(projectId: string): Promise<ProjectPartnerContext> {
  const sql = getSql();
  const canViewFinancial = await financialAllowed();
  try {
    const rows = await sql`
      select coalesce(jsonb_agg(jsonb_build_object(
        'id',pa.id,'status',pa.status,'execution_route',pa.execution_route,'blinko_role',pa.blinko_role,
        'quote_reference',pa.quote_reference,'quoted_at',pa.quoted_at,'quote_valid_until',pa.quote_valid_until,
        'committed_cost_to_blinko',case when ${canViewFinancial} then pa.committed_cost_to_blinko else null end,
        'blinko_payment_obligation',case when ${canViewFinancial} then pa.blinko_payment_obligation else null end,
        'payment_terms_snapshot',case when ${canViewFinancial} then pa.payment_terms_snapshot else null end,
        'partner_id',pt.id,'partner_code',pt.official_code,'partner_name',pt.trade_name,
        'partner_eligibility',public.partner_operational_eligibility(pt.id),'solution_code',ps.solution_code,
        'project_solution_id',ps.id,'financial_rule_id',case when ${canViewFinancial} then pa.financial_rule_id else null end,
        'financial_rule_model',case when ${canViewFinancial} then fr.remuneration_model else null end,
        'financial_rule_status',case when ${canViewFinancial} then fr.formalization_status else null end,
        'financial_rule_auto_calculable',case when ${canViewFinancial} and fr.id is not null then public.partner_financial_rule_auto_calculable(fr.id) else false end,
        'financial_data_visible',${canViewFinancial},
        'cost',case when ${canViewFinancial} and pc.id is not null then jsonb_build_object('id',pc.id,'amount',pc.amount,'status',pc.status,'payment_reference',pc.payment_reference) else null end
      ) order by ps.solution_code,pt.trade_name),'[]'::jsonb) as result
      from public.project_partner_assignments pa
      join public.partners pt on pt.id=pa.partner_id
      join public.project_solutions ps on ps.id=pa.project_solution_id
      left join public.partner_financial_rules fr on fr.id=pa.financial_rule_id
      left join public.project_costs pc on pc.partner_assignment_id=pa.id
      where pa.project_id=${projectId}::uuid
    `;
    return { schemaReady: true, assignments: records(rows[0]?.result) };
  } catch (error) {
    if (isPartnerCommercialSchemaPending(error)) return { schemaReady: false, assignments: [] };
    throw error;
  }
}
