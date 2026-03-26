import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { buildCookieAccumulator, parseRequestCookies } from "@/lib/supabase/cookie-adapter";
import { isRefreshTokenNotFoundError } from "@/lib/supabase/auth-session";
import { clearDevIdentityCookie } from "@/lib/dev-auth";
import { clearMagicLinkIntentCookie } from "@/lib/auth/magic-link-intent";
import {
  attachRequestIdHeader,
  createApiObsContext,
  logApiRequestResult,
  logApiRequestStart,
  logApiUnexpectedError
} from "@/lib/observability/api";

type SupabaseCookie = { name: string; value: string; options?: Record<string, unknown> };

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
    routeTemplate: "/api/auth/logout",
    component: "auth",
    operation: "logout"
  });
  logApiRequestStart(obs);

  const finalize = ({
    response,
    outcome,
    errorCode
  }: {
    response: NextResponse;
    outcome: "success" | "failure";
    errorCode?: string;
  }) => {
    attachRequestIdHeader(response, obs.requestId);
    logApiRequestResult({
      context: obs,
      statusCode: response.status,
      eventName: `stu.auth.logout.${outcome}`,
      outcome,
      errorCode
    });
    return response;
  };

  try {
    const response = NextResponse.redirect(new URL("/", req.url), 303);
    clearDevIdentityCookie(response);
    clearMagicLinkIntentCookie(response);
    const config = getSupabaseConfig();

    if (!config) {
      return finalize({
        response,
        outcome: "success"
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

    await safeSignOut(supabase);
    cookieAccumulator.apply(response);
    return finalize({
      response,
      outcome: "success"
    });
  } catch (error) {
    logApiUnexpectedError({
      context: obs,
      eventName: "stu.auth.logout.failure",
      error,
      provider: "supabase"
    });
    return finalize({
      response: NextResponse.json({ ok: false, error: "unexpected_exception" }, { status: 500 }),
      outcome: "failure",
      errorCode: "unexpected_exception"
    });
  }
}
