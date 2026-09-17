import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPersona } from "@/lib/supabase/persona";
import { formatRelativeTime, type Estado } from "@/lib/format";
import { StatusBadge } from "@/components/ui/badge";
import { Conversation, type ConversationMessage } from "@/app/(agente)/tickets/[id]/conversation";
import { ReplyForm } from "./reply-form";

type TicketDetail = {
  id: number;
  ref: string | null;
  titulo: string;
  descripcion: string | null;
  estado: Estado;
  created_at: string;
  categoria: { nombre: string } | null;
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

export default async function MiTicketDetailPage({ params }: PageProps<"/mis-tickets/[id]">) {
  const { id } = await params;
  const ticketId = Number(id);
  if (!Number.isInteger(ticketId)) notFound();

  const supabase = await createClient();
  const persona = await getCurrentPersona();

  const [{ data: ticket, error }, { data: messages }] = await Promise.all([
    supabase
      .from("tickets")
      .select("id, ref, titulo, descripcion, estado, created_at, categoria:categorias(nombre)")
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
      <p className="mt-1 text-[13px] text-ink-muted">
        {ticket.categoria?.nombre && <>{ticket.categoria.nombre} · </>}
        {formatRelativeTime(ticket.created_at)}
      </p>

      <div className="mt-4 rounded-card border border-border bg-surface">
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
      </div>

      <ReplyForm ticketId={ticket.id} />
    </div>
  );
}
