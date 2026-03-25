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

const githubUsernamePattern = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i;

const mapGithubExtractionError = (errorMessage: string): string => {
  if (errorMessage.includes("github_fetch_failed:404")) return "source_not_found";
  if (
    errorMessage.includes("github_fetch_failed:401") ||
    errorMessage.includes("github_fetch_failed:403") ||
    errorMessage.includes("github_fetch_failed:429")
  ) {
    return "source_private_or_inaccessible";
  }
  if (errorMessage.includes("github_fetch_failed:5")) return "source_private_or_inaccessible";
  return "github_extraction_failed";
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
  if (!githubUsernamePattern.test(usernameNormalized)) return badRequest("source_url_invalid_or_unsupported");
  const githubUrl = `https://github.com/${usernameNormalized}`;
  const allowLowConfidence = payload.allow_low_confidence === true;
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
  const artifactProfileLinks = toRecord(studentData.artifact_profile_links);
  const linkedInProfileUrl = toTrimmedString(profileLinks.linkedin) ?? toTrimmedString(artifactProfileLinks.linkedin);

  try {
    const extractionRun = await extractArtifactsFromGithub({
      githubUsername: usernameNormalized,
      expectedStudentName,
      requiredLinkedinUrl: linkedInProfileUrl,
      allowLowConfidence
    });
    if (extractionRun.requiresConfirmation) {
      return ok({
        resource: "artifacts_extraction",
        status: "confirmation_required",
        data: {
          artifacts: [],
          source_run: {
            source: "github",
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
        source: "github_profile",
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
        : `${addedArtifacts} new ${artifactLabel} added from GitHub.`;

    await upsertStudentExtractionMetadata({
      supabase: extractionSupabase,
      profileId: context.user_id,
      sourceKey: "github",
      extractedFrom: githubUrl,
      artifactCount: addedArtifacts,
      status: "succeeded",
      identityConfidence: extractionRun.confidence,
      warningCode: extractionRun.warningCode,
      warningMessage: extractionRun.warningMessage,
      resultSummary,
      profileLinks: {
        github: githubUrl
      }
    });

    return ok({
      resource: "artifacts_extraction",
      status: "success",
      data: {
        artifacts: persistedArtifacts,
        source_run: {
          source: "github",
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
    console.error("Github extraction failed:", error);
    const errorMessage = error instanceof Error ? error.message : "github_extraction_failed";
    const normalizedFailureCode = mapGithubExtractionError(errorMessage);
    try {
      await upsertStudentExtractionMetadata({
        supabase: extractionSupabase,
        profileId: context.user_id,
        sourceKey: "github",
        extractedFrom: githubUrl,
        artifactCount: 0,
        status: "failed",
        errorMessage: normalizedFailureCode,
        profileLinks: {
          github: githubUrl
        }
      });
    } catch (metadataError) {
      console.error("Github extraction failure metadata update failed:", metadataError);
    }
    return badRequest(normalizedFailureCode);
  }
}
