import Link from "next/link";
import { formatDuration, type AgingBucketKey } from "@/lib/informes/metrics";
import type { AtencionItem, Dimension, FocoRow } from "./data";
import type { Estado } from "@/lib/format";
import { ESTADO_LABEL } from "@/lib/format";

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{children}</p>
  );
}

export function KpiRow({
  items,
}: {
  items: { label: string; value: string; href?: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-3">
      {items.map((item) => {
        const content = (
          <>
            <span className="block text-[20px] font-semibold leading-none text-ink">{item.value}</span>
            <span className="mt-1 block text-[12.5px] text-ink-muted">{item.label}</span>
          </>
        );
        return item.href ? (
          <Link key={item.label} href={item.href} className="group">
            <span className="block group-hover:underline">{content}</span>
          </Link>
        ) : (
          <div key={item.label}>{content}</div>
        );
      })}
    </div>
  );
}

export function MetricGroup({
  title,
  mediana,
  media,
  extra,
}: {
  title: string;
  mediana: string;
  media?: string;
  extra?: string;
}) {
  return (
    <div>
      <p className="text-[12.5px] text-ink-muted">{title}</p>
      <p className="mt-0.5 text-[16px] font-semibold text-ink">
        {mediana} <span className="text-[12px] font-normal text-ink-muted">mediana</span>
      </p>
      {media && (
        <p className="text-[12.5px] text-ink-muted">
          {media} <span className="text-[11px]">media</span>
        </p>
      )}
      {extra && <p className="mt-0.5 text-[12px] text-ink-muted">{extra}</p>}
    </div>
  );
}

function ComparisonBadge({ pct, invert }: { pct: number | null; invert?: boolean }) {
  if (pct === null) return <span className="text-[12px] text-ink-muted">Sin comparación</span>;
  const rounded = Math.round(pct);
  if (rounded === 0) return <span className="text-[12px] text-ink-muted">Sin cambios</span>;
  const positive = rounded > 0;
  // Para tiempos, subir es malo (invert=true); para volumen es neutral.
  const tone = invert === undefined ? "text-ink-muted" : positive === invert ? "text-red-600" : "text-green-700";
  return (
    <span className={`text-[12px] font-medium ${tone}`}>
      {positive ? "+" : ""}
      {rounded}% vs. periodo anterior
    </span>
  );
}

export function ComparisonRow({
  hayDatos,
  items,
}: {
  hayDatos: boolean;
  items: { label: string; pct: number | null; invert?: boolean }[];
}) {
  if (!hayDatos) {
    return (
      <p className="text-[12.5px] text-ink-muted">
        Cuando haya más tickets podrás comparar este periodo con el anterior.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline gap-1.5">
          <span className="text-[12.5px] text-ink-secondary">{item.label}</span>
          <ComparisonBadge pct={item.pct} invert={item.invert} />
        </div>
      ))}
    </div>
  );
}

const DIMENSIONES: { key: Dimension; label: string }[] = [
  { key: "categoria", label: "Categoría" },
  { key: "departamento", label: "Departamento" },
  { key: "tipo", label: "Tipo" },
];

export function FocosTable({
  dimension,
  rows,
  otherParams,
  mostrarDepartamento,
}: {
  dimension: Dimension;
  rows: FocoRow[];
  otherParams: Record<string, string | undefined>;
  mostrarDepartamento: boolean;
}) {
  function hrefFor(dim: Dimension) {
    const params = new URLSearchParams(
      Object.entries(otherParams).filter((e): e is [string, string] => Boolean(e[1])),
    );
    params.set("dim", dim);
    return `/informes?${params.toString()}`;
  }

  function drillHref(row: FocoRow) {
    if (row.id === -1) return null; // "Sin clasificar" no tiene id filtrable
    const params = new URLSearchParams();
    params.set(dimension, String(row.id));
    return `/tickets?${params.toString()}`;
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-1">
        {DIMENSIONES.filter((d) => d.key !== "departamento" || mostrarDepartamento).map((d) => (
          <Link
            key={d.key}
            href={hrefFor(d.key)}
            className={`rounded-btn px-2.5 py-1 text-[12.5px] font-medium transition-colors duration-150 ${
              dimension === d.key ? "bg-surface-2 text-ink" : "text-ink-muted hover:text-ink"
            }`}
          >
            {d.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-[12.5px] text-ink-muted">Sin tickets en este periodo.</p>
      ) : (
        <div className="overflow-hidden rounded-card border border-border">
          <div className="grid grid-cols-[minmax(0,1.4fr)_70px_60px_70px_110px_90px] gap-2 border-b border-border bg-surface-2 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
            <span>{DIMENSIONES.find((d) => d.key === dimension)?.label}</span>
            <span className="text-right">Tickets</span>
            <span className="text-right">%</span>
            <span className="text-right">Abiertos</span>
            <span className="text-right">Mediana resol.</span>
            <span className="text-right">Reaperturas</span>
          </div>
          <div className="divide-y divide-border">
            {rows.map((row) => {
              const href = drillHref(row);
              const cells = (
                <>
                  <span className="truncate text-[13px] text-ink">{row.nombre}</span>
                  <span className="text-right text-[13px] text-ink-secondary">{row.tickets}</span>
                  <span className="text-right text-[13px] text-ink-secondary">{Math.round(row.porcentaje)}%</span>
                  <span className="text-right text-[13px] text-ink-secondary">{row.abiertos}</span>
                  <span className="text-right text-[13px] text-ink-secondary">
                    {formatDuration(row.resolucionMedianaSeg)}
                  </span>
                  <span className="text-right text-[13px] text-ink-secondary">{row.reaperturas}</span>
                </>
              );
              return href ? (
                <Link
                  key={row.id}
                  href={href}
                  className="grid grid-cols-[minmax(0,1.4fr)_70px_60px_70px_110px_90px] items-center gap-2 px-3 py-2 transition-colors duration-150 hover:bg-surface-hover"
                >
                  {cells}
                </Link>
              ) : (
                <div key={row.id} className="grid grid-cols-[minmax(0,1.4fr)_70px_60px_70px_110px_90px] items-center gap-2 px-3 py-2">
                  {cells}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function BarList({
  rows,
}: {
  rows: { label: string; count: number; href?: string }[];
}) {
  if (rows.length === 0) return <p className="text-[12.5px] text-ink-muted">Sin datos.</p>;
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const bar = (
          <>
            <span className="w-28 shrink-0 truncate text-[12.5px] text-ink-secondary">{row.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-pando" style={{ width: `${(row.count / max) * 100}%` }} />
            </div>
            <span className="w-6 shrink-0 text-right text-[12.5px] text-ink-muted">{row.count}</span>
          </>
        );
        return row.href ? (
          <Link key={row.label} href={row.href} className="flex items-center gap-3 hover:opacity-80">
            {bar}
          </Link>
        ) : (
          <div key={row.label} className="flex items-center gap-3">
            {bar}
          </div>
        );
      })}
    </div>
  );
}

export function EstadoDistribution({ rows }: { rows: { estado: Estado; count: number }[] }) {
  return <BarList rows={rows.map((r) => ({ label: ESTADO_LABEL[r.estado], count: r.count }))} />;
}

export function AgingBuckets({ buckets }: { buckets: { bucket: AgingBucketKey; label: string; count: number }[] }) {
  return <BarList rows={buckets.map((b) => ({ label: b.label, count: b.count }))} />;
}

export function AttentionList({ items }: { items: AtencionItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-[12.5px] text-ink-muted">
        No hay tickets abiertos que necesiten atención especial ahora mismo.
      </p>
    );
  }
  return (
    <div className="divide-y divide-border rounded-card border border-border">
      {items.map((item) => (
        <Link
          key={item.id}
          href={`/tickets/${item.id}`}
          className="flex items-center justify-between gap-3 px-3 py-2.5 transition-colors duration-150 hover:bg-surface-hover"
        >
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-ink">{item.titulo}</p>
            <p className="mt-0.5 truncate text-[12px] text-ink-muted">
              <span className="font-mono">{item.ref}</span> · {item.motivos.join(" · ")}
            </p>
          </div>
          <span className="shrink-0 text-[12px] text-ink-muted">{Math.round(item.edadDias)}d</span>
        </Link>
      ))}
    </div>
  );
}
