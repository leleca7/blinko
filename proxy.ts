import { NextRequest, NextResponse } from "next/server";

/**
 * Prévia pública apenas para apresentação institucional.
 * Não permite APIs, formulários de coleta ou acesso administrativo.
 * Branch isolada; não mesclar na produção sem revisão.
 */
export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (
    /^\/(api|interno|internal)(\/|$)/.test(pathname) ||
    pathname === "/diagnostico/completo" ||
    pathname.startsWith("/diagnostico/completo/")
  ) {
    return new NextResponse("Indisponível nesta demonstração.", {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }
  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/).*)"],
};
