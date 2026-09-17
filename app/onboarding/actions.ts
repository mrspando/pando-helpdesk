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

  const departamentoId = Number(formData.get("departamento_id"));
  if (!departamentoId) return { error: "Elige un departamento" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_own_departamento", {
    p_departamento_id: departamentoId,
  });

  if (error) return { error: error.message };

  redirect("/");
}
