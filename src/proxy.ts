import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "boostera_super_secret_jwt_key_2026_production_grade_crm_saas"
);
const COOKIE_NAME = "boostera_session";

// Public route prefixes that do not require an active user session
const PUBLIC_PREFIXES = [
  "/login",
  "/api/cron",
  "/_next",
  "/favicon.ico",
  "/robots.txt",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip public prefixes and static files (with extensions like .png, .jpg, .svg, .css, .js)
  const isPublicRoute = PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isStaticFile = /\.[a-zA-Z0-9]+$/.test(pathname);

  if (isPublicRoute || isStaticFile) {
    // If the user is already authenticated and tries to access /login, redirect them to /dashboard
    if (pathname === "/login") {
      const token = request.cookies.get(COOKIE_NAME)?.value;
      if (token) {
        try {
          await jwtVerify(token, JWT_SECRET);
          return NextResponse.redirect(new URL("/dashboard", request.url));
        } catch {
          // Token invalid or expired, continue to login page
        }
      }
    }
    return NextResponse.next();
  }

  // 2. Private route: Verify JWT session cookie
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/" && pathname !== "/dashboard") {
      loginUrl.searchParams.set("from", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  try {
    await jwtVerify(token, JWT_SECRET);
    return NextResponse.next();
  } catch {
    // Expired or forged token: clear cookie and redirect to login
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete(COOKIE_NAME);
    return response;
  }
}

export default proxy;

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - static assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
