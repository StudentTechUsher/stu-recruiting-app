type CapabilityRadarAxis = {
  id: string;
  label: string;
  magnitude: number;
};

type CapabilityRadarProps = {
  axes: CapabilityRadarAxis[];
  ariaLabel: string;
  className?: string;
  labelFontSize?: number;
};

const clampMagnitude = (value: number): number => {
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
  const normalizedMagnitude = clampMagnitude(magnitude);
  return {
    x: center + radius * normalizedMagnitude * Math.cos(angle),
    y: center + radius * normalizedMagnitude * Math.sin(angle),
  };
};

const buildPolygonPoints = (axes: CapabilityRadarAxis[], center: number, radius: number): string => {
  if (axes.length === 0) return "";
  const count = Math.max(axes.length, 1);
  return axes
    .map((axis, index) => {
      const point = radarCoordinates({
        index,
        count,
        radius,
        center,
        magnitude: axis.magnitude,
      });
      return `${point.x},${point.y}`;
    })
    .join(" ");
};

export function CapabilityRadar({
  axes,
  ariaLabel,
  className = "h-[420px] w-full max-w-[560px]",
  labelFontSize = 13,
}: CapabilityRadarProps) {
  const count = Math.max(axes.length, 1);
  const center = 170;
  const outerRadius = 120;
  const polygonPoints = buildPolygonPoints(axes, center, outerRadius);

  const axisMap = axes.map((axis, index) => {
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
    <svg
      viewBox="-120 -100 580 540"
      className={className}
      role="img"
      aria-label={ariaLabel}
    >
      <circle cx={center} cy={center} r={outerRadius} fill="#f6fbf8" stroke="#d1e0d9" strokeWidth="1" />
      <circle cx={center} cy={center} r="80" fill="none" stroke="#d7e4de" strokeWidth="1" />
      <circle cx={center} cy={center} r="40" fill="none" stroke="#dfe9e4" strokeWidth="1" />
      {axisMap.map((axisEntry) => (
        <g key={`axis-${axisEntry.axis.id}`}>
          <line
            x1={center}
            y1={center}
            x2={axisEntry.outer.x}
            y2={axisEntry.outer.y}
            stroke="#d5e3dd"
            strokeWidth="1"
          />
          <circle cx={axisEntry.outer.x} cy={axisEntry.outer.y} r="2.5" fill="#10b981" stroke="#065f46" strokeWidth="0.5" />
          <text
            x={axisEntry.label.x}
            y={axisEntry.label.y}
            textAnchor={axisEntry.textAnchor}
            dominantBaseline={axisEntry.dominantBaseline}
            fontSize={labelFontSize}
            fontWeight="700"
            fill="#0f5132"
            style={{ paintOrder: "stroke", stroke: "#f6fbf8", strokeWidth: 3 }}
          >
            {axisEntry.axis.label}
          </text>
        </g>
      ))}
      {axes.length > 0 && polygonPoints.length > 0 ? (
        <polygon points={polygonPoints} fill="#56d99f66" stroke="#149966" strokeWidth="2" />
      ) : null}
    </svg>
  );
}

export type { CapabilityRadarAxis };
