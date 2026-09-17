import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentPersona } from "@/lib/supabase/persona";
import { signOut } from "@/lib/supabase/actions";

export default async function SolicitanteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const persona = await getCurrentPersona();

  if (!persona) {
    redirect("/login");
  }

  if (persona.rol !== "empleado") {
    redirect("/tickets");
  }

  if (!persona.departamento || !persona.nombre) {
    redirect("/onboarding");
  }

  return (
    <div className="min-h-screen bg-app">
      <header className="flex items-center gap-6 border-b border-border bg-surface px-6 py-4">
        <span className="text-[13px] font-semibold text-pando">Pando Helpdesk</span>
        <nav>
          <Link
            href="/mis-tickets"
            className="text-[13px] text-ink-secondary hover:text-ink"
          >
            Mis tickets
          </Link>
        </nav>
        <span className="ml-auto text-[13px] text-ink-muted">
          {persona.nombre ?? persona.email}
        </span>
        <form action={signOut}>
          <button type="submit" className="text-[13px] text-ink-muted hover:text-ink">
            Cerrar sesión
          </button>
        </form>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
