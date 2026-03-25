import { createHash, createHmac, timingSafeEqual } from "crypto";

export type ClaimInvitePayload = {
  aud: "student_claim_invite";
  jti: string;
  exp: number;
  candidate_id?: string;
  email?: string;
  candidate_email?: string;
};

const toTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const decodeBase64Url = (value: string): string | null => {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
    return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
  } catch {
    return null;
  }
};

const sign = (value: string, secret: string): Buffer => {
  const signature = createHmac("sha256", secret).update(value).digest("base64url");
  return Buffer.from(signature, "utf8");
};

export const hashClaimInviteToken = (token: string): string => {
  return createHash("sha256").update(token).digest("hex");
};

export const verifyClaimInviteToken = ({
  token,
  nowSeconds = Math.floor(Date.now() / 1000),
}: {
  token: string;
  nowSeconds?: number;
}): { ok: true; payload: ClaimInvitePayload } | { ok: false; error: "invite_secret_missing" | "invalid_token" | "token_expired" } => {
  const secret = process.env.STUDENT_CLAIM_INVITE_SECRET;
  if (!secret || secret.trim().length < 16) {
    return { ok: false, error: "invite_secret_missing" };
  }

  const segments = token.split(".");
  if (segments.length !== 3) return { ok: false, error: "invalid_token" };
  const [headerSegment, payloadSegment, signatureSegment] = segments;

  const signedValue = `${headerSegment}.${payloadSegment}`;
  const expected = sign(signedValue, secret.trim());
  const provided = Buffer.from(signatureSegment, "utf8");
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return { ok: false, error: "invalid_token" };
  }

  const payloadText = decodeBase64Url(payloadSegment);
  if (!payloadText) return { ok: false, error: "invalid_token" };

  let payloadRaw: unknown = null;
  try {
    payloadRaw = JSON.parse(payloadText) as unknown;
  } catch {
    return { ok: false, error: "invalid_token" };
  }

  const payloadRecord =
    payloadRaw && typeof payloadRaw === "object" && !Array.isArray(payloadRaw)
      ? (payloadRaw as Record<string, unknown>)
      : null;
  if (!payloadRecord) return { ok: false, error: "invalid_token" };

  const aud = toTrimmedString(payloadRecord.aud);
  const jti = toTrimmedString(payloadRecord.jti);
  const exp = Number(payloadRecord.exp);
  const candidateId = toTrimmedString(payloadRecord.candidate_id);
  const email = toTrimmedString(payloadRecord.email) ?? toTrimmedString(payloadRecord.candidate_email);

  if (aud !== "student_claim_invite" || !jti || !Number.isFinite(exp)) {
    return { ok: false, error: "invalid_token" };
  }
  if (!candidateId && !email) return { ok: false, error: "invalid_token" };
  if (exp < nowSeconds) return { ok: false, error: "token_expired" };

  return {
    ok: true,
    payload: {
      aud: "student_claim_invite",
      jti,
      exp,
      ...(candidateId ? { candidate_id: candidateId } : {}),
      ...(email ? { email } : {}),
    },
  };
};

