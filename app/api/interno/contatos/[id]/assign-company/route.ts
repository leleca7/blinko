import { NextResponse } from "next/server";
import { getInternalSession, hasInternalPermission } from "../../../../../../lib/blinko/internal-auth";
import { assignContactToCompany, isCompany360SchemaPending } from "../../../../../../lib/blinko/company-360-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const session = await getInternalSession();
  if (!session) return NextResponse.redirect(new URL("/interno/login", request.url), 303);
  if (!hasInternalPermission(session, "contacts.manage")) return NextResponse.redirect(new URL("/interno?status=forbidden", request.url), 303);

  const { id } = await context.params;
  const form = await request.formData();
  const companyId = String(form.get("company_id") ?? "").trim();
  const isPrimary = String(form.get("is_primary") ?? "") === "yes";

  if (!uuidPattern.test(id) || !uuidPattern.test(companyId)) {
    return NextResponse.redirect(new URL("/interno/contatos?status=contact_assignment_invalid", request.url), 303);
  }

  try {
    await assignContactToCompany({ contactId: id, companyId, isPrimary, actorLabel: session.user });
    return NextResponse.redirect(new URL("/interno/contatos?status=contact_assigned", request.url), 303);
  } catch (error) {
    if (isCompany360SchemaPending(error)) {
      return NextResponse.redirect(new URL("/interno/contatos?status=contact_assignment_failed", request.url), 303);
    }
    console.error("Blinko OS: falha ao vincular contato à empresa", error);
    return NextResponse.redirect(new URL("/interno/contatos?status=contact_assignment_failed", request.url), 303);
  }
}
