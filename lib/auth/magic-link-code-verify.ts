import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { buildCookieAccumulator, parseRequestCookies } from "@/lib/supabase/cookie-adapter";
import { getProfileByUserId } from "@/lib/auth/profile";
import { resolvePersonaFromProfileOrUser } from "@/lib/auth/role";
import { isRefreshTokenNotFoundError } from "@/lib/supabase/auth-session";
import { clearMagicLinkIntentCookie, type MagicLinkIntentPersona } from "@/lib/auth/magic-link-intent";
import { clearClaimSessionCookie } from "@/lib/auth/claim-session-cookie";
import { resolvePostAuthRedirect } from "@/lib/auth/callback-routing";
import { defaultStudentViewReleaseFlags } from "@/lib/feature-flags";
import {
  attachRequestIdHeader,
  createApiObsContext,
  logApiRequestResult,
  logApiRequestStart,
  logApiUnexpectedError,
} from "@/lib/observability/api";

type SupabaseCookie = { name: string; value: string; options?: Record<string, unknown> };

type VerifyMagicLinkCodeOptions = {
  request: Request;
  persona: MagicLinkIntentPersona;
};

const verifyCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().trim().min(6).max(64),
  claim_token: z.string().trim().min(16).max(4096).optional(),
});

const inferVerifyErrorCode = (message: string) => {
  if (/invalid|expired|otp|token|code/i.test(message)) return "invalid_otp_code";
  if (/rate limit|too many requests/i.test(message)) return "otp_rate_limited";
  return "otp_verify_failed";
};

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

export async function verifyMagicLinkCode({ request, persona }: VerifyMagicLinkCodeOptions) {
  const routeTemplate = `/api/auth/login/${persona}/verify`;
  const obs = createApiObsContext({
    request,
    routeTemplate,
    component: "auth",
    operation: `${persona}_magic_link_code_verify`,
  });
  logApiRequestStart(obs);

  const finalize = ({
    response,
    eventName,
    outcome,
    errorCode,
    details,
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
      persona,
      details,
    });
    return response;
  };

  try {
    const body = await request.json().catch(() => null);
    const parsed = verifyCodeSchema.safeParse(body);
    if (!parsed.success) {
      return finalize({
        response: NextResponse.json({ ok: false, error: "invalid_otp_payload" }, { status: 400 }),
        eventName: "stu.auth.magic_link.verify.failure",
        outcome: "failure",
        errorCode: "invalid_otp_payload",
      });
    }

    const config = getSupabaseConfig();
    if (!config) {
      return finalize({
        response: NextResponse.json({ ok: false, error: "supabase_not_configured" }, { status: 500 }),
        eventName: "stu.auth.magic_link.verify.failure",
        outcome: "failure",
        errorCode: "supabase_not_configured",
      });
    }

    const cookieAccumulator = buildCookieAccumulator();
    const supabase = createServerClient(config.url, config.anonKey, {
      cookies: {
        getAll() {
          return parseRequestCookies(request.headers.get("cookie"));
        },
        setAll(cookiesToSet: SupabaseCookie[]) {
          cookieAccumulator.push(cookiesToSet);
        },
      },
    });

    const { data, error } = await supabase.auth.verifyOtp({
      email: parsed.data.email,
      token: parsed.data.code,
      type: "email",
    });

    if (error) {
      const status = typeof error.status === "number" ? error.status : 400;
      const errorMessage = typeof error.message === "string" ? error.message : "unknown_supabase_error";
      const errorCode = inferVerifyErrorCode(errorMessage);
      return finalize({
        response: NextResponse.json(
          {
            ok: false,
            error: errorCode,
            details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
          },
          { status }
        ),
        eventName: "stu.auth.magic_link.verify.failure",
        outcome: "failure",
        errorCode,
        details: { status },
      });
    }

    let user = data.user;
    if (!user) {
      const userResult = await supabase.auth.getUser();
      user = userResult.data.user;
    }

    if (!user) {
      return finalize({
        response: NextResponse.json({ ok: false, error: "invalid_otp_code" }, { status: 400 }),
        eventName: "stu.auth.magic_link.verify.failure",
        outcome: "failure",
        errorCode: "invalid_otp_code",
      });
    }

    let profile = await getProfileByUserId(supabase, user.id);
    let resolvedPersona = resolvePersonaFromProfileOrUser(profile?.role, user);

    if (!resolvedPersona && persona === "student") {
      const { error: bootstrapError } = await supabase.auth.updateUser({
        data: {
          role: "student",
          stu_persona: "student",
        },
      });

      if (!bootstrapError) {
        const refreshed = await supabase.auth.getUser();
        if (refreshed.data.user) user = refreshed.data.user;
        profile = await getProfileByUserId(supabase, user.id);
        resolvedPersona = resolvePersonaFromProfileOrUser(profile?.role, user);
      }
    }

    if (!resolvedPersona) {
      await safeSignOut(supabase);
      const response = NextResponse.json({ ok: false, error: "role_unassigned" }, { status: 403 });
      cookieAccumulator.apply(response);
      clearMagicLinkIntentCookie(response);
      clearClaimSessionCookie(response);
      return finalize({
        response,
        eventName: "stu.auth.magic_link.verify.failure",
        outcome: "failure",
        errorCode: "role_unassigned",
      });
    }

    if (resolvedPersona !== persona) {
      await safeSignOut(supabase);
      const response = NextResponse.json({ ok: false, error: "wrong_account_type" }, { status: 403 });
      cookieAccumulator.apply(response);
      clearMagicLinkIntentCookie(response);
      clearClaimSessionCookie(response);
      return finalize({
        response,
        eventName: "stu.auth.magic_link.verify.failure",
        outcome: "failure",
        errorCode: "wrong_account_type",
        details: {
          expectedPersona: persona,
          resolvedPersona,
        },
      });
    }

    const redirectPath = resolvePostAuthRedirect({
      persona: resolvedPersona,
      onboardingCompletedAt: profile?.onboarding_completed_at ?? null,
      studentViewReleaseFlags: defaultStudentViewReleaseFlags,
    });

    const response = NextResponse.json({ ok: true, redirectPath });
    cookieAccumulator.apply(response);
    clearMagicLinkIntentCookie(response);
    clearClaimSessionCookie(response);
    return finalize({
      response,
      eventName: "stu.auth.magic_link.verify.success",
      outcome: "success",
    });
  } catch (error) {
    logApiUnexpectedError({
      context: obs,
      eventName: "stu.auth.magic_link.verify.failure",
      error,
      provider: "supabase",
    });
    return finalize({
      response: NextResponse.json({ ok: false, error: "unexpected_exception" }, { status: 500 }),
      eventName: "stu.auth.magic_link.verify.failure",
      outcome: "failure",
      errorCode: "unexpected_exception",
    });
  }
}
