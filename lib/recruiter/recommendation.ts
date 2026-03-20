import type {
  RecommendationReasonCode,
  RecommendationState,
  NormalizedATSCandidate,
} from "@/lib/ats/types";

type ScorecardSignal = {
  recommendation: string | null;
};

export type RecommendationEvaluation = {
  state: RecommendationState;
  reasonCode: RecommendationReasonCode;
};

const normalizeSignal = (value: string | null): string => {
  return (value ?? "").trim().toLowerCase();
};

const isNegativeStage = (stage: string | null): boolean => {
  const normalized = (stage ?? "").toLowerCase();
  return (
    normalized.includes("rejected") ||
    normalized.includes("declined") ||
    normalized.includes("withdraw")
  );
};

export function evaluateRecommendation(
  candidate: NormalizedATSCandidate,
  scorecards: ScorecardSignal[]
): RecommendationEvaluation {
  if (candidate.status === "hired") {
    return { state: "hold", reasonCode: "ATS_HIRED" };
  }

  if (candidate.status === "rejected" || isNegativeStage(candidate.current_stage)) {
    return { state: "hold", reasonCode: "ATS_REJECTED" };
  }

  const recommendations = scorecards
    .map((item) => normalizeSignal(item.recommendation))
    .filter((item) => item.length > 0);

  if (recommendations.length === 0) {
    return { state: "manual_review", reasonCode: "ATS_WITHOUT_SCORECARD" };
  }

  const positiveCount = recommendations.filter((value) => {
    return value === "yes" || value === "strong_yes" || value === "hire";
  }).length;

  const negativeCount = recommendations.filter((value) => {
    return value === "no" || value === "strong_no" || value === "not_recommended";
  }).length;

  const mixedCount = recommendations.filter((value) => value === "mixed").length;

  if (negativeCount > 0 && positiveCount > 0) {
    return { state: "manual_review", reasonCode: "ATS_SCORECARD_MIXED" };
  }

  if (negativeCount > 0 || mixedCount > 0) {
    return { state: "manual_review", reasonCode: "ATS_SCORECARD_NEGATIVE" };
  }

  if (positiveCount > 0) {
    return { state: "recommended", reasonCode: "RANKED_NORMAL" };
  }

  return { state: "manual_review", reasonCode: "ATS_WITHOUT_SCORECARD" };
}
