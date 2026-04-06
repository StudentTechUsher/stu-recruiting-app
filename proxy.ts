import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolvePostAuthRedirect } from "@/lib/auth/callback-routing";
import { getProfileByUserId } from "@/lib/auth/profile";
import { resolvePersonaFromProfileOrUser } from "@/lib/auth/role";
import {
  defaultStudentViewReleaseFlags,
  getFirstReleasedStudentRoute,
  isStudentPathReleased,
} from "@/lib/feature-flags";
import { getHomeRouteForPersona, getOnboardingRouteForPersona } from "@/lib/session-routing";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { clearSupabaseAuthCookies, isRefreshTokenNotFoundError } from "@/lib/supabase/auth-session";
import { devIdentityCookieName, resolveDevPersonaFromCookieValue } from "@/lib/dev-auth";

type SupabaseCookie = { name: string; value: string; options?: Record<string, unknown> };

const isEnabled = () => {
  const raw = process.env.ENABLE_SESSION_CHECK ?? process.env.NEXT_PUBLIC_ENABLE_SESSION_CHECK ?? "true";
  return raw.toLowerCase() !== "false";
};

const isPublicPath = (pathname: string) => {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth/callback") ||
    pathname === "/profile" ||
    pathname.startsWith("/profile/") ||
    pathname === "/u" ||
    pathname.startsWith("/u/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/images") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/dev")
  );
};

const isAuthRequiredApiPath = (pathname: string) =>
  pathname.startsWith("/api/student") ||
  pathname.startsWith("/api/recruiter") ||
  pathname.startsWith("/api/admin") ||
  pathname.startsWith("/api/referrer");

const isSpecialInternalApiPath = (pathname: string) => pathname.startsWith("/api/onboarding/");

export async function proxy(request: NextRequest) {
  if (!isEnabled()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const devPersona = resolveDevPersonaFromCookieValue(request.cookies.get(devIdentityCookieName)?.value);
  if (devPersona) {
    const homeRoute = getHomeRouteForPersona(devPersona);

    if (pathname === "/" || pathname === "/login") {
      const url = request.nextUrl.clone();
      url.pathname = homeRoute;
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/admin") && devPersona !== "org_admin") {
      const url = request.nextUrl.clone();
      url.pathname = homeRoute;
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/recruiter") && devPersona !== "recruiter" && devPersona !== "org_admin") {
      const url = request.nextUrl.clone();
      url.pathname = homeRoute;
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/referrer") && devPersona !== "referrer") {
      const url = request.nextUrl.clone();
      url.pathname = homeRoute;
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/student") && devPersona !== "student") {
      const url = request.nextUrl.clone();
      url.pathname = homeRoute;
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  const config = getSupabaseConfig();
  if (!config) {
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next({ request });

  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: SupabaseCookie[]) {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options as never));
      }
    }
  });

  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] = null;
  let error: unknown = null;

  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
    error = result.error;
  } catch (thrownError) {
    error = thrownError;
  }

  const hasStaleRefreshToken = isRefreshTokenNotFoundError(error);
  const toLoginRedirect = () => {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const redirectResponse = NextResponse.redirect(url);
    if (hasStaleRefreshToken) {
      clearSupabaseAuthCookies(request.cookies.getAll(), redirectResponse);
    }
    return redirectResponse;
  };

  const isApiPath = pathname.startsWith("/api/");
  const useApiAuthOnlyPath = isApiPath && (isAuthRequiredApiPath(pathname) || isSpecialInternalApiPath(pathname));

  if (useApiAuthOnlyPath) {
    if (error || !user) return toLoginRedirect();
    return response;
  }

  const profile = user ? await getProfileByUserId(supabase, user.id) : null;
  const persona = user ? resolvePersonaFromProfileOrUser(profile?.role, user) : null;
  const postAuthRoute = persona
    ? resolvePostAuthRedirect({
        persona,
        onboardingCompletedAt: profile?.onboarding_completed_at ?? null,
        studentViewReleaseFlags: defaultStudentViewReleaseFlags
      })
    : null;
  const onboardingRoute = persona ? getOnboardingRouteForPersona(persona) : null;
  const isOnboardingRoute = onboardingRoute ? pathname === onboardingRoute || pathname.startsWith(`${onboardingRoute}/`) : false;
  const isOnboarded = Boolean(profile?.onboarding_completed_at);

  if (pathname === "/") {
    if (!error && user && persona && postAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = postAuthRoute;
      return NextResponse.redirect(url);
    }
    return toLoginRedirect();
  }

  if (pathname === "/login") {
    if (!error && user && persona && postAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = postAuthRoute;
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (error || !user || !persona) {
    return toLoginRedirect();
  }

  if (!isOnboarded && onboardingRoute && !isOnboardingRoute && !isApiPath) {
    const url = request.nextUrl.clone();
    url.pathname = onboardingRoute;
    return NextResponse.redirect(url);
  }

  if (isOnboarded && isOnboardingRoute) {
    const url = request.nextUrl.clone();
    url.pathname = getHomeRouteForPersona(persona);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin") && persona !== "org_admin") {
    const url = request.nextUrl.clone();
    url.pathname = getHomeRouteForPersona(persona);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/recruiter") && persona !== "recruiter" && persona !== "org_admin") {
    const url = request.nextUrl.clone();
    url.pathname = getHomeRouteForPersona(persona);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/referrer") && persona !== "referrer") {
    const url = request.nextUrl.clone();
    url.pathname = getHomeRouteForPersona(persona);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/student") && persona !== "student") {
    const url = request.nextUrl.clone();
    url.pathname = getHomeRouteForPersona(persona);
    return NextResponse.redirect(url);
  }

  if (
    persona === "student" &&
    pathname.startsWith("/student") &&
    !pathname.startsWith("/student/onboarding") &&
    !isApiPath &&
    !isStudentPathReleased(pathname, defaultStudentViewReleaseFlags)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = getFirstReleasedStudentRoute(defaultStudentViewReleaseFlags);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
