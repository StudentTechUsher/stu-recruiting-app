import { describe, expect, it } from "vitest";
import {
  extractTargetCompanyNames,
  extractTargetRoleNames,
  splitOnboardingPersistenceData
} from "@/lib/auth/onboarding-persistence";

describe("splitOnboardingPersistenceData", () => {
  it("splits core profile metadata and student-specific data", () => {
    const result = splitOnboardingPersistenceData({
      payload: {
        personal_info: {
          first_name: "Vin",
          last_name: "Jones",
          full_name: "Vin Jones",
          email: "payload@school.edu",
          major_track: "Information Systems",
          student_year: "Year 4",
          student_archetype: "builder",
          target_companies: ["Atlassian"],
          target_roles: ["Software Engineer"]
        }
      },
      existingProfilePersonalInfo: {
        nickname: "vj"
      },
      sessionEmail: "session@school.edu"
    });

    expect(result.profilePersonalInfo).toEqual({
      nickname: "vj",
      first_name: "Vin",
      last_name: "Jones",
      full_name: "Vin Jones",
      email: "session@school.edu"
    });

    expect(result.studentData).toEqual({
      major_track: "Information Systems",
      student_year: "Year 4",
      student_archetype: "builder",
      target_companies: ["Atlassian"],
      target_roles: ["Software Engineer"]
    });
  });

  it("preserves existing profile metadata when onboarding payload is missing", () => {
    const result = splitOnboardingPersistenceData({
      payload: {},
      existingProfilePersonalInfo: {
        first_name: "Existing",
        email: "existing@school.edu"
      },
      sessionEmail: null
    });

    expect(result.profilePersonalInfo).toEqual({
      first_name: "Existing",
      full_name: "Existing",
      email: "existing@school.edu"
    });
    expect(result.studentData).toEqual({});
  });

  it("extracts deduped target companies for company upsert", () => {
    expect(
      extractTargetCompanyNames({
        target_companies: ["Adobe", "  adobe ", "Qualtrics", "", "  ", 123]
      })
    ).toEqual(["Adobe", "Qualtrics"]);
  });

  it("extracts deduped target roles for role upsert", () => {
    expect(
      extractTargetRoleNames({
        target_roles: ["Data Analyst", " data analyst ", "Software Engineer", "", "  ", 123]
      })
    ).toEqual(["Data Analyst", "Software Engineer"]);
  });
});
