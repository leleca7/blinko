import { NextResponse } from "next/server";
import { requireInternalSession } from "../../../../../lib/blinko/internal-auth";
import { isIndicatorsSchemaPending, setGlobalIndicatorTarget } from "../../../../../lib/blinko/indicators-server";

const operators = new Set(["gte", "lte", "eq", "between"]);
const codePattern = /^[A-Z0-9_]{3,80}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: Request) {
  const session = await requireInternalSession("indicators.configure");
  const form = await request.formData();
  const indicatorCode = String(form.get("indicator_code") ?? "").trim();
  const operator = String(form.get("target_operator") ?? "").trim();
  const targetRaw = String(form.get("target_value") ?? "").trim();
  const targetMaxRaw = String(form.get("target_value_max") ?? "").trim();
  const validFrom = String(form.get("valid_from") ?? "").trim();
  const validUntil = String(form.get("valid_until") ?? "").trim();
  const evidenceReference = String(form.get("evidence_reference") ?? "").trim().slice(0, 1000);
  const notes = String(form.get("notes") ?? "").trim().slice(0, 4000);
  const confirmed = String(form.get("target_confirmed") ?? "") === "yes";
  const targetValue = Number(targetRaw);
  const targetValueMax = targetMaxRaw ? Number(targetMaxRaw) : null;

  const invalid = !confirmed
    || !codePattern.test(indicatorCode)
    || !operators.has(operator)
    || !targetRaw
    || !Number.isFinite(targetValue)
    || (targetMaxRaw !== "" && !Number.isFinite(targetValueMax))
    || (operator === "between" && (targetValueMax === null || targetValueMax < targetValue))
    || (validFrom !== "" && !datePattern.test(validFrom))
    || (validUntil !== "" && !datePattern.test(validUntil))
    || (validFrom !== "" && validUntil !== "" && validUntil < validFrom)
    || !evidenceReference;

  if (invalid) return NextResponse.redirect(new URL("/interno/indicadores?status=target_invalid", request.url), 303);

  try {
    await setGlobalIndicatorTarget({ indicatorCode, operator, targetValue, targetValueMax, validFrom: validFrom || null, validUntil: validUntil || null, evidenceReference, notes, actorLabel: session.user });
    return NextResponse.redirect(new URL("/interno/indicadores?status=target_saved", request.url), 303);
  } catch (error) {
    if (isIndicatorsSchemaPending(error)) return NextResponse.redirect(new URL("/interno/indicadores?status=indicators_schema_pending", request.url), 303);
    console.error("Blinko OS: falha ao configurar meta de indicador", error);
    return NextResponse.redirect(new URL("/interno/indicadores?status=target_blocked", request.url), 303);
  }
}
