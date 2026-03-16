import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { resolvePostAuthRedirect } from "@/lib/auth/callback-routing";
import { getProfileByUserId } from "@/lib/auth/profile";
import { resolvePersonaFromProfileOrUser } from "@/lib/auth/role";
import { defaultStudentViewReleaseFlags } from "@/lib/feature-flags";
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

export async function GET(req: Request) {
  const config = getSupabaseConfig();
  if (!config) {
    return NextResponse.redirect(toLoginRedirect(req.url, "supabase_not_configured"), 303);
  }

  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");

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

  const profile = await getProfileByUserId(supabase, user.id);
  const persona = resolvePersonaFromProfileOrUser(profile?.role, user);
  const intendedPersona = resolveMagicLinkIntentFromCookieHeader(req.headers.get("cookie"));

  if (!persona) {
    await safeSignOut(supabase);
    const response = NextResponse.redirect(toLoginRedirect(req.url, "role_unassigned"), 303);
    cookieAccumulator.apply(response);
    clearMagicLinkIntentCookie(response);
    return response;
  }

  if (intendedPersona && intendedPersona !== persona) {
    await safeSignOut(supabase);
    const mismatchLoginUrl = new URL(getMagicLinkLoginPathForPersona(intendedPersona), req.url);
    mismatchLoginUrl.searchParams.set("error", "wrong_account_type");
    const response = NextResponse.redirect(mismatchLoginUrl, 303);
    cookieAccumulator.apply(response);
    clearMagicLinkIntentCookie(response);
    return response;
  }

  const redirectPath = resolvePostAuthRedirect({
    persona,
    onboardingCompletedAt: profile?.onboarding_completed_at ?? null,
    studentViewReleaseFlags: defaultStudentViewReleaseFlags
  });

  const response = NextResponse.redirect(new URL(redirectPath, req.url), 303);
  cookieAccumulator.apply(response);
  clearMagicLinkIntentCookie(response);
  return response;
}
