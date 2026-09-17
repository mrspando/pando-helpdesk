import type { Estado, Prioridad } from "@/lib/format";

// Única fuente de verdad de qué es "backlog" en todo /informes — evita
// que una sección cuente "abierto" de una forma y otra de otra.
//
// `resuelto` NO se considera backlog: desde la perspectiva de carga de
// trabajo de IT, una vez resuelto el trabajo ya está hecho aunque el
// ticket siga técnicamente abierto hasta el cierre formal. Si se
// reabre, el propio trigger de auditoría lo devuelve a un estado
// activo, así que vuelve a contar como backlog automáticamente.
export const ESTADOS_ACTIVOS: Estado[] = [
  "nuevo",
  "triaje",
  "en_curso",
  "esperando_usuario",
  "esperando_proveedor",
];

export const ESTADOS_TERMINALES: Estado[] = ["resuelto", "cerrado", "cancelado"];

export function esBacklog(estado: Estado): boolean {
  return ESTADOS_ACTIVOS.includes(estado);
}

export type TicketMetricRow = {
  id: number;
  ref: string | null;
  titulo: string;
  estado: Estado;
  prioridad: Prioridad;
  categoria_id: number | null;
  tipo_id: number | null;
  departamento_id: number | null;
  origen: string;
  created_at: string;
  triaged_at: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  espera_segundos: number;
  reopen_count: number;
};

export function estaSinClasificar(t: TicketMetricRow): boolean {
  return t.categoria_id === null || t.tipo_id === null || t.departamento_id === null;
}

export function diffSeconds(fromIso: string, toIso: string): number {
  return (new Date(toIso).getTime() - new Date(fromIso).getTime()) / 1000;
}

export function ageSeconds(createdAtIso: string, now: Date): number {
  return (now.getTime() - new Date(createdAtIso).getTime()) / 1000;
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// Duración neta atribuible a IT: tiempo bruto de resolución menos el
// tiempo acumulado esperando a terceros (usuario/proveedor), que ya
// lleva la cuenta `espera_segundos` mantenida por el trigger de
// auditoría de tickets.
export function resolucionNetaSegundos(t: TicketMetricRow): number | null {
  if (!t.resolved_at) return null;
  const bruto = diffSeconds(t.created_at, t.resolved_at);
  return Math.max(0, bruto - t.espera_segundos);
}

// null cuando no hay base de comparación (periodo anterior sin datos) —
// nunca se debe interpretar como 0% ni dividir por cero en silencio.
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export function formatDuration(totalSeconds: number | null): string {
  if (totalSeconds === null || Number.isNaN(totalSeconds)) return "—";
  const seconds = Math.round(Math.abs(totalSeconds));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return "<1m";
}

export type AgingBucketKey = "<1d" | "1-3d" | "3-7d" | "7-14d" | ">14d";
export const AGING_BUCKETS: { key: AgingBucketKey; label: string; maxDays: number | null }[] = [
  { key: "<1d", label: "< 1 día", maxDays: 1 },
  { key: "1-3d", label: "1-3 días", maxDays: 3 },
  { key: "3-7d", label: "3-7 días", maxDays: 7 },
  { key: "7-14d", label: "7-14 días", maxDays: 14 },
  { key: ">14d", label: "> 14 días", maxDays: null },
];

export function agingBucketFor(ageDays: number): AgingBucketKey {
  for (const bucket of AGING_BUCKETS) {
    if (bucket.maxDays !== null && ageDays < bucket.maxDays) return bucket.key;
  }
  return ">14d";
}
