import Link from "next/link";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { TICKETS_GRID_COLS } from "@/components/tickets-grid";

export type SortField = "id" | "prioridad" | "estado" | "created_at";
export type SortDir = "asc" | "desc";

const COLUMNS: { field: SortField | null; label: string; align?: "end" }[] = [
  { field: "id", label: "Ticket" },
  { field: null, label: "Solicitante" },
  { field: null, label: "Categoría" },
  { field: null, label: "Departamento" },
  { field: "prioridad", label: "Prioridad" },
  { field: "estado", label: "Estado" },
  { field: "created_at", label: "Creado", align: "end" },
];

export function TicketsTableHeader({
  currentParams,
  sortField,
  sortDir,
}: {
  currentParams: Record<string, string | undefined>;
  sortField: SortField;
  sortDir: SortDir;
}) {
  function hrefFor(field: SortField) {
    const nextDir: SortDir = sortField === field && sortDir === "asc" ? "desc" : "asc";
    const params = new URLSearchParams(
      Object.entries(currentParams).filter((entry): entry is [string, string] => Boolean(entry[1])),
    );
    params.set("sort", field);
    params.set("dir", nextDir);
    return `/tickets?${params.toString()}`;
  }

  return (
    <div
      className={cn(
        "grid items-center gap-3 rounded-t-card border-b border-border-strong bg-surface-2 px-8 py-2",
        TICKETS_GRID_COLS,
      )}
    >
      {COLUMNS.map((col) => {
        const content = col.field ? (
          <Link
            href={hrefFor(col.field)}
            scroll={false}
            className={cn(
              "inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-ink-muted transition-colors duration-150 hover:text-ink",
              col.align === "end" && "flex-row-reverse",
            )}
          >
            {col.label}
            {sortField === col.field &&
              (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </Link>
        ) : (
          <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">{col.label}</span>
        );

        return (
          <div key={col.label} className={cn(col.align === "end" && "text-right")}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
