import { inflateSync } from "node:zlib";

const normalizeWhitespace = (value: string): string =>
  value
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

const unescapePdfString = (value: string): string =>
  value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");

const extractTextOperators = (source: string): string[] => {
  const chunks: string[] = [];

  const tjRegex = /\(([^)]*)\)\s*Tj/g;
  let tjMatch: RegExpExecArray | null;
  while ((tjMatch = tjRegex.exec(source)) !== null) {
    chunks.push(unescapePdfString(tjMatch[1]));
  }

  const tjArrayRegex = /\[(.*?)\]\s*TJ/gs;
  let tjArrayMatch: RegExpExecArray | null;
  while ((tjArrayMatch = tjArrayRegex.exec(source)) !== null) {
    const segment = tjArrayMatch[1];
    const innerRegex = /\(([^)]*)\)/g;
    let innerMatch: RegExpExecArray | null;
    while ((innerMatch = innerRegex.exec(segment)) !== null) {
      chunks.push(unescapePdfString(innerMatch[1]));
    }
  }

  const rawTextRegex = /BT([\s\S]*?)ET/g;
  let rawTextMatch: RegExpExecArray | null;
  while ((rawTextMatch = rawTextRegex.exec(source)) !== null) {
    const block = rawTextMatch[1];
    const plain = block.replace(/[\(\)<>]/g, " ").replace(/[^\x20-\x7E\n]/g, " ");
    if (plain.trim().length > 0) chunks.push(plain);
  }

  return chunks;
};

const extractFlateStreams = (source: string): string[] => {
  const chunks: string[] = [];
  const streamRegex = /(<<[\s\S]*?>>)\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;

  while ((match = streamRegex.exec(source)) !== null) {
    const dict = match[1];
    const streamBody = match[2];
    if (!dict.includes("/FlateDecode")) continue;

    try {
      const inflated = inflateSync(Buffer.from(streamBody, "latin1")).toString("latin1");
      chunks.push(inflated);
    } catch {
      // Ignore non-inflatable streams and continue.
    }
  }

  return chunks;
};

export function extractTextFromPdfBuffer(buffer: Buffer): string {
  const latin1 = buffer.toString("latin1");
  const rawChunks = extractTextOperators(latin1);
  const streamChunks = extractFlateStreams(latin1).flatMap((value) => extractTextOperators(value));
  const merged = [...rawChunks, ...streamChunks].join("\n");

  if (merged.trim().length > 0) return normalizeWhitespace(merged);

  const fallback = buffer.toString("utf8").replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ");
  return normalizeWhitespace(fallback);
}
