import { createClient } from "@/lib/supabase/server";
import type { Rol } from "@/lib/roles";

export type Persona = {
  id: string;
  nombre: string | null;
  email: string;
  departamento: string | null;
  departamentoId: number | null;
  rol: Rol;
};

type PersonaRow = {
  id: string;
  nombre: string | null;
  email: string;
  rol: Rol;
  departamento_id: number | null;
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
    .select("id, nombre, email, rol, departamento_id, departamento:departamentos(nombre)")
    .eq("auth_user_id", user.id)
    .single<PersonaRow>();

  if (!persona) return null;

  return {
    id: persona.id,
    nombre: persona.nombre,
    email: persona.email,
    rol: persona.rol,
    departamento: persona.departamento?.nombre ?? null,
    departamentoId: persona.departamento_id,
  };
}
