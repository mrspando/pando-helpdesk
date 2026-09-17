"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPersona } from "@/lib/supabase/persona";

export async function createOwnTicket(
  _prevState: { error: string | null } | undefined,
  formData: FormData,
) {
  const persona = await getCurrentPersona();
  if (!persona) redirect("/login");

  const titulo = String(formData.get("titulo") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const categoriaIdRaw = String(formData.get("categoria_id") ?? "").trim();
  const tipoIdRaw = String(formData.get("tipo_id") ?? "").trim();

  if (!titulo) return { error: "El título es obligatorio" };

  // solicitante_id sale siempre de la sesión, nunca del formulario: un
  // empleado solo puede abrir tickets a su propio nombre
  // (tickets_propios_insert en RLS ya lo exige igualmente). Sin
  // prioridad aquí a propósito — la prioridad la fija el agente en el
  // triaje, nunca el usuario. El departamento sí se autorrellena con el
  // propio del empleado (ya lo conocemos desde el onboarding): si no,
  // el ticket nace sin departamento y, con la RLS estricta de
  // Dirección (ver supabase/README.md, 20260917160000), quedaría
  // invisible para el responsable de ese departamento hasta que un
  // agente lo triara a mano. Sigue siendo editable por el agente.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tickets")
    .insert({
      titulo,
      descripcion: descripcion || null,
      solicitante_id: persona.id,
      categoria_id: categoriaIdRaw ? Number(categoriaIdRaw) : null,
      tipo_id: tipoIdRaw ? Number(tipoIdRaw) : null,
      departamento_id: persona.departamentoId,
      origen: "manual",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/mis-tickets");
  redirect(`/mis-tickets/${data.id}`);
}

export async function replyToOwnTicket(ticketId: number, cuerpoTexto: string) {
  const persona = await getCurrentPersona();
  if (!persona) return { error: "No autorizado" };

  const body = cuerpoTexto.trim();
  if (!body) return { error: "El mensaje está vacío" };

  const supabase = await createClient();
  const { error } = await supabase.from("messages").insert({
    ticket_id: ticketId,
    direccion: "entrante",
    autor_id: persona.id,
    cuerpo_texto: body,
    es_nota_interna: false,
  });

  revalidatePath(`/mis-tickets/${ticketId}`);
  if (error) return { error: error.message };
  return { error: null };
}
