import { NextResponse } from "next/server";
import { getInternalSession } from "../../../../../../../lib/blinko/internal-auth";
import { getProposalContext } from "../../../../../../../lib/blinko/proposal-server";
import {
  approveProposalPartnerCommitment,
  isPartnerCommercialSchemaPending,
  recordProposalPartnerCommitment,
  refreshProposalPartnerQuote,
  setProposalInterventionRoute,
} from "../../../../../../../lib/blinko/partner-commercial-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const localDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const routePattern = /^R[1-6]$/;
const partnerRoutes = new Set(["R2", "R3", "R5"]);
const scopes = new Set(["standard", "pilot_exception", "restricted_exception"]);

type Context = { params: Promise<{ id: string }> };

function localIso(value: string) {
  return new Date(`${value}:00-03:00`).toISOString();
}

function optionalLocalIso(value: string) {
  return value && localDateTimePattern.test(value) ? localIso(value) : null;
}

function optionalMoney(value: string) {
  const normalized = value.includes(",") ? value.replace(/\./g, "").replace(",", ".") : value;
  if (!normalized.trim()) return null;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

export async function POST(request: Request, context: Context) {
  const session = await getInternalSession();
  if (!session) return NextResponse.redirect(new URL("/interno/login", request.url), 303);

  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false }, { status: 404 });
  const form = await request.formData();
  const action = String(form.get("action") ?? "").trim();
  const proposalId = String(form.get("proposal_id") ?? "").trim();

  try {
    const proposalContext = await getProposalContext(id);
    if (!proposalContext.schemaReady || !uuidPattern.test(proposalId) || proposalContext.proposal?.id !== proposalId) {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=partner_action_blocked`, request.url), 303);
    }

    if (action === "set_route") {
      const interventionId = String(form.get("intervention_id") ?? "").trim();
      const route = String(form.get("execution_route") ?? "").trim();
      const confirmed = String(form.get("route_confirmed") ?? "") === "yes";
      if (!confirmed || !uuidPattern.test(interventionId) || !routePattern.test(route)) {
        return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=partner_action_invalid`, request.url), 303);
      }
      await setProposalInterventionRoute({ proposalId, interventionId, route, actorLabel: session.user });
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=proposal_route_saved`, request.url), 303);
    }

    if (action === "record_commitment") {
      const interventionId = String(form.get("intervention_id") ?? "").trim();
      const partnerId = String(form.get("partner_id") ?? "").trim();
      const executionRoute = String(form.get("execution_route") ?? "").trim();
      const blinkoRole = String(form.get("blinko_role") ?? "").trim().slice(0, 4000);
      const quoteReference = String(form.get("quote_reference") ?? "").trim().slice(0, 1000);
      const quotedAtLocal = String(form.get("quoted_at") ?? "").trim();
      const quoteValidUntilLocal = String(form.get("quote_valid_until") ?? "").trim();
      const blinkoPaymentObligation = String(form.get("blinko_payment_obligation") ?? "") === "yes";
      const quotedCostRaw = String(form.get("quoted_cost_to_blinko") ?? "").trim();
      const quotedCostToBlinko = optionalMoney(quotedCostRaw);
      const paymentTermsSnapshot = String(form.get("payment_terms_snapshot") ?? "").trim().slice(0, 4000);
      const financialRuleIdRaw = String(form.get("financial_rule_id") ?? "").trim();
      const financialRuleId = uuidPattern.test(financialRuleIdRaw) ? financialRuleIdRaw : null;
      const approvalScope = String(form.get("approval_scope") ?? "").trim();
      const conditionEvidence = String(form.get("condition_evidence") ?? "").trim().slice(0, 4000);
      const notes = String(form.get("notes") ?? "").trim().slice(0, 4000);
      const confirmed = String(form.get("commitment_confirmed") ?? "") === "yes";

      if (!confirmed || !uuidPattern.test(interventionId) || !uuidPattern.test(partnerId) || !partnerRoutes.has(executionRoute) || !blinkoRole || !quoteReference || !localDateTimePattern.test(quotedAtLocal) || !scopes.has(approvalScope) || (blinkoPaymentObligation && quotedCostToBlinko === null)) {
        return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=partner_action_invalid`, request.url), 303);
      }

      await recordProposalPartnerCommitment({
        proposalId,
        interventionId,
        partnerId,
        executionRoute,
        blinkoRole,
        quoteReference,
        quotedAt: localIso(quotedAtLocal),
        quoteValidUntil: optionalLocalIso(quoteValidUntilLocal),
        quotedCostToBlinko,
        blinkoPaymentObligation,
        paymentTermsSnapshot,
        financialRuleId,
        approvalScope,
        conditionEvidence,
        notes,
        actorLabel: session.user,
      });
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=partner_commitment_saved`, request.url), 303);
    }

    if (action === "approve_commitment") {
      const commitmentId = String(form.get("commitment_id") ?? "").trim();
      const validationEvidence = String(form.get("validation_evidence") ?? "").trim().slice(0, 5000);
      const confirmed = String(form.get("partner_approval_confirmed") ?? "") === "yes";
      if (!confirmed || !uuidPattern.test(commitmentId) || !validationEvidence) {
        return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=partner_action_invalid`, request.url), 303);
      }
      await approveProposalPartnerCommitment({ commitmentId, validationEvidence, actorLabel: session.user });
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=partner_commitment_approved`, request.url), 303);
    }

    if (action === "refresh_quote") {
      const commitmentId = String(form.get("commitment_id") ?? "").trim();
      const quoteReference = String(form.get("quote_reference") ?? "").trim().slice(0, 1000);
      const quotedAtLocal = String(form.get("quoted_at") ?? "").trim();
      const quoteValidUntilLocal = String(form.get("quote_valid_until") ?? "").trim();
      const evidence = String(form.get("revalidation_evidence") ?? "").trim().slice(0, 5000);
      const confirmed = String(form.get("quote_revalidation_confirmed") ?? "") === "yes";
      if (!confirmed || !uuidPattern.test(commitmentId) || !quoteReference || !localDateTimePattern.test(quotedAtLocal) || !evidence) {
        return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=partner_action_invalid`, request.url), 303);
      }
      await refreshProposalPartnerQuote({
        commitmentId,
        quoteReference,
        quotedAt: localIso(quotedAtLocal),
        quoteValidUntil: optionalLocalIso(quoteValidUntilLocal),
        evidence,
        actorLabel: session.user,
      });
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=partner_quote_revalidated`, request.url), 303);
    }

    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=partner_action_invalid`, request.url), 303);
  } catch (error) {
    if (isPartnerCommercialSchemaPending(error)) {
      return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=partner_schema_pending`, request.url), 303);
    }
    console.error("Blinko OS: falha na governança de parceiro da proposta", error);
    return NextResponse.redirect(new URL(`/interno/diagnosticos/${id}?status=partner_action_blocked`, request.url), 303);
  }
}
