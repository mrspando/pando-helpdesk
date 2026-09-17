import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPersona } from "@/lib/supabase/persona";
import { formatRelativeTime, type Estado, type Prioridad } from "@/lib/format";
import { StatusBadge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Conversation, type ConversationMessage } from "@/app/(agente)/tickets/[id]/conversation";
import { PropertiesPanel } from "@/app/(agente)/tickets/[id]/properties-panel";
import { Timeline, type TimelineEvent } from "@/app/(agente)/tickets/[id]/timeline";
import { ReplyForm } from "./reply-form";

type TicketDetail = {
  id: number;
  ref: string | null;
  titulo: string;
  descripcion: string | null;
  categoria_id: number | null;
  tipo_id: number | null;
  departamento_id: number | null;
  prioridad: Prioridad;
  estado: Estado;
  created_at: string;
  triaged_at: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
};

type MessageRow = {
  id: number;
  direccion: "entrante" | "saliente";
  cuerpo_texto: string;
  es_nota_interna: boolean;
  created_at: string;
  autor_id: string | null;
  autor: { nombre: string | null; email: string } | null;
};

type EventRow = {
  id: number;
  tipo: string;
  valor_anterior: string | null;
  valor_nuevo: string | null;
  created_at: string;
  actor: { nombre: string | null; email: string } | null;
};

export default async function MiTicketDetailPage({ params }: PageProps<"/mis-tickets/[id]">) {
  const { id } = await params;
  const ticketId = Number(id);
  if (!Number.isInteger(ticketId)) notFound();

  const supabase = await createClient();
  const persona = await getCurrentPersona();

  const [
    { data: ticket, error },
    { data: messages },
    { data: categorias },
    { data: tipos },
    { data: departamentos },
    { data: events },
  ] = await Promise.all([
    supabase
      .from("tickets")
      .select(
        `id, ref, titulo, descripcion, categoria_id, tipo_id, departamento_id, prioridad, estado, created_at,
         triaged_at, first_response_at, resolved_at`,
      )
      .eq("id", ticketId)
      .is("deleted_at", null)
      .single()
      .returns<TicketDetail>(),
    supabase
      .from("messages")
      .select(
        `id, direccion, cuerpo_texto, es_nota_interna, created_at, autor_id,
         autor:personas!messages_autor_id_fkey(nombre, email)`,
      )
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true })
      .returns<MessageRow[]>(),
    supabase.from("categorias").select("id, nombre").order("orden"),
    supabase.from("tipos").select("id, nombre").order("orden"),
    supabase.from("departamentos").select("id, nombre").order("orden"),
    supabase
      .from("events")
      .select(
        `id, tipo, valor_anterior, valor_nuevo, created_at,
         actor:personas!events_actor_id_fkey(nombre, email)`,
      )
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true })
      .returns<EventRow[]>(),
  ]);

  if (error || !ticket) notFound();

  const conversation: ConversationMessage[] = (messages ?? []).map((m) => ({
    id: m.id,
    direccion: m.direccion,
    cuerpo_texto: m.cuerpo_texto,
    es_nota_interna: m.es_nota_interna,
    created_at: m.created_at,
    autor_nombre: m.autor?.nombre ?? m.autor?.email ?? "Agente",
    is_self: m.autor_id === persona?.id,
    destinatarios: null,
    copia: null,
  }));

  const timelineEvents: TimelineEvent[] = (events ?? []).map((e) => ({
    id: e.id,
    tipo: e.tipo,
    valor_anterior: e.valor_anterior,
    valor_nuevo: e.valor_nuevo,
    created_at: e.created_at,
    actor_nombre: e.actor?.nombre ?? e.actor?.email ?? null,
  }));

  const categoriaMap = Object.fromEntries((categorias ?? []).map((c) => [c.id, c.nombre]));
  const tipoMap = Object.fromEntries((tipos ?? []).map((t) => [t.id, t.nombre]));
  const departamentoMap = Object.fromEntries((departamentos ?? []).map((d) => [d.id, d.nombre]));

  return (
    <div>
      <Link
        href="/mis-tickets"
        className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-ink-muted transition-colors duration-150 hover:text-ink"
      >
        <ArrowLeft size={14} />
        Mis tickets
      </Link>

      <p className="font-mono text-[12.5px] text-ink-muted">{ticket.ref ?? `PANDO-${ticket.id}`}</p>
      <div className="mt-0.5 flex items-center gap-2">
        <h1 className="text-[19px] font-semibold leading-snug text-ink">{ticket.titulo}</h1>
        <StatusBadge estado={ticket.estado} />
      </div>
      <p className="mt-1 text-[13px] text-ink-muted">{formatRelativeTime(ticket.created_at)}</p>

      <div className="mt-4 flex items-start overflow-hidden rounded-card border border-border bg-surface">
        <Tabs defaultValue="conversacion" className="min-w-0 flex-1">
          <TabsList>
            <TabsTrigger value="conversacion">Conversación</TabsTrigger>
            <TabsTrigger value="cronologia">Cronología</TabsTrigger>
          </TabsList>

          <TabsContent value="conversacion">
            {ticket.descripcion && (
              <div className="border-b border-border px-8 py-6">
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                  Descripción inicial
                </p>
                <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">
                  {ticket.descripcion}
                </p>
              </div>
            )}
            <Conversation messages={conversation} />
            <div className="border-t border-border px-8 py-6">
              <ReplyForm ticketId={ticket.id} />
            </div>
          </TabsContent>

          <TabsContent value="cronologia">
            <Timeline
              events={timelineEvents}
              categorias={categoriaMap}
              tipos={tipoMap}
              departamentos={departamentoMap}
            />
          </TabsContent>
        </Tabs>

        <PropertiesPanel
          ticketId={ticket.id}
          canEdit={false}
          estado={ticket.estado}
          prioridad={ticket.prioridad}
          categoriaId={ticket.categoria_id}
          categorias={categorias ?? []}
          tipoId={ticket.tipo_id}
          tipos={tipos ?? []}
          departamentoId={ticket.departamento_id}
          departamentos={departamentos ?? []}
          solicitanteNombre={persona?.nombre ?? "—"}
          createdAt={ticket.created_at}
          triagedAt={ticket.triaged_at}
          firstResponseAt={ticket.first_response_at}
          resolvedAt={ticket.resolved_at}
        />
      </div>
    </div>
  );
}
