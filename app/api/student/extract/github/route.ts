import { getAuthContext } from "@/lib/auth-context";
import { badRequest, forbidden, ok } from "@/lib/api-response";
import { hasPersona } from "@/lib/authorization";
import {
  extractArtifactsFromGithub,
  persistExtractedArtifacts,
  type SupabaseClientLike,
  upsertStudentExtractionMetadata
} from "@/lib/artifacts/extraction";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const toRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

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

  const githubUsername = payload.github_username;
  if (!githubUsername || typeof githubUsername !== "string") return badRequest("github_username_required");

  const usernameNormalized = githubUsername.trim();
  const githubUrl = `https://github.com/${usernameNormalized}`;
  const expectedStudentName =
    toTrimmedString(context.profile?.personal_info?.full_name) ??
    toTrimmedString(context.profile?.personal_info?.first_name) ??
    null;

  const { data: studentRows } = await supabase
    .from("students")
    .select("student_data")
    .eq("profile_id", context.user_id)
    .limit(1);
  const studentData = toRecord((studentRows as Array<{ student_data: unknown }> | null)?.[0]?.student_data);
  const profileLinks = toRecord(studentData.profile_links);
  const linkedInProfileUrl = toTrimmedString(profileLinks.linkedin);
  if (!linkedInProfileUrl) return badRequest("github_linkedin_profile_required");

  try {
    await upsertStudentExtractionMetadata({
      supabase: extractionSupabase,
      profileId: context.user_id,
      sourceKey: "github",
      extractedFrom: githubUrl,
      artifactCount: 0,
      status: "extracting",
      profileLinks: {
        github: githubUrl
      }
    });
  } catch (metadataError) {
    console.error("Github extraction start metadata update failed:", metadataError);
  }

  try {
    const extractedArtifacts = await extractArtifactsFromGithub({
      githubUsername: usernameNormalized,
      expectedStudentName,
      requiredLinkedinUrl: linkedInProfileUrl
    });
    const persistedArtifacts = await persistExtractedArtifacts({
      supabase: extractionSupabase,
      profileId: context.user_id,
      artifacts: extractedArtifacts
    });

    await upsertStudentExtractionMetadata({
      supabase: extractionSupabase,
      profileId: context.user_id,
      sourceKey: "github",
      extractedFrom: githubUrl,
      artifactCount: persistedArtifacts.length,
      status: "succeeded",
      profileLinks: {
        github: githubUrl
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
    console.error("Github extraction failed:", error);
    const errorMessage = error instanceof Error ? error.message : "github_extraction_failed";
    try {
      await upsertStudentExtractionMetadata({
        supabase: extractionSupabase,
        profileId: context.user_id,
        sourceKey: "github",
        extractedFrom: githubUrl,
        artifactCount: 0,
        status: "failed",
        errorMessage,
        profileLinks: {
          github: githubUrl
        }
      });
    } catch (metadataError) {
      console.error("Github extraction failure metadata update failed:", metadataError);
    }
    if (
      errorMessage === "github_linkedin_profile_required" ||
      errorMessage === "github_linkedin_link_required" ||
      errorMessage === "github_profile_name_mismatch"
    ) {
      return badRequest(errorMessage);
    }
    return badRequest("github_extraction_failed");
  }
}
