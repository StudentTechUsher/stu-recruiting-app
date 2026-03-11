import { describe, expect, it } from "vitest";
import { resolvePostAuthRedirect } from "@/lib/auth/callback-routing";
import { resolvePersonaFromProfileOrUser } from "@/lib/auth/role";
import {
  isAllowedStudentEmail,
  parseStudentEmailExceptionDomains
} from "@/lib/auth/student-email-policy";

describe("student email policy", () => {
  it("allows .edu addresses", () => {
    expect(isAllowedStudentEmail("student@asu.edu", [])).toBe(true);
  });

  it("allows explicit exception domains", () => {
    const exceptions = parseStudentEmailExceptionDomains("example.com, campus.ac.uk");
    expect(isAllowedStudentEmail("student@example.com", exceptions)).toBe(true);
    expect(isAllowedStudentEmail("student@campus.ac.uk", exceptions)).toBe(true);
  });

  it("blocks non-.edu domains outside exceptions", () => {
    expect(isAllowedStudentEmail("student@gmail.com", ["example.com"])).toBe(false);
  });
});

describe("persona precedence", () => {
  it("prefers profile role over user metadata role", () => {
    const user = {
      app_metadata: { role: "recruiter" },
      user_metadata: {}
    };

    expect(resolvePersonaFromProfileOrUser("student", user)).toBe("student");
  });

  it("falls back to user metadata role when profile role missing", () => {
    const user = {
      app_metadata: { role: "org_admin" },
      user_metadata: {}
    };

    expect(resolvePersonaFromProfileOrUser(null, user)).toBe("org_admin");
  });
});

describe("post-auth redirect routing", () => {
  const studentFlags = {
    artifactRepository: true,
    capabilityDashboard: false,
    pathwayPlanner: false,
    aiGuidance: false,
    interviewPrep: false,
    manageRoles: false
  };

  it("sends students without onboarding completion to onboarding", () => {
    expect(
      resolvePostAuthRedirect({
        persona: "student",
        onboardingCompletedAt: null,
        studentViewReleaseFlags: studentFlags
      })
    ).toBe("/student/onboarding");
  });

  it("sends onboarded students to first released student view", () => {
    expect(
      resolvePostAuthRedirect({
        persona: "student",
        onboardingCompletedAt: "2026-03-10T00:00:00.000Z",
        studentViewReleaseFlags: studentFlags
      })
    ).toBe("/student/artifacts");
  });

  it("sends recruiters without onboarding to recruiter onboarding route", () => {
    expect(
      resolvePostAuthRedirect({
        persona: "recruiter",
        onboardingCompletedAt: null,
        studentViewReleaseFlags: studentFlags
      })
    ).toBe("/recruiter/onboarding");
  });

  it("sends onboarded recruiters to recruiter home route", () => {
    expect(
      resolvePostAuthRedirect({
        persona: "recruiter",
        onboardingCompletedAt: "2026-03-10T00:00:00.000Z",
        studentViewReleaseFlags: studentFlags
      })
    ).toBe("/recruiter/pipeline");
  });
});
