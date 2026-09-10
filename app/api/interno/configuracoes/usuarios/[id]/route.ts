import { NextResponse } from "next/server";
import { requireInternalSession } from "../../../../../../lib/blinko/internal-auth";
import { isInternalUsersSchemaPending, resetInternalUserPassword, setInternalUserRole, setInternalUserStatus } from "../../../../../../lib/blinko/internal-users-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const roles = new Set(["admin","strategy_consulting","operations","financial"]);
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const session = await requireInternalSession("settings.users.manage");
  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ ok: false }, { status: 404 });
  const form = await request.formData();
  const action = String(form.get("action") ?? "").trim();

  try {
    if (action === "status") {
      const status = String(form.get("status") ?? "").trim();
      if (status !== "active" && status !== "disabled") return NextResponse.redirect(new URL("/interno/configuracoes/usuarios?status=invalid", request.url), 303);
      await setInternalUserStatus({ userId: id, status, session });
      return NextResponse.redirect(new URL("/interno/configuracoes/usuarios?status=updated", request.url), 303);
    }

    if (action === "role") {
      const roleCode = String(form.get("role_code") ?? "").trim();
      if (!roles.has(roleCode)) return NextResponse.redirect(new URL("/interno/configuracoes/usuarios?status=invalid", request.url), 303);
      await setInternalUserRole({ userId: id, roleCode, session });
      return NextResponse.redirect(new URL("/interno/configuracoes/usuarios?status=updated", request.url), 303);
    }

    if (action === "password") {
      const password = String(form.get("password") ?? "");
      const confirmed = String(form.get("confirmed") ?? "") === "yes";
      if (!confirmed || password.length < 12) return NextResponse.redirect(new URL("/interno/configuracoes/usuarios?status=invalid", request.url), 303);
      await resetInternalUserPassword({ userId: id, password, session });
      return NextResponse.redirect(new URL("/interno/configuracoes/usuarios?status=password_reset", request.url), 303);
    }

    return NextResponse.redirect(new URL("/interno/configuracoes/usuarios?status=invalid", request.url), 303);
  } catch (error) {
    if (!isInternalUsersSchemaPending(error)) console.error("Blinko OS: falha ao administrar usuário interno", error);
    return NextResponse.redirect(new URL("/interno/configuracoes/usuarios?status=blocked", request.url), 303);
  }
}
