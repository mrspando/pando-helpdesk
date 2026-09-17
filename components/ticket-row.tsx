import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format";
import { PriorityBadge, StatusBadge } from "@/components/ui/badge";
import { TICKETS_GRID_COLS } from "@/components/tickets-grid";
import type { Estado, Prioridad } from "@/lib/format";

export function TicketRow({
  id,
  refCode,
  titulo,
  prioridad,
  estado,
  createdAt,
  solicitanteNombre,
  categoriaNombre,
  departamentoNombre,
}: {
  id: number;
  refCode: string;
  titulo: string;
  prioridad: Prioridad;
  estado: Estado;
  createdAt: string;
  solicitanteNombre: string;
  categoriaNombre: string;
  departamentoNombre: string;
}) {
  const urgent = prioridad === "critica" || prioridad === "alta";

  return (
    <Link
      href={`/tickets/${id}`}
      className={cn(
        "grid items-center gap-3 px-8 py-3.5 transition-colors duration-150 hover:bg-surface-hover",
        TICKETS_GRID_COLS,
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span
          className={cn(
            "mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full",
            urgent ? (prioridad === "critica" ? "bg-red-500" : "bg-orange-500") : "bg-transparent",
          )}
        />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium text-ink">{titulo}</p>
          <p className="mt-0.5 truncate font-mono text-[12px] text-ink-muted">{refCode}</p>
        </div>
      </div>

      <span className="truncate text-[13px] text-ink-secondary">{solicitanteNombre}</span>
      <span className="truncate text-[13px] text-ink-secondary">{categoriaNombre}</span>
      <span className="truncate text-[13px] text-ink-secondary">{departamentoNombre}</span>

      <div>
        <PriorityBadge prioridad={prioridad} />
      </div>
      <div>
        <StatusBadge estado={estado} />
      </div>

      <span className="text-right text-[12.5px] text-ink-muted">{formatRelativeTime(createdAt)}</span>
    </Link>
  );
}
