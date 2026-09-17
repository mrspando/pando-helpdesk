import type { SupabaseClient } from "@supabase/supabase-js";
import type { Estado, Prioridad } from "@/lib/format";
import type { Rol } from "@/lib/roles";
import {
  ESTADOS_ACTIVOS,
  AGING_BUCKETS,
  type AgingBucketKey,
  type TicketMetricRow,
  agingBucketFor,
  ageSeconds,
  diffSeconds,
  esBacklog,
  estaSinClasificar,
  mean,
  median,
  percentChange,
  resolucionNetaSegundos,
} from "@/lib/informes/metrics";
import {
  bucketKey,
  bucketLabel,
  bucketRange,
  inRange,
  resolvePeriodo,
  type PeriodoKey,
  type RangoPeriodo,
} from "@/lib/informes/periodo";

export type Dimension = "categoria" | "departamento" | "tipo";

export type InformesFiltros = {
  periodo: PeriodoKey;
  departamentoId: number | null;
  categoriaId: number | null;
  tipoId: number | null;
  prioridad: Prioridad | null;
  dimension: Dimension;
};

type Catalogo = { id: number; nombre: string };

export type FocoRow = {
  id: number;
  nombre: string;
  tickets: number;
  porcentaje: number;
  abiertos: number;
  resolucionMedianaSeg: number | null;
  reaperturas: number;
};

export type AtencionItem = {
  id: number;
  ref: string;
  titulo: string;
  motivos: string[];
  edadDias: number;
};

export type InformesData = {
  scopeVacio: boolean;
  catalogos: { categorias: Catalogo[]; tipos: Catalogo[]; departamentos: Catalogo[] };
  rango: RangoPeriodo;
  estadoActual: {
    abiertos: number;
    altaOUrgente: number;
    esperando: number;
    sinClasificar: number;
    antiguedadMaxDias: number | null;
    antiguedadMaxRef: string | null;
  };
  rendimiento: {
    creados: number;
    resueltos: number;
    variacionBacklog: number;
    primeraRespuestaMedianaSeg: number | null;
    primeraRespuestaMediaSeg: number | null;
    nMuestraPrimeraRespuesta: number;
    resolucionMedianaSeg: number | null;
    resolucionMediaSeg: number | null;
    resolucionNetaMedianaSeg: number | null;
    nMuestraResolucion: number;
    tasaReaperturaPct: number | null;
  };
  comparacion: {
    hayPeriodoAnterior: boolean;
    creadosPct: number | null;
    resueltosPct: number | null;
    variacionBacklogAnterior: number | null;
    primeraRespuestaMedianaPct: number | null;
    resolucionMedianaPct: number | null;
    tasaReaperturaAnteriorPct: number | null;
  };
  serieEntradasResoluciones: { key: string; label: string; creados: number; resueltos: number }[];
  serieBacklog: { key: string; label: string; backlog: number }[] | null;
  serieBacklogLimitacion: string | null;
  focos: FocoRow[];
  distribucionEstado: { estado: Estado; count: number }[];
  distribucionDepartamento: { nombre: string; count: number }[] | null;
  envejecimiento: { bucket: AgingBucketKey; label: string; count: number }[];
  requiereAtencion: AtencionItem[];
};

const TICKET_COLUMNS =
  "id, ref, titulo, estado, prioridad, categoria_id, tipo_id, departamento_id, origen, created_at, triaged_at, first_response_at, resolved_at, closed_at, espera_segundos, reopen_count";

export async function getInformesData(
  supabase: SupabaseClient,
  rol: Rol,
  filtros: InformesFiltros,
  now: Date = new Date(),
): Promise<InformesData> {
  const rango = resolvePeriodo(filtros.periodo, now);

  const [{ data: categorias }, { data: tipos }, { data: departamentos }, ticketsQuery] = await Promise.all([
    supabase.from("categorias").select("id, nombre").order("orden"),
    supabase.from("tipos").select("id, nombre").order("orden"),
    supabase.from("departamentos").select("id, nombre").order("orden"),
    (async () => {
      let query = supabase.from("tickets").select(TICKET_COLUMNS).is("deleted_at", null);
      if (filtros.departamentoId) query = query.eq("departamento_id", filtros.departamentoId);
      if (filtros.categoriaId) query = query.eq("categoria_id", filtros.categoriaId);
      if (filtros.tipoId) query = query.eq("tipo_id", filtros.tipoId);
      if (filtros.prioridad) query = query.eq("prioridad", filtros.prioridad);
      return query.returns<TicketMetricRow[]>();
    })(),
  ]);

  const tickets = ticketsQuery.data ?? [];
  const catalogos = {
    categorias: categorias ?? [],
    tipos: tipos ?? [],
    departamentos: departamentos ?? [],
  };
  const categoriaNombre = new Map(catalogos.categorias.map((c) => [c.id, c.nombre]));
  const tipoNombre = new Map(catalogos.tipos.map((t) => [t.id, t.nombre]));
  const departamentoNombre = new Map(catalogos.departamentos.map((d) => [d.id, d.nombre]));

  // ── Estado actual (stock, no acotado al periodo) ──────────────────
  const backlogAhora = tickets.filter((t) => esBacklog(t.estado));
  const altaOUrgenteAhora = backlogAhora.filter((t) => t.prioridad === "alta" || t.prioridad === "critica");
  const esperandoAhora = backlogAhora.filter(
    (t) => t.estado === "esperando_usuario" || t.estado === "esperando_proveedor",
  );
  const sinClasificarAhora = backlogAhora.filter(estaSinClasificar);

  let antiguedadMaxDias: number | null = null;
  let antiguedadMaxRef: string | null = null;
  for (const t of backlogAhora) {
    const dias = ageSeconds(t.created_at, now) / 86400;
    if (antiguedadMaxDias === null || dias > antiguedadMaxDias) {
      antiguedadMaxDias = dias;
      antiguedadMaxRef = t.ref ?? `PANDO-${t.id}`;
    }
  }

  // ── Rendimiento del periodo ────────────────────────────────────────
  function calcularRendimiento(desde: Date, hasta: Date) {
    const creadosSet = tickets.filter((t) => inRange(t.created_at, desde, hasta));
    const resueltosSet = tickets.filter((t) => inRange(t.resolved_at, desde, hasta));

    // Primera respuesta: tickets que ENTRARON en el periodo y ya tienen
    // respuesta — mide "de lo que entró, qué tan rápido respondimos".
    const conPrimeraRespuesta = creadosSet.filter((t) => t.first_response_at);
    const primeraRespuestaSegs = conPrimeraRespuesta.map((t) =>
      diffSeconds(t.created_at, t.first_response_at as string),
    );

    // Resolución: tickets RESUELTOS en el periodo (venga de cuando venga
    // su creación) — mide "de lo que cerramos este periodo, cuánto tardó".
    const resolucionSegs = resueltosSet.map((t) => diffSeconds(t.created_at, t.resolved_at as string));
    const resolucionNetaSegs = resueltosSet
      .map(resolucionNetaSegundos)
      .filter((v): v is number => v !== null);

    const reabiertos = resueltosSet.filter((t) => t.reopen_count > 0).length;
    const tasaReaperturaPct = resueltosSet.length > 0 ? (reabiertos / resueltosSet.length) * 100 : null;

    return {
      creados: creadosSet.length,
      resueltos: resueltosSet.length,
      variacionBacklog: creadosSet.length - resueltosSet.length,
      primeraRespuestaMedianaSeg: median(primeraRespuestaSegs),
      primeraRespuestaMediaSeg: mean(primeraRespuestaSegs),
      nMuestraPrimeraRespuesta: primeraRespuestaSegs.length,
      resolucionMedianaSeg: median(resolucionSegs),
      resolucionMediaSeg: mean(resolucionSegs),
      resolucionNetaMedianaSeg: median(resolucionNetaSegs),
      nMuestraResolucion: resolucionSegs.length,
      tasaReaperturaPct,
    };
  }

  const rendimiento = calcularRendimiento(rango.desde, rango.hasta);
  const anterior = calcularRendimiento(rango.desdeAnterior, rango.hastaAnterior);
  const hayPeriodoAnterior = anterior.creados > 0 || anterior.resueltos > 0;

  const comparacion = {
    hayPeriodoAnterior,
    creadosPct: percentChange(rendimiento.creados, anterior.creados),
    resueltosPct: percentChange(rendimiento.resueltos, anterior.resueltos),
    variacionBacklogAnterior: hayPeriodoAnterior ? anterior.variacionBacklog : null,
    primeraRespuestaMedianaPct:
      rendimiento.primeraRespuestaMedianaSeg !== null && anterior.primeraRespuestaMedianaSeg !== null
        ? percentChange(rendimiento.primeraRespuestaMedianaSeg, anterior.primeraRespuestaMedianaSeg)
        : null,
    resolucionMedianaPct:
      rendimiento.resolucionMedianaSeg !== null && anterior.resolucionMedianaSeg !== null
        ? percentChange(rendimiento.resolucionMedianaSeg, anterior.resolucionMedianaSeg)
        : null,
    tasaReaperturaAnteriorPct: hayPeriodoAnterior ? anterior.tasaReaperturaPct : null,
  };

  // ── Serie de entradas/resoluciones ─────────────────────────────────
  const cubosPeriodo = bucketRange(rango.desde, rango.hasta, rango.agrupacion);
  const creadosPorCubo = new Map<string, number>();
  const resueltosPorCubo = new Map<string, number>();
  for (const t of tickets) {
    if (inRange(t.created_at, rango.desde, rango.hasta)) {
      const k = bucketKey(t.created_at, rango.agrupacion);
      creadosPorCubo.set(k, (creadosPorCubo.get(k) ?? 0) + 1);
    }
    if (inRange(t.resolved_at, rango.desde, rango.hasta)) {
      const k = bucketKey(t.resolved_at as string, rango.agrupacion);
      resueltosPorCubo.set(k, (resueltosPorCubo.get(k) ?? 0) + 1);
    }
  }
  const serieEntradasResoluciones = cubosPeriodo.map((k) => ({
    key: k,
    label: bucketLabel(k, rango.agrupacion),
    creados: creadosPorCubo.get(k) ?? 0,
    resueltos: resueltosPorCubo.get(k) ?? 0,
  }));

  // ── Evolución del backlog (reconstruida desde `events`, no desde el
  // estado actual) ────────────────────────────────────────────────────
  let serieBacklog: InformesData["serieBacklog"] = null;
  let serieBacklogLimitacion: string | null = null;

  if (tickets.length === 0) {
    serieBacklogLimitacion = "No hay tickets en este ámbito todavía.";
  } else {
    const { data: eventosEstado, error: eventosError } = await supabase
      .from("events")
      .select("ticket_id, valor_nuevo, created_at")
      .eq("tipo", "estado")
      .in(
        "ticket_id",
        tickets.map((t) => t.id),
      )
      .order("created_at", { ascending: true });

    if (eventosError) {
      serieBacklogLimitacion = "No se pudo leer el historial de estados para reconstruir el backlog.";
    } else {
      const eventosPorTicket = new Map<number, { estado: Estado; created_at: string }[]>();
      for (const e of eventosEstado ?? []) {
        const lista = eventosPorTicket.get(e.ticket_id) ?? [];
        lista.push({ estado: e.valor_nuevo as Estado, created_at: e.created_at });
        eventosPorTicket.set(e.ticket_id, lista);
      }

      serieBacklog = cubosPeriodo.map((k) => {
        // Evalúa el backlog al final del último instante de ese cubo.
        const finCubo = new Date(bucketCutoff(k, rango.agrupacion));
        let count = 0;
        for (const t of tickets) {
          if (new Date(t.created_at).getTime() > finCubo.getTime()) continue;
          let estadoEnEseMomento: Estado = "nuevo";
          for (const evento of eventosPorTicket.get(t.id) ?? []) {
            if (new Date(evento.created_at).getTime() > finCubo.getTime()) break;
            estadoEnEseMomento = evento.estado;
          }
          if (esBacklog(estadoEnEseMomento)) count++;
        }
        return { key: k, label: bucketLabel(k, rango.agrupacion), backlog: count };
      });
    }
  }

  // ── Principales focos (dimensión seleccionable) ───────────────────
  const enPeriodo = tickets.filter((t) => inRange(t.created_at, rango.desde, rango.hasta));
  const totalEnPeriodo = enPeriodo.length;

  function dimensionKey(t: TicketMetricRow): number | null {
    if (filtros.dimension === "categoria") return t.categoria_id;
    if (filtros.dimension === "tipo") return t.tipo_id;
    return t.departamento_id;
  }
  function dimensionNombre(id: number | null): string {
    if (id === null) return "Sin clasificar";
    if (filtros.dimension === "categoria") return categoriaNombre.get(id) ?? `#${id}`;
    if (filtros.dimension === "tipo") return tipoNombre.get(id) ?? `#${id}`;
    return departamentoNombre.get(id) ?? `#${id}`;
  }

  const gruposFoco = new Map<number | null, TicketMetricRow[]>();
  for (const t of enPeriodo) {
    const k = dimensionKey(t);
    const lista = gruposFoco.get(k) ?? [];
    lista.push(t);
    gruposFoco.set(k, lista);
  }

  const focos: FocoRow[] = [...gruposFoco.entries()]
    .map(([key, grupo]) => {
      const resolucionSegs = grupo
        .filter((t) => t.resolved_at)
        .map((t) => diffSeconds(t.created_at, t.resolved_at as string));
      return {
        id: key ?? -1,
        nombre: dimensionNombre(key),
        tickets: grupo.length,
        porcentaje: totalEnPeriodo > 0 ? (grupo.length / totalEnPeriodo) * 100 : 0,
        abiertos: grupo.filter((t) => esBacklog(t.estado)).length,
        resolucionMedianaSeg: median(resolucionSegs),
        reaperturas: grupo.filter((t) => t.reopen_count > 0).length,
      };
    })
    .sort((a, b) => b.tickets - a.tickets);

  // ── Distribuciones (sobre el backlog actual) ───────────────────────
  const distribucionEstadoMap = new Map<Estado, number>();
  for (const t of backlogAhora) {
    distribucionEstadoMap.set(t.estado, (distribucionEstadoMap.get(t.estado) ?? 0) + 1);
  }
  const distribucionEstado = ESTADOS_ACTIVOS.map((estado) => ({
    estado,
    count: distribucionEstadoMap.get(estado) ?? 0,
  })).filter((row) => row.count > 0);

  let distribucionDepartamento: InformesData["distribucionDepartamento"] = null;
  if (rol !== "direccion") {
    const porDepto = new Map<string, number>();
    for (const t of backlogAhora) {
      const nombre = t.departamento_id ? (departamentoNombre.get(t.departamento_id) ?? "—") : "Sin departamento";
      porDepto.set(nombre, (porDepto.get(nombre) ?? 0) + 1);
    }
    const filas = [...porDepto.entries()].map(([nombre, count]) => ({ nombre, count }));
    // Con una sola fila no aporta nada (coincide con el propio ámbito).
    distribucionDepartamento = filas.length > 1 ? filas.sort((a, b) => b.count - a.count) : null;
  }

  // ── Envejecimiento del backlog ─────────────────────────────────────
  const envejecimientoMap = new Map<AgingBucketKey, number>();
  for (const t of backlogAhora) {
    const dias = ageSeconds(t.created_at, now) / 86400;
    const bucket = agingBucketFor(dias);
    envejecimientoMap.set(bucket, (envejecimientoMap.get(bucket) ?? 0) + 1);
  }
  const envejecimiento = AGING_BUCKETS.map((b) => ({
    bucket: b.key,
    label: b.label,
    count: envejecimientoMap.get(b.key) ?? 0,
  }));

  // ── Requiere atención (reglas transparentes, sin SLA inventado) ────
  const requiereAtencion: AtencionItem[] = backlogAhora
    .map((t) => {
      const edadDias = ageSeconds(t.created_at, now) / 86400;
      const motivos: string[] = [];

      if (t.prioridad === "critica") motivos.push("Urgente");
      if (t.prioridad === "alta" && edadDias > 3) motivos.push("Alta prioridad, más de 3 días abierto");
      if (!t.first_response_at && edadDias * 24 > 4) motivos.push("Sin primera respuesta");
      if ((t.estado === "nuevo" || t.estado === "triaje") && edadDias > 2)
        motivos.push("Más de 2 días sin salir de Nuevo/Triaje");
      if (estaSinClasificar(t)) motivos.push("Sin clasificar");
      if (t.reopen_count > 0) motivos.push(`Reabierto ${t.reopen_count} ${t.reopen_count === 1 ? "vez" : "veces"}`);
      if (edadDias > 14) motivos.push("Antigüedad elevada");

      return { id: t.id, ref: t.ref ?? `PANDO-${t.id}`, titulo: t.titulo, motivos, edadDias };
    })
    .filter((item) => item.motivos.length > 0)
    .sort((a, b) => b.edadDias - a.edadDias)
    .slice(0, 10);

  return {
    scopeVacio: tickets.length === 0,
    catalogos,
    rango,
    estadoActual: {
      abiertos: backlogAhora.length,
      altaOUrgente: altaOUrgenteAhora.length,
      esperando: esperandoAhora.length,
      sinClasificar: sinClasificarAhora.length,
      antiguedadMaxDias,
      antiguedadMaxRef,
    },
    rendimiento,
    comparacion,
    serieEntradasResoluciones,
    serieBacklog,
    serieBacklogLimitacion,
    focos,
    distribucionEstado,
    distribucionDepartamento,
    envejecimiento,
    requiereAtencion,
  };
}

function bucketCutoff(key: string, agrupacion: RangoPeriodo["agrupacion"]): string {
  if (agrupacion === "mes") {
    const [year, month] = key.split("-").map(Number);
    return new Date(year, month, 0, 23, 59, 59, 999).toISOString();
  }
  if (agrupacion === "semana") {
    const monday = new Date(key + "T00:00:00");
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return sunday.toISOString();
  }
  return new Date(key + "T23:59:59.999").toISOString();
}
