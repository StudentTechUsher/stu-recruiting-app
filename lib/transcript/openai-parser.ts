import { normalizeTranscriptParseResult, type TranscriptParseResult } from "@/lib/transcript/intake";

const DEFAULT_TRANSCRIPT_MODEL = "gpt-5-mini";

const transcriptSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    institution_name: { type: ["string", "null"] },
    student_name: { type: ["string", "null"] },
    program: { type: ["string", "null"] },
    transcript_level: { type: ["string", "null"] },
    courses: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: true,
        properties: {
          course_code: { type: ["string", "null"] },
          course_title: { type: ["string", "null"] },
          term: { type: ["string", "null"] },
          credits: { type: ["number", "string", "null"] },
          grade: { type: ["string", "null"] },
          course_meta: { type: ["object", "null"], additionalProperties: true }
        },
        required: []
      }
    }
  },
  required: ["courses"]
} as const;

const extractOutputText = (payload: unknown): string | null => {
  if (typeof payload !== "object" || payload === null) return null;
  const data = payload as Record<string, unknown>;

  if (typeof data.output_text === "string" && data.output_text.trim().length > 0) {
    return data.output_text;
  }

  if (Array.isArray(data.output)) {
    const chunks: string[] = [];
    for (const item of data.output) {
      if (typeof item !== "object" || item === null) continue;
      const content = (item as Record<string, unknown>).content;
      if (!Array.isArray(content)) continue;
      for (const part of content) {
        if (typeof part !== "object" || part === null) continue;
        const text = (part as Record<string, unknown>).text;
        if (typeof text === "string" && text.trim().length > 0) chunks.push(text);
      }
    }

    if (chunks.length > 0) return chunks.join("\n");
  }

  return null;
};

const heuristicParseTranscriptText = (transcriptText: string): TranscriptParseResult => {
  const lines = transcriptText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const courses: Array<Record<string, unknown>> = [];

  const linePattern =
    /^([A-Z]{2,5}\s?-?\d{2,4}[A-Z]?)\s+(.+?)(?:\s+(\d+(?:\.\d+)?))?(?:\s+([A-F][+-]?|P|NP|CR|NC|S|U))?$/i;

  for (const line of lines) {
    const match = linePattern.exec(line);
    if (!match) continue;

    courses.push({
      course_code: match[1],
      course_title: match[2],
      credits: match[3] ?? null,
      grade: match[4] ?? null
    });
  }

  return normalizeTranscriptParseResult({
    courses
  });
};

export async function parseTranscriptTextWithOpenAI({
  transcriptText,
  model = process.env.OPENAI_TRANSCRIPT_PARSE_MODEL || DEFAULT_TRANSCRIPT_MODEL
}: {
  transcriptText: string;
  model?: string;
}): Promise<TranscriptParseResult> {
  const trimmedText = transcriptText.trim();
  if (trimmedText.length === 0) return normalizeTranscriptParseResult({ courses: [] });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return heuristicParseTranscriptText(trimmedText);
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
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
          name: "transcript_course_parse",
          schema: transcriptSchema,
          strict: true
        }
      },
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "Parse the transcript text into structured course data. Return only valid JSON matching the schema. " +
                "Capture essential fields (course_code, course_title, term, credits, grade) and put extra details in course_meta."
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: trimmedText.slice(0, 200_000)
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const fallback = await response.text().catch(() => "");
    throw new Error(`openai_parse_failed:${response.status}:${fallback.slice(0, 400)}`);
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  const outputText = extractOutputText(payload);
  if (!outputText) {
    throw new Error("openai_parse_failed:empty_output");
  }

  const parsedPayload = JSON.parse(outputText) as unknown;
  return normalizeTranscriptParseResult(parsedPayload);
}
