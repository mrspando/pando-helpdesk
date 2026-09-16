"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPersona } from "@/lib/supabase/persona";

async function requireAgente() {
  const persona = await getCurrentPersona();
  if (!persona || !persona.es_agente) {
    throw new Error("No autorizado");
  }
  return persona;
}

export async function updatePersonaNombre(personaId: string, nombre: string) {
  await requireAgente();
  const supabase = await createClient();
  const { error } = await supabase
    .from("personas")
    .update({ nombre: nombre.trim() || null })
    .eq("id", personaId);

  revalidatePath("/ajustes/personas");
  if (error) return { error: error.message };
  return { error: null };
}

export async function updatePersonaDepartamento(personaId: string, departamentoId: number | null) {
  await requireAgente();
  const supabase = await createClient();
  const { error } = await supabase
    .from("personas")
    .update({ departamento_id: departamentoId })
    .eq("id", personaId);

  revalidatePath("/ajustes/personas");
  if (error) return { error: error.message };
  return { error: null };
}

export async function togglePersonaFlag(
  personaId: string,
  field: "es_agente" | "activo",
  value: boolean,
) {
  const actor = await requireAgente();

  if (field === "es_agente" && !value && personaId === actor.id) {
    return { error: "No puedes quitarte a ti mismo el rol de agente." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("personas")
    .update({ [field]: value })
    .eq("id", personaId);

  revalidatePath("/ajustes/personas");
  if (error) return { error: error.message };
  return { error: null };
}
