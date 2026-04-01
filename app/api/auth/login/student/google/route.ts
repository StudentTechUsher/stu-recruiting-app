import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseConfig, getAuthAppUrl } from "@/lib/supabase/config";
import { buildCookieAccumulator, parseRequestCookies } from "@/lib/supabase/cookie-adapter";
import { applyMagicLinkIntentCookie } from "@/lib/auth/magic-link-intent";
import { isStudentGoogleOAuthEnabled } from "@/lib/session-flags";
import {
  attachRequestIdHeader,
  createApiObsContext,
  logApiRequestResult,
  logApiRequestStart,
  logApiUnexpectedError,
} from "@/lib/observability/api";

type SupabaseCookie = { name: string; value: string; options?: Record<string, unknown> };

const toTrimmedString = (value: string | null): string | null => {
  if (!value) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const getCallbackUrl = (req: Request, claimToken: string | null) => {
  const explicit = getAuthAppUrl();
  const origin = explicit ?? new URL(req.url).origin;
  const callbackUrl = new URL("/auth/callback", origin);
  if (claimToken) callbackUrl.searchParams.set("claim_token", claimToken);
  return callbackUrl.toString();
};

const inferGoogleOAuthErrorCode = (message: string) => {
  if (/provider.*disabled|unsupported provider|google/i.test(message)) return "google_oauth_provider_unavailable";
  if (/redirect|redirect_to|uri|url/i.test(message)) return "invalid_oauth_redirect";
  return "google_oauth_start_failed";
};

export async function GET(req: Request) {
  const obs = createApiObsContext({
    request: req,
    routeTemplate: "/api/auth/login/student/google",
    component: "auth",
    operation: "student_google_oauth_start",
  });
  logApiRequestStart(obs);

  const finalize = ({
    response,
    outcome,
    eventName,
    errorCode,
    details,
  }: {
    response: NextResponse;
    outcome: "success" | "failure" | "timeout" | "retry" | "dropped";
    eventName: string;
    errorCode?: string;
    details?: Record<string, unknown>;
  }) => {
    attachRequestIdHeader(response, obs.requestId);
    logApiRequestResult({
      context: obs,
      statusCode: response.status,
      eventName,
      outcome,
      errorCode,
      persona: "student",
      details,
    });
    return response;
  };

  try {
    if (!isStudentGoogleOAuthEnabled()) {
      return finalize({
        response: NextResponse.json({ ok: false, error: "google_oauth_disabled" }, { status: 404 }),
        outcome: "failure",
        eventName: "stu.auth.oauth.start.failure",
        errorCode: "google_oauth_disabled",
      });
    }

    const config = getSupabaseConfig();
    if (!config) {
      return finalize({
        response: NextResponse.json({ ok: false, error: "supabase_not_configured" }, { status: 500 }),
        outcome: "failure",
        eventName: "stu.auth.oauth.start.failure",
        errorCode: "supabase_not_configured",
      });
    }

    const requestUrl = new URL(req.url);
    const claimToken = toTrimmedString(requestUrl.searchParams.get("claim_token"));
    const callbackUrl = getCallbackUrl(req, claimToken);
    const cookieAccumulator = buildCookieAccumulator();

    const supabase = createServerClient(config.url, config.anonKey, {
      cookies: {
        getAll() {
          return parseRequestCookies(req.headers.get("cookie"));
        },
        setAll(cookiesToSet: SupabaseCookie[]) {
          cookieAccumulator.push(cookiesToSet);
        },
      },
    });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl,
      },
    });

    if (error || !data?.url) {
      const status = typeof (error as { status?: unknown })?.status === "number"
        ? (error as { status: number }).status
        : 500;
      const message = typeof (error as { message?: unknown })?.message === "string"
        ? (error as { message: string }).message
        : "missing_oauth_redirect_url";
      const errorCode = inferGoogleOAuthErrorCode(message);
      return finalize({
        response: NextResponse.json(
          {
            ok: false,
            error: errorCode,
            details: process.env.NODE_ENV === "development" ? message : undefined,
          },
          { status }
        ),
        outcome: "failure",
        eventName: "stu.auth.oauth.start.failure",
        errorCode,
        details: {
          status,
        },
      });
    }

    const response = NextResponse.redirect(data.url, 303);
    cookieAccumulator.apply(response);
    applyMagicLinkIntentCookie(response, "student");
    return finalize({
      response,
      outcome: "success",
      eventName: "stu.auth.oauth.start.success",
      details: {
        provider: "google",
      },
    });
  } catch (error) {
    logApiUnexpectedError({
      context: obs,
      eventName: "stu.auth.oauth.start.failure",
      error,
      provider: "supabase",
    });
    return finalize({
      response: NextResponse.json({ ok: false, error: "unexpected_exception" }, { status: 500 }),
      outcome: "failure",
      eventName: "stu.auth.oauth.start.failure",
      errorCode: "unexpected_exception",
    });
  }
}

