import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { getSupabaseConfig, getAuthAppUrl } from "@/lib/supabase/config";
import { buildCookieAccumulator, parseRequestCookies } from "@/lib/supabase/cookie-adapter";
import { consumeMagicLinkThrottle } from "@/lib/auth/magic-link-throttle";
import { applyMagicLinkIntentCookie } from "@/lib/auth/magic-link-intent";
import { applyClaimSessionCookie, clearClaimSessionCookie } from "@/lib/auth/claim-session-cookie";
import {
  attachRequestIdHeader,
  createApiObsContext,
  logApiRequestResult,
  logApiRequestStart,
  logApiUnexpectedError
} from "@/lib/observability/api";

type SupabaseCookie = { name: string; value: string; options?: Record<string, unknown> };

const magicLinkSchema = z.object({
  email: z.string().email(),
  claim_token: z.string().trim().min(16).max(4096).optional(),
});
const MAGIC_LINK_RETRY_AFTER_SECONDS = 60;

const getCallbackUrl = (req: Request, claimToken?: string | null) => {
  const explicit = getAuthAppUrl();
  const origin = explicit ?? new URL(req.url).origin;
  const callbackUrl = new URL("/auth/callback", origin);
  if (claimToken && claimToken.trim().length > 0) {
    callbackUrl.searchParams.set("claim_token", claimToken.trim());
  }
  return callbackUrl.toString();
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
    routeTemplate: "/api/auth/login/student",
    component: "auth",
    operation: "student_magic_link_login"
  });
  logApiRequestStart(obs);

  const finalize = ({
    response,
    outcome,
    eventName,
    errorCode,
    details
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
        outcome: "failure",
        eventName: "stu.auth.magic_link.send.failure",
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
      response.headers.set("x-stu-persona", "student");
      applyMagicLinkIntentCookie(response, "student");
      if (parsed.data.claim_token) {
        applyClaimSessionCookie({
          response,
          claimToken: parsed.data.claim_token,
          email: parsed.data.email,
        });
      } else {
        clearClaimSessionCookie(response);
      }
      return finalize({
        response,
        outcome: "retry",
        eventName: "stu.auth.magic_link.send.retry",
        errorCode: "magic_link_rate_limited",
        details: { throttled: true }
      });
    }

    const config = getSupabaseConfig();
    if (!config) {
      return finalize({
        response: NextResponse.json({ ok: false, error: "supabase_not_configured" }, { status: 500 }),
        outcome: "failure",
        eventName: "stu.auth.magic_link.send.failure",
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
        emailRedirectTo: getCallbackUrl(req, parsed.data.claim_token ?? null),
        shouldCreateUser: true,
        data: {
          role: "student",
          stu_persona: "student"
        }
      }
    });

    if (error) {
      const status = typeof error.status === "number" ? error.status : 400;
      const errorMessage = typeof error.message === "string" ? error.message : "unknown_supabase_error";
      const errorCode = inferMagicLinkErrorCode(errorMessage);

      if (errorCode === "magic_link_rate_limited" || status === 429) {
        console.warn("student_magic_link_rate_limited", {
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
        response.headers.set("x-stu-persona", "student");
        applyMagicLinkIntentCookie(response, "student");
        if (parsed.data.claim_token) {
          applyClaimSessionCookie({
            response,
            claimToken: parsed.data.claim_token,
            email: parsed.data.email,
          });
        } else {
          clearClaimSessionCookie(response);
        }
        return finalize({
          response,
          outcome: "retry",
          eventName: "stu.auth.magic_link.send.retry",
          errorCode,
          details: { throttled: true, status }
        });
      }

      console.error("student_magic_link_send_failed", {
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
        outcome: "failure",
        eventName: "stu.auth.magic_link.send.failure",
        errorCode,
        details: { status }
      });
    }

    const response = NextResponse.json({ ok: true });
    cookieAccumulator.apply(response);
    response.headers.set("x-stu-login-email", parsed.data.email);
    response.headers.set("x-stu-persona", "student");
    applyMagicLinkIntentCookie(response, "student");
    if (parsed.data.claim_token) {
      applyClaimSessionCookie({
        response,
        claimToken: parsed.data.claim_token,
        email: parsed.data.email,
      });
    } else {
      clearClaimSessionCookie(response);
    }
    return finalize({
      response,
      outcome: "success",
      eventName: "stu.auth.magic_link.send.success"
    });
  } catch (error) {
    logApiUnexpectedError({
      context: obs,
      eventName: "stu.auth.magic_link.send.failure",
      error,
      provider: "supabase"
    });
    throw error;
  }
}
