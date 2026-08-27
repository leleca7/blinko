import { NextResponse } from "next/server";
import { isSupabaseConfigured, supabaseRpc } from "../../../lib/blinko/supabase-server";

type FormBody = {
  name?: unknown;
  email?: unknown;
  whatsapp?: unknown;
  companyName?: unknown;
  companyRole?: unknown;
  cityState?: unknown;
  segment?: unknown;
  website?: unknown;
  socialUrl?: unknown;
  objective?: unknown;
  urgency?: unknown;
  perceivedBlocker?: unknown;
  perceivedAreas?: unknown;
  pillarAnswers?: unknown;
  operationalSignals?: unknown;
  teamSize?: unknown;
  companyMoment?: unknown;
  opennessToChange?: unknown;
  investmentIntent?: unknown;
  additionalContext?: unknown;
  consent?: unknown;
  companyFax?: unknown;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function stringArray(value: unknown, maxItems = 20, maxLength = 80) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function object(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function calculateScore(input: {
  objective: string;
  blocker: string;
  urgency: string;
  areas: string[];
  signals: string[];
  openness: string;
  investment: string;
}) {
  const relevance =
    input.blocker.length >= 40 || input.signals.length >= 3 || input.areas.length >= 3
      ? 2
      : input.blocker.length >= 12 || input.signals.length >= 1 || input.areas.length >= 1
        ? 1
        : 0;

  const urgency = input.urgency === "critical" || input.urgency === "up_to_3_months" ? 2
    : input.urgency === "3_to_6_months" ? 1
      : 0;

  const openness = input.openness === "yes" ? 2 : input.openness === "maybe" ? 1 : 0;

  const investment = input.investment === "yes" ? 2
    : input.investment === "need_value" ? 1
      : 0;

  const information = input.objective.length >= 30 && input.blocker.length >= 30 ? 2
    : input.objective.length >= 12 && input.blocker.length >= 12 ? 1
      : 0;

  return {
    total: relevance + urgency + openness + investment + information,
    breakdown: { relevance, urgency, openness, investment, information },
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as FormBody;

    // Honeypot: humanos não veem nem preenchem este campo.
    if (text(body.companyFax, 120)) {
      return NextResponse.json({ ok: true });
    }

    const name = text(body.name, 120);
    const email = text(body.email, 180).toLowerCase();
    const whatsapp = text(body.whatsapp, 40);
    const companyName = text(body.companyName, 160);
    const companyRole = text(body.companyRole, 120);
    const cityState = text(body.cityState, 120);
    const segment = text(body.segment, 120);
    const website = text(body.website, 240);
    const socialUrl = text(body.socialUrl, 240);
    const objective = text(body.objective, 1200);
    const urgency = text(body.urgency, 40);
    const perceivedBlocker = text(body.perceivedBlocker, 1600);
    const perceivedAreas = stringArray(body.perceivedAreas, 8, 40);
    const operationalSignals = stringArray(body.operationalSignals, 20, 100);
    const pillarAnswers = object(body.pillarAnswers);
    const teamSize = text(body.teamSize, 60);
    const companyMoment = text(body.companyMoment, 80);
    const opennessToChange = text(body.opennessToChange, 40);
    const investmentIntent = text(body.investmentIntent, 40);
    const additionalContext = text(body.additionalContext, 1800);
    const consent = body.consent === true;

    const missing = [
      ["name", name],
      ["email", email],
      ["whatsapp", whatsapp],
      ["companyName", companyName],
      ["companyRole", companyRole],
      ["cityState", cityState],
      ["segment", segment],
      ["objective", objective],
      ["urgency", urgency],
      ["perceivedBlocker", perceivedBlocker],
      ["teamSize", teamSize],
      ["companyMoment", companyMoment],
      ["opennessToChange", opennessToChange],
      ["investmentIntent", investmentIntent],
    ].filter(([, value]) => !value).map(([field]) => field);

    if (missing.length > 0 || !consent || !emailPattern.test(email)) {
      return NextResponse.json(
        { ok: false, error: "invalid_submission", fields: missing },
        { status: 400 },
      );
    }

    const score = calculateScore({
      objective,
      blocker: perceivedBlocker,
      urgency,
      areas: perceivedAreas,
      signals: operationalSignals,
      openness: opennessToChange,
      investment: investmentIntent,
    });

    if (!isSupabaseConfigured()) {
      console.error("Blinko pre-diagnostic: Supabase environment is not configured.");
      return NextResponse.json({ ok: false, error: "service_not_configured" }, { status: 503 });
    }

    const payload = {
      name,
      email,
      whatsapp,
      company_name: companyName,
      company_role: companyRole,
      city_state: cityState,
      segment,
      website,
      social_url: socialUrl,
      objective,
      urgency,
      perceived_blocker: perceivedBlocker,
      perceived_areas: perceivedAreas,
      pillar_answers: pillarAnswers,
      operational_signals: operationalSignals,
      team_size: teamSize,
      company_moment: companyMoment,
      openness_to_change: opennessToChange,
      investment_intent: investmentIntent,
      additional_context: additionalContext,
      commercial_score: score.total,
      score_breakdown: score.breakdown,
      source: "site_pre_diagnostic",
    };

    await supabaseRpc("create_pre_diagnostic_submission", { payload });

    // Não devolvemos score comercial nem IDs internos ao visitante.
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";

    if (message === "supabase_not_configured") {
      console.error("Blinko pre-diagnostic: Supabase environment is not configured.");
      return NextResponse.json({ ok: false, error: "service_not_configured" }, { status: 503 });
    }

    if (message.startsWith("supabase_rpc_failed:")) {
      console.error("Blinko pre-diagnostic: Supabase RPC failed", message.slice(0, 1200));
      return NextResponse.json({ ok: false, error: "submission_failed" }, { status: 502 });
    }

    console.error("Blinko pre-diagnostic: unexpected error", error);
    return NextResponse.json({ ok: false, error: "unexpected_error" }, { status: 500 });
  }
}
