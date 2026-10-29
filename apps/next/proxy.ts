import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, safeNext } from "./lib/session";

export function proxy(request: NextRequest) {
  const loggedIn = request.cookies.get(SESSION_COOKIE)?.value === "1";
  const { pathname, searchParams } = request.nextUrl;

  if (pathname === "/me" && !loggedIn) {
    return NextResponse.redirect(new URL("/login?next=/me", request.url));
  }
  if (pathname === "/login" && loggedIn) {
    return NextResponse.redirect(
      new URL(safeNext(searchParams.get("next")), request.url),
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/me", "/login"],
};
