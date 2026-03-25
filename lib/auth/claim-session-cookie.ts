import { hashClaimInviteToken } from "@/lib/auth/claim-invite-token";

type ClaimSessionCookiePayload = {
  token_hash: string;
  email: string;
  created_at: string;
};

const claimSessionCookieName = "stu-claim-session";
const claimSessionCookieMaxAgeSeconds = 15 * 60;

const toTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const parseCookieHeader = (cookieHeader: string | null): Record<string, string> => {
  const values: Record<string, string> = {};
  if (!cookieHeader) return values;

  for (const segment of cookieHeader.split(";")) {
    const [rawName, ...rest] = segment.trim().split("=");
    if (!rawName) continue;
    values[rawName] = rest.join("=");
  }
  return values;
};

export const buildClaimSessionCookieValue = ({
  claimToken,
  email,
  nowIso = new Date().toISOString(),
}: {
  claimToken: string;
  email: string;
  nowIso?: string;
}): string => {
  const payload: ClaimSessionCookiePayload = {
    token_hash: hashClaimInviteToken(claimToken),
    email: email.trim().toLowerCase(),
    created_at: nowIso,
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
};

export const parseClaimSessionCookieValue = (value: string | null): ClaimSessionCookiePayload | null => {
  const normalized = toTrimmedString(value);
  if (!normalized) return null;

  try {
    const decoded = Buffer.from(normalized, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    const tokenHash = toTrimmedString(record.token_hash);
    const email = toTrimmedString(record.email)?.toLowerCase() ?? null;
    const createdAt = toTrimmedString(record.created_at);
    if (!tokenHash || !email || !createdAt) return null;

    return {
      token_hash: tokenHash,
      email,
      created_at: createdAt,
    };
  } catch {
    return null;
  }
};

export const resolveClaimSessionFromCookieHeader = (cookieHeader: string | null): ClaimSessionCookiePayload | null => {
  const cookies = parseCookieHeader(cookieHeader);
  return parseClaimSessionCookieValue(cookies[claimSessionCookieName] ?? null);
};

export const applyClaimSessionCookie = ({
  response,
  claimToken,
  email,
}: {
  response: Response;
  claimToken: string;
  email: string;
}) => {
  const cookieValue = buildClaimSessionCookieValue({
    claimToken,
    email,
  });
  response.headers.append(
    "set-cookie",
    `${claimSessionCookieName}=${cookieValue}; Path=/; Max-Age=${claimSessionCookieMaxAgeSeconds}; HttpOnly; SameSite=Lax`
  );
};

export const clearClaimSessionCookie = (response: Response) => {
  response.headers.append(
    "set-cookie",
    `${claimSessionCookieName}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`
  );
};
