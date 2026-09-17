import { redirect } from "next/navigation";
import { getCurrentPersona } from "@/lib/supabase/persona";

export default async function AjustesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const persona = await getCurrentPersona();

  // AgenteLayout ya garantiza que hay sesión y que no es Empleado, pero
  // Ajustes es exclusivo de Admin — Gerencia y Responsable de
  // departamento no deben poder ver esta zona ni tecleando la URL a
  // mano, no basta con que el enlace esté oculto en la sidebar.
  if (!persona || persona.rol !== "admin") {
    redirect("/tickets");
  }

  return <>{children}</>;
}
