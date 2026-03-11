import { describe, expect, it } from "vitest";
import { assertOrgScope, assertRecruiterAssignment } from "@/lib/guards";

describe("guards", () => {
  it("enforces org scope", () => {
    expect(
      assertOrgScope({ authenticated: true, user_id: "u1", org_id: "org-a", persona: "student", assignment_ids: [] }, "org-a")
    ).toBe(true);
    expect(
      assertOrgScope({ authenticated: true, user_id: "u1", org_id: "org-a", persona: "student", assignment_ids: [] }, "org-b")
    ).toBe(false);
  });

  it("enforces recruiter assignment", () => {
    expect(
      assertRecruiterAssignment(
        { authenticated: true, user_id: "u2", org_id: "org-a", persona: "recruiter", assignment_ids: ["pos-1"] },
        "pos-1"
      )
    ).toBe(true);
    expect(
      assertRecruiterAssignment(
        { authenticated: true, user_id: "u2", org_id: "org-a", persona: "recruiter", assignment_ids: ["pos-1"] },
        "pos-2"
      )
    ).toBe(false);
  });
});
