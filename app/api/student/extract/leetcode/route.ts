import { getAuthContext } from "@/lib/auth-context";
import { badRequest, forbidden, ok } from "@/lib/api-response";
import { hasPersona } from "@/lib/authorization";
import {
  extractArtifactsFromLeetcode,
  persistExtractedArtifacts,
  type SupabaseClientLike,
  upsertStudentExtractionMetadata
} from "@/lib/artifacts/extraction";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const toTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const normalizeLeetcodeUrl = (value: string): string | null => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.toLowerCase();
    if (!host.endsWith("leetcode.com")) return null;
    const segments = parsed.pathname.split("/").filter(Boolean);
    const username = segments[0] === "u" || segments[0] === "profile" ? segments[1] : segments[0];
    if (!username) return null;
    return `https://leetcode.com/u/${username}`;
  } catch {
    return null;
  }
};

const mapLeetcodeExtractionError = (errorMessage: string): string => {
  if (errorMessage.includes("status_404")) return "source_not_found";
  if (
    errorMessage.includes("status_401") ||
    errorMessage.includes("status_403") ||
    errorMessage.includes("status_429")
  ) {
    return "source_private_or_inaccessible";
  }
  if (errorMessage.includes("status_5")) return "source_private_or_inaccessible";
  return "leetcode_extraction_failed";
};

export async function POST(req: Request) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["student"])) return forbidden();

  const supabase = await getSupabaseServerClient();
  if (!supabase) return badRequest("supabase_unavailable");
  const extractionSupabase = supabase as unknown as SupabaseClientLike;

  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return badRequest("invalid_payload");

  const profileUrl = toTrimmedString(payload.profile_url);
  if (!profileUrl) return badRequest("profile_url_required");
  const urlNormalized = normalizeLeetcodeUrl(profileUrl);
  if (!urlNormalized) return badRequest("source_url_invalid_or_unsupported");
  const allowLowConfidence = payload.allow_low_confidence === true;
  const expectedStudentName =
    toTrimmedString(context.profile?.personal_info?.full_name) ??
    toTrimmedString(context.profile?.personal_info?.first_name) ??
    null;

  try {
    await upsertStudentExtractionMetadata({
      supabase: extractionSupabase,
      profileId: context.user_id,
      sourceKey: "leetcode",
      extractedFrom: urlNormalized,
      artifactCount: 0,
      status: "extracting",
      profileLinks: {
        leetcode: urlNormalized
      }
    });
  } catch (metadataError) {
    console.error("LeetCode extraction start metadata update failed:", metadataError);
  }

  try {
    const extractionRun = await extractArtifactsFromLeetcode({
      profileUrl: urlNormalized,
      expectedStudentName,
      allowLowConfidence
    });
    if (extractionRun.requiresConfirmation) {
      return ok({
        resource: "artifacts_extraction",
        status: "confirmation_required",
        data: {
          artifacts: [],
          source_run: {
            source: "leetcode",
            identity_confidence: extractionRun.confidence,
            warning_code: extractionRun.warningCode,
            warning_message: extractionRun.warningMessage,
            requires_confirmation: true
          }
        },
        session_source: context.session_source ?? "none"
      });
    }

    const persistedArtifacts = await persistExtractedArtifacts({
      supabase: extractionSupabase,
      profileId: context.user_id,
      artifacts: extractionRun.artifacts,
      sourceProvenance: {
        source: "leetcode_profile",
        identity_confidence: extractionRun.confidence,
        ...(extractionRun.warningCode ? { warning_code: extractionRun.warningCode } : {}),
        ...(extractionRun.warningMessage ? { warning_message: extractionRun.warningMessage } : {})
      }
    });
    const addedArtifacts = persistedArtifacts.length;
    const artifactLabel = addedArtifacts === 1 ? "artifact" : "artifacts";
    const resultSummary =
      addedArtifacts === 0
        ? "No new artifacts found. Your profile is already up to date."
        : `${addedArtifacts} new ${artifactLabel} added from LeetCode.`;

    await upsertStudentExtractionMetadata({
      supabase: extractionSupabase,
      profileId: context.user_id,
      sourceKey: "leetcode",
      extractedFrom: urlNormalized,
      artifactCount: addedArtifacts,
      status: "succeeded",
      identityConfidence: extractionRun.confidence,
      warningCode: extractionRun.warningCode,
      warningMessage: extractionRun.warningMessage,
      resultSummary,
      profileLinks: {
        leetcode: urlNormalized
      }
    });

    return ok({
      resource: "artifacts_extraction",
      status: "success",
      data: {
        artifacts: persistedArtifacts,
        source_run: {
          source: "leetcode",
          identity_confidence: extractionRun.confidence,
          warning_code: extractionRun.warningCode,
          warning_message: extractionRun.warningMessage,
          result_summary: resultSummary,
          requires_confirmation: false
        }
      },
      session_source: context.session_source ?? "none"
    });
  } catch (error) {
    console.error("LeetCode extraction failed:", error);
    const errorMessage = error instanceof Error ? error.message : "leetcode_extraction_failed";
    const normalizedFailureCode = mapLeetcodeExtractionError(errorMessage);
    try {
      await upsertStudentExtractionMetadata({
        supabase: extractionSupabase,
        profileId: context.user_id,
        sourceKey: "leetcode",
        extractedFrom: urlNormalized,
        artifactCount: 0,
        status: "failed",
        errorMessage: normalizedFailureCode,
        profileLinks: {
          leetcode: urlNormalized
        }
      });
    } catch (metadataError) {
      console.error("LeetCode extraction failure metadata update failed:", metadataError);
    }
    return badRequest(normalizedFailureCode);
  }
}
