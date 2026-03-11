import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolvePostAuthRedirect } from "@/lib/auth/callback-routing";
import { getProfileByUserId } from "@/lib/auth/profile";
import { resolvePersonaFromProfileOrUser } from "@/lib/auth/role";
import { defaultStudentViewReleaseFlags } from "@/lib/feature-flags";
import { getHomeRouteForPersona, getOnboardingRouteForPersona } from "@/lib/session-routing";
import { getSupabaseConfig } from "@/lib/supabase/config";

type SupabaseCookie = { name: string; value: string; options?: Record<string, unknown> };

const isEnabled = () => {
  const raw = process.env.ENABLE_SESSION_CHECK ?? process.env.NEXT_PUBLIC_ENABLE_SESSION_CHECK ?? "true";
  return raw.toLowerCase() !== "false";
};

const isPublicPath = (pathname: string) => {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/images") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/api/auth")
  );
};

export async function proxy(request: NextRequest) {
  if (!isEnabled()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) {
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

  const { data, error } = await supabase.auth.getUser();
  const user = data.user;
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
  const isApiPath = pathname.startsWith("/api/");

  if (pathname === "/") {
    if (!error && user && persona && postAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = postAuthRoute;
      return NextResponse.redirect(url);
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
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
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
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

  if (pathname.startsWith("/recruiter") && persona === "student") {
    const url = request.nextUrl.clone();
    url.pathname = getHomeRouteForPersona(persona);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/student") && persona !== "student") {
    const url = request.nextUrl.clone();
    url.pathname = getHomeRouteForPersona(persona);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
