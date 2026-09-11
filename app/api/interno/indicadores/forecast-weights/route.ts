import { NextResponse } from "next/server";
import { requireInternalSession } from "../../../../../lib/blinko/internal-auth";
import { isIndicatorsSchemaPending, setForecastStageWeights } from "../../../../../lib/blinko/indicators-server";

const stages = Array.from({ length: 13 }, (_, index) => `P${String(index + 1).padStart(2, "0")}`);

export async function POST(request: Request) {
  const session = await requireInternalSession("indicators.configure");
  const form = await request.formData();
  const evidenceReference = String(form.get("evidence_reference") ?? "").trim().slice(0, 1000);
  const notes = String(form.get("notes") ?? "").trim().slice(0, 4000);
  const confirmed = String(form.get("weights_confirmed") ?? "") === "yes";
  const weights: Record<string, number> = {};
  let invalid = !confirmed || !evidenceReference;

  for (const stage of stages) {
    const raw = String(form.get(stage) ?? "").trim();
    const percent = Number(raw);
    if (!raw || !Number.isFinite(percent) || percent < 0 || percent > 100) {
      invalid = true;
      continue;
    }
    weights[stage] = percent / 100;
  }

  if (invalid || Object.keys(weights).length !== stages.length) return NextResponse.redirect(new URL("/interno/indicadores?status=weights_invalid", request.url), 303);

  try {
    await setForecastStageWeights({ weights, evidenceReference, notes, actorLabel: session.user });
    return NextResponse.redirect(new URL("/interno/indicadores?status=weights_saved", request.url), 303);
  } catch (error) {
    if (isIndicatorsSchemaPending(error)) return NextResponse.redirect(new URL("/interno/indicadores?status=indicators_schema_pending", request.url), 303);
    console.error("Blinko OS: falha ao configurar pesos do forecast", error);
    return NextResponse.redirect(new URL("/interno/indicadores?status=weights_blocked", request.url), 303);
  }
}
