import { describe, expect, it } from "vitest";
import { parseOnboardingClientMetrics } from "@/lib/auth/onboarding-metrics";

describe("parseOnboardingClientMetrics", () => {
  it("parses valid onboarding metrics payload", () => {
    const metrics = parseOnboardingClientMetrics({
      onboarding_started_at: "2026-03-19T12:00:00.000Z",
      onboarding_submitted_at: "2026-03-19T12:00:45.000Z",
      onboarding_duration_ms: 45000
    });

    expect(metrics).toEqual({
      started_at: "2026-03-19T12:00:00.000Z",
      submitted_at: "2026-03-19T12:00:45.000Z",
      duration_ms: 45000
    });
  });

  it("derives duration when explicit duration is missing", () => {
    const metrics = parseOnboardingClientMetrics({
      started_at: "2026-03-19T12:00:00.000Z",
      submitted_at: "2026-03-19T12:01:00.000Z"
    });

    expect(metrics).toEqual({
      started_at: "2026-03-19T12:00:00.000Z",
      submitted_at: "2026-03-19T12:01:00.000Z",
      duration_ms: 60000
    });
  });

  it("returns null when payload is missing or malformed", () => {
    expect(parseOnboardingClientMetrics(null)).toBeNull();
    expect(parseOnboardingClientMetrics({ onboarding_started_at: "not-a-date", onboarding_duration_ms: "bad" })).toBeNull();
  });
});
