import { NextResponse } from "next/server";
import { requireInternalSession } from "../../../../../../lib/blinko/internal-auth";
import { isSettingsSchemaPending, setAutomationRuleVersion } from "../../../../../../lib/blinko/settings-server";

const statuses = new Set(["draft","inactive","pilot","active"]);
const modes = new Set(["manual","deterministic","external"]);
type Context = { params: Promise<{ code: string }> };

function field(form: FormData, name: string, max = 5000) {
  return String(form.get(name) ?? "").trim().slice(0, max);
}
function lines(value: string, maxItems = 40) {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, maxItems);
}

export async function POST(request: Request, context: Context) {
  const session = await requireInternalSession("settings.manage");
  const { code: rawCode } = await context.params;
  const ruleCode = rawCode.toUpperCase();
  if (!/^A\d{2}$/.test(ruleCode)) return NextResponse.json({ ok: false }, { status: 404 });

  const form = await request.formData();
  const status = field(form, "status", 30);
  const executionMode = field(form, "execution_mode", 30);
  const runtimeBinding = field(form, "runtime_binding", 500);
  const triggerDescription = field(form, "trigger_description", 3000);
  const conditions = lines(field(form, "conditions", 12000));
  const actions = lines(field(form, "actions", 12000));
  const exceptions = lines(field(form, "exceptions", 12000));
  const ownerLabel = field(form, "owner_label", 240);
  const expectedResult = field(form, "expected_result", 3000);
  const retryPolicy = field(form, "retry_policy", 3000);
  const evidenceReference = field(form, "evidence_reference", 1000);
  const notes = field(form, "notes", 3000);

  if (!statuses.has(status) || !modes.has(executionMode) || !triggerDescription || !actions.length || !ownerLabel || !expectedResult || !retryPolicy || !evidenceReference) {
    return NextResponse.redirect(new URL("/interno/configuracoes?status=automation_invalid", request.url), 303);
  }

  try {
    await setAutomationRuleVersion({
      ruleCode, status, executionMode, runtimeBinding, triggerDescription,
      conditions, actions, exceptions, ownerLabel, expectedResult, retryPolicy,
      evidenceReference, notes, actorLabel: session.user,
    });
    return NextResponse.redirect(new URL("/interno/configuracoes?status=automation_saved", request.url), 303);
  } catch (error) {
    if (!isSettingsSchemaPending(error)) console.error("Blinko OS: falha ao versionar regra de automação", error);
    return NextResponse.redirect(new URL("/interno/configuracoes?status=automation_blocked", request.url), 303);
  }
}
