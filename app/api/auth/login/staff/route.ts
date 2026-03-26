import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { getProfileByUserId } from "@/lib/auth/profile";
import { resolvePersonaFromProfileOrUser } from "@/lib/auth/role";
import { getHomeRouteForPersona } from "@/lib/session-routing";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { buildCookieAccumulator, parseRequestCookies } from "@/lib/supabase/cookie-adapter";
import { isRefreshTokenNotFoundError } from "@/lib/supabase/auth-session";
import {
  attachRequestIdHeader,
  createApiObsContext,
  logApiRequestResult,
  logApiRequestStart,
  logApiUnexpectedError
} from "@/lib/observability/api";

type SupabaseCookie = { name: string; value: string; options?: Record<string, unknown> };

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

const safeSignOut = async (supabase: { auth: { signOut: () => Promise<{ error: unknown }> } }) => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error && !isRefreshTokenNotFoundError(error)) {
      throw error;
    }
  } catch (error) {
    if (!isRefreshTokenNotFoundError(error)) {
      throw error;
    }
  }
};

export async function POST(req: Request) {
  const obs = createApiObsContext({
    request: req,
    routeTemplate: "/api/auth/login/staff",
    component: "auth",
    operation: "staff_password_login"
  });
  logApiRequestStart(obs);

  const finalize = ({
    response,
    outcome,
    errorCode,
    details
  }: {
    response: NextResponse;
    outcome: "success" | "failure";
    errorCode?: string;
    details?: Record<string, unknown>;
  }) => {
    attachRequestIdHeader(response, obs.requestId);
    logApiRequestResult({
      context: obs,
      statusCode: response.status,
      eventName: `stu.auth.staff_login.${outcome}`,
      outcome,
      errorCode,
      persona: "org_admin",
      details
    });
    return response;
  };

  try {
    const body = await req.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return finalize({
        response: NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 400 }),
        outcome: "failure",
        errorCode: "invalid_credentials"
      });
    }

    const config = getSupabaseConfig();
    if (!config) {
      return finalize({
        response: NextResponse.json({ ok: false, error: "supabase_not_configured" }, { status: 500 }),
        outcome: "failure",
        errorCode: "supabase_not_configured"
      });
    }

    const cookieAccumulator = buildCookieAccumulator();

    const supabase = createServerClient(config.url, config.anonKey, {
      cookies: {
        getAll() {
          return parseRequestCookies(req.headers.get("cookie"));
        },
        setAll(cookiesToSet: SupabaseCookie[]) {
          cookieAccumulator.push(cookiesToSet);
        }
      }
    });

    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password
    });

    if (error || !data.user) {
      return finalize({
        response: NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 }),
        outcome: "failure",
        errorCode: "invalid_credentials"
      });
    }

    const profile = await getProfileByUserId(supabase, data.user.id);
    const persona = resolvePersonaFromProfileOrUser(profile?.role, data.user);
    if (!persona) {
      await safeSignOut(supabase);
      return finalize({
        response: NextResponse.json({ ok: false, error: "role_unassigned" }, { status: 403 }),
        outcome: "failure",
        errorCode: "role_unassigned"
      });
    }
    if (persona === "student") {
      await safeSignOut(supabase);
      return finalize({
        response: NextResponse.json({ ok: false, error: "use_student_magic_link" }, { status: 403 }),
        outcome: "failure",
        errorCode: "use_student_magic_link"
      });
    }
    if (persona === "recruiter") {
      await safeSignOut(supabase);
      return finalize({
        response: NextResponse.json({ ok: false, error: "use_recruiter_magic_link" }, { status: 403 }),
        outcome: "failure",
        errorCode: "use_recruiter_magic_link"
      });
    }
    if (persona === "referrer") {
      await safeSignOut(supabase);
      return finalize({
        response: NextResponse.json({ ok: false, error: "use_referrer_magic_link" }, { status: 403 }),
        outcome: "failure",
        errorCode: "use_referrer_magic_link"
      });
    }

    const response = NextResponse.json({ ok: true, redirectPath: getHomeRouteForPersona(persona) });
    cookieAccumulator.apply(response);
    response.headers.set("x-stu-login-email", parsed.data.email);
    response.headers.set("x-stu-persona", persona);
    return finalize({
      response,
      outcome: "success",
      details: { persona }
    });
  } catch (error) {
    logApiUnexpectedError({
      context: obs,
      eventName: "stu.auth.staff_login.failure",
      error,
      provider: "supabase"
    });
    throw error;
  }
}
