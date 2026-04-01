import { describe, expect, it } from "vitest";
import { StudentMagicLinkLoginScreen } from "@/components/auth/StudentMagicLinkLoginScreen";

describe("student magic link login screen", () => {
  it("passes Google OAuth path when enabled and includes claim token", () => {
    const element = StudentMagicLinkLoginScreen({
      sessionCheckEnabled: true,
      googleOAuthEnabled: true,
      claimToken: "claim-token-123",
    }) as { props: Record<string, unknown> };

    expect(element.props.googleOAuthPath).toBe("/api/auth/login/student/google?claim_token=claim-token-123");
  });

  it("omits Google OAuth path when disabled", () => {
    const element = StudentMagicLinkLoginScreen({
      sessionCheckEnabled: true,
      googleOAuthEnabled: false,
      claimToken: null,
    }) as { props: Record<string, unknown> };

    expect(element.props.googleOAuthPath).toBeNull();
  });
});

