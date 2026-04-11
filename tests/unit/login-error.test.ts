import { describe, expect, it } from "vitest";
import { resolveAuthLoginErrorMessage } from "@/lib/auth/login-error";

describe("resolveAuthLoginErrorMessage", () => {
  it("maps wrong_account_type to persona-specific guidance", () => {
    const message = resolveAuthLoginErrorMessage(
      {
        error: "wrong_account_type",
      },
      {
        intendedPersona: "recruiter",
      }
    );

    expect(message).toBe(
      "This email is already assigned to a different account type. Recruiter magic links only work for recruiter profiles."
    );
  });

  it("maps explicit otp_expired errors to a refresh guidance message", () => {
    const message = resolveAuthLoginErrorMessage({
      error: "access_denied",
      error_code: "otp_expired",
      error_description: "Email link is invalid or has expired",
    });

    expect(message).toBe("This sign-in link is invalid or expired. Request a new magic link and use the latest email.");
  });

  it("maps access_denied invalid-link descriptions when provider omits otp_expired code", () => {
    const message = resolveAuthLoginErrorMessage({
      error: "access_denied",
      error_description: "Email link is invalid or has expired",
    });

    expect(message).toBe("This sign-in link is invalid or expired. Request a new magic link and use the latest email.");
  });

  it("maps role_unassigned errors", () => {
    const message = resolveAuthLoginErrorMessage({
      error: "role_unassigned",
    });

    expect(message).toBe("Your account does not have an assigned Stu role. Contact an org admin.");
  });

  it("returns null for unknown errors", () => {
    const message = resolveAuthLoginErrorMessage({
      error: "unknown_error",
    });

    expect(message).toBeNull();
  });
});
