import { createHash } from "node:crypto";
import {
  CAPABILITY_ONTOLOGY_VERSION,
  CAPABILITY_SCORING_VERSION,
  getCapabilityOntologyAxes,
} from "@/lib/capabilities/ontology";

type VerificationState = "verified" | "pending" | "unverified";

const contributionWeightByVerificationState: Record<VerificationState, number> = {
  verified: 1,
  pending: 0.65,
  unverified: 0.35,
};

const artifactTypeToCapabilities: Record<string, string[]> = {
  coursework: ["technical_depth", "data_management"],
  project: ["technical_depth", "systems_thinking", "execution_reliability"],
  internship: ["execution_reliability", "collaboration", "communication"],
  employment: ["execution_reliability", "collaboration", "leadership"],
  certification: ["technical_depth", "execution_reliability"],
  test: ["technical_depth", "execution_reliability"],
  leadership: ["leadership", "communication", "collaboration"],
  club: ["collaboration", "communication", "leadership"],
  competition: ["technical_depth", "research_methodology", "execution_reliability"],
  research: ["research_methodology", "technical_depth", "systems_thinking"],
};

type ArtifactInput = {
  artifact_id: string;
  artifact_type: string;
  artifact_data: Record<string, unknown>;
  updated_at: string | null;
};

export type CandidateCapabilityAxisScore = {
  axis_id: string;
  score_normalized: number;
  confidence: number;
  evidence_count: number;
  low_confidence: boolean;
  confidence_reason: string[];
  confidence_level: "low" | "medium" | "high";
  supporting_evidence_ids: string[];
};

export type CandidateCapabilitySnapshotResult = {
  snapshot_id: string | null;
  profile_id: string;
  state: "fresh" | "stale" | "recomputing" | "failed";
  input_state_hash: string;
  ontology_version: string;
  scoring_version: string;
  computed_at: string;
  axis_scores: CandidateCapabilityAxisScore[];
  persisted: boolean;
};

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

const toVerificationState = (value: unknown): VerificationState => {
  if (typeof value !== "string") return "unverified";
  const normalized = value.trim().toLowerCase();
  if (normalized === "verified" || normalized === "pending" || normalized === "unverified") {
    return normalized;
  }
  return "unverified";
};

const computeInputStateHash = ({
  profileId,
  artifacts,
}: {
  profileId: string;
  artifacts: ArtifactInput[];
}): string =>
  createHash("sha256")
    .update(
      [
        profileId,
        ...artifacts
          .map((artifact) => {
            const verification = toVerificationState(artifact.artifact_data.verification_status);
            const fingerprintSource =
              typeof artifact.artifact_data.content_hash === "string"
                ? artifact.artifact_data.content_hash
                : JSON.stringify(artifact.artifact_data);
            const fingerprint = createHash("sha256").update(fingerprintSource).digest("hex");
            return `${artifact.artifact_id}:${artifact.artifact_type}:${verification}:${artifact.updated_at ?? ""}:${fingerprint}`;
          })
          .sort(),
      ].join("|")
    )
    .digest("hex");

const deriveAxisScores = (artifacts: ArtifactInput[]): CandidateCapabilityAxisScore[] => {
  const ontologyAxes = getCapabilityOntologyAxes().filter((axis) => axis.is_active);
  const axisMap = new Map<
    string,
    {
      score: number;
      evidenceIds: Set<string>;
      breakdown: Record<VerificationState, number>;
    }
  >();
  for (const axis of ontologyAxes) {
    axisMap.set(axis.axis_id, {
      score: 0,
      evidenceIds: new Set<string>(),
      breakdown: { verified: 0, pending: 0, unverified: 0 },
    });
  }

  for (const artifact of artifacts) {
    const mappedAxes = artifactTypeToCapabilities[artifact.artifact_type] ?? [];
    if (mappedAxes.length === 0) continue;
    const verification = toVerificationState(artifact.artifact_data.verification_status);
    const contribution = contributionWeightByVerificationState[verification];
    for (const axisId of mappedAxes) {
      const current = axisMap.get(axisId);
      if (!current) continue;
      current.score = clamp01(current.score + contribution);
      current.evidenceIds.add(artifact.artifact_id);
      current.breakdown[verification] += 1;
    }
  }

  return Array.from(axisMap.entries()).map(([axisId, value]) => {
    const evidenceCount = value.evidenceIds.size;
    const verifiedRatio = evidenceCount > 0 ? value.breakdown.verified / evidenceCount : 0;
    const confidence = clamp01(evidenceCount === 0 ? 0 : 0.35 + Math.min(evidenceCount, 4) * 0.1 + verifiedRatio * 0.25);
    const lowConfidence = confidence < 0.6 || evidenceCount < 2;
    const confidenceReason: string[] = [];
    if (confidence < 0.6) confidenceReason.push("confidence_below_threshold");
    if (evidenceCount < 2) confidenceReason.push("insufficient_evidence_count");

    return {
      axis_id: axisId,
      score_normalized: clamp01(value.score),
      confidence,
      evidence_count: evidenceCount,
      low_confidence: lowConfidence,
      confidence_reason: confidenceReason,
      confidence_level: lowConfidence ? "low" : confidence < 0.8 ? "medium" : "high",
      supporting_evidence_ids: Array.from(value.evidenceIds.values()),
    };
  });
};

const isMissingTableError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return code === "PGRST205" || code === "42P01";
};

type SupabaseClientLike = {
  from: (table: string) => any;
};

export const materializeCandidateCapabilitySnapshot = async ({
  supabase,
  profileId,
  artifacts,
}: {
  supabase: SupabaseClientLike | null;
  profileId: string;
  artifacts: ArtifactInput[];
}): Promise<CandidateCapabilitySnapshotResult> => {
  const ontologyVersion = CAPABILITY_ONTOLOGY_VERSION;
  const scoringVersion = CAPABILITY_SCORING_VERSION;
  const inputStateHash = computeInputStateHash({
    profileId,
    artifacts,
  });
  const computedAt = new Date().toISOString();
  const derivedAxisScores = deriveAxisScores(artifacts);

  if (!supabase) {
    return {
      snapshot_id: null,
      profile_id: profileId,
      state: "fresh",
      input_state_hash: inputStateHash,
      ontology_version: ontologyVersion,
      scoring_version: scoringVersion,
      computed_at: computedAt,
      axis_scores: derivedAxisScores,
      persisted: false,
    };
  }
  const headsProbe = supabase.from("candidate_capability_profile_heads");
  if (!headsProbe || typeof headsProbe.select !== "function") {
    return {
      snapshot_id: null,
      profile_id: profileId,
      state: "fresh",
      input_state_hash: inputStateHash,
      ontology_version: ontologyVersion,
      scoring_version: scoringVersion,
      computed_at: computedAt,
      axis_scores: derivedAxisScores,
      persisted: false,
    };
  }

  try {
    const { data: existingHead, error: existingHeadError } = (await supabase
      .from("candidate_capability_profile_heads")
      .select("profile_id, state, latest_snapshot_id, latest_input_state_hash, latest_ontology_version, latest_scoring_version")
      .eq("profile_id", profileId)
      .limit(1)
      .single()) as {
      data: {
        profile_id: string;
        state: "fresh" | "stale" | "recomputing" | "failed";
        latest_snapshot_id: string | null;
        latest_input_state_hash: string | null;
        latest_ontology_version: string | null;
        latest_scoring_version: string | null;
      } | null;
      error: unknown;
    };

    if (
      !existingHeadError &&
      existingHead?.latest_snapshot_id &&
      existingHead.latest_input_state_hash === inputStateHash &&
      existingHead.latest_ontology_version === ontologyVersion &&
      existingHead.latest_scoring_version === scoringVersion &&
      existingHead.state === "fresh"
    ) {
      const { data: existingScores } = (await supabase
        .from("candidate_capability_profile_axis_scores")
        .select(
          "axis_id, score_normalized, confidence, evidence_count, low_confidence, confidence_reason, confidence_level"
        )
        .eq("snapshot_id", existingHead.latest_snapshot_id)) as {
        data: Array<{
          axis_id: string;
          score_normalized: number;
          confidence: number;
          evidence_count: number;
          low_confidence: boolean;
          confidence_reason: string[] | null;
          confidence_level: "low" | "medium" | "high";
        }> | null;
      };

      if (existingScores && existingScores.length > 0) {
        return {
          snapshot_id: existingHead.latest_snapshot_id,
          profile_id: profileId,
          state: "fresh",
          input_state_hash: inputStateHash,
          ontology_version: ontologyVersion,
          scoring_version: scoringVersion,
          computed_at: computedAt,
          axis_scores: existingScores.map((score) => ({
            axis_id: score.axis_id,
            score_normalized: clamp01(score.score_normalized),
            confidence: clamp01(score.confidence),
            evidence_count: Math.max(score.evidence_count, 0),
            low_confidence: Boolean(score.low_confidence),
            confidence_reason: score.confidence_reason ?? [],
            confidence_level: score.confidence_level,
            supporting_evidence_ids: [],
          })),
          persisted: true,
        };
      }
    }

    await supabase.from("candidate_capability_profile_heads").upsert(
      {
        profile_id: profileId,
        state: "recomputing",
        stale_since: computedAt,
        latest_input_state_hash: inputStateHash,
        latest_ontology_version: ontologyVersion,
        latest_scoring_version: scoringVersion,
      },
      { onConflict: "profile_id" }
    );

    try {
      await supabase.from("candidate_capability_profile_recompute_jobs").insert({
        profile_id: profileId,
        ontology_version: ontologyVersion,
        scoring_version: scoringVersion,
        input_state_hash: inputStateHash,
        status: "queued",
      });
    } catch {
      // Best-effort enqueue for observability; snapshot write remains authoritative.
    }

    const { data: insertedSnapshot, error: snapshotInsertError } = (await supabase
      .from("candidate_capability_profile_snapshots")
      .insert({
        profile_id: profileId,
        ontology_version: ontologyVersion,
        scoring_version: scoringVersion,
        input_state_hash: inputStateHash,
        computed_at: computedAt,
      })
      .select("snapshot_id")
      .limit(1)
      .single()) as { data: { snapshot_id: string } | null; error: unknown };

    if (snapshotInsertError || !insertedSnapshot?.snapshot_id) {
      throw snapshotInsertError ?? new Error("candidate_capability_snapshot_insert_failed");
    }

    const snapshotId = insertedSnapshot.snapshot_id;
    const axisRows = derivedAxisScores.map((axis) => ({
      snapshot_id: snapshotId,
      axis_id: axis.axis_id,
      score_normalized: axis.score_normalized,
      confidence: axis.confidence,
      evidence_count: axis.evidence_count,
      low_confidence: axis.low_confidence,
      confidence_reason: axis.confidence_reason,
      confidence_level: axis.confidence_level,
    }));
    if (axisRows.length > 0) {
      await supabase.from("candidate_capability_profile_axis_scores").insert(axisRows);
    }

    const evidenceLinks = derivedAxisScores.flatMap((axis) =>
      axis.supporting_evidence_ids.map((artifactId) => ({
        snapshot_id: snapshotId,
        axis_id: axis.axis_id,
        artifact_id: artifactId,
        link_reason: "artifact_type_mapping",
      }))
    );
    if (evidenceLinks.length > 0) {
      await supabase.from("candidate_capability_profile_axis_evidence_links").insert(evidenceLinks);
    }

    await supabase
      .from("candidate_capability_profile_heads")
      .update({
        state: "fresh",
        latest_snapshot_id: snapshotId,
        last_fresh_snapshot_id: snapshotId,
        latest_input_state_hash: inputStateHash,
        latest_ontology_version: ontologyVersion,
        latest_scoring_version: scoringVersion,
        stale_since: null,
        last_error_code: null,
        last_error_message: null,
      })
      .eq("profile_id", profileId);

    await supabase
      .from("candidate_capability_profile_recompute_jobs")
      .update({
        status: "succeeded",
        started_at: computedAt,
        finished_at: new Date().toISOString(),
        attempt_count: 1,
      })
      .eq("profile_id", profileId)
      .eq("ontology_version", ontologyVersion)
      .eq("scoring_version", scoringVersion)
      .eq("input_state_hash", inputStateHash)
      .in("status", ["queued", "running"]);

    return {
      snapshot_id: snapshotId,
      profile_id: profileId,
      state: "fresh",
      input_state_hash: inputStateHash,
      ontology_version: ontologyVersion,
      scoring_version: scoringVersion,
      computed_at: computedAt,
      axis_scores: derivedAxisScores,
      persisted: true,
    };
  } catch (error) {
    if (!isMissingTableError(error)) {
      const headsClient = supabase.from("candidate_capability_profile_heads");
      if (headsClient && typeof headsClient.upsert === "function") {
        try {
          await headsClient.upsert(
            {
              profile_id: profileId,
              state: "failed",
              latest_input_state_hash: inputStateHash,
              latest_ontology_version: ontologyVersion,
              latest_scoring_version: scoringVersion,
              stale_since: computedAt,
              last_error_code: "recompute_failed",
              last_error_message: error instanceof Error ? error.message : "unknown_error",
            },
            { onConflict: "profile_id" }
          );
        } catch {
          // Preserve original failure path even if failed-state write cannot be persisted.
        }
      }
    }
    return {
      snapshot_id: null,
      profile_id: profileId,
      state: "failed",
      input_state_hash: inputStateHash,
      ontology_version: ontologyVersion,
      scoring_version: scoringVersion,
      computed_at: computedAt,
      axis_scores: derivedAxisScores,
      persisted: false,
    };
  }
};
