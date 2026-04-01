type EvidenceTargetRadarAxis = {
  capability_id: string;
  label: string;
  target_magnitude: number;
  evidence_magnitude: number;
  evidence_state: "missing" | "tentative" | "strong";
};

type EvidenceTargetRadarProps = {
  axes: EvidenceTargetRadarAxis[];
  ariaLabel: string;
  className?: string;
};

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

const radarCoordinates = ({
  index,
  count,
  radius,
  center,
  magnitude,
}: {
  index: number;
  count: number;
  radius: number;
  center: number;
  magnitude: number;
}): { x: number; y: number } => {
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  const normalizedMagnitude = clamp01(magnitude);
  return {
    x: center + radius * normalizedMagnitude * Math.cos(angle),
    y: center + radius * normalizedMagnitude * Math.sin(angle),
  };
};

const buildPolygonPoints = ({
  axes,
  center,
  radius,
  key,
}: {
  axes: EvidenceTargetRadarAxis[];
  center: number;
  radius: number;
  key: "target_magnitude" | "evidence_magnitude";
}): string => {
  if (axes.length === 0) return "";
  const count = Math.max(axes.length, 1);
  return axes
    .map((axis, index) => {
      const point = radarCoordinates({
        index,
        count,
        radius,
        center,
        magnitude: axis[key],
      });
      return `${point.x},${point.y}`;
    })
    .join(" ");
};

const truncLabel = (value: string): string => {
  const normalized = value.trim();
  if (normalized.length <= 22) return normalized;
  return `${normalized.slice(0, 19)}...`;
};

export function EvidenceTargetRadar({
  axes,
  ariaLabel,
  className = "h-[360px] w-full max-w-[520px]",
}: EvidenceTargetRadarProps) {
  if (axes.length < 3) {
    return (
      <div className="w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900 dark:border-amber-400/35 dark:bg-amber-500/10 dark:text-amber-200">
        Add more capability coverage data to render this chart.
      </div>
    );
  }

  const center = 170;
  const outerRadius = 120;
  const count = Math.max(axes.length, 1);
  const targetPoints = buildPolygonPoints({ axes, center, radius: outerRadius, key: "target_magnitude" });
  const evidencePoints = buildPolygonPoints({ axes, center, radius: outerRadius, key: "evidence_magnitude" });

  const axisMeta = axes.map((axis, index) => {
    const outer = radarCoordinates({
      index,
      count,
      radius: outerRadius,
      center,
      magnitude: 1,
    });
    const label = radarCoordinates({
      index,
      count,
      radius: 136,
      center,
      magnitude: 1,
    });
    const textAnchor: "start" | "middle" | "end" =
      label.x > 178 ? "start" : label.x < 162 ? "end" : "middle";
    const dominantBaseline: "hanging" | "middle" | "alphabetic" =
      label.y > 178 ? "hanging" : label.y < 162 ? "alphabetic" : "middle";

    return {
      axis,
      outer,
      label,
      textAnchor,
      dominantBaseline,
    };
  });

  return (
    <div className="w-full">
      <div className="mb-2 flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.07em]">
        <span className="inline-flex items-center gap-1 text-[#0d5a42] dark:text-emerald-300">
          <span className="h-2.5 w-2.5 rounded-full bg-[#21c58a]" aria-hidden="true" />
          Evidence coverage
        </span>
        <span className="inline-flex items-center gap-1 text-[#466258] dark:text-slate-300">
          <span className="h-2.5 w-2.5 rounded-full bg-[#8cb6a2]" aria-hidden="true" />
          Target expectation
        </span>
      </div>
      <svg viewBox="-120 -100 580 540" className={className} role="img" aria-label={ariaLabel}>
        <circle cx={center} cy={center} r={outerRadius} fill="#f6fbf8" stroke="#d1e0d9" strokeWidth="1" />
        <circle cx={center} cy={center} r="80" fill="none" stroke="#d7e4de" strokeWidth="1" />
        <circle cx={center} cy={center} r="40" fill="none" stroke="#dfe9e4" strokeWidth="1" />
        {axisMeta.map((entry) => (
          <g key={`axis-${entry.axis.capability_id}`}>
            <line
              x1={center}
              y1={center}
              x2={entry.outer.x}
              y2={entry.outer.y}
              stroke="#d5e3dd"
              strokeWidth="1"
            />
            <text
              x={entry.label.x}
              y={entry.label.y}
              textAnchor={entry.textAnchor}
              dominantBaseline={entry.dominantBaseline}
              fontSize={12}
              fontWeight="700"
              fill="#0f5132"
              style={{ paintOrder: "stroke", stroke: "#f6fbf8", strokeWidth: 3 }}
            >
              {truncLabel(entry.axis.label)}
            </text>
          </g>
        ))}
        {targetPoints.length > 0 ? (
          <>
            <polygon points={targetPoints} fill="#8cb6a255" stroke="#7ea995" strokeWidth="2" />
          </>
        ) : null}
        {evidencePoints.length > 0 ? (
          <>
            <polygon points={evidencePoints} fill="#21c58a5a" stroke="#149966" strokeWidth="2" />
          </>
        ) : null}
      </svg>
    </div>
  );
}

export type { EvidenceTargetRadarAxis };
