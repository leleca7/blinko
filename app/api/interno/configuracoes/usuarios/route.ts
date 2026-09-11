import { NextResponse } from "next/server";
import { BLINKO_INTERNAL_COOKIE, requireInternalSession } from "../../../../../lib/blinko/internal-auth";
import { createInternalUserAccount, isInternalUsersSchemaPending } from "../../../../../lib/blinko/internal-users-server";

const roles = new Set(["admin","strategy_consulting","operations","financial"]);

export async function POST(request: Request) {
  const session = await requireInternalSession("settings.users.manage");
  const form = await request.formData();
  const action = String(form.get("action") ?? "");
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const displayName = String(form.get("display_name") ?? "").trim().slice(0, 160);
  const email = String(form.get("email") ?? "").trim().toLowerCase().slice(0, 320);
  const roleCode = String(form.get("role_code") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const confirmed = String(form.get("confirmed") ?? "") === "yes";

  if (action !== "create" || !confirmed || !/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username) || !displayName || !roles.has(roleCode) || password.length < 12) {
    return NextResponse.redirect(new URL("/interno/configuracoes/usuarios?status=invalid", request.url), 303);
  }

  try {
    await createInternalUserAccount({ username, displayName, email, roleCode, password, session });
    const firstIndividualUser = session.mode === "legacy";
    const response = NextResponse.redirect(new URL(firstIndividualUser ? "/interno/login?status=individual_ready" : "/interno/configuracoes/usuarios?status=created", request.url), 303);
    if (firstIndividualUser) {
      response.cookies.set(BLINKO_INTERNAL_COOKIE, "", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 0,
      });
    }
    return response;
  } catch (error) {
    if (isInternalUsersSchemaPending(error)) return NextResponse.redirect(new URL("/interno/configuracoes/usuarios?status=blocked", request.url), 303);
    console.error("Blinko OS: falha ao criar usuário interno", error);
    return NextResponse.redirect(new URL("/interno/configuracoes/usuarios?status=blocked", request.url), 303);
  }
}
