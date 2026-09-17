import { createClient } from "@/lib/supabase/server";
import { getCurrentPersona } from "@/lib/supabase/persona";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { BarChart3 } from "lucide-react";
import type { Prioridad } from "@/lib/format";
import { formatDuration } from "@/lib/informes/metrics";
import { PERIODO_LABEL, type PeriodoKey } from "@/lib/informes/periodo";
import { getInformesData, type Dimension, type InformesFiltros } from "./data";
import { FiltersBar } from "./filters-bar";
import { EvolutionChart } from "./evolution-chart";
import { FocosPieChart } from "./pie-chart";
import {
  SectionTitle,
  KpiRow,
  MetricGroup,
  ComparisonRow,
  FocosDimensionTabs,
  FocosTable,
  EstadoDistribution,
  AgingBuckets,
  AttentionList,
  BarList,
} from "./sections";

const PERIODOS_VALIDOS: PeriodoKey[] = ["7d", "30d", "90d", "year"];
const DIMENSIONES_VALIDAS: Dimension[] = ["categoria", "departamento", "tipo"];

export default async function InformesPage({ searchParams }: PageProps<"/informes">) {
  const params = await searchParams;
  const persona = await getCurrentPersona();
  const supabase = await createClient();

  const periodoParam = typeof params.periodo === "string" ? (params.periodo as PeriodoKey) : "30d";
  const periodo = PERIODOS_VALIDOS.includes(periodoParam) ? periodoParam : "30d";

  const departamentoId = typeof params.departamento === "string" ? params.departamento : undefined;
  const categoriaId = typeof params.categoria === "string" ? params.categoria : undefined;
  const tipoId = typeof params.tipo === "string" ? params.tipo : undefined;
  const prioridad = typeof params.prioridad === "string" ? (params.prioridad as Prioridad) : undefined;

  const dimensionParam = typeof params.dim === "string" ? (params.dim as Dimension) : "categoria";
  const dimension = DIMENSIONES_VALIDAS.includes(dimensionParam) ? dimensionParam : "categoria";

  const rol = persona?.rol ?? "empleado";
  const mostrarDepartamento = rol !== "direccion";

  const filtros: InformesFiltros = {
    periodo,
    departamentoId: departamentoId ? Number(departamentoId) : null,
    categoriaId: categoriaId ? Number(categoriaId) : null,
    tipoId: tipoId ? Number(tipoId) : null,
    prioridad: prioridad ?? null,
    // A un Responsable de departamento no le sirve de nada desglosar por
    // departamento (RLS ya lo deja ver solo el suyo, sería una fila).
    dimension: !mostrarDepartamento && dimension === "departamento" ? "categoria" : dimension,
  };

  const data = await getInformesData(supabase, rol, filtros);

  const otherParams = {
    periodo,
    departamento: departamentoId,
    categoria: categoriaId,
    tipo: tipoId,
    prioridad,
  };

  return (
    <div>
      <PageHeader title="Informes" description="Visión global del servicio de soporte" />

      {!mostrarDepartamento && persona?.departamento && (
        <p className="-mt-2 px-8 pb-3 text-[12.5px] text-ink-muted">
          Mostrando datos de tu departamento: <span className="font-medium text-ink-secondary">{persona.departamento}</span>
        </p>
      )}

      <FiltersBar
        categorias={data.catalogos.categorias}
        tipos={data.catalogos.tipos}
        departamentos={data.catalogos.departamentos}
        mostrarDepartamento={mostrarDepartamento}
      />

      {data.scopeVacio ? (
        <EmptyState
          icon={BarChart3}
          title="Sin datos todavía"
          description="En cuanto existan tickets en tu ámbito, aquí aparecerá el análisis completo."
          className="mt-6"
        />
      ) : (
        <div className="space-y-8 px-8 pb-14">
          <section>
            <SectionTitle>Estado actual</SectionTitle>
            <KpiRow
              items={[
                { label: "Abiertos", value: String(data.estadoActual.abiertos), href: "/tickets" },
                {
                  label: "Alta / urgente",
                  value: String(data.estadoActual.altaOUrgente),
                  href: "/tickets?prioridad=critica",
                },
                { label: "Esperando", value: String(data.estadoActual.esperando), href: "/tickets?estado=esperando" },
                { label: "Sin clasificar", value: String(data.estadoActual.sinClasificar) },
                {
                  label: "Más antiguo abierto",
                  value:
                    data.estadoActual.antiguedadMaxDias !== null
                      ? `${Math.round(data.estadoActual.antiguedadMaxDias)}d`
                      : "—",
                },
              ]}
            />
          </section>

          <section className="border-t border-border pt-6">
            <SectionTitle>Rendimiento · {PERIODO_LABEL[periodo]}</SectionTitle>
            <div className="flex flex-wrap gap-x-10 gap-y-4">
              <div>
                <p className="text-[12.5px] text-ink-muted">Tickets</p>
                <p className="mt-0.5 text-[16px] font-semibold text-ink">
                  {data.rendimiento.creados} creados · {data.rendimiento.resueltos} resueltos
                </p>
                <p className="text-[12.5px] text-ink-muted">
                  {data.rendimiento.variacionBacklog >= 0 ? "+" : ""}
                  {data.rendimiento.variacionBacklog} backlog neto
                </p>
              </div>

              <MetricGroup
                title="Primera respuesta"
                mediana={formatDuration(data.rendimiento.primeraRespuestaMedianaSeg)}
                media={formatDuration(data.rendimiento.primeraRespuestaMediaSeg)}
              />

              <MetricGroup
                title="Resolución"
                mediana={formatDuration(data.rendimiento.resolucionMedianaSeg)}
                media={formatDuration(data.rendimiento.resolucionMediaSeg)}
                extra={
                  data.rendimiento.resolucionNetaMedianaSeg !== null
                    ? `Neta (sin esperas): ${formatDuration(data.rendimiento.resolucionNetaMedianaSeg)}`
                    : undefined
                }
              />

              <div>
                <p className="text-[12.5px] text-ink-muted">Reabiertos</p>
                <p className="mt-0.5 text-[16px] font-semibold text-ink">
                  {data.rendimiento.tasaReaperturaPct !== null ? `${Math.round(data.rendimiento.tasaReaperturaPct)}%` : "—"}
                </p>
              </div>
            </div>

            <div className="mt-4 border-t border-border pt-3">
              <ComparisonRow
                hayDatos={data.comparacion.hayPeriodoAnterior}
                items={[
                  { label: "Tickets creados", pct: data.comparacion.creadosPct },
                  { label: "Primera respuesta", pct: data.comparacion.primeraRespuestaMedianaPct, invert: true },
                  { label: "Resolución", pct: data.comparacion.resolucionMedianaPct, invert: true },
                ]}
              />
            </div>
          </section>

          <section className="border-t border-border pt-6">
            <SectionTitle>Evolución</SectionTitle>
            <p className="mb-2 text-[12.5px] text-ink-secondary">Tickets creados / resueltos</p>
            <EvolutionChart
              labels={data.serieEntradasResoluciones.map((s) => s.label)}
              series={[
                {
                  key: "creados",
                  color: "#181818",
                  label: "Creados",
                  values: data.serieEntradasResoluciones.map((s) => s.creados),
                },
                {
                  key: "resueltos",
                  color: "#2f855a",
                  label: "Resueltos",
                  values: data.serieEntradasResoluciones.map((s) => s.resueltos),
                },
              ]}
            />

            <p className="mb-2 mt-6 text-[12.5px] text-ink-secondary">Backlog</p>
            {data.serieBacklog ? (
              <EvolutionChart
                labels={data.serieBacklog.map((s) => s.label)}
                series={[
                  { key: "backlog", color: "#111111", label: "Backlog", values: data.serieBacklog.map((s) => s.backlog) },
                ]}
              />
            ) : (
              <p className="text-[12.5px] text-ink-muted">
                {data.serieBacklogLimitacion ?? "No hay suficientes datos para reconstruir el backlog todavía."}
              </p>
            )}
          </section>

          <section className="border-t border-border pt-6">
            <SectionTitle>Principales focos</SectionTitle>
            <FocosDimensionTabs
              dimension={filtros.dimension}
              otherParams={otherParams}
              mostrarDepartamento={mostrarDepartamento}
            />
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
              <div className="shrink-0 lg:w-[380px]">
                <FocosPieChart rows={data.focos} dimension={filtros.dimension} otherParams={otherParams} />
              </div>
              <div className="min-w-0 flex-1">
                <FocosTable dimension={filtros.dimension} rows={data.focos} />
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-8 border-t border-border pt-6">
            <div>
              <SectionTitle>Por estado (backlog actual)</SectionTitle>
              <EstadoDistribution rows={data.distribucionEstado} />
            </div>
            {data.distribucionDepartamento && (
              <div>
                <SectionTitle>Por departamento (backlog actual)</SectionTitle>
                <BarList rows={data.distribucionDepartamento.map((d) => ({ label: d.nombre, count: d.count }))} />
              </div>
            )}
          </section>

          <section className="border-t border-border pt-6">
            <SectionTitle>Envejecimiento del backlog</SectionTitle>
            <AgingBuckets buckets={data.envejecimiento} />
          </section>

          <section className="border-t border-border pt-6">
            <SectionTitle>Requiere atención</SectionTitle>
            <AttentionList items={data.requiereAtencion} />
          </section>
        </div>
      )}
    </div>
  );
}
