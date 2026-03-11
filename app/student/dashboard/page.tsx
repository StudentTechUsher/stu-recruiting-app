import { AppNavigationShell } from "@/components/AppNavigationShell";
import { StudentDashboardCapabilityOverview } from "@/components/mock/StudentDashboardCapabilityOverview/StudentDashboardCapabilityOverview";
import { getAuthContext } from "@/lib/auth-context";

const extractFirstToken = (value: string): string => {
  return value.trim().split(/\s+/).filter(Boolean)[0] ?? "";
};

const toMetadataString = (metadata: Record<string, unknown>, key: string): string => {
  const value = metadata[key];
  return typeof value === "string" ? value.trim() : "";
};

const resolveFirstNameFromContext = async () => {
  const context = await getAuthContext();
  const profileInfo = context.profile?.personal_info ?? {};
  const profileFullName = toMetadataString(profileInfo, "full_name");
  const sessionUser = context.session_user;

  if (!sessionUser) {
    return (
      toMetadataString(profileInfo, "first_name") ||
      toMetadataString(profileInfo, "given_name") ||
      extractFirstToken(profileFullName) ||
      "Vin"
    );
  }

  const userMetadata = sessionUser.user_metadata ?? {};
  const appMetadata = sessionUser.app_metadata ?? {};
  const fullName = toMetadataString(userMetadata, "full_name");
  const emailLocalPart = sessionUser.email?.split("@")[0] ?? "";

  const candidates = [
    toMetadataString(profileInfo, "first_name"),
    toMetadataString(profileInfo, "given_name"),
    extractFirstToken(profileFullName),
    toMetadataString(userMetadata, "first_name"),
    toMetadataString(userMetadata, "given_name"),
    extractFirstToken(fullName),
    toMetadataString(appMetadata, "first_name"),
    extractFirstToken(emailLocalPart.replace(/[._-]+/g, " "))
  ];

  return candidates.find((candidate) => candidate.length > 0) ?? "Vin";
};

export default async function StudentDashboardPage() {
  const firstName = await resolveFirstNameFromContext();

  return (
    <AppNavigationShell audience="student">
      <main className="min-h-screen text-[#0a1f1a] dark:text-slate-100">
        <StudentDashboardCapabilityOverview scenario="in-progress" firstName={firstName} />
      </main>
    </AppNavigationShell>
  );
}
