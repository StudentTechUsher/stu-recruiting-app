import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { resolvePostAuthRedirect } from "@/lib/auth/callback-routing";
import { getProfileByUserId } from "@/lib/auth/profile";
import { resolvePersonaFromProfileOrUser } from "@/lib/auth/role";
import { redeemClaimInviteToken } from "@/lib/candidates/claim-invite";
import { createSupabaseCandidateIdentityStore } from "@/lib/candidates/identity";
import { hashClaimInviteToken } from "@/lib/auth/claim-invite-token";
import {
  clearClaimSessionCookie,
  resolveClaimSessionFromCookieHeader,
} from "@/lib/auth/claim-session-cookie";
import { defaultStudentViewReleaseFlags } from "@/lib/feature-flags";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { buildCookieAccumulator, parseRequestCookies } from "@/lib/supabase/cookie-adapter";
import { isRefreshTokenNotFoundError } from "@/lib/supabase/auth-session";
import {
  clearMagicLinkIntentCookie,
  getMagicLinkLoginPathForPersona,
  resolveMagicLinkIntentFromCookieHeader
} from "@/lib/auth/magic-link-intent";

type SupabaseCookie = { name: string; value: string; options?: Record<string, unknown> };

const emailOtpTypes: EmailOtpType[] = ["email", "magiclink", "recovery", "invite", "email_change"];

const toLoginRedirect = (requestUrl: string, errorCode: string) => {
  const loginUrl = new URL("/login", requestUrl);
  loginUrl.searchParams.set("error", errorCode);
  return loginUrl;
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

const toTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

export async function GET(req: Request) {
  const config = getSupabaseConfig();
  if (!config) {
    return NextResponse.redirect(toLoginRedirect(req.url, "supabase_not_configured"), 303);
  }

  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const claimToken = requestUrl.searchParams.get("claim_token");

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

  let authError: unknown = null;
  let userFromAuthFlow: { id: string; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> } | null = null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    authError = error;
    userFromAuthFlow = data.user;
  } else if (tokenHash && type && emailOtpTypes.includes(type as EmailOtpType)) {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType
    });
    authError = error;
    userFromAuthFlow = data.user;
  } else {
    return NextResponse.redirect(toLoginRedirect(req.url, "invalid_magic_link"), 303);
  }

  if (authError) {
    return NextResponse.redirect(toLoginRedirect(req.url, "invalid_magic_link"), 303);
  }

  let user: { id: string; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> } | null =
    userFromAuthFlow;
  let userError: unknown = null;

  try {
    const userResult = await supabase.auth.getUser();
    user = userResult.data.user ?? userFromAuthFlow;
    userError = userResult.error;
  } catch (error) {
    userError = error;
  }

  if (userError || !user) {
    return NextResponse.redirect(toLoginRedirect(req.url, "invalid_magic_link"), 303);
  }

  const intendedPersona = resolveMagicLinkIntentFromCookieHeader(req.headers.get("cookie"));
  let profile = await getProfileByUserId(supabase, user.id);
  let persona = resolvePersonaFromProfileOrUser(profile?.role, user);

  if (!persona && intendedPersona === "student") {
    const { error: bootstrapError } = await supabase.auth.updateUser({
      data: {
        role: "student",
        stu_persona: "student",
      },
    });

    if (bootstrapError) {
      console.warn("auth_oauth_student_bootstrap_failed", {
        reason: "update_user_failed",
        error: bootstrapError,
      });
    } else {
      try {
        const refreshed = await supabase.auth.getUser();
        if (refreshed.data.user) {
          user = refreshed.data.user;
        }
      } catch (refreshError) {
        console.warn("auth_oauth_student_bootstrap_failed", {
          reason: "refresh_user_failed",
          error: refreshError,
        });
      }

      profile = await getProfileByUserId(supabase, user.id);
      persona = resolvePersonaFromProfileOrUser(profile?.role, user);
      console.info("auth_oauth_student_bootstrap_completed", {
        resolved_persona: persona,
      });
    }
  }

  if (!persona) {
    console.warn("auth_callback_role_unassigned", {
      intended_persona: intendedPersona,
      provider: toTrimmedString((user.app_metadata ?? {}).provider),
    });
    await safeSignOut(supabase);
    const response = NextResponse.redirect(toLoginRedirect(req.url, "role_unassigned"), 303);
    cookieAccumulator.apply(response);
    clearMagicLinkIntentCookie(response);
    clearClaimSessionCookie(response);
    return response;
  }

  if (intendedPersona && intendedPersona !== persona) {
    console.warn("auth_callback_persona_mismatch", {
      intended_persona: intendedPersona,
      resolved_persona: persona,
      provider: toTrimmedString((user.app_metadata ?? {}).provider),
    });
    await safeSignOut(supabase);
    const mismatchLoginUrl = new URL(getMagicLinkLoginPathForPersona(intendedPersona), req.url);
    mismatchLoginUrl.searchParams.set("error", "wrong_account_type");
    const response = NextResponse.redirect(mismatchLoginUrl, 303);
    cookieAccumulator.apply(response);
    clearMagicLinkIntentCookie(response);
    clearClaimSessionCookie(response);
    return response;
  }

  let claimStatus: "claimed" | "idempotent" | "conflict" | "invalid" | null = null;
  if (persona === "student" && claimToken && claimToken.trim().length > 0) {
    const claimSession = resolveClaimSessionFromCookieHeader(req.headers.get("cookie"));
    const expectedTokenHash = hashClaimInviteToken(claimToken);
    const authenticatedEmail = toTrimmedString((user as Record<string, unknown>).email)?.toLowerCase() ?? null;
    const appMetadata = (user.app_metadata ?? {}) as Record<string, unknown>;
    const provider = toTrimmedString(appMetadata.provider)?.toLowerCase();
    const providerList = Array.isArray(appMetadata.providers)
      ? appMetadata.providers
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.toLowerCase())
      : [];
    const isGoogleFlow = provider === "google" || providerList.includes("google");
    const claimSessionMatches =
      (claimSession &&
        claimSession.token_hash === expectedTokenHash &&
        authenticatedEmail &&
        claimSession.email === authenticatedEmail) ||
      (!claimSession && isGoogleFlow && intendedPersona === "student" && Boolean(authenticatedEmail));

    if (!claimSessionMatches) {
      claimStatus = "invalid";
    } else {
      const serviceRoleClient = getSupabaseServiceRoleClient();
      if (serviceRoleClient) {
        const store = createSupabaseCandidateIdentityStore(serviceRoleClient);
        const claimResult = await redeemClaimInviteToken({
          token: claimToken,
          canonicalProfileId: user.id,
          store,
          supabase: serviceRoleClient,
        });
        if (claimResult.ok) {
          claimStatus = claimResult.status;
        } else if (
          claimResult.error === "invalid_token" ||
          claimResult.error === "token_expired" ||
          claimResult.error === "invite_secret_missing"
        ) {
          claimStatus = "invalid";
        } else if (claimResult.error === "claim_conflict") {
          claimStatus = "conflict";
        }
      } else {
        claimStatus = "invalid";
      }
    }
  }

  const redirectPath = resolvePostAuthRedirect({
    persona,
    onboardingCompletedAt: profile?.onboarding_completed_at ?? null,
    studentViewReleaseFlags: defaultStudentViewReleaseFlags
  });

  const redirectUrl = new URL(redirectPath, req.url);
  if (claimStatus) {
    redirectUrl.searchParams.set("claim_status", claimStatus);
  }

  const response = NextResponse.redirect(redirectUrl, 303);
  cookieAccumulator.apply(response);
  clearMagicLinkIntentCookie(response);
  clearClaimSessionCookie(response);
  return response;
}
