import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPersona } from "@/lib/supabase/persona";
import { PageHeader } from "@/components/page-header";
import { PersonasManager } from "./personas-manager";

export default async function PersonasPage() {
  const supabase = await createClient();
  const currentPersona = await getCurrentPersona();

  const [{ data: personas, error }, { data: departamentos }] = await Promise.all([
    supabase
      .from("personas")
      .select("id, nombre, email, departamento_id, rol, activo")
      .order("nombre"),
    supabase.from("departamentos").select("id, nombre").order("orden"),
  ]);

  return (
    <div>
      <div className="px-8 pt-6">
        <Link
          href="/ajustes"
          className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted transition-colors duration-150 hover:text-ink"
        >
          <ArrowLeft size={14} />
          Ajustes
        </Link>
      </div>
      <PageHeader
        title="Personas"
        description="Solicitantes y agentes dados de alta en el sistema"
        className="pt-3"
      />

      <div className="px-8 pb-10">
        {error && <p className="text-sm text-red-600">No se pudieron cargar las personas: {error.message}</p>}
        {!error && (
          <PersonasManager
            personas={personas ?? []}
            departamentos={departamentos ?? []}
            currentPersonaId={currentPersona?.id ?? null}
          />
        )}
      </div>
    </div>
  );
}
