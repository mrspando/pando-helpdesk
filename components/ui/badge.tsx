import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ESTADO_LABEL, PRIORIDAD_LABEL, type Estado, type Prioridad } from "@/lib/format";

export function Badge({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-badge px-2 py-0.5 text-[12px] font-medium leading-none",
        className,
      )}
    >
      {children}
    </span>
  );
}

const ESTADO_STYLE: Record<Estado, string> = {
  nuevo: "bg-blue-50 text-blue-700",
  triaje: "bg-violet-50 text-violet-700",
  en_curso: "bg-blue-100 text-blue-700",
  esperando_usuario: "bg-amber-50 text-amber-700",
  esperando_proveedor: "bg-orange-50 text-orange-700",
  resuelto: "bg-green-50 text-green-700",
  cerrado: "bg-surface-2 text-ink-muted",
  cancelado: "bg-surface-2 text-ink-muted",
};

const ESTADO_DOT: Record<Estado, string> = {
  nuevo: "bg-blue-500",
  triaje: "bg-violet-500",
  en_curso: "bg-blue-600",
  esperando_usuario: "bg-amber-500",
  esperando_proveedor: "bg-orange-500",
  resuelto: "bg-green-600",
  cerrado: "bg-ink-disabled",
  cancelado: "bg-ink-disabled",
};

export function StatusBadge({ estado, className }: { estado: Estado; className?: string }) {
  return (
    <Badge className={cn(ESTADO_STYLE[estado], className)}>
      {estado === "resuelto" ? (
        <Check size={11} strokeWidth={2.5} />
      ) : (
        <span className={cn("h-1.5 w-1.5 rounded-full", ESTADO_DOT[estado])} />
      )}
      {ESTADO_LABEL[estado]}
    </Badge>
  );
}

const PRIORIDAD_STYLE: Record<Prioridad, string> = {
  critica: "bg-red-50 text-red-700",
  alta: "bg-orange-50 text-orange-700",
  normal: "",
  baja: "",
};

export function PriorityBadge({
  prioridad,
  className,
}: {
  prioridad: Prioridad;
  className?: string;
}) {
  if (prioridad === "normal" || prioridad === "baja") {
    return (
      <span
        className={cn(
          "inline-flex items-center text-[12px] font-medium leading-none",
          prioridad === "baja" ? "text-ink-muted" : "text-ink-secondary",
          className,
        )}
      >
        {PRIORIDAD_LABEL[prioridad]}
      </span>
    );
  }

  return <Badge className={cn(PRIORIDAD_STYLE[prioridad], className)}>{PRIORIDAD_LABEL[prioridad]}</Badge>;
}
