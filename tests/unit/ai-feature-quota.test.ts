import { beforeEach, describe, expect, it } from "vitest";
import { consumeAIFeatureQuota, resetAIFeatureQuotaStateForTests } from "@/lib/ai/feature-quota";

describe("AI feature quota", () => {
  beforeEach(() => {
    resetAIFeatureQuotaStateForTests();
  });

  it("allows usage until max and then blocks", async () => {
    const first = await consumeAIFeatureQuota({
      userId: "user-1",
      featureKey: "guidance_message",
      maxUses: 2
    });
    const second = await consumeAIFeatureQuota({
      userId: "user-1",
      featureKey: "guidance_message",
      maxUses: 2
    });
    const third = await consumeAIFeatureQuota({
      userId: "user-1",
      featureKey: "guidance_message",
      maxUses: 2
    });

    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(1);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
    expect(third.used).toBe(2);
  });

  it("tracks quotas independently per feature and user", async () => {
    const userOneGuidance = await consumeAIFeatureQuota({
      userId: "user-1",
      featureKey: "guidance_message",
      maxUses: 1
    });
    const userOnePathway = await consumeAIFeatureQuota({
      userId: "user-1",
      featureKey: "pathway_plan",
      maxUses: 1
    });
    const userTwoGuidance = await consumeAIFeatureQuota({
      userId: "user-2",
      featureKey: "guidance_message",
      maxUses: 1
    });
    const userOneGuidanceBlocked = await consumeAIFeatureQuota({
      userId: "user-1",
      featureKey: "guidance_message",
      maxUses: 1
    });

    expect(userOneGuidance.allowed).toBe(true);
    expect(userOnePathway.allowed).toBe(true);
    expect(userTwoGuidance.allowed).toBe(true);
    expect(userOneGuidanceBlocked.allowed).toBe(false);
  });
});
