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
