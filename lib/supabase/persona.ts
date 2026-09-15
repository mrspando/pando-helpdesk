import { createClient } from "@/lib/supabase/server";

export type Persona = {
  id: string;
  nombre: string | null;
  email: string;
  es_agente: boolean;
};

export async function getCurrentPersona(): Promise<Persona | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: persona } = await supabase
    .from("personas")
    .select("id, nombre, email, es_agente")
    .eq("auth_user_id", user.id)
    .single();

  return persona;
}
