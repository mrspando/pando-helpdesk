import { redirect } from "next/navigation";
import { getCurrentPersona } from "@/lib/supabase/persona";

export default async function Home() {
  const persona = await getCurrentPersona();

  if (!persona) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-xl font-semibold">No se encontró tu perfil</h1>
        <p className="max-w-sm text-sm text-zinc-500">
          Tu sesión es válida pero no hay una fila en `personas` asociada.
          Contacta con IT.
        </p>
      </div>
    );
  }

  redirect(persona.es_agente ? "/tickets" : "/mis-tickets");
}
