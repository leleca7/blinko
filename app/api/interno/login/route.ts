import { NextResponse } from "next/server";
import {
  BLINKO_INTERNAL_COOKIE,
  createInternalSessionToken,
  isInternalAccessConfigured,
  verifyInternalCredentials,
} from "../../../../lib/blinko/internal-auth";

function safeNext(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return "/interno";
  return value.startsWith("/interno") && !value.startsWith("//") ? value : "/interno";
}

export async function POST(request: Request) {
  const form = await request.formData();
  const user = typeof form.get("user") === "string" ? String(form.get("user")) : "";
  const password = typeof form.get("password") === "string" ? String(form.get("password")) : "";
  const next = safeNext(form.get("next"));

  if (!isInternalAccessConfigured()) {
    return NextResponse.redirect(new URL("/interno/login?status=setup", request.url), 303);
  }

  if (!verifyInternalCredentials(user, password)) {
    return NextResponse.redirect(new URL(`/interno/login?status=invalid&next=${encodeURIComponent(next)}`, request.url), 303);
  }

  const response = NextResponse.redirect(new URL(next, request.url), 303);
  response.cookies.set(BLINKO_INTERNAL_COOKIE, createInternalSessionToken(user.trim()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return response;
}
