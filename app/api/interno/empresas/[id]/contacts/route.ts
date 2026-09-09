import { NextResponse } from "next/server";
import { getInternalSession } from "../../../../../../lib/blinko/internal-auth";
import { isCompany360SchemaPending, saveCompanyContact } from "../../../../../../lib/blinko/company-360-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const session = await getInternalSession();
  if (!session) return NextResponse.redirect(new URL("/interno/login", request.url), 303);

  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false }, { status: 404 });

  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim().slice(0, 240);
  const email = String(form.get("email") ?? "").trim().slice(0, 320);
  const whatsapp = String(form.get("whatsapp") ?? "").trim().slice(0, 120);
  const roleTitle = String(form.get("role_title") ?? "").trim().slice(0, 240);
  const preferredChannel = String(form.get("preferred_channel") ?? "").trim();
  const notes = String(form.get("notes") ?? "").trim().slice(0, 3000);
  const isPrimary = String(form.get("is_primary") ?? "") === "yes";

  if (!name || (!email && !whatsapp) || (preferredChannel && !["whatsapp", "email", "phone", "meeting", "other"].includes(preferredChannel))) {
    return NextResponse.redirect(new URL(`/interno/empresas/${id}?status=contact_invalid`, request.url), 303);
  }

  try {
    await saveCompanyContact({
      companyId: id,
      name,
      email,
      whatsapp,
      roleTitle,
      preferredChannel,
      notes,
      isPrimary,
      actorLabel: session.user,
    });
    return NextResponse.redirect(new URL(`/interno/empresas/${id}?status=contact_saved`, request.url), 303);
  } catch (error) {
    if (!isCompany360SchemaPending(error)) console.error("Blinko OS: falha ao salvar contato da empresa", error);
    return NextResponse.redirect(new URL(`/interno/empresas/${id}?status=contact_failed`, request.url), 303);
  }
}
