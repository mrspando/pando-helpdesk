import { createClient } from "@/lib/supabase/server";
import { getCurrentPersona } from "@/lib/supabase/persona";
import { PageHeader } from "@/components/page-header";
import { TicketsTabs, type TicketTabKey } from "@/components/tickets-tabs";
import { TicketsToolbar } from "@/components/tickets-toolbar";
import { TicketRow } from "@/components/ticket-row";
import { EmptyState } from "@/components/ui/empty-state";
import { Inbox } from "lucide-react";
import type { Estado, Prioridad } from "@/lib/format";
import { NewTicketDialog } from "./new-ticket-dialog";

type TicketRowData = {
  id: number;
  ref: string | null;
  titulo: string;
  prioridad: Prioridad;
  estado: Estado;
  created_at: string;
  solicitante: { nombre: string | null; email: string } | null;
  categoria: { nombre: string } | null;
  tipo: { nombre: string } | null;
  departamento: { nombre: string } | null;
};

const BUCKET_ESTADOS: Record<TicketTabKey, Estado[] | null> = {
  todos: null,
  nuevos: ["nuevo"],
  en_curso: ["en_curso"],
  esperando: ["esperando_usuario", "esperando_proveedor"],
  resueltos: ["resuelto"],
};

export default async function TicketsPage({ searchParams }: PageProps<"/tickets">) {
  const params = await searchParams;
  const tab = (typeof params.estado === "string" ? params.estado : "todos") as TicketTabKey;
  const prioridad = typeof params.prioridad === "string" ? params.prioridad : undefined;
  const categoriaId = typeof params.categoria === "string" ? params.categoria : undefined;
  const tipoId = typeof params.tipo === "string" ? params.tipo : undefined;
  const departamentoId = typeof params.departamento === "string" ? params.departamento : undefined;
  const q = typeof params.q === "string" ? params.q : undefined;

  const supabase = await createClient();
  const persona = await getCurrentPersona();
  const isAdmin = persona?.rol === "admin";

  const [
    { data: categorias },
    { data: tipos },
    { data: departamentos },
    { data: personas },
    ticketsQuery,
  ] = await Promise.all([
    supabase.from("categorias").select("id, nombre").order("orden"),
    supabase.from("tipos").select("id, nombre").order("orden"),
    supabase.from("departamentos").select("id, nombre").order("orden"),
    supabase
      .from("personas")
      .select("id, nombre, email")
      .eq("activo", true)
      .order("nombre"),
    (async () => {
      let query = supabase
        .from("tickets")
        .select(
          `id, ref, titulo, prioridad, estado, created_at,
           solicitante:personas!tickets_solicitante_id_fkey(nombre, email),
           categoria:categorias(nombre),
           tipo:tipos(nombre),
           departamento:departamentos(nombre)`,
        )
        .is("deleted_at", null)
        .order("prioridad", { ascending: false })
        .order("created_at", { ascending: true });

      const estados = BUCKET_ESTADOS[tab] ?? BUCKET_ESTADOS.todos;
      if (estados) query = query.in("estado", estados);
      if (prioridad) query = query.eq("prioridad", prioridad);
      if (categoriaId) query = query.eq("categoria_id", categoriaId);
      if (tipoId) query = query.eq("tipo_id", tipoId);
      if (departamentoId) query = query.eq("departamento_id", departamentoId);
      if (q) query = query.ilike("titulo", `%${q}%`);

      return query.returns<TicketRowData[]>();
    })(),
  ]);

  const { data: tickets, error } = ticketsQuery;

  return (
    <div>
      <PageHeader
        title="Tickets"
        description="Gestiona y prioriza las incidencias internas"
        actions={
          <NewTicketDialog
            isAdmin={isAdmin}
            personas={personas ?? []}
            categorias={categorias ?? []}
            tipos={tipos ?? []}
            departamentos={departamentos ?? []}
          />
        }
      />
      <TicketsTabs
        active={tab}
        otherParams={{ prioridad, categoria: categoriaId, tipo: tipoId, departamento: departamentoId, q }}
      />
      <TicketsToolbar categorias={categorias ?? []} tipos={tipos ?? []} departamentos={departamentos ?? []} />

      {error && (
        <p className="px-8 py-6 text-sm text-red-600">
          No se pudo cargar la cola de tickets: {error.message}
        </p>
      )}

      {!error && tickets && tickets.length === 0 && (
        <EmptyState
          icon={Inbox}
          title="No hay tickets"
          description="No hay tickets que coincidan con estos filtros."
        />
      )}

      {!error && tickets && tickets.length > 0 && (
        <div className="divide-y divide-border border-t border-border">
          {tickets.map((ticket) => (
            <TicketRow
              key={ticket.id}
              id={ticket.id}
              refCode={ticket.ref ?? `PANDO-${ticket.id}`}
              titulo={ticket.titulo}
              prioridad={ticket.prioridad}
              estado={ticket.estado}
              createdAt={ticket.created_at}
              solicitanteNombre={ticket.solicitante?.nombre ?? ticket.solicitante?.email ?? "—"}
              categoriaNombre={ticket.categoria?.nombre ?? "Sin categoría"}
              tipoNombre={ticket.tipo?.nombre ?? null}
              departamentoNombre={ticket.departamento?.nombre ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
