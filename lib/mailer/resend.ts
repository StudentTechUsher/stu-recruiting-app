type EmailAddress = string | string[];

type EmailTag = {
  name: string;
  value: string;
};

export type SendEmailInput = {
  to: EmailAddress;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  cc?: EmailAddress;
  bcc?: EmailAddress;
  tags?: EmailTag[];
  idempotencyKey?: string;
};

type ResendSuccessResponse = {
  id?: string;
};

type ResendErrorResponse = {
  message?: string;
  error?: string;
  name?: string;
};

const RESEND_API_URL = "https://api.resend.com/emails";

const normalizeEnvValue = (value: string | undefined) => {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
};

export function getResendMailerConfig() {
  const apiKey = normalizeEnvValue(process.env.RESEND_API_KEY);
  const fromEmail = normalizeEnvValue(process.env.RESEND_FROM_EMAIL);
  const replyToEmail = normalizeEnvValue(process.env.RESEND_REPLY_TO_EMAIL);

  if (!apiKey || !fromEmail) {
    return null;
  }

  return {
    apiKey,
    fromEmail,
    replyToEmail
  };
}

export function isResendMailerConfigured() {
  return getResendMailerConfig() !== null;
}

const isResendSuccessResponse = (value: unknown): value is ResendSuccessResponse => {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === "string" && candidate.id.length > 0;
};

const resolveResendErrorMessage = (responsePayload: ResendErrorResponse | null, status: number) => {
  const explicitMessage = responsePayload?.message ?? responsePayload?.error ?? responsePayload?.name;
  if (explicitMessage && explicitMessage.trim().length > 0) return explicitMessage.trim();
  return `Resend request failed with status ${status}`;
};

export async function sendEmailViaResend(input: SendEmailInput) {
  const config = getResendMailerConfig();
  if (!config) {
    throw new Error("resend_not_configured");
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {})
    },
    body: JSON.stringify({
      from: input.from ?? config.fromEmail,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      reply_to: input.replyTo ?? config.replyToEmail ?? undefined,
      cc: input.cc,
      bcc: input.bcc,
      tags: input.tags
    })
  });

  const payload = (await response.json().catch(() => null)) as ResendSuccessResponse | ResendErrorResponse | null;

  if (!response.ok) {
    throw new Error(resolveResendErrorMessage(payload as ResendErrorResponse | null, response.status));
  }

  if (!isResendSuccessResponse(payload)) {
    throw new Error("resend_missing_email_id");
  }

  return {
    id: payload.id
  };
}
