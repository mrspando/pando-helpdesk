"use client";

import { useId, useState } from "react";

type Serie = {
  key: string;
  color: string;
  label: string;
  values: number[];
};

export function EvolutionChart({
  labels,
  series,
  height = 160,
}: {
  labels: string[];
  series: Serie[];
  height?: number;
}) {
  const gradientId = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (labels.length === 0) return null;

  const width = Math.max(labels.length * 36, 320);
  const padding = { top: 12, right: 8, bottom: 24, left: 8 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const stepX = labels.length > 1 ? innerW / (labels.length - 1) : 0;

  function pointsFor(values: number[]) {
    return values.map((v, i) => {
      const x = padding.left + i * stepX;
      const y = padding.top + innerH - (v / max) * innerH;
      return { x, y, v };
    });
  }

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} className="block" role="img" aria-label="Gráfica de evolución temporal">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-pando)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="var(--color-pando)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* línea base */}
        <line
          x1={padding.left}
          y1={padding.top + innerH}
          x2={padding.left + innerW}
          y2={padding.top + innerH}
          stroke="var(--color-border)"
          strokeWidth={1}
        />

        {series.map((s, si) => {
          const pts = pointsFor(s.values);
          const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
          const areaPath =
            si === 0
              ? `${linePath} L${pts[pts.length - 1].x},${padding.top + innerH} L${pts[0].x},${padding.top + innerH} Z`
              : null;

          return (
            <g key={s.key}>
              {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
              <path d={linePath} fill="none" stroke={s.color} strokeWidth={1.75} />
              {pts.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={hoverIndex === i ? 3.5 : 2}
                  fill={s.color}
                  className="transition-all duration-150"
                />
              ))}
            </g>
          );
        })}

        {/* zonas invisibles para hover/tooltip por índice */}
        {labels.map((_, i) => (
          <rect
            key={i}
            x={padding.left + i * stepX - stepX / 2}
            y={0}
            width={stepX || innerW}
            height={height}
            fill="transparent"
            onMouseEnter={() => setHoverIndex(i)}
            onMouseLeave={() => setHoverIndex((v) => (v === i ? null : v))}
          />
        ))}

        {labels.map(
          (label, i) =>
            (i === 0 || i === labels.length - 1 || i === hoverIndex) && (
              <text
                key={label + i}
                x={padding.left + i * stepX}
                y={height - 6}
                textAnchor={i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle"}
                className="fill-ink-muted text-[10px]"
              >
                {label}
              </text>
            ),
        )}
      </svg>

      {hoverIndex !== null && (
        <div className="mt-1 flex gap-3 px-1 text-[12px] text-ink-secondary">
          <span className="font-medium text-ink">{labels[hoverIndex]}</span>
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}: {s.values[hoverIndex]}
            </span>
          ))}
        </div>
      )}

      <div className="mt-1 flex gap-3 px-1 text-[12px] text-ink-muted">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
