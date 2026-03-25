import { getAuthContext } from "@/lib/auth-context";
import { StudentOnboardingClient } from "./StudentOnboardingClient";

const resolveCampusEmail = async (): Promise<string> => {
  const context = await getAuthContext();
  const sessionEmail = context.session_user?.email;
  if (typeof sessionEmail === "string" && sessionEmail.trim().length > 0) {
    return sessionEmail.trim();
  }

  const profileEmail = context.profile?.personal_info?.email;
  if (typeof profileEmail === "string" && profileEmail.trim().length > 0) {
    return profileEmail.trim();
  }

  return "";
};

export default async function StudentOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [defaultCampusEmail, resolvedSearchParams] = await Promise.all([resolveCampusEmail(), searchParams]);
  const claimStatusParam = resolvedSearchParams.claim_status;
  const claimStatus = typeof claimStatusParam === "string" ? claimStatusParam.trim() : null;

  return (
    <StudentOnboardingClient
      defaultCampusEmail={defaultCampusEmail}
      claimStatus={claimStatus}
    />
  );
}
