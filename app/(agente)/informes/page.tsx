import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { BarChart3 } from "lucide-react";

type Row = {
  categoria_id: number | null;
  created_at: string;
  first_response_at: string | null;
  categoria: { nombre: string } | null;
};

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function daysAgoIso(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export default async function InformesPage() {
  const supabase = await createClient();
  const since = daysAgoIso(30);

  const { data: tickets, error } = await supabase
    .from("tickets")
    .select("categoria_id, created_at, first_response_at, categoria:categorias(nombre)")
    .is("deleted_at", null)
    .gte("created_at", since)
    .returns<Row[]>();

  const total = tickets?.length ?? 0;

  const respondedTimes = (tickets ?? [])
    .filter((t) => t.first_response_at)
    .map((t) => (new Date(t.first_response_at!).getTime() - new Date(t.created_at).getTime()) / 1000);

  const avgResponse =
    respondedTimes.length > 0
      ? formatDuration(respondedTimes.reduce((a, b) => a + b, 0) / respondedTimes.length)
      : "—";

  const porCategoria = new Map<string, number>();
  for (const t of tickets ?? []) {
    const nombre = t.categoria?.nombre ?? "Sin categoría";
    porCategoria.set(nombre, (porCategoria.get(nombre) ?? 0) + 1);
  }
  const categoriaRows = [...porCategoria.entries()].sort((a, b) => b[1] - a[1]);
  const maxCount = Math.max(1, ...categoriaRows.map(([, count]) => count));

  return (
    <div>
      <PageHeader title="Informes" description="Resumen de actividad de los últimos 30 días" />

      {error && (
        <p className="px-8 py-6 text-sm text-red-600">No se pudieron cargar los informes: {error.message}</p>
      )}

      {!error && total === 0 && (
        <EmptyState icon={BarChart3} title="Sin datos todavía" description="Aún no hay tickets en los últimos 30 días." />
      )}

      {!error && total > 0 && (
        <div className="px-8 pb-10">
          <div className="flex items-baseline gap-8 border-b border-border pb-5">
            <div>
              <p className="text-[22px] font-semibold text-ink">{total}</p>
              <p className="text-[12.5px] text-ink-muted">tickets</p>
            </div>
            <div>
              <p className="text-[22px] font-semibold text-ink">{avgResponse}</p>
              <p className="text-[12.5px] text-ink-muted">respuesta media</p>
            </div>
          </div>

          <p className="mb-3 mt-6 text-[13px] font-medium text-ink-secondary">Tickets por categoría</p>
          <div className="space-y-2.5">
            {categoriaRows.map(([nombre, count]) => (
              <div key={nombre} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate text-[12.5px] text-ink-secondary">{nombre}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-pando"
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right text-[12.5px] text-ink-muted">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
