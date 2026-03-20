import type { ATSPipelineResult } from "@/lib/ats/types";
import { fetchBambooHRPipelineFromMock } from "./bamboohr";
import { fetchGreenhousePipeline } from "./greenhouse";
import { fetchLeverPipeline } from "./lever";
import { resolveATSProviderForOrg } from "./provider-config";

export async function fetchATSPipelineForOrg(
  orgId: string,
  opts: { page?: number; jobId?: string } = {}
): Promise<{ provider: "greenhouse" | "lever" | "bamboohr"; result: ATSPipelineResult }> {
  const resolved = await resolveATSProviderForOrg(orgId);

  if (resolved.provider === "greenhouse") {
    const result = await fetchGreenhousePipeline(orgId, {
      page: opts.page,
      jobId: opts.jobId,
    });
    return { provider: "greenhouse", result };
  }

  if (resolved.provider === "lever") {
    const result = await fetchLeverPipeline(orgId, {});
    return { provider: "lever", result };
  }

  const result = await fetchBambooHRPipelineFromMock({ page: opts.page });
  return { provider: "bamboohr", result };
}
