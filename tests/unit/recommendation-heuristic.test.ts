import { describe, expect, it } from "vitest";
import { evaluateRecommendation } from "@/lib/recruiter/recommendation";
import type { NormalizedATSCandidate } from "@/lib/ats/types";

const baseCandidate: NormalizedATSCandidate = {
  ats_id: "app-1",
  ats_source: "greenhouse",
  full_name: "Test Candidate",
  email: "candidate@example.com",
  current_stage: "Phone Screen",
  applied_at: "2026-03-01T00:00:00Z",
  job_title: "Data Analyst",
  job_id: "job-1",
  status: "active",
  profile_url: null,
  tags: [],
  raw: {},
};

describe("evaluateRecommendation", () => {
  it("returns hold for hired candidates", () => {
    const result = evaluateRecommendation({ ...baseCandidate, status: "hired" }, []);
    expect(result).toEqual({ state: "hold", reasonCode: "ATS_HIRED" });
  });

  it("returns hold for rejected candidates", () => {
    const result = evaluateRecommendation({ ...baseCandidate, status: "rejected" }, []);
    expect(result).toEqual({ state: "hold", reasonCode: "ATS_REJECTED" });
  });

  it("returns manual_review when scorecards are missing", () => {
    const result = evaluateRecommendation(baseCandidate, []);
    expect(result).toEqual({ state: "manual_review", reasonCode: "ATS_WITHOUT_SCORECARD" });
  });

  it("returns recommended for positive scorecards", () => {
    const result = evaluateRecommendation(baseCandidate, [{ recommendation: "yes" }, { recommendation: "strong_yes" }]);
    expect(result).toEqual({ state: "recommended", reasonCode: "RANKED_NORMAL" });
  });

  it("returns manual_review for mixed scorecards", () => {
    const result = evaluateRecommendation(baseCandidate, [{ recommendation: "yes" }, { recommendation: "no" }]);
    expect(result).toEqual({ state: "manual_review", reasonCode: "ATS_SCORECARD_MIXED" });
  });

  it("returns manual_review for negative scorecards", () => {
    const result = evaluateRecommendation(baseCandidate, [{ recommendation: "no" }]);
    expect(result).toEqual({ state: "manual_review", reasonCode: "ATS_SCORECARD_NEGATIVE" });
  });
});
