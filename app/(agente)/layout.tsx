import { redirect } from "next/navigation";
import { getCurrentPersona } from "@/lib/supabase/persona";
import { Sidebar } from "@/components/sidebar";

export default async function AgenteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const persona = await getCurrentPersona();

  if (!persona) {
    redirect("/login");
  }

  if (persona.rol === "empleado") {
    redirect("/mis-tickets");
  }

  // Admin queda exento a propósito: si nadie tuviera aún departamento
  // asignado (proyecto recién estrenado), Admin necesita poder entrar
  // a Ajustes → Catálogos para crear alguno antes de que tenga sentido
  // pedírselo a él mismo.
  if (persona.rol !== "admin" && !persona.departamento) {
    redirect("/onboarding");
  }

  return (
    <div className="flex min-h-screen bg-app">
      <Sidebar
        nombre={persona.nombre}
        email={persona.email}
        departamento={persona.departamento}
        rol={persona.rol}
      />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
