import Link from "next/link";
import { Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PriorityBadge, StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatRelativeTime, type Estado, type Prioridad } from "@/lib/format";
import { NewTicketDialog } from "./new-ticket-dialog";

type TicketRow = {
  id: number;
  ref: string | null;
  titulo: string;
  estado: Estado;
  prioridad: Prioridad;
  created_at: string;
  updated_at: string;
  categoria: { nombre: string } | null;
  tipo: { nombre: string } | null;
  departamento: { nombre: string } | null;
};

export default async function MisTicketsPage() {
  const supabase = await createClient();

  const [{ data: tickets, error }, { data: categorias }, { data: tipos }] = await Promise.all([
    supabase
      .from("tickets")
      .select(
        `id, ref, titulo, estado, prioridad, created_at, updated_at,
         categoria:categorias(nombre), tipo:tipos(nombre), departamento:departamentos(nombre)`,
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .returns<TicketRow[]>(),
    supabase.from("categorias").select("id, nombre").order("orden"),
    supabase.from("tipos").select("id, nombre").order("orden"),
  ]);

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[19px] font-semibold text-ink">Mis tickets</h1>
          <p className="mt-1 text-[13px] text-ink-muted">
            Incidencias y solicitudes que has enviado a IT
          </p>
        </div>
        <NewTicketDialog categorias={categorias ?? []} tipos={tipos ?? []} />
      </div>

      {error && (
        <p className="mt-6 text-sm text-red-600">No se pudieron cargar tus tickets: {error.message}</p>
      )}

      {!error && tickets && tickets.length === 0 && (
        <EmptyState
          icon={Inbox}
          title="Todavía no has enviado ningún ticket"
          description="Cuando abras uno con el botón de arriba, aparecerá aquí."
          className="mt-6"
        />
      )}

      {!error && tickets && tickets.length > 0 && (
        <div className="mt-6 divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
          {tickets.map((ticket) => (
            <Link
              key={ticket.id}
              href={`/mis-tickets/${ticket.id}`}
              className="flex items-center justify-between gap-4 px-4 py-3 transition-colors duration-150 hover:bg-surface-hover"
            >
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium text-ink">{ticket.titulo}</p>
                <p className="mt-0.5 truncate text-[12px] text-ink-muted">
                  <span className="font-mono">{ticket.ref ?? `PANDO-${ticket.id}`}</span>
                  {ticket.categoria?.nombre && <> · {ticket.categoria.nombre}</>}
                  {ticket.tipo?.nombre && <> · {ticket.tipo.nombre}</>}
                  {ticket.departamento?.nombre && <> · {ticket.departamento.nombre}</>}
                  {" · actualizado "}
                  {formatRelativeTime(ticket.updated_at)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <PriorityBadge prioridad={ticket.prioridad} />
                <StatusBadge estado={ticket.estado} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
