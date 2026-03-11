import { describe, expect, it } from "vitest";
import { buildCourseworkArtifactData, normalizeTranscriptParseResult } from "@/lib/transcript/intake";

describe("normalizeTranscriptParseResult", () => {
  it("normalizes valid parsed transcript payloads", () => {
    const result = normalizeTranscriptParseResult({
      institution_name: "Utah Tech University",
      student_name: "Vin Jones",
      courses: [
        {
          course_code: "CS 2420",
          course_title: "Data Structures",
          term: "Fall 2025",
          credits: "3",
          grade: "A",
          section: "001"
        }
      ]
    });

    expect(result.summary.course_count).toBe(1);
    expect(result.summary.institution_name).toBe("Utah Tech University");
    expect(result.courses).toEqual([
      {
        course_code: "CS 2420",
        course_title: "Data Structures",
        term: "Fall 2025",
        credits: 3,
        grade: "A",
        course_meta: {
          section: "001"
        }
      }
    ]);
  });

  it("falls back safely when fields are missing or malformed", () => {
    const result = normalizeTranscriptParseResult({
      courses: [{}, { course_code: "MATH 1040" }, { course_title: "Discrete Math", credits: "invalid" }]
    });

    expect(result.summary.course_count).toBe(3);
    expect(result.courses[0]).toMatchObject({
      course_code: null,
      course_title: "Course 1",
      term: null,
      credits: null,
      grade: null
    });
    expect(result.courses[1]).toMatchObject({
      course_code: "MATH 1040",
      course_title: "Course MATH 1040"
    });
    expect(result.courses[2]).toMatchObject({
      course_title: "Discrete Math",
      credits: null
    });
  });
});

describe("buildCourseworkArtifactData", () => {
  it("creates canonical coursework artifact data with transcript provenance", () => {
    const artifactData = buildCourseworkArtifactData({
      course: {
        course_code: "CS 3510",
        course_title: "Algorithms",
        term: "Spring 2026",
        credits: 3,
        grade: "A-",
        course_meta: { instructor: "Dr. Lee" }
      },
      impactDescription: "Built confidence in analyzing tradeoffs and runtime complexity.",
      transcriptSessionId: "session-1",
      parsedCourseId: "course-1",
      transcriptArtifactId: "artifact-1"
    });

    expect(artifactData).toMatchObject({
      title: "Algorithms (Spring 2026)",
      source: "Transcript coursework",
      type: "coursework",
      course_code: "CS 3510",
      course_title: "Algorithms",
      term: "Spring 2026",
      credits: 3,
      grade: "A-",
      impact_description: "Built confidence in analyzing tradeoffs and runtime complexity.",
      transcript_session_id: "session-1",
      parsed_course_id: "course-1",
      provenance: {
        source: "transcript_parse",
        transcript_artifact_id: "artifact-1"
      }
    });
  });
});
