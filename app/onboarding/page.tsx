import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPersona } from "@/lib/supabase/persona";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const persona = await getCurrentPersona();
  if (!persona) redirect("/login");
  if (persona.departamento && persona.nombre) redirect("/");

  const supabase = await createClient();
  const { data: departamentos } = await supabase
    .from("departamentos")
    .select("id, nombre")
    .eq("activa", true)
    .order("orden");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-app px-4">
      <div className="text-center">
        <p className="text-[13px] font-semibold tracking-wide text-pando">PANDO</p>
        <p className="text-[13px] text-ink-muted">HELPDESK</p>
      </div>

      <div className="w-full max-w-sm rounded-card border border-border bg-surface p-6">
        <h1 className="text-[16px] font-semibold text-ink">Antes de empezar</h1>
        <p className="mt-1 text-[13px] text-ink-muted">
          Confirma tu nombre y en qué departamento trabajas — ayuda a dirigir tus tickets
          al sitio correcto.
        </p>
        <OnboardingForm defaultNombre={persona.nombre ?? ""} departamentos={departamentos ?? []} />
      </div>
    </div>
  );
}
