import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  clearSessionCookies,
  hasSessionCookie,
} from "@/lib/auth/session-cookies";

const protectedPrefixes = ["/dashboard", "/agents", "/billing", "/profile"];

function isProtectedPath(pathname: string): boolean {
  return protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function createSignInUrl(request: NextRequest): URL {
  const signInUrl = new URL("/sign-in", request.url);
  signInUrl.searchParams.set(
    "callbackUrl",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  return signInUrl;
}

export async function proxy(request: NextRequest) {
  const session = await auth();
  const pathname = request.nextUrl.pathname;
  const staleSessionCookie = !session?.user && hasSessionCookie(request);

  if (staleSessionCookie) {
    const response = isProtectedPath(pathname)
      ? NextResponse.redirect(createSignInUrl(request))
      : NextResponse.redirect(request.url);

    clearSessionCookies(request, response);
    return response;
  }

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  if (!session?.user) {
    return NextResponse.redirect(createSignInUrl(request));
  }

  return NextResponse.next();
}

export const proxyConfig = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
