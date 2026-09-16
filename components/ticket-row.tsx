import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format";
import { PriorityBadge, StatusBadge } from "@/components/ui/badge";
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
  tipoNombre,
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
  tipoNombre: string | null;
  departamentoNombre: string | null;
}) {
  const urgent = prioridad === "critica" || prioridad === "alta";

  return (
    <Link
      href={`/tickets/${id}`}
      className="flex items-center gap-3 px-8 py-3 transition-colors duration-150 hover:bg-surface-hover"
    >
      <span
        className={cn(
          "mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full",
          urgent ? (prioridad === "critica" ? "bg-red-500" : "bg-orange-500") : "bg-transparent",
        )}
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-ink">{titulo}</p>
        <p className="mt-0.5 truncate text-[12.5px] text-ink-muted">
          <span className="font-mono">{refCode}</span> · {solicitanteNombre} · {categoriaNombre}
          {tipoNombre && <> · {tipoNombre}</>}
          {departamentoNombre && <> · {departamentoNombre}</>}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <span className="w-20 text-right text-[12.5px] text-ink-muted">
          {formatRelativeTime(createdAt)}
        </span>
        <PriorityBadge prioridad={prioridad} className="w-14 justify-end" />
        <StatusBadge estado={estado} />
      </div>
    </Link>
  );
}
