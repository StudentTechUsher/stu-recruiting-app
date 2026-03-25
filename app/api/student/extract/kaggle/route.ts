import { getAuthContext } from "@/lib/auth-context";
import { badRequest, forbidden, ok } from "@/lib/api-response";
import { hasPersona } from "@/lib/authorization";
import {
  extractArtifactsFromKaggle,
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

const normalizeKaggleUrl = (value: string): string | null => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.toLowerCase();
    if (!host.endsWith("kaggle.com")) return null;
    const [username] = parsed.pathname.split("/").filter(Boolean);
    if (!username) return null;
    return `https://www.kaggle.com/${username}`;
  } catch {
    return null;
  }
};

const mapKaggleExtractionError = (errorMessage: string): string => {
  if (errorMessage.includes("status_404")) return "source_not_found";
  if (
    errorMessage.includes("status_401") ||
    errorMessage.includes("status_403") ||
    errorMessage.includes("status_429")
  ) {
    return "source_private_or_inaccessible";
  }
  if (errorMessage.includes("status_5")) return "source_private_or_inaccessible";
  return "kaggle_extraction_failed";
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
  const urlNormalized = normalizeKaggleUrl(profileUrl);
  if (!urlNormalized) return badRequest("source_url_invalid_or_unsupported");

  try {
    await upsertStudentExtractionMetadata({
      supabase: extractionSupabase,
      profileId: context.user_id,
      sourceKey: "kaggle",
      extractedFrom: urlNormalized,
      artifactCount: 0,
      status: "extracting",
      profileLinks: {
        kaggle: urlNormalized
      }
    });
  } catch (metadataError) {
    console.error("Kaggle extraction start metadata update failed:", metadataError);
  }

  try {
    const extractedArtifacts = await extractArtifactsFromKaggle({
      profileUrl: urlNormalized
    });
    const persistedArtifacts = await persistExtractedArtifacts({
      supabase: extractionSupabase,
      profileId: context.user_id,
      artifacts: extractedArtifacts,
      sourceProvenance: {
        source: "kaggle_profile",
        identity_confidence: "high"
      }
    });
    const addedArtifacts = persistedArtifacts.length;
    const artifactLabel = addedArtifacts === 1 ? "artifact" : "artifacts";
    const resultSummary =
      addedArtifacts === 0
        ? "No new artifacts found. Your profile is already up to date."
        : `${addedArtifacts} new ${artifactLabel} added from Kaggle.`;

    await upsertStudentExtractionMetadata({
      supabase: extractionSupabase,
      profileId: context.user_id,
      sourceKey: "kaggle",
      extractedFrom: urlNormalized,
      artifactCount: addedArtifacts,
      status: "succeeded",
      identityConfidence: "high",
      resultSummary,
      profileLinks: {
        kaggle: urlNormalized
      }
    });

    return ok({
      resource: "artifacts_extraction",
      status: "success",
      data: {
        artifacts: persistedArtifacts,
        source_run: {
          source: "kaggle",
          identity_confidence: "high",
          warning_code: null,
          warning_message: null,
          result_summary: resultSummary,
          requires_confirmation: false
        }
      },
      session_source: context.session_source ?? "none"
    });
  } catch (error) {
    console.error("Kaggle extraction failed:", error);
    const errorMessage = error instanceof Error ? error.message : "kaggle_extraction_failed";
    const normalizedFailureCode = mapKaggleExtractionError(errorMessage);
    try {
      await upsertStudentExtractionMetadata({
        supabase: extractionSupabase,
        profileId: context.user_id,
        sourceKey: "kaggle",
        extractedFrom: urlNormalized,
        artifactCount: 0,
        status: "failed",
        errorMessage: normalizedFailureCode,
        profileLinks: {
          kaggle: urlNormalized
        }
      });
    } catch (metadataError) {
      console.error("Kaggle extraction failure metadata update failed:", metadataError);
    }
    return badRequest(normalizedFailureCode);
  }
}
