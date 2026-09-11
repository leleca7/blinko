import { NextResponse } from "next/server";
import { requireInternalSession } from "../../../../../../lib/blinko/internal-auth";
import { isSettingsSchemaPending, setDocumentTemplateVersion } from "../../../../../../lib/blinko/settings-server";

const statuses = new Set(["draft","active","inactive"]);
const audiences = new Set(["internal","client","team","client_team"]);
const localDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
type Context = { params: Promise<{ code: string }> };

function field(form: FormData, name: string, max = 5000) {
  return String(form.get(name) ?? "").trim().slice(0, max);
}
function lines(value: string, maxItems = 80) {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, maxItems);
}

export async function POST(request: Request, context: Context) {
  const session = await requireInternalSession("settings.manage");
  const { code: rawCode } = await context.params;
  const templateCode = rawCode.toUpperCase();
  if (!/^TPL_[A-Z0-9_]{3,60}$/.test(templateCode)) return NextResponse.json({ ok: false }, { status: 404 });

  const form = await request.formData();
  const status = field(form, "status", 30);
  const audience = field(form, "audience", 30);
  const contentReference = field(form, "content_reference", 1500);
  const reusableFields = lines(field(form, "reusable_fields", 12000));
  const dataSources = lines(field(form, "data_sources", 12000));
  const ownerLabel = field(form, "owner_label", 240);
  const reviewedAtLocal = field(form, "reviewed_at", 30);
  const evidenceReference = field(form, "evidence_reference", 1000);
  const notes = field(form, "notes", 3000);

  if (!statuses.has(status) || !audiences.has(audience) || (status === "active" && !contentReference) || !ownerLabel || !localDateTimePattern.test(reviewedAtLocal) || !evidenceReference) {
    return NextResponse.redirect(new URL("/interno/configuracoes?status=template_invalid", request.url), 303);
  }

  try {
    await setDocumentTemplateVersion({
      templateCode, status, audience, contentReference, reusableFields, dataSources, ownerLabel,
      reviewedAt: new Date(`${reviewedAtLocal}:00-03:00`).toISOString(), evidenceReference, notes, actorLabel: session.user,
    });
    return NextResponse.redirect(new URL("/interno/configuracoes?status=template_saved", request.url), 303);
  } catch (error) {
    if (!isSettingsSchemaPending(error)) console.error("Blinko OS: falha ao versionar template", error);
    return NextResponse.redirect(new URL("/interno/configuracoes?status=template_blocked", request.url), 303);
  }
}
