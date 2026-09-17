export type PeriodoKey = "7d" | "30d" | "90d" | "year";

export const PERIODO_LABEL: Record<PeriodoKey, string> = {
  "7d": "Últimos 7 días",
  "30d": "Últimos 30 días",
  "90d": "Últimos 90 días",
  year: "Este año",
};

export const PERIODO_ORDER: PeriodoKey[] = ["7d", "30d", "90d", "year"];

export type RangoPeriodo = {
  desde: Date;
  hasta: Date;
  desdeAnterior: Date;
  hastaAnterior: Date;
  /** Agrupación recomendada para gráficas temporales de este periodo. */
  agrupacion: "dia" | "semana" | "mes";
};

export function resolvePeriodo(key: PeriodoKey, now: Date = new Date()): RangoPeriodo {
  const hasta = now;

  if (key === "year") {
    const desde = new Date(now.getFullYear(), 0, 1);
    const desdeAnterior = new Date(now.getFullYear() - 1, 0, 1);
    const hastaAnterior = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate(), 23, 59, 59);
    return { desde, hasta, desdeAnterior, hastaAnterior, agrupacion: "mes" };
  }

  const dias = key === "7d" ? 7 : key === "30d" ? 30 : 90;
  const desde = new Date(now.getTime() - dias * 86400_000);
  const desdeAnterior = new Date(desde.getTime() - dias * 86400_000);
  const hastaAnterior = desde;
  const agrupacion = dias <= 30 ? "dia" : "semana";

  return { desde, hasta, desdeAnterior, hastaAnterior, agrupacion };
}

export function inRange(iso: string | null, desde: Date, hasta: Date): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= desde.getTime() && t <= hasta.getTime();
}

/** Claves de "cubo" (día/semana/mes) usadas para agrupar series temporales. */
export function bucketKey(iso: string, agrupacion: RangoPeriodo["agrupacion"]): string {
  const d = new Date(iso);
  if (agrupacion === "mes") {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  if (agrupacion === "semana") {
    // Lunes de esa semana como clave.
    const day = (d.getDay() + 6) % 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - day);
    return monday.toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

export function bucketLabel(key: string, agrupacion: RangoPeriodo["agrupacion"]): string {
  if (agrupacion === "mes") {
    const [year, month] = key.split("-").map(Number);
    return new Intl.DateTimeFormat("es-ES", { month: "short", year: "2-digit" }).format(
      new Date(year, month - 1, 1),
    );
  }
  const date = new Date(key + "T00:00:00");
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short" }).format(date);
}

/** Genera las claves de cubo consecutivas entre dos fechas, para que las
 * series temporales incluyan ceros en los días/semanas/meses sin datos
 * en vez de saltárselos. */
export function bucketRange(desde: Date, hasta: Date, agrupacion: RangoPeriodo["agrupacion"]): string[] {
  const keys: string[] = [];
  const cursor = new Date(desde);
  const seen = new Set<string>();
  while (cursor.getTime() <= hasta.getTime()) {
    const key = bucketKey(cursor.toISOString(), agrupacion);
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
    if (agrupacion === "mes") cursor.setMonth(cursor.getMonth() + 1);
    else if (agrupacion === "semana") cursor.setDate(cursor.getDate() + 7);
    else cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}
