import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentPersona } from "@/lib/supabase/persona";

export default async function SolicitanteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const persona = await getCurrentPersona();

  if (!persona) {
    redirect("/login");
  }

  if (persona.es_agente) {
    redirect("/tickets");
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center gap-6 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <span className="font-semibold">Pando Helpdesk</span>
        <nav>
          <Link
            href="/mis-tickets"
            className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Mis tickets
          </Link>
        </nav>
        <span className="ml-auto text-sm text-zinc-500">
          {persona.nombre ?? persona.email}
        </span>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
