import { getAuthContext } from "@/lib/auth-context";
import { badRequest, forbidden, ok } from "@/lib/api-response";
import { hasPersona } from "@/lib/authorization";
import {
  extractArtifactsFromLinkedin,
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

export async function POST(req: Request) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["student"])) return forbidden();

  const supabase = await getSupabaseServerClient();
  if (!supabase) return badRequest("supabase_unavailable");
  const extractionSupabase = supabase as unknown as SupabaseClientLike;

  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return badRequest("invalid_payload");

  const profileUrl = payload.profile_url;
  if (!profileUrl || typeof profileUrl !== "string") return badRequest("profile_url_required");

  const urlNormalized = profileUrl.trim();
  const expectedStudentName =
    toTrimmedString(context.profile?.personal_info?.full_name) ??
    toTrimmedString(context.profile?.personal_info?.first_name) ??
    null;

  try {
    await upsertStudentExtractionMetadata({
      supabase: extractionSupabase,
      profileId: context.user_id,
      sourceKey: "linkedin",
      extractedFrom: urlNormalized,
      artifactCount: 0,
      status: "extracting",
      profileLinks: {
        linkedin: urlNormalized
      }
    });
  } catch (metadataError) {
    console.error("LinkedIn extraction start metadata update failed:", metadataError);
  }

  try {
    const extractedArtifacts = await extractArtifactsFromLinkedin({
      profileUrl: urlNormalized,
      expectedStudentName
    });
    const persistedArtifacts = await persistExtractedArtifacts({
      supabase: extractionSupabase,
      profileId: context.user_id,
      artifacts: extractedArtifacts
    });

    await upsertStudentExtractionMetadata({
      supabase: extractionSupabase,
      profileId: context.user_id,
      sourceKey: "linkedin",
      extractedFrom: urlNormalized,
      artifactCount: persistedArtifacts.length,
      status: "succeeded",
      profileLinks: {
        linkedin: urlNormalized
      }
    });

    return ok({
      resource: "artifacts_extraction",
      status: "success",
      data: {
        artifacts: persistedArtifacts
      },
      session_source: context.session_source ?? "none"
    });
  } catch (error) {
    console.error("Profile extraction failed:", error);
    const errorMessage = error instanceof Error ? error.message : "linkedin_extraction_failed";
    try {
      await upsertStudentExtractionMetadata({
        supabase: extractionSupabase,
        profileId: context.user_id,
        sourceKey: "linkedin",
        extractedFrom: urlNormalized,
        artifactCount: 0,
        status: "failed",
        errorMessage,
        profileLinks: {
          linkedin: urlNormalized
        }
      });
    } catch (metadataError) {
      console.error("LinkedIn extraction failure metadata update failed:", metadataError);
    }
    if (errorMessage === "linkedin_profile_name_mismatch") {
      return badRequest(errorMessage);
    }
    return badRequest("profile_extraction_failed");
  }
}
