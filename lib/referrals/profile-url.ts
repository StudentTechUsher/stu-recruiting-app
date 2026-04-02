const SHARE_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{1,62}[a-z0-9])?$/i;

export const normalizeShareSlug = (value: string): string | null => {
  const normalized = value.trim().toLowerCase();
  if (!SHARE_SLUG_PATTERN.test(normalized)) return null;
  return normalized;
};

const parseUrl = (value: string): URL | null => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

export const resolveShareSlugFromProfileInput = (value: string): string | null => {
  const raw = value.trim();
  if (!raw) return null;

  const directSlug = normalizeShareSlug(raw);
  if (directSlug) return directSlug;

  const relativePathMatch = raw.match(/^\/(?:profile|u)\/([a-z0-9_-]+)\/?$/i);
  if (relativePathMatch?.[1]) {
    return normalizeShareSlug(relativePathMatch[1]);
  }

  const parsedUrl = parseUrl(raw);
  if (!parsedUrl) return null;

  const pathMatch = parsedUrl.pathname.match(/^\/(?:profile|u)\/([a-z0-9_-]+)\/?$/i);
  if (pathMatch?.[1]) {
    return normalizeShareSlug(pathMatch[1]);
  }

  const paramSlug = parsedUrl.searchParams.get("slug") ?? parsedUrl.searchParams.get("share_slug");
  if (paramSlug) {
    return normalizeShareSlug(paramSlug);
  }

  return null;
};
