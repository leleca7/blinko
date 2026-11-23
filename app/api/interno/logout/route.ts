import { NextResponse } from "next/server";
import { BLINKO_INTERNAL_COOKIE } from "../../../../lib/blinko/internal-auth";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json({ ok: false, error: "origin_not_allowed" }, { status: 403 });
  }
  const length = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(length) && length > 4096) {
    return NextResponse.json({ ok: false, error: "request_too_large" }, { status: 413 });
  }
  const response = NextResponse.redirect(new URL("/interno/login", request.url), 303);
  response.cookies.set(BLINKO_INTERNAL_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
