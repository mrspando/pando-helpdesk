import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { CatalogManager } from "./catalog-manager";

export default async function CatalogosPage() {
  const supabase = await createClient();

  const [{ data: categorias }, { data: tipos }, { data: departamentos }] = await Promise.all([
    supabase.from("categorias").select("id, nombre, activa").order("orden"),
    supabase.from("tipos").select("id, nombre, activa").order("orden"),
    supabase.from("departamentos").select("id, nombre, activa").order("orden"),
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
        title="Catálogos"
        description="Categorías, tipos y departamentos usados al crear y triar tickets"
        className="pt-3"
      />

      <div className="grid grid-cols-3 gap-4 px-8 pb-10">
        <CatalogManager
          catalog="categorias"
          title="Categorías"
          description="ERP/BC, Hardware, Accesos..."
          items={categorias ?? []}
        />
        <CatalogManager
          catalog="tipos"
          title="Tipos"
          description="Incidencia, Solicitud, Proyecto..."
          items={tipos ?? []}
        />
        <CatalogManager
          catalog="departamentos"
          title="Departamentos"
          description="A qué departamento afecta el ticket"
          items={departamentos ?? []}
        />
      </div>
    </div>
  );
}
