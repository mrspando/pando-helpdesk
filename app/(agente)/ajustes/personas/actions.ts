"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPersona } from "@/lib/supabase/persona";
import type { Rol } from "@/lib/roles";

async function requireAdmin() {
  const persona = await getCurrentPersona();
  if (!persona || persona.rol !== "admin") {
    throw new Error("No autorizado");
  }
  return persona;
}

// Evita que la aplicación se quede sin ningún Admin activo: cuenta los
// Admin activos que no sean `personaId` antes de dejar que se le quite
// ese rol o se le desactive.
async function hasOtherActiveAdmin(personaId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("personas")
    .select("id", { count: "exact", head: true })
    .eq("rol", "admin")
    .eq("activo", true)
    .neq("id", personaId);
  return (count ?? 0) > 0;
}

export async function updatePersonaNombre(personaId: string, nombre: string) {
  await requireAdmin();
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
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("personas")
    .update({ departamento_id: departamentoId })
    .eq("id", personaId);

  revalidatePath("/ajustes/personas");
  if (error) return { error: error.message };
  return { error: null };
}

export async function updatePersonaRol(personaId: string, rol: Rol) {
  await requireAdmin();
  const supabase = await createClient();

  if (rol !== "admin") {
    const { data: target } = await supabase
      .from("personas")
      .select("rol")
      .eq("id", personaId)
      .single();

    if (target?.rol === "admin" && !(await hasOtherActiveAdmin(personaId))) {
      return { error: "No puedes quitar el rol de Admin a la última persona que lo tiene." };
    }
  }

  const { error } = await supabase.from("personas").update({ rol }).eq("id", personaId);

  revalidatePath("/ajustes/personas");
  if (error) return { error: error.message };
  return { error: null };
}

export async function togglePersonaActivo(personaId: string, activo: boolean) {
  await requireAdmin();
  const supabase = await createClient();

  if (!activo) {
    const { data: target } = await supabase
      .from("personas")
      .select("rol")
      .eq("id", personaId)
      .single();

    if (target?.rol === "admin" && !(await hasOtherActiveAdmin(personaId))) {
      return { error: "No puedes desactivar a la última persona con rol Admin." };
    }
  }

  const { error } = await supabase.from("personas").update({ activo }).eq("id", personaId);

  revalidatePath("/ajustes/personas");
  if (error) return { error: error.message };
  return { error: null };
}
