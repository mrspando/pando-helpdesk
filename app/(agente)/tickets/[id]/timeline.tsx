import { Sparkles, UserRound } from "lucide-react";
import { StatusBadge, PriorityBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime, type Estado, type Prioridad } from "@/lib/format";

export type TimelineEvent = {
  id: number;
  tipo: string;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  created_at: string;
  actor_nombre: string | null;
};

type CatalogMap = Record<number, string>;

function resolveCatalog(map: CatalogMap, raw: string | null) {
  if (!raw) return "Sin asignar";
  return map[Number(raw)] ?? `#${raw}`;
}

const ORIGEN_LABEL: Record<string, string> = {
  email: "por correo",
  manual: "manualmente",
};

function EventLine({
  event,
  categorias,
  tipos,
  departamentos,
}: {
  event: TimelineEvent;
  categorias: CatalogMap;
  tipos: CatalogMap;
  departamentos: CatalogMap;
}) {
  if (event.tipo === "creacion") {
    return (
      <>
        <Sparkles size={13} className="text-ink-secondary" />
        <span className="text-[13px] text-ink">
          Ticket creado {ORIGEN_LABEL[event.valor_nuevo ?? ""] ?? ""}
        </span>
      </>
    );
  }

  if (event.tipo === "estado") {
    const nuevo = event.valor_nuevo as Estado | null;
    return (
      <>
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ink-disabled" />
        <span className="text-[13px] text-ink">Estado cambiado a</span>
        {nuevo && <StatusBadge estado={nuevo} />}
      </>
    );
  }

  if (event.tipo === "prioridad") {
    const nueva = event.valor_nuevo as Prioridad | null;
    return (
      <>
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ink-disabled" />
        <span className="text-[13px] text-ink">Prioridad cambiada a</span>
        {nueva && <PriorityBadge prioridad={nueva} />}
      </>
    );
  }

  if (event.tipo === "categoria" || event.tipo === "tipo" || event.tipo === "departamento") {
    const map = event.tipo === "categoria" ? categorias : event.tipo === "tipo" ? tipos : departamentos;
    const label = event.tipo === "categoria" ? "Categoría" : event.tipo === "tipo" ? "Tipo" : "Departamento";
    return (
      <>
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ink-disabled" />
        <span className="text-[13px] text-ink">
          {label} cambiado a <span className="font-medium">{resolveCatalog(map, event.valor_nuevo)}</span>
        </span>
      </>
    );
  }

  if (event.tipo === "asignacion") {
    return (
      <>
        <UserRound size={13} className="text-ink-secondary" />
        <span className="text-[13px] text-ink">Ticket reasignado</span>
      </>
    );
  }

  return (
    <>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ink-disabled" />
      <span className="text-[13px] text-ink">{event.tipo}</span>
    </>
  );
}

export function Timeline({
  events,
  categorias,
  tipos,
  departamentos,
}: {
  events: TimelineEvent[];
  categorias: CatalogMap;
  tipos: CatalogMap;
  departamentos: CatalogMap;
}) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Sin actividad todavía"
        description="Los cambios de estado, prioridad y demás aparecerán aquí."
      />
    );
  }

  return (
    <div className="px-8 py-6">
      <ol className="space-y-4">
        {events.map((event) => (
          <li key={event.id} className="flex items-start gap-2.5">
            <EventLine event={event} categorias={categorias} tipos={tipos} departamentos={departamentos} />
            <span className="ml-auto shrink-0 whitespace-nowrap text-[12px] text-ink-muted">
              {event.actor_nombre ?? "Sistema"} · {formatDateTime(event.created_at)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
