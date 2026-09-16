"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPersona } from "@/lib/supabase/persona";

type Catalog = "categorias" | "tipos" | "departamentos";

async function requireAgente() {
  const persona = await getCurrentPersona();
  if (!persona || !persona.es_agente) {
    throw new Error("No autorizado");
  }
}

export async function createCatalogItem(catalog: Catalog, nombre: string) {
  await requireAgente();
  const trimmed = nombre.trim();
  if (!trimmed) return { error: "El nombre es obligatorio" };

  const supabase = await createClient();
  const { error } = await supabase.from(catalog).insert({ nombre: trimmed });

  revalidatePath("/ajustes");
  if (error) return { error: error.message };
  return { error: null };
}

export async function toggleCatalogItemActiva(catalog: Catalog, id: number, activa: boolean) {
  await requireAgente();
  const supabase = await createClient();
  const { error } = await supabase.from(catalog).update({ activa }).eq("id", id);

  revalidatePath("/ajustes");
  if (error) return { error: error.message };
  return { error: null };
}

export async function deleteCatalogItem(catalog: Catalog, id: number) {
  await requireAgente();
  const supabase = await createClient();
  const { error } = await supabase.from(catalog).delete().eq("id", id);

  revalidatePath("/ajustes");
  if (error) {
    if (error.code === "23503") {
      return {
        error:
          "No se puede borrar: hay tickets usando este valor. Desactívalo en su lugar.",
      };
    }
    return { error: error.message };
  }
  return { error: null };
}
