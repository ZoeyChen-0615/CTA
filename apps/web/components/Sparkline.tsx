"use client";

type Props = {
  points: number[];
  color: string;
  width?: number;
  height?: number;
};

export default function Sparkline({ points, color, width = 72, height = 18 }: Props) {
  if (points.length === 0) {
    return (
      <svg width={width} height={height} className="opacity-40">
        <line
          x1={0}
          y1={height - 1}
          x2={width}
          y2={height - 1}
          stroke="currentColor"
          strokeDasharray="2 2"
        />
      </svg>
    );
  }

  const max = Math.max(...points, 1);
  const stepX = points.length > 1 ? width / (points.length - 1) : 0;
  const toY = (v: number) => height - 1 - (v / max) * (height - 2);

  const d = points
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i * stepX).toFixed(2)},${toY(v).toFixed(2)}`)
    .join(" ");

  const last = points[points.length - 1];

  return (
    <svg width={width} height={height}>
      <path d={d} stroke={color} strokeWidth={1.5} fill="none" />
      <circle cx={(points.length - 1) * stepX} cy={toY(last)} r={1.8} fill={color} />
    </svg>
  );
}
