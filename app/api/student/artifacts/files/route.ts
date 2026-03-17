import { badRequest, forbidden, ok } from "@/lib/api-response";
import { getAuthContext } from "@/lib/auth-context";
import { hasPersona } from "@/lib/authorization";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const ARTIFACT_BUCKET = "student-artifacts-private";
const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const allowedFileRefKinds = new Set(["artifact_supporting_file", "syllabus"]);
const allowedExtensions = new Set([
  "pdf",
  "doc",
  "docx",
  "txt",
  "rtf",
  "md",
  "csv",
  "ppt",
  "pptx",
  "xls",
  "xlsx",
  "png",
  "jpg",
  "jpeg",
  "webp"
]);

const toSafeFileName = (value: string): string =>
  value
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);

const getMaxUploadBytes = (): number => {
  const raw = process.env.ARTIFACT_MAX_UPLOAD_BYTES;
  if (!raw) return DEFAULT_MAX_UPLOAD_BYTES;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_UPLOAD_BYTES;
};

const getFileExtension = (fileName: string): string => {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
};

const toTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

export async function POST(req: Request) {
  const context = await getAuthContext();
  if (!hasPersona(context, ["student"])) return forbidden();

  const supabase = await getSupabaseServerClient();
  if (!supabase) return badRequest("supabase_unavailable");

  const form = await req.formData().catch(() => null);
  const uploaded = form?.get("file");
  if (!(uploaded instanceof File)) return badRequest("artifact_file_required");
  const requestedKind = toTrimmedString(form?.get("kind"));
  const fileRefKind = requestedKind && allowedFileRefKinds.has(requestedKind) ? requestedKind : "artifact_supporting_file";

  const fileName = uploaded.name || "artifact-file";
  const extension = getFileExtension(fileName);
  if (!allowedExtensions.has(extension)) return badRequest("artifact_file_type_not_supported");

  const maxUploadBytes = getMaxUploadBytes();
  if (uploaded.size <= 0 || uploaded.size > maxUploadBytes) return badRequest("artifact_file_size_invalid");

  const safeName = toSafeFileName(fileName) || `artifact-${Date.now()}.${extension || "bin"}`;
  const filePath = `${context.user_id}/artifacts/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage.from(ARTIFACT_BUCKET).upload(filePath, uploaded, {
    upsert: false,
    contentType: uploaded.type || "application/octet-stream"
  });

  if (uploadError) return badRequest("artifact_file_upload_failed");

  const now = new Date().toISOString();
  const fileRef = {
    kind: fileRefKind,
    bucket: ARTIFACT_BUCKET,
    path: filePath,
    file_name: fileName,
    content_type: uploaded.type || "application/octet-stream",
    size_bytes: uploaded.size,
    uploaded_at: now
  };

  return ok({
    resource: "artifact_file_upload",
    profile_id: context.user_id,
    file_ref: fileRef,
    session_source: context.session_source ?? "none"
  });
}
