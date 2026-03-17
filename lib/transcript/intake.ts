import { z } from "zod";

export const transcriptParseStatusValues = ["uploaded", "processing", "parsed", "failed"] as const;
export type TranscriptParseStatus = (typeof transcriptParseStatusValues)[number];

export type TranscriptCourse = {
  course_code: string | null;
  course_title: string;
  term: string | null;
  credits: number | null;
  grade: string | null;
  course_meta: Record<string, unknown>;
};

export type TranscriptParseResult = {
  courses: TranscriptCourse[];
  summary: Record<string, unknown>;
};

const courseInputSchema = z
  .object({
    course_code: z.string().trim().nullish(),
    course_title: z.string().trim().nullish(),
    term: z.string().trim().nullish(),
    credits: z.union([z.number(), z.string().trim()]).nullish(),
    grade: z.string().trim().nullish(),
    course_meta: z.record(z.string(), z.unknown()).nullish()
  })
  .passthrough();

const parseResultSchema = z
  .object({
    institution_name: z.string().trim().nullish(),
    student_name: z.string().trim().nullish(),
    program: z.string().trim().nullish(),
    transcript_level: z.string().trim().nullish(),
    courses: z.array(z.unknown()).default([])
  })
  .passthrough();

const toNormalizedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized : null;
};

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function normalizeTranscriptParseResult(raw: unknown): TranscriptParseResult {
  const parsed = parseResultSchema.safeParse(raw);
  const result = parsed.success ? parsed.data : { courses: [] };

  const courses: TranscriptCourse[] = result.courses
    .map((value) => courseInputSchema.safeParse(value))
    .filter((entry): entry is { success: true; data: z.infer<typeof courseInputSchema> } => entry.success)
    .map((entry, index) => {
      const courseCode = toNormalizedString(entry.data.course_code) ?? null;
      const fallbackTitle = courseCode ? `Course ${courseCode}` : `Course ${index + 1}`;
      const courseTitle = toNormalizedString(entry.data.course_title) ?? fallbackTitle;
      const term = toNormalizedString(entry.data.term) ?? null;
      const grade = toNormalizedString(entry.data.grade) ?? null;
      const credits = toNumberOrNull(entry.data.credits);
      const courseMeta = entry.data.course_meta ?? {};

      const known = new Set(["course_code", "course_title", "term", "credits", "grade", "course_meta"]);
      const inferredMeta = Object.fromEntries(
        Object.entries(entry.data).filter(([key]) => !known.has(key))
      ) as Record<string, unknown>;

      return {
        course_code: courseCode,
        course_title: courseTitle,
        term,
        credits,
        grade,
        course_meta: {
          ...inferredMeta,
          ...(typeof courseMeta === "object" && courseMeta !== null ? courseMeta : {})
        }
      };
    });

  const summary: Record<string, unknown> = {
    course_count: courses.length
  };

  const institutionName = toNormalizedString((result as Record<string, unknown>).institution_name);
  const studentName = toNormalizedString((result as Record<string, unknown>).student_name);
  const program = toNormalizedString((result as Record<string, unknown>).program);
  const transcriptLevel = toNormalizedString((result as Record<string, unknown>).transcript_level);

  if (institutionName) summary.institution_name = institutionName;
  if (studentName) summary.student_name = studentName;
  if (program) summary.program = program;
  if (transcriptLevel) summary.transcript_level = transcriptLevel;

  return { courses, summary };
}

export function buildCourseworkArtifactData({
  course,
  impactDescription,
  transcriptSessionId,
  parsedCourseId,
  transcriptArtifactId
}: {
  course: TranscriptCourse;
  impactDescription: string;
  transcriptSessionId: string;
  parsedCourseId: string;
  transcriptArtifactId: string;
}): Record<string, unknown> {
  const normalizedImpact = impactDescription.trim();
  return {
    title: course.term ? `${course.course_title} (${course.term})` : course.course_title,
    source: "Transcript coursework",
    description: normalizedImpact,
    type: "coursework",
    course_code: course.course_code,
    course_title: course.course_title,
    term: course.term,
    credits: course.credits,
    grade: course.grade,
    impact_description: normalizedImpact,
    course_meta: course.course_meta,
    transcript_session_id: transcriptSessionId,
    parsed_course_id: parsedCourseId,
    verification_status: "verified",
    verification_method: "transcript_parse",
    provenance: {
      source: "transcript_parse",
      transcript_artifact_id: transcriptArtifactId
    }
  };
}
