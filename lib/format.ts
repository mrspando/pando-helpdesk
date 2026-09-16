export type Estado =
  | "nuevo"
  | "triaje"
  | "en_curso"
  | "esperando_usuario"
  | "esperando_proveedor"
  | "resuelto"
  | "cerrado"
  | "cancelado";

export type Prioridad = "baja" | "normal" | "alta" | "critica";

export const ESTADO_LABEL: Record<Estado, string> = {
  nuevo: "Nuevo",
  triaje: "Triaje",
  en_curso: "En curso",
  esperando_usuario: "Esperando usuario",
  esperando_proveedor: "Esperando proveedor",
  resuelto: "Resuelto",
  cerrado: "Cerrado",
  cancelado: "Cancelado",
};

export const ESTADO_ORDER: Estado[] = [
  "nuevo",
  "triaje",
  "en_curso",
  "esperando_usuario",
  "esperando_proveedor",
  "resuelto",
  "cerrado",
  "cancelado",
];

export const PRIORIDAD_LABEL: Record<Prioridad, string> = {
  critica: "Crítica",
  alta: "Alta",
  normal: "Normal",
  baja: "Baja",
};

export const PRIORIDAD_ORDER: Prioridad[] = ["critica", "alta", "normal", "baja"];

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["week", 60 * 60 * 24 * 7],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60],
];

const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto", style: "short" });

export function formatRelativeTime(isoDate: string, now: Date = new Date()): string {
  const seconds = (new Date(isoDate).getTime() - now.getTime()) / 1000;

  if (Math.abs(seconds) < 60) return "justo ahora";

  for (const [unit, unitSeconds] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= unitSeconds) {
      return rtf.format(Math.round(seconds / unitSeconds), unit);
    }
  }

  return rtf.format(Math.round(seconds / 60), "minute");
}

export function formatDateTime(isoDate: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoDate));
}

export function initials(name: string | null | undefined, fallback = "?"): string {
  const source = name?.trim();
  if (!source) return fallback;
  const parts = source.split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "");
  return letters.join("") || fallback;
}
