"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPersona } from "@/lib/supabase/persona";
import type { Estado, Prioridad } from "@/lib/format";

async function requireAgente() {
  const persona = await getCurrentPersona();
  if (!persona || !persona.es_agente) {
    throw new Error("No autorizado");
  }
  return persona;
}

export async function updateEstado(ticketId: number, estado: Estado) {
  await requireAgente();
  const supabase = await createClient();
  const { error } = await supabase.from("tickets").update({ estado }).eq("id", ticketId);
  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  if (error) return { error: error.message };
  return { error: null };
}

export async function updatePrioridad(ticketId: number, prioridad: Prioridad) {
  await requireAgente();
  const supabase = await createClient();
  const { error } = await supabase.from("tickets").update({ prioridad }).eq("id", ticketId);
  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  if (error) return { error: error.message };
  return { error: null };
}

export async function updateCategoria(ticketId: number, categoriaId: number) {
  await requireAgente();
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
  await requireAgente();
  const supabase = await createClient();
  const { error } = await supabase.from("tickets").update({ tipo_id: tipoId }).eq("id", ticketId);
  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  if (error) return { error: error.message };
  return { error: null };
}

export async function updateDepartamento(ticketId: number, departamentoId: number) {
  await requireAgente();
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

export async function sendMessage(
  ticketId: number,
  cuerpoTexto: string,
  esNotaInterna: boolean,
) {
  const persona = await requireAgente();
  const body = cuerpoTexto.trim();
  if (!body) return { error: "El mensaje está vacío" };

  const supabase = await createClient();
  const { error } = await supabase.from("messages").insert({
    ticket_id: ticketId,
    direccion: "saliente",
    autor_id: persona.id,
    cuerpo_texto: body,
    es_nota_interna: esNotaInterna,
    enviado_at: esNotaInterna ? null : new Date().toISOString(),
  });

  revalidatePath(`/tickets/${ticketId}`);
  if (error) return { error: error.message };
  return { error: null };
}
