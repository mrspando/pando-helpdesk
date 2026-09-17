import { redirect } from "next/navigation";
import { getCurrentPersona } from "@/lib/supabase/persona";

export default async function Home() {
  const persona = await getCurrentPersona();

  if (!persona) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-app text-center">
        <h1 className="text-xl font-semibold text-ink">No se encontró tu perfil</h1>
        <p className="max-w-sm text-sm text-ink-muted">
          Tu sesión es válida pero no hay una fila en `personas` asociada.
          Contacta con IT.
        </p>
      </div>
    );
  }

  redirect(persona.rol === "empleado" ? "/mis-tickets" : "/tickets");
}
