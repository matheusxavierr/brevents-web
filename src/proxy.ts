import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (request.cookies.get("brevents_access")?.value) {
    const headers = new Headers(request.headers);
    headers.set("x-brevents-return-path", pathname + search);
    return NextResponse.next({ request: { headers } });
  }

  const login = new URL("/entrar", request.url);
  login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/eventos/:slug/:path*", "/meetings/:slug/:path*"],
};
