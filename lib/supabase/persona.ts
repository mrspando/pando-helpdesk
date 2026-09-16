import { createClient } from "@/lib/supabase/server";

export type Persona = {
  id: string;
  nombre: string | null;
  email: string;
  departamento: string | null;
  es_agente: boolean;
};

type PersonaRow = {
  id: string;
  nombre: string | null;
  email: string;
  es_agente: boolean;
  departamento: { nombre: string } | null;
};

export async function getCurrentPersona(): Promise<Persona | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: persona } = await supabase
    .from("personas")
    .select("id, nombre, email, es_agente, departamento:departamentos(nombre)")
    .eq("auth_user_id", user.id)
    .single<PersonaRow>();

  if (!persona) return null;

  return {
    id: persona.id,
    nombre: persona.nombre,
    email: persona.email,
    es_agente: persona.es_agente,
    departamento: persona.departamento?.nombre ?? null,
  };
}
