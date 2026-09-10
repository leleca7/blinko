import { NextResponse } from "next/server";
import { requireInternalSession } from "../../../../../lib/blinko/internal-auth";
import { isSettingsSchemaPending, setOsParameterVersion } from "../../../../../lib/blinko/settings-server";

const domains = new Set(["commercial","diagnostic","operation","financial","partners","communications","files","system"]);
const valueKinds = new Set(["boolean","number","string","object","array"]);
const sensitivities = new Set(["normal","sensitive","critical"]);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function field(form: FormData, name: string, max = 3000) {
  return String(form.get(name) ?? "").trim().slice(0, max);
}

export async function POST(request: Request) {
  const session = await requireInternalSession("settings.manage");
  const form = await request.formData();
  const parameterKey = field(form, "parameter_key", 120).toLowerCase();
  const domain = field(form, "domain", 40);
  const name = field(form, "name", 240);
  const description = field(form, "description", 2000);
  const valueKind = field(form, "value_kind", 30);
  const sensitivity = field(form, "sensitivity", 30) || "normal";
  const rawValue = field(form, "value_json", 12000);
  const validFromRaw = field(form, "valid_from", 20);
  const validUntilRaw = field(form, "valid_until", 20);
  const evidenceReference = field(form, "evidence_reference", 1000);
  const sourceDocument = field(form, "source_document", 500);
  const sourceVersion = field(form, "source_version", 200);
  const notes = field(form, "notes", 3000);

  if (!/^[a-z][a-z0-9_.-]{2,119}$/.test(parameterKey) || !domains.has(domain) || !name || !description || !valueKinds.has(valueKind) || !sensitivities.has(sensitivity) || !rawValue || !evidenceReference) {
    return NextResponse.redirect(new URL("/interno/configuracoes?status=parameter_invalid", request.url), 303);
  }
  if ((validFromRaw && !datePattern.test(validFromRaw)) || (validUntilRaw && !datePattern.test(validUntilRaw))) {
    return NextResponse.redirect(new URL("/interno/configuracoes?status=parameter_invalid", request.url), 303);
  }

  let value: unknown;
  try {
    value = JSON.parse(rawValue);
  } catch {
    return NextResponse.redirect(new URL("/interno/configuracoes?status=parameter_invalid_json", request.url), 303);
  }

  try {
    await setOsParameterVersion({
      parameterKey, domain, name, description, valueKind, sensitivity, value,
      validFrom: validFromRaw || null, validUntil: validUntilRaw || null,
      evidenceReference, sourceDocument, sourceVersion, notes, actorLabel: session.user,
    });
    return NextResponse.redirect(new URL("/interno/configuracoes?status=parameter_saved", request.url), 303);
  } catch (error) {
    if (!isSettingsSchemaPending(error)) console.error("Blinko OS: falha ao criar versão de parâmetro", error);
    return NextResponse.redirect(new URL("/interno/configuracoes?status=parameter_blocked", request.url), 303);
  }
}
