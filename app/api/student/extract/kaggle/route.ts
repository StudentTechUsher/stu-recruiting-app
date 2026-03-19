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
      artifacts: extractedArtifacts
    });

    await upsertStudentExtractionMetadata({
      supabase: extractionSupabase,
      profileId: context.user_id,
      sourceKey: "kaggle",
      extractedFrom: urlNormalized,
      artifactCount: persistedArtifacts.length,
      status: "succeeded",
      profileLinks: {
        kaggle: urlNormalized
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
    console.error("Kaggle extraction failed:", error);
    const errorMessage = error instanceof Error ? error.message : "kaggle_extraction_failed";
    try {
      await upsertStudentExtractionMetadata({
        supabase: extractionSupabase,
        profileId: context.user_id,
        sourceKey: "kaggle",
        extractedFrom: urlNormalized,
        artifactCount: 0,
        status: "failed",
        errorMessage,
        profileLinks: {
          kaggle: urlNormalized
        }
      });
    } catch (metadataError) {
      console.error("Kaggle extraction failure metadata update failed:", metadataError);
    }
    return badRequest("kaggle_extraction_failed");
  }
}
