import { promises as fs } from "node:fs";
import path from "node:path";
import type { ConnectionRecord } from "@/lib/networking/types";

type ConnectionsPayload = {
  generated_at?: string;
  source_csv?: string;
  total_connections?: number;
  connections?: unknown;
};

const connectionsJsonPath = path.join(process.cwd(), "data/networking/connections.json");

let cachedConnections: ConnectionRecord[] | null = null;

const toTrimmedString = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const normalizeConnection = (value: unknown): ConnectionRecord | null => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const name = toTrimmedString(record.name);
  const headline = toTrimmedString(record.headline);
  const url = toTrimmedString(record.url);
  if (!name || !url) return null;
  if (!/^https?:\/\//i.test(url)) return null;
  return { name, headline, url };
};

export async function getConnectionsBaseline(): Promise<ConnectionRecord[] | null> {
  if (cachedConnections) return cachedConnections;

  try {
    const raw = await fs.readFile(connectionsJsonPath, "utf8");
    const parsed = JSON.parse(raw) as ConnectionsPayload;
    const rows = Array.isArray(parsed.connections) ? parsed.connections : [];
    const normalized = rows
      .map((row) => normalizeConnection(row))
      .filter((row): row is ConnectionRecord => Boolean(row));
    if (normalized.length === 0) return null;
    cachedConnections = normalized;
    return normalized;
  } catch {
    return null;
  }
}

export function resetConnectionsCacheForTests() {
  cachedConnections = null;
}

