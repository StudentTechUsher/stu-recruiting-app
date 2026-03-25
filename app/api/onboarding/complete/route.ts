import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  extractTargetCompanyNames,
  extractTargetRoleNames,
  splitOnboardingPersistenceData
} from "@/lib/auth/onboarding-persistence";
import { parseOnboardingClientMetrics } from "@/lib/auth/onboarding-metrics";
import { resolvePostAuthRedirect } from "@/lib/auth/callback-routing";
import { getProfileByUserId } from "@/lib/auth/profile";
import { resolveAssignmentsFromUser, resolveOrgIdFromUser, resolvePersonaFromProfileOrUser } from "@/lib/auth/role";
import { notifyOnNewRolesForMapping } from "@/lib/capabilities/role-mapping-alerts";
import { defaultStudentViewReleaseFlags } from "@/lib/feature-flags";
import type { AuthContext, SessionUserSnapshot } from "@/lib/route-policy";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { buildCookieAccumulator, parseRequestCookies } from "@/lib/supabase/cookie-adapter";
import { buildDevAuthContext, resolveDevPersonaFromCookieHeader } from "@/lib/dev-auth";

type SupabaseCookie = { name: string; value: string; options?: Record<string, unknown> };
type StudentRow = { student_data: unknown };

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

const toRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const mergeRecords = (
  base: Record<string, unknown>,
  override: Record<string, unknown>
): Record<string, unknown> => {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    const baseValue = merged[key];
    if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      typeof baseValue === "object" &&
      baseValue !== null &&
      !Array.isArray(baseValue)
    ) {
      merged[key] = mergeRecords(baseValue as Record<string, unknown>, value as Record<string, unknown>);
      continue;
    }
    merged[key] = value;
  }
  return merged;
};

const normalizeRoleName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

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
  const payloadRecord = toRecord(payload);
  const now = new Date().toISOString();
  const onboardingClientMetrics = parseOnboardingClientMetrics(payloadRecord.client_metrics);
  const { profilePersonalInfo, studentData } = splitOnboardingPersistenceData({
    payload,
    existingProfilePersonalInfo: context.profile?.personal_info,
    sessionEmail: context.session_user?.email
  });
  const referrerDataInput = toRecord(payloadRecord.referrer_data);

  if (supabase) {
    let existingStudentData: Record<string, unknown> = {};
    if (context.persona === "student") {
      const { data: claimReviewRows } = (await supabase
        .from("students")
        .select("student_data")
        .eq("profile_id", context.user_id)
        .limit(1)) as { data: StudentRow[] | null };
      existingStudentData = toRecord(claimReviewRows?.[0]?.student_data);
      const claimReview = toRecord(existingStudentData.claim_review);
      if (claimReview.status === "flagged_mismatch") {
        const response = NextResponse.json({ ok: false, error: "claim_under_review" }, { status: 409 });
        applyCookies(response);
        return response;
      }
    }

    await supabase
      .from("profiles")
      .update({
        onboarding_completed_at: now,
        personal_info: profilePersonalInfo
      })
      .eq("id", context.user_id);

    if (context.persona === "student") {
      const studentDataWithMetrics: Record<string, unknown> = mergeRecords(existingStudentData, studentData);
      if (onboardingClientMetrics) {
        studentDataWithMetrics.onboarding_metrics = {
          ...onboardingClientMetrics,
          completed_at: now
        };
      }

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
        const jobRolesClient = supabase.from("job_roles") as unknown as {
          select?: (columns: string) => Promise<{ data: Array<{ role_name: string | null }> | null; error?: unknown }>;
          upsert: (
            payload: Array<{ role_name: string }>,
            options: { onConflict: string }
          ) => Promise<{ error?: unknown }>;
        };

        let rolesToInsert = roleNames;
        if (typeof jobRolesClient.select === "function") {
          const { data: existingRoleRows } = await jobRolesClient.select("role_name");
          const existingRoleSet = new Set(
            (existingRoleRows ?? [])
              .map((row) => normalizeRoleName(row.role_name ?? ""))
              .filter((roleName) => roleName.length > 0)
          );
          rolesToInsert = roleNames.filter((roleName) => !existingRoleSet.has(normalizeRoleName(roleName)));
        }

        await jobRolesClient.upsert(
          roleNames.map((roleName) => ({
            role_name: roleName
          })),
          { onConflict: "role_name_normalized" }
        );

        if (rolesToInsert.length > 0) {
          await notifyOnNewRolesForMapping({
            supabase,
            roleNames: rolesToInsert,
            detectedByProfileId: context.user_id,
            sourceFlow: "student_onboarding",
          });
        }
      }

      await supabase.from("students").upsert(
        {
          profile_id: context.user_id,
          claimed: true,
          student_data: studentDataWithMetrics
        },
        { onConflict: "profile_id" }
      );
    }

    if (context.persona === "referrer") {
      await supabase.from("referrers").upsert(
        {
          profile_id: context.user_id,
          referrer_data: referrerDataInput,
          onboarded_at: now
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
