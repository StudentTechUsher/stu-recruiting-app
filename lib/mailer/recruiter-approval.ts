import { sendEmailViaResend } from "@/lib/mailer/resend";

type RecruiterApprovalEmailInput = {
  recruiterEmail: string;
  recruiterProfileId: string;
  approveUrl: string;
  notificationTo?: string;
  requestedAt?: string;
};

const normalizeEnvValue = (value: string | undefined) => {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const formatRequestedAt = (requestedAt: string) => {
  const parsed = new Date(requestedAt);
  if (Number.isNaN(parsed.getTime())) return requestedAt;
  return parsed.toUTCString();
};

export function getRecruiterApprovalNotificationRecipient() {
  return normalizeEnvValue(process.env.RECRUITER_APPROVAL_NOTIFICATION_TO);
}

export function buildRecruiterApprovalRequestEmail({
  recruiterEmail,
  recruiterProfileId,
  approveUrl,
  requestedAt
}: Omit<RecruiterApprovalEmailInput, "notificationTo">) {
  const requestedAtLabel = requestedAt ? formatRequestedAt(requestedAt) : new Date().toUTCString();
  const subject = `Recruiter approval request: ${recruiterEmail}`;
  const safeRecruiterEmail = escapeHtml(recruiterEmail);
  const safeRecruiterProfileId = escapeHtml(recruiterProfileId);
  const safeApproveUrl = escapeHtml(approveUrl);

  return {
    subject,
    text: [
      "A recruiter needs approval before accessing Stu.",
      "",
      `Recruiter email: ${recruiterEmail}`,
      `Profile ID: ${recruiterProfileId}`,
      `Requested at: ${requestedAtLabel}`,
      "",
      `Approve recruiter: ${approveUrl}`
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; color: #0a1f1a; line-height: 1.5;">
        <p style="margin: 0 0 16px; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #476a5d;">
          Stu recruiter approval
        </p>
        <h1 style="margin: 0 0 16px; font-size: 24px;">A recruiter needs approval</h1>
        <p style="margin: 0 0 16px;">Approve this recruiter only if their employer is an active paying customer.</p>
        <div style="margin: 0 0 20px; padding: 16px; border: 1px solid #d2dfd9; border-radius: 16px; background: #f8fcfa;">
          <p style="margin: 0 0 8px;"><strong>Recruiter email:</strong> ${safeRecruiterEmail}</p>
          <p style="margin: 0 0 8px;"><strong>Profile ID:</strong> ${safeRecruiterProfileId}</p>
          <p style="margin: 0;"><strong>Requested at:</strong> ${escapeHtml(requestedAtLabel)}</p>
        </div>
        <p style="margin: 0 0 24px;">
          <a
            href="${safeApproveUrl}"
            style="display: inline-block; padding: 12px 18px; border-radius: 12px; background: #12f987; color: #0a1f1a; font-weight: 700; text-decoration: none;"
          >
            Approve recruiter
          </a>
        </p>
        <p style="margin: 0; font-size: 13px; color: #476a5d;">If the button does not work, open this URL directly:</p>
        <p style="margin: 8px 0 0; font-size: 13px; word-break: break-all;">
          <a href="${safeApproveUrl}" style="color: #0a6b4b;">${safeApproveUrl}</a>
        </p>
      </div>
    `.trim()
  };
}

export async function sendRecruiterApprovalRequestEmail({
  recruiterEmail,
  recruiterProfileId,
  approveUrl,
  notificationTo,
  requestedAt
}: RecruiterApprovalEmailInput) {
  const resolvedNotificationTo = notificationTo ?? getRecruiterApprovalNotificationRecipient();
  if (!resolvedNotificationTo) {
    throw new Error("recruiter_approval_notification_to_missing");
  }

  const message = buildRecruiterApprovalRequestEmail({
    recruiterEmail,
    recruiterProfileId,
    approveUrl,
    requestedAt
  });

  return sendEmailViaResend({
    to: resolvedNotificationTo,
    subject: message.subject,
    html: message.html,
    text: message.text,
    idempotencyKey: `recruiter-approval-${recruiterProfileId}`,
    tags: [
      { name: "workflow", value: "recruiter-approval" },
      { name: "profile_id", value: recruiterProfileId }
    ]
  });
}
