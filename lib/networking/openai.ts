import type { ConnectionRecord, GeneratedNetworkingPayload, ScoredArtifact } from "@/lib/networking/types";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5-mini";
const OPENAI_TIMEOUT_MS = 45_000;

const suggestionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    selected_url: { type: "string" },
    rationale: { type: "string" },
    invite_message: { type: "string" },
    follow_up_message: { type: "string" },
  },
  required: ["selected_url", "rationale", "invite_message", "follow_up_message"],
} as const;

const toTrimmedString = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const toRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const extractOutputText = (payload: unknown): string | null => {
  if (typeof payload !== "object" || payload === null) return null;
  const root = payload as Record<string, unknown>;

  const direct = toTrimmedString(root.output_text);
  if (direct) return direct;

  if (!Array.isArray(root.output)) return null;

  const chunks: string[] = [];
  for (const item of root.output) {
    if (typeof item !== "object" || item === null) continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (typeof part !== "object" || part === null) continue;
      const text = toTrimmedString((part as Record<string, unknown>).text);
      if (text) chunks.push(text);
    }
  }

  return chunks.length > 0 ? chunks.join("\n") : null;
};

export class OpenAINetworkingError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "OpenAINetworkingError";
    this.code = code;
  }
}

type CallInput = {
  candidatePool: ConnectionRecord[];
  topArtifacts: ScoredArtifact[];
  primaryTarget: {
    role_label: string;
    company_label: string;
  };
  publicProfileUrl: string;
};

type CallOutput = {
  payload: GeneratedNetworkingPayload;
  model: string;
};

export async function callOpenAINetworkingSuggestion(input: CallInput): Promise<CallOutput> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new OpenAINetworkingError("openai_api_key_missing", "OPENAI_API_KEY is missing.");
  }

  const model = process.env.OPENAI_NETWORKING_MODEL?.trim() || DEFAULT_MODEL;

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort("timeout"), OPENAI_TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        text: {
          format: {
            type: "json_schema",
            name: "networking_suggestion",
            schema: suggestionSchema,
            strict: true,
          },
        },
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text:
                  "You draft networking outreach for students. Pick exactly one contact from candidate_pool and write concise messages. " +
                  "Use the student's target role/company and artifacts. Invite message max 300 chars. Follow-up max 700 chars and include the exact public profile URL.",
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: JSON.stringify(
                  {
                    task: "Select one best contact and write invite + follow-up drafts.",
                    primary_target: input.primaryTarget,
                    public_profile_url: input.publicProfileUrl,
                    top_artifacts: input.topArtifacts.map((artifact) => ({
                      artifact_id: artifact.artifact_id,
                      title: artifact.title,
                      source: artifact.source,
                      capability_label: artifact.capability_label,
                      verification_status: artifact.verification_status,
                    })),
                    candidate_pool: input.candidatePool,
                  },
                  null,
                  2
                ),
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const failureText = await response.text().catch(() => "");
      throw new OpenAINetworkingError(
        "openai_response_failed",
        `OpenAI response failed (${response.status}): ${failureText.slice(0, 240)}`
      );
    }

    const payload = (await response.json().catch(() => null)) as unknown;
    const outputText = extractOutputText(payload);
    if (!outputText) {
      throw new OpenAINetworkingError("openai_empty_output", "OpenAI returned an empty output payload.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(outputText);
    } catch {
      throw new OpenAINetworkingError("openai_invalid_json", "OpenAI output was not valid JSON.");
    }

    const record = toRecord(parsed);
    const generated: GeneratedNetworkingPayload = {
      selected_url: toTrimmedString(record.selected_url),
      rationale: toTrimmedString(record.rationale),
      invite_message: toTrimmedString(record.invite_message),
      follow_up_message: toTrimmedString(record.follow_up_message),
    };

    if (!generated.selected_url || !generated.rationale || !generated.invite_message || !generated.follow_up_message) {
      throw new OpenAINetworkingError("openai_invalid_schema", "OpenAI output failed required field checks.");
    }

    return { payload: generated, model };
  } catch (error) {
    if (error instanceof OpenAINetworkingError) throw error;
    if ((error as { name?: string })?.name === "AbortError") {
      throw new OpenAINetworkingError("openai_timeout", "OpenAI request timed out.");
    }
    throw new OpenAINetworkingError(
      "openai_unknown_failure",
      error instanceof Error ? error.message : "Unknown OpenAI networking failure."
    );
  } finally {
    clearTimeout(timeoutHandle);
  }
}

