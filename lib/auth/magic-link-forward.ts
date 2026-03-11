type SearchParamValue = string | string[] | undefined;

const firstValue = (value: SearchParamValue): string | null => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : null;
  return null;
};

export function buildMagicLinkCallbackRedirectPath(
  searchParams: Record<string, SearchParamValue> | null | undefined
): string | null {
  if (!searchParams) return null;

  const code = firstValue(searchParams.code);
  const tokenHash = firstValue(searchParams.token_hash);
  const type = firstValue(searchParams.type);
  if (!code && !tokenHash) return null;

  const next = new URLSearchParams();
  if (code) next.set("code", code);
  if (tokenHash) next.set("token_hash", tokenHash);
  if (type) next.set("type", type);

  return `/auth/callback?${next.toString()}`;
}
