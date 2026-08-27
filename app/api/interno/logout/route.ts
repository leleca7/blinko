import { NextResponse } from "next/server";
import { BLINKO_INTERNAL_COOKIE } from "../../../../lib/blinko/internal-auth";

export async function POST(request: Request) {
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
