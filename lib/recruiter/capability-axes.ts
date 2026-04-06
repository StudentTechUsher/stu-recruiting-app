import { isKnownCapabilityAxis } from "@/lib/capabilities/ontology";

export const REQUIRED_LEVEL_SOURCES = ["authored", "legacy_default"] as const;
export type RequiredLevelSource = (typeof REQUIRED_LEVEL_SOURCES)[number];

export type RoleCapabilityAxis = {
  axis_id: string;
  required_level: number;
  weight: number;
  required_level_source: RequiredLevelSource;
  required_evidence_types?: string[];
  is_active?: boolean;
};

const toRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const toRequiredLevelSource = (value: unknown, fallback: RequiredLevelSource): RequiredLevelSource => {
  if (typeof value !== "string") return fallback;
  if (REQUIRED_LEVEL_SOURCES.includes(value as RequiredLevelSource)) {
    return value as RequiredLevelSource;
  }
  return fallback;
};

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

export const normalizeRoleCapabilityAxes = ({
  axes,
  weights,
}: {
  axes: unknown;
  weights: unknown;
}): RoleCapabilityAxis[] => {
  if (Array.isArray(axes)) {
    const normalizedAxes: RoleCapabilityAxis[] = [];
    const seen = new Set<string>();

    for (const entry of axes) {
      const record = toRecord(entry);
      const axisId = typeof record.axis_id === "string" ? record.axis_id.trim() : "";
      if (!axisId || seen.has(axisId)) continue;
      seen.add(axisId);
      const requiredLevel = toFiniteNumber(record.required_level);
      const weight = toFiniteNumber(record.weight);
      normalizedAxes.push({
        axis_id: axisId,
        required_level: clamp01(requiredLevel ?? 0),
        weight: Math.max(weight ?? 0, 0),
        required_level_source: toRequiredLevelSource(record.required_level_source, "authored"),
        required_evidence_types: toStringArray(record.required_evidence_types),
        is_active: record.is_active === false ? false : true,
      });
    }

    return normalizedAxes;
  }

  const weightRecord = toRecord(weights);
  const legacyAxes: RoleCapabilityAxis[] = [];
  for (const [axisIdRaw, value] of Object.entries(weightRecord)) {
    const axisId = axisIdRaw.trim();
    if (!axisId) continue;
    const weight = toFiniteNumber(value);
    if (weight === null) continue;
    legacyAxes.push({
      axis_id: axisId,
      required_level: 0.7,
      required_level_source: "legacy_default",
      weight: Math.max(weight, 0),
      required_evidence_types: [],
      is_active: true,
    });
  }
  return legacyAxes;
};

export const getActiveRoleCapabilityAxes = (axes: RoleCapabilityAxis[]): RoleCapabilityAxis[] =>
  axes.filter((axis) => axis.is_active !== false);

export const toLegacyWeights = (axes: RoleCapabilityAxis[]): Record<string, number> => {
  const weights: Record<string, number> = {};
  for (const axis of axes) {
    if (axis.is_active === false) continue;
    weights[axis.axis_id] = axis.weight;
  }
  return weights;
};

export const validateRoleCapabilityAxes = (axes: RoleCapabilityAxis[]): string | null => {
  if (axes.length === 0) return "capability_axes_required";
  const seen = new Set<string>();

  for (const axis of axes) {
    if (!axis.axis_id) return "capability_axis_id_required";
    if (seen.has(axis.axis_id)) return "capability_axis_duplicate";
    seen.add(axis.axis_id);
    if (!isKnownCapabilityAxis(axis.axis_id)) return "capability_axis_unknown";
    if (!Number.isFinite(axis.required_level) || axis.required_level < 0 || axis.required_level > 1) {
      return "capability_axis_required_level_invalid";
    }
    if (!Number.isFinite(axis.weight) || axis.weight < 0) return "capability_axis_weight_invalid";
  }

  const activeAxes = getActiveRoleCapabilityAxes(axes);
  if (activeAxes.length === 0) return "capability_axis_no_active_axes";
  const activeWeightSum = activeAxes.reduce((sum, axis) => sum + axis.weight, 0);
  if (activeWeightSum <= 0) return "capability_axis_weight_sum_invalid";
  return null;
};
