import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { createHash } from "node:crypto";
import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib";

type ArtifactType =
  | "coursework"
  | "club"
  | "project"
  | "internship"
  | "certification"
  | "leadership"
  | "competition"
  | "research"
  | "employment"
  | "test";

type ExtractionSource = "resume" | "transcript" | "linkedin" | "github" | "kaggle";

type ArtifactDraft = {
  artifact_type: ArtifactType;
  artifact_data: Record<string, unknown>;
};

type SourceLogKey = "resume" | "transcript" | "linkedin" | "github" | "kaggle";
type StorageFileRef = { bucket: string; path: string; kind?: string };
type SourceExtractionStatus = "extracting" | "succeeded" | "failed";
export type SourceOwnershipConfidence = "high" | "medium" | "low";

export type ExternalSourceExtractionResult = {
  artifacts: ArtifactDraft[];
  confidence: SourceOwnershipConfidence;
  warningCode: string | null;
  warningMessage: string | null;
  requiresConfirmation: boolean;
};

type QueryResult<T = unknown> = PromiseLike<{ data: T; error: unknown }>;

type SupabaseFromLike = {
  insert: (payload: unknown) => {
    select: (columns: string) => QueryResult<unknown>;
  };
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      limit: (count: number) => QueryResult<unknown>;
    };
  };
  upsert: (
    payload: { profile_id: string; student_data: Record<string, unknown> },
    options: { onConflict: string }
  ) => QueryResult<unknown>;
  update: (payload: unknown) => {
    eq: (column: string, value: string) => QueryResult<unknown>;
  };
};

export type SupabaseClientLike = {
  from: (table: string) => SupabaseFromLike;
};

const defaultModel = "gpt-5-mini";
const openaiResponsesUrl = "https://api.openai.com/v1/responses";
const openaiFilesUrl = "https://api.openai.com/v1/files";

const allowedArtifactTypes: ArtifactType[] = [
  "coursework",
  "club",
  "project",
  "internship",
  "certification",
  "leadership",
  "competition",
  "research",
  "employment",
  "test"
];

const allowedArtifactTypeSet = new Set<string>(allowedArtifactTypes);
const duplicateKeyErrorCode = "23505";

const artifactFingerprintKeys = [
  "title",
  "source",
  "organization",
  "company",
  "position",
  "job_title",
  "course_code",
  "course_title",
  "project_title",
  "certification_name",
  "assessment_name",
  "competition_name",
  "research_title",
  "term",
  "start_date",
  "end_date",
  "awarded_date",
  "provider"
] as const;

const artifactTypeFallbackLabel: Record<ArtifactType, string> = {
  coursework: "Coursework",
  club: "Club",
  project: "Project",
  internship: "Internship",
  certification: "Certification",
  leadership: "Leadership",
  competition: "Competition",
  research: "Research",
  employment: "Employment",
  test: "Assessment"
};

const artifactTypeDefaultTags: Record<ArtifactType, string[]> = {
  coursework: ["Technical depth", "Systems thinking"],
  club: ["Collaboration signal", "Communication signal"],
  project: ["Applied execution", "Technical depth"],
  internship: ["Applied execution", "Communication signal"],
  certification: ["Technical depth", "Reliability signal"],
  leadership: ["Collaboration signal", "Communication signal"],
  competition: ["Applied execution", "Collaboration signal"],
  research: ["Technical depth", "Communication signal"],
  employment: ["Applied execution", "Reliability signal"],
  test: ["Reliability signal", "Systems thinking"]
};

const nullableStringSchema = { type: ["string", "null"] } as const;
const nullableNumberOrStringSchema = { type: ["number", "string", "null"] } as const;

const artifactDataProperties = {
  title: { type: "string" },
  source: { type: "string" },
  description: { type: "string" },
  type: { type: "string", enum: allowedArtifactTypes },
  tags: {
    type: "array",
    maxItems: 8,
    items: { type: "string" }
  },
  link: nullableStringSchema,
  attachment_name: nullableStringSchema,
  reference_contact_name: nullableStringSchema,
  reference_contact_role: nullableStringSchema,
  reference_quote: nullableStringSchema,
  course_code: nullableStringSchema,
  course_title: nullableStringSchema,
  instructor_name: nullableStringSchema,
  term: nullableStringSchema,
  credits: nullableNumberOrStringSchema,
  grade: nullableStringSchema,
  impact_description: nullableStringSchema,
  project_demo_link: nullableStringSchema,
  project_title: nullableStringSchema,
  company: nullableStringSchema,
  job_title: nullableStringSchema,
  start_date: nullableStringSchema,
  end_date: nullableStringSchema,
  mentor_email: nullableStringSchema,
  impact_statement: nullableStringSchema,
  certification_name: nullableStringSchema,
  awarded_date: nullableStringSchema,
  organization: nullableStringSchema,
  position: nullableStringSchema,
  performance: nullableStringSchema,
  deliverable_note: nullableStringSchema,
  research_title: nullableStringSchema,
  research_area: nullableStringSchema,
  advisor: nullableStringSchema,
  assessment_name: nullableStringSchema,
  provider: nullableStringSchema,
  score: nullableStringSchema,
  summary: nullableStringSchema
} as const;

const artifactDataSchema = {
  type: "object",
  additionalProperties: false,
  properties: artifactDataProperties,
  required: Object.keys(artifactDataProperties)
} as const;

const artifactExtractionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    artifacts: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          artifact_type: {
            type: "string",
            enum: allowedArtifactTypes
          },
          artifact_data: {
            ...artifactDataSchema
          }
        },
        required: ["artifact_type", "artifact_data"]
      }
    }
  },
  required: ["artifacts"]
} as const;

const toRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const toTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const normalizeGithubProfileUrl = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "";

  const normalizedInput = trimmed.replace(/^@+/, "");
  if (!normalizedInput.includes("://") && !normalizedInput.includes("/")) {
    const username = normalizedInput.replace(/^\/+|\/+$/g, "");
    return username.length > 0 ? `https://github.com/${username}` : "";
  }

  try {
    const parsed = new URL(normalizedInput.includes("://") ? normalizedInput : `https://${normalizedInput}`);
    const host = parsed.hostname.toLowerCase();
    if (host === "github.com" || host === "www.github.com") {
      const [username] = parsed.pathname.split("/").filter(Boolean);
      if (username) return `https://github.com/${username}`;
    }
  } catch {
    return trimmed;
  }

  return trimmed;
};

const normalizeLinkedinProfileUrl = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "";

  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.toLowerCase();
    if (host.endsWith("linkedin.com")) {
      const cleanedPath = parsed.pathname.replace(/\/+$/, "");
      if (cleanedPath.length > 0) return `https://www.linkedin.com${cleanedPath}`;
    }
  } catch {
    return trimmed;
  }

  return trimmed;
};

const normalizeKaggleProfileUrl = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "";

  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.toLowerCase();
    if (host.endsWith("kaggle.com")) {
      const [username] = parsed.pathname.split("/").filter(Boolean);
      if (username) return `https://www.kaggle.com/${username}`;
    }
  } catch {
    return trimmed;
  }

  return trimmed;
};

const normalizeExtractionProfileLinkValue = (key: string, value: string): string => {
  const normalizedKey = key.trim().toLowerCase();
  if (normalizedKey === "github") return normalizeGithubProfileUrl(value);
  if (normalizedKey === "linkedin") return normalizeLinkedinProfileUrl(value);
  if (normalizedKey === "kaggle") return normalizeKaggleProfileUrl(value);
  return value.trim();
};

const sanitizeExtractionProfileLinks = (profileLinks: Record<string, string | null> | undefined): Record<string, string> => {
  if (!profileLinks) return {};

  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(profileLinks)) {
    if (typeof value !== "string") continue;
    const normalized = normalizeExtractionProfileLinkValue(key, value);
    if (normalized.length === 0) continue;
    sanitized[key] = normalized;
  }
  return sanitized;
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === "string")
    .map((item) => (item as string).trim())
    .filter(Boolean);
};

const normalizeFingerprintToken = (value: unknown): string => {
  const normalized = toTrimmedString(value)?.toLowerCase() ?? "";
  if (!normalized) return "";
  return normalized
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
};

const buildArtifactFingerprint = (artifact: ArtifactDraft): string => {
  const artifactData = toRecord(artifact.artifact_data);
  const tokens = [
    normalizeFingerprintToken(artifact.artifact_type),
    ...artifactFingerprintKeys.map((key) => normalizeFingerprintToken(artifactData[key]))
  ].filter((token) => token.length > 0);

  const joined = tokens.join("|");
  return createHash("md5").update(joined).digest("hex");
};

const normalizeFileRef = (value: unknown): Record<string, unknown> | null => {
  const row = toRecord(value);
  const bucket = toTrimmedString(row.bucket);
  const path = toTrimmedString(row.path);
  if (!bucket || !path) return null;

  const normalized: Record<string, unknown> = {
    bucket,
    path
  };
  const kind = toTrimmedString(row.kind);
  if (kind) normalized.kind = kind;
  return normalized;
};

const isRecord = (value: Record<string, unknown> | null): value is Record<string, unknown> => value !== null;

const mergeFileRefs = ({
  existingFileRefs,
  nextFileRef
}: {
  existingFileRefs: unknown;
  nextFileRef: Record<string, unknown>;
}): Array<Record<string, unknown>> => {
  const merged = Array.isArray(existingFileRefs) ? existingFileRefs.map((entry) => normalizeFileRef(entry)).filter(isRecord) : [];
  const normalizedNext = normalizeFileRef(nextFileRef);
  if (!normalizedNext) return merged;

  const nextBucket = toTrimmedString(normalizedNext.bucket) ?? "";
  const nextPath = toTrimmedString(normalizedNext.path) ?? "";
  const nextKind = toTrimmedString(normalizedNext.kind) ?? "";

  const alreadyLinked = merged.some((entry) => {
    const bucket = toTrimmedString(entry.bucket) ?? "";
    const path = toTrimmedString(entry.path) ?? "";
    const kind = toTrimmedString(entry.kind) ?? "";
    return bucket === nextBucket && path === nextPath && kind === nextKind;
  });

  if (alreadyLinked) return merged;
  return [...merged, normalizedNext];
};

const nicknameCanonicalMap: Record<string, string> = {
  alex: "alexander",
  allie: "alexandra",
  andy: "andrew",
  ben: "benjamin",
  beth: "elizabeth",
  bill: "william",
  bob: "robert",
  cathy: "catherine",
  chris: "christopher",
  dan: "daniel",
  dave: "david",
  jen: "jennifer",
  jenny: "jennifer",
  jim: "james",
  joe: "joseph",
  jon: "john",
  kate: "katherine",
  katie: "katherine",
  liz: "elizabeth",
  mike: "michael",
  nick: "nicholas",
  pat: "patrick",
  rob: "robert",
  sam: "samuel",
  steve: "steven",
  tom: "thomas",
  tony: "anthony",
  vince: "vincent",
  vinny: "vincent",
  will: "william"
};

const canonicalNameToken = (value: string): string => {
  const normalized = value.toLowerCase().replace(/[^a-z]/g, "");
  if (!normalized) return "";
  return nicknameCanonicalMap[normalized] ?? normalized;
};

const toNameTokens = (value: string): string[] => {
  const matches = value.toLowerCase().match(/[a-z]+/g) ?? [];
  return matches.map((token) => canonicalNameToken(token)).filter((token) => token.length > 0);
};

const extractLinkedinSlug = (value: string): string | null => {
  try {
    const parsed = new URL(value);
    const pathMatch = parsed.pathname.match(/\/in\/([^/?#]+)/i);
    if (!pathMatch) return null;
    return pathMatch[1].trim().toLowerCase();
  } catch {
    return null;
  }
};

const assessNameMatchConfidence = ({
  expectedName,
  candidateName,
  candidateHandle
}: {
  expectedName: string | null;
  candidateName: string | null;
  candidateHandle?: string | null;
}): SourceOwnershipConfidence => {
  const normalizedExpectedName = toTrimmedString(expectedName);
  if (!normalizedExpectedName) return "high";

  const expectedTokens = toNameTokens(normalizedExpectedName);
  if (expectedTokens.length === 0) return "high";

  const candidateTokens = new Set<string>();
  for (const token of toNameTokens(candidateName ?? "")) candidateTokens.add(token);
  for (const token of toNameTokens(candidateHandle ?? "")) candidateTokens.add(token);

  if (candidateTokens.size === 0) return "low";

  const expectedFirst = expectedTokens[0];
  const expectedLast = expectedTokens[expectedTokens.length - 1];
  const overlapCount = expectedTokens.filter((token) => candidateTokens.has(token)).length;
  const joinedCandidate = Array.from(candidateTokens).join("");
  const firstMatch =
    candidateTokens.has(expectedFirst) ||
    (expectedFirst.length >= 3 && joinedCandidate.includes(expectedFirst.slice(0, 3)));
  const lastMatch =
    candidateTokens.has(expectedLast) ||
    (expectedLast.length >= 4 && joinedCandidate.includes(expectedLast.slice(0, 4)));

  if (expectedTokens.length === 1) {
    if (firstMatch || overlapCount >= 1) return "high";
    return "low";
  }

  if ((firstMatch && lastMatch) || overlapCount >= 2) return "high";
  if (firstMatch || lastMatch || overlapCount >= 1) return "medium";
  return "low";
};

const extractLinkedinDisplayNameFromHtml = (html: string): string | null => {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (!titleMatch) return null;
  const titleRaw = titleMatch[1]
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim();
  if (!titleRaw) return null;

  const withoutLinkedInSuffix = titleRaw.replace(/\s*[-|]\s*.*linkedin.*$/i, "").trim();
  return withoutLinkedInSuffix.length > 0 ? withoutLinkedInSuffix : null;
};

const containsLinkedinUrl = ({
  requiredLinkedinUrl,
  profileBlogUrl,
  profileBio
}: {
  requiredLinkedinUrl: string;
  profileBlogUrl: string | null;
  profileBio: string | null;
}): boolean => {
  const requiredSlug = extractLinkedinSlug(requiredLinkedinUrl);
  const searchable = [profileBlogUrl, profileBio]
    .map((value) => (value ?? "").toLowerCase())
    .join(" ");

  if (!searchable.includes("linkedin.com/in/")) return false;
  if (!requiredSlug) return true;
  return searchable.includes(requiredSlug);
};

const hasResumeAcademicSignal = (artifact: ArtifactDraft): boolean => {
  if (artifact.artifact_type === "coursework") return true;
  const data = toRecord(artifact.artifact_data);
  const searchable = [
    toTrimmedString(data.title),
    toTrimmedString(data.source),
    toTrimmedString(data.description),
    toTrimmedString(data.course_title),
    toTrimmedString(data.course_code),
    toTrimmedString(data.term)
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  return /\bgpa\b/.test(searchable) || /\bcoursework\b/.test(searchable) || /\bcourses?\b/.test(searchable);
};

const isRedirectStatus = (statusCode: number) => statusCode === 301 || statusCode === 302 || statusCode === 303 || statusCode === 307 || statusCode === 308;

const decodeHttpBody = ({
  body,
  encodingHeader
}: {
  body: Buffer;
  encodingHeader: string | string[] | undefined;
}): string => {
  const rawEncoding = Array.isArray(encodingHeader) ? encodingHeader[0] : encodingHeader;
  const encoding = toTrimmedString(rawEncoding)?.toLowerCase() ?? "";

  try {
    if (encoding.includes("br")) return brotliDecompressSync(body).toString("utf8");
    if (encoding.includes("gzip")) return gunzipSync(body).toString("utf8");
    if (encoding.includes("deflate")) return inflateSync(body).toString("utf8");
  } catch {
    return body.toString("utf8");
  }

  return body.toString("utf8");
};

const fetchPageWithNodeHttp = async ({
  pageUrl,
  headers,
  maxRedirects = 5
}: {
  pageUrl: string;
  headers: Record<string, string>;
  maxRedirects?: number;
}): Promise<{ status: number; html: string }> => {
  let nextUrl = pageUrl;

  for (let attempt = 0; attempt <= maxRedirects; attempt += 1) {
    const target = new URL(nextUrl);
    const requestImpl = target.protocol === "https:" ? httpsRequest : httpRequest;
    const response = await new Promise<{
      status: number;
      body: Buffer;
      headers: Record<string, string | string[] | undefined>;
    }>((resolve, reject) => {
      const req = requestImpl(
        {
          protocol: target.protocol,
          hostname: target.hostname,
          port: target.port ? Number(target.port) : undefined,
          path: `${target.pathname}${target.search}`,
          method: "GET",
          headers
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer | string) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });
          res.on("end", () => {
            resolve({
              status: typeof res.statusCode === "number" ? res.statusCode : 0,
              body: Buffer.concat(chunks),
              headers: res.headers
            });
          });
          res.on("error", reject);
        }
      );

      req.setTimeout(20_000, () => {
        req.destroy(new Error("linkedin_fetch_timeout"));
      });
      req.on("error", reject);
      req.end();
    });

    if (isRedirectStatus(response.status)) {
      const locationHeader = response.headers.location;
      const location = Array.isArray(locationHeader) ? locationHeader[0] : locationHeader;
      if (!location) return { status: response.status, html: decodeHttpBody({ body: response.body, encodingHeader: response.headers["content-encoding"] }) };
      if (attempt === maxRedirects) throw new Error("linkedin_fetch_failed:too_many_redirects");
      nextUrl = new URL(location, nextUrl).toString();
      continue;
    }

    return {
      status: response.status,
      html: decodeHttpBody({
        body: response.body,
        encodingHeader: response.headers["content-encoding"]
      })
    };
  }

  throw new Error("linkedin_fetch_failed:too_many_redirects");
};

const fetchLinkedinPage = async (profileUrl: string): Promise<{ status: number; html: string }> => {
  const headers = {
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.9",
    "accept-encoding": "identity"
  };

  try {
    const response = await fetch(profileUrl, {
      headers,
      redirect: "follow",
      cache: "no-store"
    });
    return {
      status: response.status,
      html: await response.text().catch(() => "")
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const statusRangeError =
      error instanceof RangeError && message.includes('init["status"]') && message.includes("200 to 599");
    if (!statusRangeError) throw error;

    // LinkedIn can respond with non-standard 999; Node fetch rejects that.
    return fetchPageWithNodeHttp({
      pageUrl: profileUrl,
      headers
    });
  }
};

const fetchKagglePage = async (profileUrl: string): Promise<{ status: number; html: string }> => {
  const headers: Record<string, string> = {
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.9",
    "accept-encoding": "identity"
  };

  try {
    const response = await fetch(profileUrl, {
      headers,
      redirect: "follow",
      cache: "no-store"
    });
    return {
      status: response.status,
      html: await response.text().catch(() => "")
    };
  } catch {
    return fetchPageWithNodeHttp({
      pageUrl: profileUrl,
      headers
    });
  }
};

const sourceLabelFromKind = (source: ExtractionSource) => {
  if (source === "resume") return "Resume extraction";
  if (source === "transcript") return "Transcript extraction";
  if (source === "linkedin") return "LinkedIn profile";
  if (source === "github") return "GitHub profile";
  return "Kaggle profile";
};

const firstNonEmptyString = (...values: unknown[]): string | null => {
  for (const value of values) {
    const normalized = toTrimmedString(value);
    if (normalized) return normalized;
  }
  return null;
};

const normalizeTags = (rawTags: unknown, type: ArtifactType): string[] => {
  const unique = new Set<string>();
  for (const tag of toStringArray(rawTags)) {
    if (unique.size >= 6) break;
    unique.add(tag);
  }
  if (unique.size === 0) {
    artifactTypeDefaultTags[type].forEach((tag) => unique.add(tag));
  }
  return Array.from(unique);
};

const sanitizeArtifactDraft = ({
  artifactType,
  rawData,
  sourceKind
}: {
  artifactType: ArtifactType;
  rawData: Record<string, unknown>;
  sourceKind: ExtractionSource;
}): ArtifactDraft => {
  const sourceLabel = sourceLabelFromKind(sourceKind);
  const title =
    firstNonEmptyString(
      rawData.title,
      rawData.course_title,
      rawData.project_title,
      rawData.job_title,
      rawData.certification_name,
      rawData.assessment_name
    ) ?? `${artifactTypeFallbackLabel[artifactType]} evidence`;

  const source = firstNonEmptyString(rawData.source, sourceLabel) ?? sourceLabel;
  const description =
    firstNonEmptyString(
      rawData.description,
      rawData.impact_statement,
      rawData.impact_description,
      rawData.course_impact,
      rawData.coursework_summary,
      rawData.summary
    ) ?? `Extracted ${artifactTypeFallbackLabel[artifactType].toLowerCase()} evidence from ${sourceLabel.toLowerCase()}.`;

  const artifactData: Record<string, unknown> = {
    ...rawData,
    title,
    source,
    description,
    type: artifactType,
    tags: normalizeTags(rawData.tags, artifactType)
  };

  if (artifactType === "leadership" || artifactType === "club") {
    const organization =
      firstNonEmptyString(rawData.organization, rawData.club_name, rawData.organization_name, rawData.source, title) ??
      (artifactType === "club" ? "Student organization" : "Leadership organization");
    const position =
      firstNonEmptyString(rawData.position, rawData.role, rawData.leadership_role) ?? (artifactType === "club" ? "Member" : "Leader");
    artifactData.organization = organization;
    artifactData.position = position;
  }

  if (sourceKind === "transcript" || sourceKind === "github" || sourceKind === "kaggle") {
    artifactData.verification_status = "verified";
    artifactData.verification_method =
      sourceKind === "transcript"
        ? "transcript_extraction"
        : sourceKind === "github"
          ? "github_extraction"
          : "kaggle_extraction";
  } else {
    artifactData.verification_status = "unverified";
    artifactData.verification_method = sourceKind === "linkedin" ? "linkedin_extraction" : "resume_extraction";
  }

  return {
    artifact_type: artifactType,
    artifact_data: artifactData
  };
};

const extractOutputText = (payload: unknown): string | null => {
  if (typeof payload !== "object" || payload === null) return null;
  const data = payload as Record<string, unknown>;

  if (typeof data.output_text === "string" && data.output_text.trim().length > 0) {
    return data.output_text;
  }

  if (!Array.isArray(data.output)) return null;
  const chunks: string[] = [];
  for (const item of data.output) {
    if (typeof item !== "object" || item === null) continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (typeof part !== "object" || part === null) continue;
      const text = (part as Record<string, unknown>).text;
      if (typeof text === "string" && text.trim().length > 0) {
        chunks.push(text);
      }
    }
  }

  return chunks.length > 0 ? chunks.join("\n") : null;
};

const normalizeOpenAIExtractionResponse = ({
  payload,
  sourceKind
}: {
  payload: unknown;
  sourceKind: ExtractionSource;
}): ArtifactDraft[] => {
  const asRecord = toRecord(payload);
  const rows = Array.isArray(asRecord.artifacts) ? asRecord.artifacts : [];

  const drafts = rows
    .map((row) => toRecord(row))
    .map((row) => {
      const type = toTrimmedString(row.artifact_type);
      const data = toRecord(row.artifact_data);
      if (!type || !allowedArtifactTypeSet.has(type)) return null;
      return sanitizeArtifactDraft({
        artifactType: type as ArtifactType,
        rawData: data,
        sourceKind
      });
    })
    .filter((row): row is ArtifactDraft => Boolean(row));

  const unique = new Map<string, ArtifactDraft>();
  for (const draft of drafts) {
    const data = toRecord(draft.artifact_data);
    const dedupeKey = `${draft.artifact_type}::${(toTrimmedString(data.title) ?? "").toLowerCase()}::${(
      toTrimmedString(data.source) ?? ""
    ).toLowerCase()}`;
    if (!unique.has(dedupeKey)) unique.set(dedupeKey, draft);
  }

  return Array.from(unique.values()).slice(0, 12);
};

const getOpenAIConfig = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error("openai_api_key_missing");
  }
  const model = process.env.OPENAI_ARTIFACT_EXTRACT_MODEL || defaultModel;
  return { apiKey, model };
};

const uploadFileToOpenAI = async ({
  apiKey,
  file
}: {
  apiKey: string;
  file: File;
}): Promise<{ id: string }> => {
  const form = new FormData();
  form.set("purpose", "user_data");
  form.set("file", file, file.name || "document");

  const response = await fetch(openaiFilesUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`
    },
    body: form
  });

  if (!response.ok) {
    const failureText = await response.text().catch(() => "");
    throw new Error(`openai_file_upload_failed:${response.status}:${failureText.slice(0, 240)}`);
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  const fileId = toTrimmedString(toRecord(payload).id);
  if (!fileId) throw new Error("openai_file_upload_failed:missing_file_id");
  return { id: fileId };
};

const deleteOpenAIFile = async ({ apiKey, fileId }: { apiKey: string; fileId: string }) => {
  await fetch(`${openaiFilesUrl}/${fileId}`, {
    method: "DELETE",
    headers: {
      authorization: `Bearer ${apiKey}`
    }
  }).catch(() => undefined);
};

const callOpenAIExtraction = async ({
  sourceKind,
  userContent,
  systemPrompt
}: {
  sourceKind: ExtractionSource;
  userContent: Array<Record<string, unknown>>;
  systemPrompt: string;
}): Promise<ArtifactDraft[]> => {
  const { apiKey, model } = getOpenAIConfig();

  const response = await fetch(openaiResponsesUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      text: {
        format: {
          type: "json_schema",
          name: "artifact_extraction_result",
          schema: artifactExtractionSchema,
          strict: true
        }
      },
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemPrompt }]
        },
        {
          role: "user",
          content: userContent
        }
      ]
    })
  });

  if (!response.ok) {
    const failureText = await response.text().catch(() => "");
    throw new Error(`openai_extraction_failed:${response.status}:${failureText.slice(0, 400)}`);
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  const outputText = extractOutputText(payload);
  if (!outputText) throw new Error("openai_extraction_failed:empty_output");

  let parsedPayload: unknown = null;
  try {
    parsedPayload = JSON.parse(outputText) as unknown;
  } catch {
    throw new Error("openai_extraction_failed:invalid_json");
  }

  return normalizeOpenAIExtractionResponse({
    payload: parsedPayload,
    sourceKind
  });
};

const stripHtmlToText = (value: string): string => {
  const withoutScripts = value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ");
  const textOnly = withoutScripts
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
  return textOnly;
};

const fetchGithubJson = async ({
  path,
  githubToken
}: {
  path: string;
  githubToken: string | null;
}): Promise<unknown> => {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "stu-recruiting-app",
      ...(githubToken ? { authorization: `Bearer ${githubToken}` } : {})
    },
    cache: "no-store"
  });
  if (!response.ok) {
    const failureText = await response.text().catch(() => "");
    throw new Error(`github_fetch_failed:${response.status}:${failureText.slice(0, 200)}`);
  }
  return (await response.json().catch(() => null)) as unknown;
};

const fetchGithubReadme = async ({
  owner,
  repo,
  githubToken
}: {
  owner: string;
  repo: string;
  githubToken: string | null;
}): Promise<string | null> => {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "stu-recruiting-app",
      ...(githubToken ? { authorization: `Bearer ${githubToken}` } : {})
    },
    cache: "no-store"
  });

  if (!response.ok) return null;
  const payload = (await response.json().catch(() => null)) as unknown;
  const content = toTrimmedString(toRecord(payload).content);
  const encoding = toTrimmedString(toRecord(payload).encoding);
  if (!content || encoding !== "base64") return null;
  try {
    return Buffer.from(content, "base64").toString("utf8").slice(0, 8_000);
  } catch {
    return null;
  }
};

export async function extractArtifactsFromDocument({
  sourceKind,
  file
}: {
  sourceKind: "resume" | "transcript";
  file: File;
}): Promise<ArtifactDraft[]> {
  const { apiKey } = getOpenAIConfig();
  const uploaded = await uploadFileToOpenAI({ apiKey, file });
  try {
    const extracted = await callOpenAIExtraction({
      sourceKind,
      systemPrompt:
        "You extract student capability artifacts from source material. " +
        "Perform OCR on the provided document when text is embedded as images or scanned pages. " +
        "Return only artifacts clearly supported by the document. " +
        "Every artifact_data object must include title, source, and description. " +
        "Use artifact type 'club' for club memberships without leadership responsibility. " +
        "Use artifact type 'leadership' only when the student held a clear leadership role. " +
        "For club and leadership artifacts, always include organization and position fields. " +
        (sourceKind === "resume"
          ? "When processing resumes, ignore GPA, coursework, and course lists entirely because transcripts are the official source for academic records."
          : ""),
      userContent: [
        { type: "input_text", text: `Document type: ${sourceKind}.` },
        { type: "input_file", file_id: uploaded.id }
      ]
    });

    if (sourceKind === "resume") {
      return extracted.filter((artifact) => !hasResumeAcademicSignal(artifact));
    }
    return extracted;
  } finally {
    await deleteOpenAIFile({ apiKey, fileId: uploaded.id });
  }
}

export async function extractArtifactsFromLinkedin({
  profileUrl,
  expectedStudentName,
  allowLowConfidence = false
}: {
  profileUrl: string;
  expectedStudentName?: string | null;
  allowLowConfidence?: boolean;
}): Promise<ExternalSourceExtractionResult> {
  const { status, html } = await fetchLinkedinPage(profileUrl);
  if (!html.trim()) {
    throw new Error(`linkedin_fetch_failed:status_${status || "unknown"}:empty_response`);
  }

  const linkedInDisplayName = extractLinkedinDisplayNameFromHtml(html);
  const linkedInSlug = extractLinkedinSlug(profileUrl);
  const linkedInSlugName = linkedInSlug ? linkedInSlug.replace(/[-_.]+/g, " ") : null;
  const confidence = assessNameMatchConfidence({
    expectedName: expectedStudentName ?? null,
    candidateName: linkedInDisplayName,
    candidateHandle: linkedInSlugName
  });
  const warningCode =
    confidence === "medium"
      ? "linkedin_name_match_medium_confidence"
      : confidence === "low"
        ? "linkedin_name_match_low_confidence"
        : null;
  const warningMessage =
    confidence === "medium"
      ? "LinkedIn profile match is not fully certain. Extraction will continue with a warning."
      : confidence === "low"
        ? "We couldn't confidently match this LinkedIn profile to your name."
        : null;
  if (confidence === "low" && !allowLowConfidence) {
    return {
      artifacts: [],
      confidence,
      warningCode,
      warningMessage,
      requiresConfirmation: true
    };
  }

  const scrapedText = stripHtmlToText(html).slice(0, 100_000);
  const artifacts = await callOpenAIExtraction({
    sourceKind: "linkedin",
    systemPrompt:
      "Extract student artifacts from a LinkedIn profile capture. " +
      "Use artifact type 'club' for memberships without leadership role. " +
      "Use artifact type 'leadership' only for leadership roles. " +
      "For club and leadership artifacts, always include organization and position fields. " +
      "Do not invent employers, dates, or accomplishments that are not present. " +
      "If evidence is weak, return an empty artifacts array.",
    userContent: [
      { type: "input_text", text: `LinkedIn URL: ${profileUrl}` },
      { type: "input_text", text: `HTTP status: ${status}` },
      { type: "input_text", text: `Scraped page text:\n${scrapedText}` }
    ]
  });
  return {
    artifacts,
    confidence,
    warningCode,
    warningMessage,
    requiresConfirmation: false
  };
}

export async function extractArtifactsFromKaggle({
  profileUrl
}: {
  profileUrl: string;
}): Promise<ArtifactDraft[]> {
  const { status, html } = await fetchKagglePage(profileUrl);
  if (!html.trim()) {
    throw new Error(`kaggle_fetch_failed:status_${status || "unknown"}:empty_response`);
  }

  const scrapedText = stripHtmlToText(html).slice(0, 100_000);
  return callOpenAIExtraction({
    sourceKind: "kaggle",
    systemPrompt:
      "Extract student artifacts from a Kaggle profile capture. " +
      "Prioritize project, competition, research, and certification artifacts grounded in visible profile evidence. " +
      "Use artifact type 'club' for memberships without leadership role. " +
      "Use artifact type 'leadership' only for leadership roles. " +
      "For club and leadership artifacts, always include organization and position fields. " +
      "Do not invent rankings, medals, scores, or outcomes not present in the profile text. " +
      "If evidence is weak, return an empty artifacts array.",
    userContent: [
      { type: "input_text", text: `Kaggle URL: ${profileUrl}` },
      { type: "input_text", text: `HTTP status: ${status}` },
      { type: "input_text", text: `Scraped page text:\n${scrapedText}` }
    ]
  });
}

export async function extractArtifactsFromGithub({
  githubUsername,
  expectedStudentName,
  requiredLinkedinUrl,
  allowLowConfidence = false
}: {
  githubUsername: string;
  expectedStudentName?: string | null;
  requiredLinkedinUrl?: string | null;
  allowLowConfidence?: boolean;
}): Promise<ExternalSourceExtractionResult> {
  const githubToken = toTrimmedString(process.env.GITHUB_TOKEN);
  const profilePayload = await fetchGithubJson({
    path: `/users/${encodeURIComponent(githubUsername)}`,
    githubToken
  });
  const profile = toRecord(profilePayload);
  const profileName = toTrimmedString(profile.name);
  const profileBlogUrl = toTrimmedString(profile.blog);
  const profileBio = toTrimmedString(profile.bio);

  const requiredLinkedin = toTrimmedString(requiredLinkedinUrl);
  const hasRequiredLinkedinLink = !requiredLinkedin
    ? true
    : containsLinkedinUrl({ requiredLinkedinUrl: requiredLinkedin, profileBlogUrl, profileBio });
  const nameConfidence = assessNameMatchConfidence({
    expectedName: expectedStudentName ?? null,
    candidateName: profileName,
    candidateHandle: githubUsername
  });
  const confidence: SourceOwnershipConfidence =
    nameConfidence === "low" ? "low" : hasRequiredLinkedinLink && nameConfidence === "high" ? "high" : "medium";
  const warningCode =
    confidence === "low"
      ? "github_name_match_low_confidence"
      : !hasRequiredLinkedinLink
        ? "github_linkedin_link_not_detected"
        : nameConfidence === "medium"
          ? "github_name_match_medium_confidence"
          : null;
  const warningMessage =
    confidence === "low"
      ? "We couldn't confidently match this GitHub profile to your name."
      : !hasRequiredLinkedinLink
        ? "We could not detect your LinkedIn profile URL in your GitHub profile. Extraction can continue with caution."
        : nameConfidence === "medium"
          ? "GitHub profile match is not fully certain. Extraction will continue with a warning."
          : null;
  if (confidence === "low" && !allowLowConfidence) {
    return {
      artifacts: [],
      confidence,
      warningCode,
      warningMessage,
      requiresConfirmation: true
    };
  }

  const reposPayload = await fetchGithubJson({
    path: `/users/${encodeURIComponent(githubUsername)}/repos?sort=updated&per_page=12`,
    githubToken
  });

  const repos = Array.isArray(reposPayload) ? reposPayload : [];
  const normalizedRepos = repos
    .map((repo) => toRecord(repo))
    .filter((repo) => !Boolean(repo.fork))
    .slice(0, 6);

  const repoSummaries: Array<Record<string, unknown>> = [];
  for (const repo of normalizedRepos) {
    const repoName = toTrimmedString(repo.name);
    if (!repoName) continue;
    const readme = await fetchGithubReadme({
      owner: githubUsername,
      repo: repoName,
      githubToken
    });
    repoSummaries.push({
      name: repoName,
      description: toTrimmedString(repo.description),
      language: toTrimmedString(repo.language),
      topics: Array.isArray(repo.topics) ? repo.topics : [],
      stars: typeof repo.stargazers_count === "number" ? repo.stargazers_count : 0,
      forks: typeof repo.forks_count === "number" ? repo.forks_count : 0,
      updated_at: toTrimmedString(repo.updated_at),
      html_url: toTrimmedString(repo.html_url),
      readme_excerpt: readme
    });
  }

  const artifacts = await callOpenAIExtraction({
    sourceKind: "github",
    systemPrompt:
      "Extract capability artifacts from GitHub profile and repository metadata. " +
      "Use artifact type 'club' for memberships without leadership role. " +
      "Use artifact type 'leadership' only for leadership roles. " +
      "For club and leadership artifacts, always include organization and position fields. " +
      "Prefer project artifacts unless the source explicitly supports another artifact type. " +
      "Ground all output in provided data and avoid fabricating impact claims.",
    userContent: [
      { type: "input_text", text: `GitHub username: ${githubUsername}` },
      {
        type: "input_text",
        text: JSON.stringify({
          profile: toRecord(profilePayload),
          repositories: repoSummaries
        }).slice(0, 160_000)
      }
    ]
  });
  return {
    artifacts,
    confidence,
    warningCode,
    warningMessage,
    requiresConfirmation: false
  };
}

export async function persistExtractedArtifacts({
  supabase,
  profileId,
  artifacts,
  fileRef,
  sourceProvenance
}: {
  supabase: SupabaseClientLike;
  profileId: string;
  artifacts: ArtifactDraft[];
  fileRef?: Record<string, unknown> | null;
  sourceProvenance?: Record<string, unknown>;
}): Promise<ArtifactDraft[]> {
  if (artifacts.length === 0) return [];

  const insertedArtifacts: ArtifactDraft[] = [];
  const ingestionRunId = new Date().toISOString();
  for (const artifact of artifacts) {
    const artifactFingerprint = buildArtifactFingerprint(artifact);
    const mergedSourceProvenance = fileRef
      ? {
          source: toTrimmedString(fileRef.kind) ?? "extraction",
          file_ref: normalizeFileRef(fileRef),
          ...(sourceProvenance ?? {})
        }
      : { ...(sourceProvenance ?? {}) };
    const sourceObjectId =
      fileRef && toTrimmedString(fileRef.bucket) && toTrimmedString(fileRef.path)
        ? `${toTrimmedString(fileRef.bucket)}:${toTrimmedString(fileRef.path)}`
        : null;
    const rowToInsert = {
      profile_id: profileId,
      artifact_type: artifact.artifact_type,
      artifact_data: artifact.artifact_data,
      artifact_fingerprint: artifactFingerprint,
      file_refs: fileRef ? [fileRef] : [],
      source_provenance: mergedSourceProvenance,
      source_object_id: sourceObjectId,
      ingestion_run_id: ingestionRunId,
      // Keep inactive until version + pointer writes succeed.
      is_active: false,
    };

    const { data, error } = await supabase
      .from("artifacts")
      .insert([rowToInsert])
      .select("artifact_id, artifact_type, artifact_data, file_refs, source_provenance, source_object_id, ingestion_run_id");

    if (!error) {
      const insertedRow = Array.isArray(data) ? toRecord(data[0]) : {};
      const insertedArtifactId = toTrimmedString(insertedRow.artifact_id);
      const type = toTrimmedString(insertedRow.artifact_type);
      if (insertedArtifactId && type && allowedArtifactTypeSet.has(type)) {
        const versionInsert = await supabase
          .from("artifact_versions")
          .insert({
            artifact_id: insertedArtifactId,
            profile_id: profileId,
            operation: "reextract",
            artifact_type: type,
            artifact_data: toRecord(insertedRow.artifact_data),
            file_refs: Array.isArray(insertedRow.file_refs) ? insertedRow.file_refs : [],
            verification_status: toTrimmedString(toRecord(insertedRow.artifact_data).verification_status) ?? "unverified",
            source_provenance: toRecord(insertedRow.source_provenance),
            source_object_id: toTrimmedString(insertedRow.source_object_id),
            ingestion_run_id: toTrimmedString(insertedRow.ingestion_run_id),
            artifact_fingerprint: artifactFingerprint,
          })
          .select("version_id");

        const versionData = Array.isArray(versionInsert.data) ? toRecord(versionInsert.data[0]) : {};
        const versionId = toTrimmedString(versionData.version_id);
        if (versionInsert.error || !versionId) {
          throw new Error(`artifact_version_persist_failed:${JSON.stringify(versionInsert.error).slice(0, 260)}`);
        }

        const activationResult = await (supabase
          .from("artifacts")
          .update({
            active_version_id: versionId,
            is_active: true,
            deactivated_at: null,
          }) as unknown as {
          eq: (column: string, value: string) => QueryResult<unknown>;
        })
          .eq("artifact_id", insertedArtifactId);

        if (activationResult.error) {
          throw new Error(`artifact_activation_failed:${JSON.stringify(activationResult.error).slice(0, 260)}`);
        }

        insertedArtifacts.push({
          artifact_type: type as ArtifactType,
          artifact_data: toRecord(insertedRow.artifact_data),
        });
      }
      continue;
    }

    const errorCode = toTrimmedString(toRecord(error).code);
    if (errorCode !== duplicateKeyErrorCode) {
      throw new Error(`artifact_persist_failed:${JSON.stringify(error).slice(0, 260)}`);
    }

    const existingArtifactQuery = await (supabase
      .from("artifacts")
      .select("artifact_id, artifact_data, file_refs, source_provenance, source_object_id, active_version_id") as unknown as {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => {
          limit: (count: number) => QueryResult<unknown>;
        };
      };
    })
      .eq("profile_id", profileId)
      .eq("artifact_fingerprint", artifactFingerprint)
      .limit(1);

    const existingRows = Array.isArray(existingArtifactQuery.data) ? existingArtifactQuery.data : [];
    const existingArtifact = toRecord(existingRows[0]);
    const existingArtifactId = toTrimmedString(existingArtifact.artifact_id);
    if (!existingArtifactId) continue;

    const mergedFileRefs =
      fileRef === null || fileRef === undefined
        ? (Array.isArray(existingArtifact.file_refs) ? existingArtifact.file_refs : [])
        : mergeFileRefs({
            existingFileRefs: existingArtifact.file_refs,
            nextFileRef: fileRef,
          });

    const existingData = toRecord(existingArtifact.artifact_data);
    const existingSourceObjectId = toTrimmedString(existingArtifact.source_object_id);
    const isEquivalent =
      JSON.stringify(existingData) === JSON.stringify(artifact.artifact_data) &&
      existingSourceObjectId === sourceObjectId;

    if (isEquivalent) {
      const updateExistingResult = await (supabase
        .from("artifacts")
        .update({
          file_refs: mergedFileRefs,
          source_provenance: mergedSourceProvenance,
          source_object_id: sourceObjectId,
          ingestion_run_id: ingestionRunId,
          is_active: true,
          deactivated_at: null,
        }) as unknown as {
        eq: (column: string, value: string) => QueryResult<unknown>;
      })
        .eq("artifact_id", existingArtifactId);

      if (updateExistingResult.error) {
        throw new Error(`artifact_link_existing_source_failed:${JSON.stringify(updateExistingResult.error).slice(0, 260)}`);
      }
      continue;
    }

    const versionInsert = await supabase
      .from("artifact_versions")
      .insert({
        artifact_id: existingArtifactId,
        profile_id: profileId,
        operation: "reextract",
        artifact_type: artifact.artifact_type,
        artifact_data: artifact.artifact_data,
        file_refs: mergedFileRefs,
        verification_status: toTrimmedString(toRecord(artifact.artifact_data).verification_status) ?? "unverified",
            source_provenance: mergedSourceProvenance,
        source_object_id: sourceObjectId,
        ingestion_run_id: ingestionRunId,
        artifact_fingerprint: artifactFingerprint,
      })
      .select("version_id");

    const versionData = Array.isArray(versionInsert.data) ? toRecord(versionInsert.data[0]) : {};
    const versionId = toTrimmedString(versionData.version_id);
    if (versionInsert.error || !versionId) {
      throw new Error(`artifact_version_persist_failed:${JSON.stringify(versionInsert.error).slice(0, 260)}`);
    }

    const updateResult = await (supabase
      .from("artifacts")
      .update({
        artifact_data: artifact.artifact_data,
        file_refs: mergedFileRefs,
        source_provenance: mergedSourceProvenance,
        source_object_id: sourceObjectId,
        ingestion_run_id: ingestionRunId,
        active_version_id: versionId,
        is_active: true,
        deactivated_at: null,
      }) as unknown as {
      eq: (column: string, value: string) => QueryResult<unknown>;
    })
      .eq("artifact_id", existingArtifactId);

    if (updateResult.error) {
      throw new Error(`artifact_update_existing_source_failed:${JSON.stringify(updateResult.error).slice(0, 260)}`);
    }
  }

  return insertedArtifacts;
}

export async function upsertStudentExtractionMetadata({
  supabase,
  profileId,
  sourceKey,
  artifactCount,
  status,
  errorMessage,
  extractedFrom,
  extractedFromFilename,
  profileLinks,
  storageFileRef,
  identityConfidence,
  warningCode,
  warningMessage,
  resultSummary
}: {
  supabase: SupabaseClientLike;
  profileId: string;
  sourceKey: SourceLogKey;
  artifactCount: number;
  status?: SourceExtractionStatus;
  errorMessage?: string | null;
  extractedFrom?: string | null;
  extractedFromFilename?: string | null;
  profileLinks?: Record<string, string | null>;
  storageFileRef?: StorageFileRef | null;
  identityConfidence?: SourceOwnershipConfidence | null;
  warningCode?: string | null;
  warningMessage?: string | null;
  resultSummary?: string | null;
}) {
  const { data: rows } = await supabase
    .from("students")
    .select("student_data")
    .eq("profile_id", profileId)
    .limit(1);

  const existingStudentData = toRecord((Array.isArray(rows) ? (rows[0] as Record<string, unknown>) : {}).student_data);
  const existingLog = toRecord(existingStudentData.source_extraction_log);
  const existingProfileLinks = toRecord(existingStudentData.profile_links);
  const sanitizedProfileLinks = sanitizeExtractionProfileLinks(profileLinks);

  const nextLogEntry: Record<string, unknown> = {
    last_extracted_at: new Date().toISOString(),
    artifact_count: artifactCount
  };
  if (status) nextLogEntry.status = status;

  const normalizedFrom = toTrimmedString(extractedFrom);
  const normalizedFilename = toTrimmedString(extractedFromFilename);
  const normalizedErrorMessage = toTrimmedString(errorMessage);
  const normalizedWarningCode = toTrimmedString(warningCode);
  const normalizedWarningMessage = toTrimmedString(warningMessage);
  const normalizedResultSummary = toTrimmedString(resultSummary);
  if (identityConfidence === "high" || identityConfidence === "medium" || identityConfidence === "low") {
    nextLogEntry.identity_confidence = identityConfidence;
  }
  if (normalizedFrom) nextLogEntry.extracted_from = normalizedFrom;
  if (normalizedFilename) nextLogEntry.extracted_from_filename = normalizedFilename;
  if (normalizedErrorMessage) nextLogEntry.error_message = normalizedErrorMessage;
  if (normalizedWarningCode) nextLogEntry.warning_code = normalizedWarningCode;
  if (normalizedWarningMessage) nextLogEntry.warning_message = normalizedWarningMessage;
  if (normalizedResultSummary) nextLogEntry.last_run_summary = normalizedResultSummary;
  if (storageFileRef?.bucket && storageFileRef?.path) {
    nextLogEntry.storage_file_ref = {
      bucket: storageFileRef.bucket,
      path: storageFileRef.path,
      ...(storageFileRef.kind ? { kind: storageFileRef.kind } : {})
    };
  }

  const nextStudentData: Record<string, unknown> = {
    ...existingStudentData,
    source_extraction_log: {
      ...existingLog,
      [sourceKey]: nextLogEntry
    }
  };

  if (Object.keys(sanitizedProfileLinks).length > 0) {
    nextStudentData.profile_links = {
      ...existingProfileLinks,
      ...sanitizedProfileLinks
    };
  }

  await supabase.from("students").upsert(
    {
      profile_id: profileId,
      student_data: nextStudentData
    },
    { onConflict: "profile_id" }
  );
}
