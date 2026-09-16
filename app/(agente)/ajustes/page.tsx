import { Tags, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SettingsCard } from "@/components/settings-card";

export default function AjustesPage() {
  return (
    <div>
      <PageHeader title="Ajustes" description="Configuración general de la aplicación" />

      <div className="grid grid-cols-4 gap-4 px-8 pb-10">
        <SettingsCard
          href="/ajustes/catalogos"
          icon={Tags}
          title="Catálogos"
          description="Categorías, tipos y departamentos de los tickets."
        />
        <SettingsCard
          href="/ajustes/personas"
          icon={Users}
          title="Personas"
          description="Solicitantes y agentes dados de alta en el sistema."
        />
      </div>
    </div>
  );
}
