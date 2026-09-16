"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPersona } from "@/lib/supabase/persona";
import type { Prioridad } from "@/lib/format";

export async function createTicket(_prevState: { error: string | null } | undefined, formData: FormData) {
  const persona = await getCurrentPersona();
  if (!persona || !persona.es_agente) {
    throw new Error("No autorizado");
  }

  const titulo = String(formData.get("titulo") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const solicitanteId = String(formData.get("solicitante_id") ?? "").trim();
  const categoriaIdRaw = String(formData.get("categoria_id") ?? "").trim();
  const tipoIdRaw = String(formData.get("tipo_id") ?? "").trim();
  const departamentoIdRaw = String(formData.get("departamento_id") ?? "").trim();
  const prioridad = String(formData.get("prioridad") ?? "normal") as Prioridad;

  if (!titulo) return { error: "El título es obligatorio" };
  if (!solicitanteId) return { error: "Elige un solicitante" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tickets")
    .insert({
      titulo,
      descripcion: descripcion || null,
      solicitante_id: solicitanteId,
      categoria_id: categoriaIdRaw ? Number(categoriaIdRaw) : null,
      tipo_id: tipoIdRaw ? Number(tipoIdRaw) : null,
      departamento_id: departamentoIdRaw ? Number(departamentoIdRaw) : null,
      prioridad,
      origen: "manual",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/tickets");
  redirect(`/tickets/${data.id}`);
}
