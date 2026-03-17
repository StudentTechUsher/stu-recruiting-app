import { getAuthContext } from "@/lib/auth-context";
import { badRequest, forbidden, ok } from "@/lib/api-response";
import { hasPersona } from "@/lib/authorization";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type SourceDocumentKey = "resume" | "transcript";
type StorageFileRef = { bucket: string; path: string };

type SupabaseStorageClient = {
  storage: {
    from: (bucket: string) => {
      createSignedUrl: (
        path: string,
        expiresIn: number
      ) => Promise<{ data: { signedUrl?: string | null } | null; error: unknown }>;
    };
  };
};

const signedUrlTtlSeconds = 10 * 60;

const toRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const toTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const parseSourceDocumentKey = (value: unknown): SourceDocumentKey | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "resume" || normalized === "transcript") return normalized;
  return null;
};

const parseStorageFileRef = (value: unknown): StorageFileRef | null => {
  const row = toRecord(value);
  const bucket = toTrimmedString(row.bucket);
  const path = toTrimmedString(row.path);
  if (!bucket || !path) return null;
  return { bucket, path };
};

export async function POST(req: Request) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["student"])) return forbidden();

  const supabase = await getSupabaseServerClient();
  if (!supabase) return badRequest("supabase_unavailable");

  const payload = await req.json().catch(() => null);
  const source = parseSourceDocumentKey(toRecord(payload).source);
  if (!source) return badRequest("source_required");

  const { data: studentRows } = await supabase
    .from("students")
    .select("student_data")
    .eq("profile_id", context.user_id)
    .limit(1);

  const studentData = toRecord((studentRows as Array<{ student_data: unknown }> | null)?.[0]?.student_data);
  const sourceExtractionLog = toRecord(studentData.source_extraction_log);
  const sourceEntry = toRecord(sourceExtractionLog[source]);
  const fileRef = parseStorageFileRef(sourceEntry.storage_file_ref);
  if (!fileRef) return badRequest("source_document_not_found");

  const expectedPrefix = `${context.user_id}/`;
  if (!fileRef.path.startsWith(expectedPrefix)) return forbidden();

  const storageClient = supabase as unknown as SupabaseStorageClient;
  const { data, error } = await storageClient.storage.from(fileRef.bucket).createSignedUrl(fileRef.path, signedUrlTtlSeconds);
  if (error || !data?.signedUrl) return badRequest("source_document_url_unavailable");

  return ok({
    resource: "source_document_url",
    source,
    signed_url: data.signedUrl,
    expires_in_seconds: signedUrlTtlSeconds
  });
}
