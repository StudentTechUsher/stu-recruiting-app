import { afterEach, describe, expect, it } from "vitest";
import {
  buildDevAuthContext,
  devIdentityCookieName,
  getDevRecruiterIdentity,
  isDevIdentitiesEnabled,
  resolveDevPersonaFromCookieHeader,
  resolveDevPersonaFromCookieValue
} from "@/lib/dev-auth";

const originalEnableDevIdentities = process.env.ENABLE_DEV_IDENTITIES;
const originalDevRecruiterProfileId = process.env.DEV_RECRUITER_PROFILE_ID;
const originalDevRecruiterId = process.env.DEV_RECRUITER_ID;
const originalDevRecruiterEmail = process.env.DEV_RECRUITER_EMAIL;
const originalDevRecruiterFullName = process.env.DEV_RECRUITER_FULL_NAME;
const originalDevRecruiterOrgId = process.env.DEV_RECRUITER_ORG_ID;

afterEach(() => {
  process.env.ENABLE_DEV_IDENTITIES = originalEnableDevIdentities;
  process.env.DEV_RECRUITER_PROFILE_ID = originalDevRecruiterProfileId;
  process.env.DEV_RECRUITER_ID = originalDevRecruiterId;
  process.env.DEV_RECRUITER_EMAIL = originalDevRecruiterEmail;
  process.env.DEV_RECRUITER_FULL_NAME = originalDevRecruiterFullName;
  process.env.DEV_RECRUITER_ORG_ID = originalDevRecruiterOrgId;
});

describe("dev auth identities", () => {
  it("enables dev identities by default outside production", () => {
    delete process.env.ENABLE_DEV_IDENTITIES;
    expect(isDevIdentitiesEnabled()).toBe(true);
  });

  it("can disable dev identities via env flag", () => {
    process.env.ENABLE_DEV_IDENTITIES = "false";
    expect(isDevIdentitiesEnabled()).toBe(false);
    expect(resolveDevPersonaFromCookieValue("student")).toBeNull();
  });

  it("parses dev persona from cookie header", () => {
    process.env.ENABLE_DEV_IDENTITIES = "true";
    const cookieHeader = `${devIdentityCookieName}=recruiter; other=value`;
    expect(resolveDevPersonaFromCookieHeader(cookieHeader)).toBe("recruiter");
  });

  it("returns null for unsupported persona values", () => {
    process.env.ENABLE_DEV_IDENTITIES = "true";
    expect(resolveDevPersonaFromCookieValue("unknown")).toBeNull();
  });

  it("parses referrer persona", () => {
    process.env.ENABLE_DEV_IDENTITIES = "true";
    expect(resolveDevPersonaFromCookieValue("referrer")).toBe("referrer");
  });

  it("builds an authenticated context for dev student persona", () => {
    const context = buildDevAuthContext("student");
    expect(context.authenticated).toBe(true);
    expect(context.persona).toBe("student");
    expect(context.user_id).toBe("11111111-1111-4111-8111-111111111119");
    expect(context.session_user?.email).toBe("sam.r@example.com");
    expect(context.profile?.onboarding_completed_at).toBeTruthy();
  });

  it("builds an authenticated context for dev referrer persona", () => {
    const context = buildDevAuthContext("referrer");
    expect(context.authenticated).toBe(true);
    expect(context.persona).toBe("referrer");
    expect(context.user_id).toBe("dev-referrer-user");
    expect(context.profile?.onboarding_completed_at).toBeTruthy();
  });

  it("builds an authenticated context for dev recruiter persona with fake recruiter identity", () => {
    const recruiter = getDevRecruiterIdentity();
    const context = buildDevAuthContext("recruiter");

    expect(context.authenticated).toBe(true);
    expect(context.persona).toBe("recruiter");
    expect(context.user_id).toBe(recruiter.profileId);
    expect(context.org_id).toBe(recruiter.orgId);
    expect(context.profile?.personal_info.email).toBe(recruiter.email);
    expect(context.session_user?.app_metadata.recruiter_id).toBe(recruiter.recruiterId);
    expect(context.profile?.onboarding_completed_at).toBeTruthy();
  });
});
