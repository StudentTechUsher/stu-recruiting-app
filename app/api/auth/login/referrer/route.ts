import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { getSupabaseConfig, getAuthAppUrl } from "@/lib/supabase/config";
import { buildCookieAccumulator, parseRequestCookies } from "@/lib/supabase/cookie-adapter";
import { consumeMagicLinkThrottle } from "@/lib/auth/magic-link-throttle";
import { applyMagicLinkIntentCookie } from "@/lib/auth/magic-link-intent";
import {
  attachRequestIdHeader,
  createApiObsContext,
  logApiRequestResult,
  logApiRequestStart,
  logApiUnexpectedError
} from "@/lib/observability/api";

type SupabaseCookie = { name: string; value: string; options?: Record<string, unknown> };

const magicLinkSchema = z.object({
  email: z.string().email()
});
const MAGIC_LINK_RETRY_AFTER_SECONDS = 60;

const getCallbackUrl = (req: Request) => {
  const explicit = getAuthAppUrl();
  const origin = explicit ?? new URL(req.url).origin;
  return new URL("/auth/callback", origin).toString();
};

const inferMagicLinkErrorCode = (message: string) => {
  if (/email logins are disabled/i.test(message)) return "email_auth_disabled";
  if (/redirect|redirect_to|emailredirectto|uri|url/i.test(message)) return "invalid_magic_link_redirect";
  if (/rate limit|too many requests/i.test(message)) return "magic_link_rate_limited";
  return "magic_link_send_failed";
};

export async function POST(req: Request) {
  const obs = createApiObsContext({
    request: req,
    routeTemplate: "/api/auth/login/referrer",
    component: "auth",
    operation: "referrer_magic_link_login"
  });
  logApiRequestStart(obs);

  const finalize = ({
    response,
    eventName,
    outcome,
    errorCode,
    details
  }: {
    response: NextResponse;
    eventName: string;
    outcome: "success" | "failure" | "timeout" | "retry" | "dropped";
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
      persona: "referrer",
      details
    });
    return response;
  };

  try {
    const body = await req.json().catch(() => null);
    const parsed = magicLinkSchema.safeParse(body);

    if (!parsed.success) {
      return finalize({
        response: NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 }),
        eventName: "stu.auth.magic_link.send.failure",
        outcome: "failure",
        errorCode: "invalid_email"
      });
    }

    const throttleResult = consumeMagicLinkThrottle({ email: parsed.data.email, request: req });
    if (throttleResult.throttled) {
      const response = NextResponse.json({
        ok: true,
        throttled: true,
        retryAfterSeconds: throttleResult.retryAfterSeconds
      });
      response.headers.set("retry-after", String(throttleResult.retryAfterSeconds));
      response.headers.set("x-stu-login-email", parsed.data.email);
      response.headers.set("x-stu-persona", "referrer");
      applyMagicLinkIntentCookie(response, "referrer");
      return finalize({
        response,
        eventName: "stu.auth.magic_link.send.retry",
        outcome: "retry",
        errorCode: "magic_link_rate_limited",
        details: { throttled: true }
      });
    }

    const config = getSupabaseConfig();
    if (!config) {
      return finalize({
        response: NextResponse.json({ ok: false, error: "supabase_not_configured" }, { status: 500 }),
        eventName: "stu.auth.magic_link.send.failure",
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

    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: {
        emailRedirectTo: getCallbackUrl(req),
        shouldCreateUser: true,
        data: {
          role: "referrer",
          stu_persona: "referrer"
        }
      }
    });

    if (error) {
      const status = typeof error.status === "number" ? error.status : 400;
      const errorMessage = typeof error.message === "string" ? error.message : "unknown_supabase_error";
      const errorCode = inferMagicLinkErrorCode(errorMessage);

      if (errorCode === "magic_link_rate_limited" || status === 429) {
        console.warn("referrer_magic_link_rate_limited", {
          status,
          message: errorMessage
        });

        const response = NextResponse.json({
          ok: true,
          throttled: true,
          retryAfterSeconds: MAGIC_LINK_RETRY_AFTER_SECONDS
        });
        response.headers.set("retry-after", String(MAGIC_LINK_RETRY_AFTER_SECONDS));
        response.headers.set("x-stu-login-email", parsed.data.email);
        response.headers.set("x-stu-persona", "referrer");
        applyMagicLinkIntentCookie(response, "referrer");
        return finalize({
          response,
          eventName: "stu.auth.magic_link.send.retry",
          outcome: "retry",
          errorCode,
          details: { throttled: true, status }
        });
      }

      console.error("referrer_magic_link_send_failed", {
        errorCode,
        status,
        message: errorMessage
      });

      return finalize({
        response: NextResponse.json(
          {
            ok: false,
            error: errorCode,
            details: process.env.NODE_ENV === "development" ? errorMessage : undefined
          },
          { status }
        ),
        eventName: "stu.auth.magic_link.send.failure",
        outcome: "failure",
        errorCode,
        details: { status }
      });
    }

    const response = NextResponse.json({ ok: true });
    cookieAccumulator.apply(response);
    response.headers.set("x-stu-login-email", parsed.data.email);
    response.headers.set("x-stu-persona", "referrer");
    applyMagicLinkIntentCookie(response, "referrer");
    return finalize({
      response,
      eventName: "stu.auth.magic_link.send.success",
      outcome: "success"
    });
  } catch (error) {
    logApiUnexpectedError({
      context: obs,
      eventName: "stu.auth.magic_link.send.failure",
      error,
      provider: "supabase"
    });
    return finalize({
      response: NextResponse.json({ ok: false, error: "unexpected_exception" }, { status: 500 }),
      eventName: "stu.auth.magic_link.send.failure",
      outcome: "failure",
      errorCode: "unexpected_exception"
    });
  }
}
