"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPersona } from "@/lib/supabase/persona";

export async function completeOnboarding(
  _prevState: { error: string | null } | undefined,
  formData: FormData,
) {
  const persona = await getCurrentPersona();
  if (!persona) redirect("/login");

  const nombre = String(formData.get("nombre") ?? "").trim();
  const departamentoId = Number(formData.get("departamento_id"));

  if (!nombre) return { error: "Escribe tu nombre" };
  if (!departamentoId) return { error: "Elige un departamento" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_own_onboarding", {
    p_nombre: nombre,
    p_departamento_id: departamentoId,
  });

  if (error) return { error: error.message };

  redirect("/");
}
