import { getAuthContext } from "@/lib/auth-context";
import { ReferrerOnboardingClient } from "./ReferrerOnboardingClient";

const asTrimmedString = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim();
};

export default async function ReferrerOnboardingPage() {
  const context = await getAuthContext();
  const personalInfo = context.profile?.personal_info ?? {};
  const defaultEmail = asTrimmedString(context.session_user?.email) || asTrimmedString(personalInfo.email);
  const defaultFullName =
    asTrimmedString(personalInfo.full_name) ||
    [asTrimmedString(personalInfo.first_name), asTrimmedString(personalInfo.last_name)].filter(Boolean).join(" ");

  return <ReferrerOnboardingClient defaultEmail={defaultEmail} defaultFullName={defaultFullName} />;
}
