import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  extractTargetCompanyNames,
  extractTargetRoleNames,
  splitOnboardingPersistenceData
} from "@/lib/auth/onboarding-persistence";
import { resolvePostAuthRedirect } from "@/lib/auth/callback-routing";
import { getProfileByUserId } from "@/lib/auth/profile";
import { resolveAssignmentsFromUser, resolveOrgIdFromUser, resolvePersonaFromProfileOrUser } from "@/lib/auth/role";
import { defaultStudentViewReleaseFlags } from "@/lib/feature-flags";
import type { AuthContext, SessionUserSnapshot } from "@/lib/route-policy";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { buildCookieAccumulator, parseRequestCookies } from "@/lib/supabase/cookie-adapter";
import { buildDevAuthContext, resolveDevPersonaFromCookieHeader } from "@/lib/dev-auth";

type SupabaseCookie = { name: string; value: string; options?: Record<string, unknown> };

const toUnauthenticatedContext = (): AuthContext => ({
  authenticated: false,
  user_id: "",
  org_id: "",
  persona: "student",
  assignment_ids: [],
  profile: null,
  session_source: "none",
  session_user: null
});

const resolveRequestAuthContext = async (req: Request): Promise<{
  context: AuthContext;
  supabase: ReturnType<typeof createServerClient> | null;
  applyCookies: (response: NextResponse) => void;
}> => {
  const config = getSupabaseConfig();
  const cookieAccumulator = buildCookieAccumulator();

  const applyCookies = (response: NextResponse) => {
    cookieAccumulator.apply(response);
  };

  const devPersona = resolveDevPersonaFromCookieHeader(req.headers.get("cookie"));
  if (devPersona) {
    return {
      context: buildDevAuthContext(devPersona),
      supabase: null,
      applyCookies
    };
  }

  if (!config) {
    return {
      context: toUnauthenticatedContext(),
      supabase: null,
      applyCookies
    };
  }

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

  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] = null;
  let userError: unknown = null;

  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
    userError = result.error;
  } catch (error) {
    userError = error;
  }

  if (userError || !user) {
    return {
      context: toUnauthenticatedContext(),
      supabase,
      applyCookies
    };
  }

  const sessionUser: SessionUserSnapshot = {
    id: user.id,
    email: user.email ?? null,
    aud: user.aud ?? "authenticated",
    role: user.role ?? null,
    app_metadata: user.app_metadata ?? {},
    user_metadata: user.user_metadata ?? {}
  };

  const profile = await getProfileByUserId(supabase, user.id);
  const persona = resolvePersonaFromProfileOrUser(profile?.role, user);
  if (!persona) {
    return {
      context: toUnauthenticatedContext(),
      supabase,
      applyCookies
    };
  }

  return {
    context: {
      authenticated: true,
      user_id: user.id,
      org_id: resolveOrgIdFromUser(user),
      persona,
      assignment_ids: resolveAssignmentsFromUser(user),
      profile,
      session_source: "supabase",
      session_user: sessionUser
    },
    supabase,
    applyCookies
  };
};

export async function POST(req: Request) {
  const { context, supabase, applyCookies } = await resolveRequestAuthContext(req);
  if (!context.authenticated) {
    const response = NextResponse.json({ ok: false, error: "session_expired" }, { status: 403 });
    applyCookies(response);
    return response;
  }

  const payload = await req.json().catch(() => ({}));
  const now = new Date().toISOString();
  const { profilePersonalInfo, studentData } = splitOnboardingPersistenceData({
    payload,
    existingProfilePersonalInfo: context.profile?.personal_info,
    sessionEmail: context.session_user?.email
  });

  if (supabase) {
    await supabase
      .from("profiles")
      .update({
        onboarding_completed_at: now,
        personal_info: profilePersonalInfo
      })
      .eq("id", context.user_id);

    if (context.persona === "student") {
      const companyNames = extractTargetCompanyNames(studentData);
      if (companyNames.length > 0) {
        await supabase.from("companies").upsert(
          companyNames.map((companyName) => ({
            company_name: companyName
          })),
          { onConflict: "company_name_normalized" }
        );
      }

      const roleNames = extractTargetRoleNames(studentData);
      if (roleNames.length > 0) {
        await supabase.from("job_roles").upsert(
          roleNames.map((roleName) => ({
            role_name: roleName
          })),
          { onConflict: "role_name_normalized" }
        );
      }

      await supabase.from("students").upsert(
        {
          profile_id: context.user_id,
          student_data: studentData
        },
        { onConflict: "profile_id" }
      );
    }
  }

  const redirectPath = resolvePostAuthRedirect({
    persona: context.persona,
    onboardingCompletedAt: now,
    studentViewReleaseFlags: defaultStudentViewReleaseFlags
  });
  const redirectPathWithTour =
    context.persona === "student" && redirectPath.startsWith("/student/artifacts")
      ? (() => {
          const next = new URL(redirectPath, "http://local");
          next.searchParams.set("tour", "artifacts");
          return `${next.pathname}${next.search}`;
        })()
      : redirectPath;

  const response = NextResponse.json({
    ok: true,
    resource: "onboarding_complete",
    context,
    redirectPath: redirectPathWithTour,
    completedAt: now
  });
  applyCookies(response);
  return response;
}
