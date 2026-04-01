import { sendEmailViaResend } from "@/lib/mailer/resend";

const defaultCapabilityProfileRequestRecipient = "vin@stuplanning.com";

const normalizeEnvValue = (value: string | undefined): string | null => {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
};

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export type CapabilityProfileRequestAlertInput = {
  candidateProfileId: string;
  candidateEmail: string | null;
  companyId: string | null;
  companyLabel: string;
  roleId: string | null;
  roleLabel: string;
  requestKey: string;
  submittedAt: string;
  sourceMode: "role_first" | "employer_first";
};

export const getCapabilityProfileRequestRecipient = (): string =>
  normalizeEnvValue(process.env.CAPABILITY_PROFILE_REQUEST_TO) ?? defaultCapabilityProfileRequestRecipient;

export async function sendCapabilityProfileRequestAlert(
  input: CapabilityProfileRequestAlertInput
): Promise<{ messageId: string }> {
  const recipient = getCapabilityProfileRequestRecipient();
  const companyLabel = asTrimmedString(input.companyLabel) ?? "Unknown company";
  const roleLabel = asTrimmedString(input.roleLabel) ?? "Unknown role";
  const submittedAtLabel = new Date(input.submittedAt).toUTCString();

  const subject = `[Stu Recruiting] Capability profile request: ${roleLabel} @ ${companyLabel}`;
  const text = [
    "A candidate requested a missing company-role capability profile.",
    "",
    `Candidate profile ID: ${input.candidateProfileId}`,
    `Candidate email: ${input.candidateEmail ?? "unknown"}`,
    `Company: ${companyLabel}`,
    `Company ID: ${input.companyId ?? "unknown"}`,
    `Role: ${roleLabel}`,
    `Role ID: ${input.roleId ?? "unknown"}`,
    `Selection mode: ${input.sourceMode}`,
    `Request key: ${input.requestKey}`,
    `Submitted at (UTC): ${submittedAtLabel}`,
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; color: #0a1f1a; line-height: 1.5;">
      <p style="margin: 0 0 12px; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #476a5d;">
        Stu capability profile request
      </p>
      <h1 style="margin: 0 0 14px; font-size: 22px;">Missing company-role capability profile requested</h1>
      <div style="margin: 0 0 16px; padding: 14px; border: 1px solid #d2dfd9; border-radius: 12px; background: #f8fcfa;">
        <p style="margin: 0 0 6px;"><strong>Candidate profile ID:</strong> ${escapeHtml(input.candidateProfileId)}</p>
        <p style="margin: 0 0 6px;"><strong>Candidate email:</strong> ${escapeHtml(input.candidateEmail ?? "unknown")}</p>
        <p style="margin: 0 0 6px;"><strong>Company:</strong> ${escapeHtml(companyLabel)}</p>
        <p style="margin: 0 0 6px;"><strong>Company ID:</strong> ${escapeHtml(input.companyId ?? "unknown")}</p>
        <p style="margin: 0 0 6px;"><strong>Role:</strong> ${escapeHtml(roleLabel)}</p>
        <p style="margin: 0 0 6px;"><strong>Role ID:</strong> ${escapeHtml(input.roleId ?? "unknown")}</p>
        <p style="margin: 0 0 6px;"><strong>Selection mode:</strong> ${escapeHtml(input.sourceMode)}</p>
        <p style="margin: 0 0 6px;"><strong>Request key:</strong> ${escapeHtml(input.requestKey)}</p>
        <p style="margin: 0;"><strong>Submitted at (UTC):</strong> ${escapeHtml(submittedAtLabel)}</p>
      </div>
      <p style="margin: 0;">Action needed: verify whether this capability profile exists and add it if feasible.</p>
    </div>
  `.trim();

  const sent = await sendEmailViaResend({
    to: recipient,
    subject,
    text,
    html,
    idempotencyKey: `capability-profile-request-${input.requestKey}`,
    tags: [
      { name: "workflow", value: "capability-profile-request" },
      { name: "candidate_profile_id", value: input.candidateProfileId.slice(0, 64) },
    ],
  });

  return { messageId: sent.id ?? "unknown" };
}
