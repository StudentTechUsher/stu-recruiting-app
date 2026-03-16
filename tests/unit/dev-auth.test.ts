import { afterEach, describe, expect, it } from "vitest";
import {
  buildDevAuthContext,
  devIdentityCookieName,
  isDevIdentitiesEnabled,
  resolveDevPersonaFromCookieHeader,
  resolveDevPersonaFromCookieValue
} from "@/lib/dev-auth";

const originalEnableDevIdentities = process.env.ENABLE_DEV_IDENTITIES;

afterEach(() => {
  process.env.ENABLE_DEV_IDENTITIES = originalEnableDevIdentities;
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

  it("builds an authenticated context for dev student persona", () => {
    const context = buildDevAuthContext("student");
    expect(context.authenticated).toBe(true);
    expect(context.persona).toBe("student");
    expect(context.user_id).toBe("dev-student-user");
    expect(context.profile?.onboarding_completed_at).toBeTruthy();
  });
});
