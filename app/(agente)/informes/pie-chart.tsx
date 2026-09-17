"use client";

import { useState } from "react";
import Link from "next/link";
import type { Dimension, FocoRow } from "./data";

const COLORS = [
  "#111111",
  "#2563eb",
  "#2f855a",
  "#d97706",
  "#7c3aed",
  "#dc2626",
  "#0891b2",
  "#94a3b8",
];

const OTROS_COLOR = "#d4d4d4";
const MAX_SLICES = 7;

type Slice = FocoRow & { pct: number; offset: number; color: string };

export function FocosPieChart({
  rows,
  dimension,
  otherParams,
}: {
  rows: FocoRow[];
  dimension: Dimension;
  otherParams: Record<string, string | undefined>;
}) {
  const [hoverId, setHoverId] = useState<number | null>(null);

  const total = rows.reduce((sum, r) => sum + r.tickets, 0);

  if (total === 0) {
    return <p className="text-[12.5px] text-ink-muted">Sin tickets en este periodo.</p>;
  }

  const top = rows.slice(0, MAX_SLICES);
  const resto = rows.slice(MAX_SLICES);
  const restoTickets = resto.reduce((sum, r) => sum + r.tickets, 0);

  const base: FocoRow[] =
    restoTickets > 0
      ? [
          ...top,
          {
            id: -2,
            nombre: "Otros",
            tickets: restoTickets,
            porcentaje: (restoTickets / total) * 100,
            abiertos: 0,
            resolucionMedianaSeg: null,
            reaperturas: 0,
          },
        ]
      : top;

  const pcts = base.map((row) => (row.tickets / total) * 100);
  const slices: Slice[] = base.map((row, i) => ({
    ...row,
    pct: pcts[i],
    offset: -pcts.slice(0, i).reduce((sum, p) => sum + p, 0),
    color: row.id === -2 ? OTROS_COLOR : COLORS[i % COLORS.length],
  }));

  function drillHref(row: FocoRow) {
    if (row.id === -1 || row.id === -2) return null;
    const params = new URLSearchParams(
      Object.entries(otherParams).filter((e): e is [string, string] => Boolean(e[1])),
    );
    params.set(dimension, String(row.id));
    return `/tickets?${params.toString()}`;
  }

  return (
    <div className="flex items-center gap-6">
      <div className="relative shrink-0" style={{ width: 148, height: 148 }}>
        <svg viewBox="0 0 36 36" width={148} height={148} className="-rotate-90">
          <circle cx={18} cy={18} r={15.5} fill="none" stroke="var(--color-surface-2)" strokeWidth={5} />
          {slices.map((slice) => (
            <circle
              key={slice.id}
              cx={18}
              cy={18}
              r={15.5}
              fill="none"
              stroke={slice.color}
              strokeWidth={hoverId === slice.id ? 6.5 : 5}
              strokeDasharray={`${slice.pct} ${100 - slice.pct}`}
              strokeDashoffset={slice.offset}
              pathLength={100}
              style={{ transition: "stroke-width 120ms" }}
              onMouseEnter={() => setHoverId(slice.id)}
              onMouseLeave={() => setHoverId(null)}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[18px] font-semibold leading-none text-ink">{total}</span>
          <span className="mt-1 text-[10.5px] text-ink-muted">tickets</span>
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-1.5">
        {slices.map((slice) => {
          const href = drillHref(slice);
          const content = (
            <>
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-secondary">{slice.nombre}</span>
              <span className="shrink-0 text-[12.5px] font-medium text-ink">{Math.round(slice.pct)}%</span>
            </>
          );
          return (
            <li key={slice.id}>
              {href ? (
                <Link
                  href={href}
                  onMouseEnter={() => setHoverId(slice.id)}
                  onMouseLeave={() => setHoverId(null)}
                  className="flex items-center gap-2 rounded-btn px-1 py-0.5 transition-colors duration-150 hover:bg-surface-hover"
                >
                  {content}
                </Link>
              ) : (
                <div
                  onMouseEnter={() => setHoverId(slice.id)}
                  onMouseLeave={() => setHoverId(null)}
                  className="flex items-center gap-2 px-1 py-0.5"
                >
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
