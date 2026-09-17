"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPersona } from "@/lib/supabase/persona";
import { sendMailAsUser } from "@/lib/graph/mail";
import type { Estado, Prioridad } from "@/lib/format";

async function requireAdmin() {
  const persona = await getCurrentPersona();
  if (!persona || persona.rol !== "admin") {
    throw new Error("No autorizado");
  }
  return persona;
}

export async function updateEstado(ticketId: number, estado: Estado) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("tickets").update({ estado }).eq("id", ticketId);
  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  if (error) return { error: error.message };
  return { error: null };
}

export async function updatePrioridad(ticketId: number, prioridad: Prioridad) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("tickets").update({ prioridad }).eq("id", ticketId);
  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  if (error) return { error: error.message };
  return { error: null };
}

export async function updateCategoria(ticketId: number, categoriaId: number) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("tickets")
    .update({ categoria_id: categoriaId })
    .eq("id", ticketId);
  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  if (error) return { error: error.message };
  return { error: null };
}

export async function updateTipo(ticketId: number, tipoId: number) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("tickets").update({ tipo_id: tipoId }).eq("id", ticketId);
  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  if (error) return { error: error.message };
  return { error: null };
}

export async function updateDepartamento(ticketId: number, departamentoId: number) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("tickets")
    .update({ departamento_id: departamentoId })
    .eq("id", ticketId);
  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  if (error) return { error: error.message };
  return { error: null };
}

// Borrado real (no soft-delete): `messages`/`events` cascadean desde
// `tickets` en la base de datos (y `attachments` a su vez desde
// `messages`), así que este único DELETE se lleva por delante todo el
// historial del ticket. Ver supabase/migrations/20260917170000_tickets_delete.sql.
export async function deleteTicket(ticketId: number) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("tickets").delete().eq("id", ticketId);
  if (error) return { error: error.message };
  revalidatePath("/tickets");
  redirect("/tickets");
}

// Un Responsable de departamento o Dirección General que crea un
// ticket para sí mismo (permitido desde la Fase 3, ver PERMISOS.md) no
// tiene acceso a /mis-tickets (esa ruta es solo para `empleado`), así
// que necesita poder escribir en su propio ticket desde esta misma
// ficha de agente. No usa requireAdmin(): solo exige ser el solicitante
// real del ticket, igual que ya garantiza la política RLS
// messages_propios_insert (esta comprobación solo da un mensaje de
// error más claro que el de Postgres si alguien manipula el formulario).
export async function replyAsSolicitante(ticketId: number, cuerpoTexto: string) {
  const persona = await getCurrentPersona();
  if (!persona) return { error: "No autorizado" };

  const body = cuerpoTexto.trim();
  if (!body) return { error: "El mensaje está vacío" };

  const supabase = await createClient();

  const { data: ticket } = await supabase
    .from("tickets")
    .select("solicitante_id")
    .eq("id", ticketId)
    .single();

  if (!ticket || ticket.solicitante_id !== persona.id) {
    return { error: "No autorizado" };
  }

  const { error } = await supabase.from("messages").insert({
    ticket_id: ticketId,
    direccion: "entrante",
    autor_id: persona.id,
    cuerpo_texto: body,
    es_nota_interna: false,
  });

  revalidatePath(`/tickets/${ticketId}`);
  if (error) return { error: error.message };
  return { error: null };
}

export type MessageMode = "reply" | "chat" | "nota";

export async function sendMessage(
  ticketId: number,
  cuerpoTexto: string,
  mode: MessageMode,
  recipients?: { to: string[]; cc: string[] },
) {
  const persona = await requireAdmin();
  const body = cuerpoTexto.trim();
  if (!body) return { error: "El mensaje está vacío" };

  const supabase = await createClient();

  let destinatarios: string[] | null = null;
  let copia: string[] | null = null;
  let enviadoAt: string | null = null;

  if (mode === "reply") {
    const to = (recipients?.to ?? []).map((address) => address.trim()).filter(Boolean);
    const cc = (recipients?.cc ?? []).map((address) => address.trim()).filter(Boolean);

    if (to.length === 0) return { error: "Añade al menos un destinatario" };

    const { data: ticket } = await supabase
      .from("tickets")
      .select("ref, titulo")
      .eq("id", ticketId)
      .single();

    if (!ticket) return { error: "No se encontró el ticket" };

    const subject = `[${ticket.ref ?? `PANDO-${ticketId}`}] ${ticket.titulo}`;
    const bodyHtml = body.replace(/\n/g, "<br>");

    try {
      await sendMailAsUser(persona.email, { to, cc, subject, bodyHtml });
    } catch (err) {
      return { error: err instanceof Error ? err.message : "No se pudo enviar el correo" };
    }

    destinatarios = to;
    copia = cc.length > 0 ? cc : null;
    enviadoAt = new Date().toISOString();
  }

  // "chat" queda como "saliente" no nota: el solicitante y Gerencia/Dirección
  // lo ven en la conversación igual que una respuesta real (y cuenta para
  // first_response_at vía tg_first_response, ver supabase/README.md), pero
  // no dispara ningún correo — sin destinatarios ni enviado_at.
  const { error } = await supabase.from("messages").insert({
    ticket_id: ticketId,
    direccion: "saliente",
    autor_id: persona.id,
    cuerpo_texto: body,
    es_nota_interna: mode === "nota",
    enviado_at: enviadoAt,
    destinatarios,
    copia,
  });

  revalidatePath(`/tickets/${ticketId}`);
  if (error) return { error: error.message };
  return { error: null };
}
