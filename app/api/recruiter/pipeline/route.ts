import { getAuthContext } from "@/lib/auth-context";
import { forbidden, ok, badRequest } from "@/lib/api-response";
import { hasPersona } from "@/lib/authorization";
import { ATSProviderResolutionError } from "@/lib/ats/provider-config";
import { getRecruiterCandidateDiscovery } from "@/lib/recruiter/candidate-discovery";

export async function GET() {
  const context = await getAuthContext();
  if (!hasPersona(context, ["recruiter", "org_admin"])) return forbidden();

  try {
    const discovery = await getRecruiterCandidateDiscovery(context.org_id, context.user_id, {
      page: 1,
      pageSize: 25,
    });

    return ok({
      provider: discovery.provider,
      summary: discovery.summary,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof ATSProviderResolutionError) {
      const message =
        error.code === "provider_conflict"
          ? "Multiple ATS providers are enabled for this org"
          : "No ATS provider configured";
      return badRequest(message);
    }

    throw error;
  }
}
