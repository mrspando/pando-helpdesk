import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { listUnreadMessages, markMessageRead, type IngestedMessage } from "@/lib/graph/ingest";
import { stripQuotedReply, htmlToPlainText } from "@/lib/email/html";

export const dynamic = "force-dynamic";

const TICKET_REF_PATTERN = /\[PANDO-(\d+)\]/i;

type Resultado = "creado" | "adjuntado" | "descartado" | "cuarentena" | "error" | "yaProcesado";

// GET en vez de POST porque así lo invoca el cron de Vercel (ver
// vercel.json). Protegido con CRON_SECRET: sin él, cualquiera que
// conociera la URL podría disparar la ingesta. Vercel añade
// automáticamente `Authorization: Bearer <CRON_SECRET>` en cada invocación
// cuando esa env var existe en el proyecto.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const mailbox = process.env.GRAPH_INGEST_MAILBOX;
  if (!mailbox) {
    return NextResponse.json({ error: "Falta GRAPH_INGEST_MAILBOX" }, { status: 500 });
  }

  const supabase = createAdminClient();
  const messages = await listUnreadMessages(mailbox);

  const resultados: Record<Resultado, number> = {
    creado: 0,
    adjuntado: 0,
    descartado: 0,
    cuarentena: 0,
    error: 0,
    yaProcesado: 0,
  };

  for (const message of messages) {
    try {
      resultados[await processMessage(supabase, mailbox, message)] += 1;
    } catch (err) {
      // Ni siquiera se pudo reclamar/leer el mensaje — no se marca como
      // leído, se reintenta en la siguiente pasada del cron.
      console.error(`[ingest-mail] error procesando ${message.id}:`, err);
      resultados.error += 1;
    }
  }

  return NextResponse.json({ procesados: messages.length, resultados });
}

async function processMessage(
  supabase: SupabaseClient,
  mailbox: string,
  message: IngestedMessage,
): Promise<Resultado> {
  const remitente = message.from?.toLowerCase() ?? null;

  // Reclama el mensaje insertando primero en email_ingesta (unique en
  // graph_message_id): si el cron se solapa, la segunda pasada choca aquí
  // antes de llegar a crear nada en tickets/messages. Ver CONTEXT.md →
  // "Riesgos a mitigar explícitamente".
  const { error: claimError } = await supabase.from("email_ingesta").insert({
    graph_message_id: message.id,
    remitente,
    asunto: message.subject || null,
    resultado: "procesando",
    recibido_at: message.receivedDateTime,
  });

  if (claimError) {
    if (claimError.code === "23505") {
      await markMessageRead(mailbox, message.id);
      return "yaProcesado";
    }
    throw claimError;
  }

  try {
    const { resultado, patch } = await resolveOutcome(supabase, message, remitente);
    await supabase.from("email_ingesta").update({ resultado, ...patch }).eq("graph_message_id", message.id);
    await markMessageRead(mailbox, message.id);
    return resultado;
  } catch (err) {
    // email_ingesta es la "caja negra" para depurar quejas de "escribí y
    // no pasó nada" (ver CONTEXT.md) — se marca como leído también en
    // error para no reintentar indefinidamente un mensaje roto; queda
    // visible en Ajustes → admin puede leer email_ingesta.
    const motivo = err instanceof Error ? err.message : "Error desconocido";
    await supabase.from("email_ingesta").update({ resultado: "error", motivo }).eq("graph_message_id", message.id);
    await markMessageRead(mailbox, message.id);
    return "error";
  }
}

async function resolveOutcome(
  supabase: SupabaseClient,
  message: IngestedMessage,
  remitente: string | null,
): Promise<{ resultado: Exclude<Resultado, "error" | "yaProcesado">; patch: Record<string, unknown> }> {
  if (message.isAutoReply) {
    return { resultado: "descartado", patch: { motivo: "autorespuesta" } };
  }

  if (!remitente || !remitente.endsWith("@pando.es")) {
    return { resultado: "cuarentena", patch: { motivo: "remitente fuera de @pando.es" } };
  }

  const persona = await resolvePersona(supabase, remitente);
  const bodyHtml = stripQuotedReply(message.bodyHtml);
  const bodyText = htmlToPlainText(bodyHtml) || "(sin contenido)";

  const refMatch = TICKET_REF_PATTERN.exec(message.subject);
  const ticketRef = refMatch ? Number(refMatch[1]) : null;

  if (ticketRef) {
    const { data: ticket } = await supabase
      .from("tickets")
      .select("id")
      .eq("id", ticketRef)
      .is("deleted_at", null)
      .maybeSingle();

    if (ticket) {
      const { error } = await supabase.from("messages").insert({
        ticket_id: ticket.id,
        direccion: "entrante",
        autor_id: persona.id,
        cuerpo_texto: bodyText,
        cuerpo_html: bodyHtml,
        es_nota_interna: false,
        graph_message_id: message.id,
      });
      if (error) throw error;
      return { resultado: "adjuntado", patch: { ticket_id: ticket.id } };
    }
  }

  // Sin referencia reconocible (o referencia a un ticket que ya no existe):
  // se trata como correo nuevo, igual que un alta manual — título = asunto,
  // descripción = cuerpo, sin categoría/tipo/departamento (los fija el
  // agente en el triaje).
  const { data: ticket, error } = await supabase
    .from("tickets")
    .insert({
      titulo: message.subject.trim() || "Sin asunto",
      descripcion: bodyText,
      solicitante_id: persona.id,
      origen: "email",
      conversation_id: message.conversationId,
    })
    .select("id")
    .single();

  if (error) throw error;
  return { resultado: "creado", patch: { ticket_id: ticket.id } };
}

// @pando.es sin fila en `personas` todavía (no ha hecho login SSO nunca):
// se crea aquí mismo, igual que haría el trigger de alta en login — y ese
// mismo trigger (`on conflict (email) do update ... auth_user_id`) la
// enlazará sin duplicados el día que esa persona inicie sesión.
async function resolvePersona(supabase: SupabaseClient, email: string): Promise<{ id: string }> {
  const { data: existing } = await supabase.from("personas").select("id").eq("email", email).maybeSingle();
  if (existing) return existing;

  const { data: created, error } = await supabase.from("personas").insert({ email }).select("id").single();
  if (error) {
    if (error.code === "23505") {
      const { data: raceWinner } = await supabase.from("personas").select("id").eq("email", email).single();
      if (raceWinner) return raceWinner;
    }
    throw error;
  }
  return created;
}
