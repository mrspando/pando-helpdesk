"use client";

import { useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PriorityBadge, StatusBadge } from "@/components/ui/badge";
import {
  ESTADO_LABEL,
  ESTADO_ORDER,
  PRIORIDAD_LABEL,
  PRIORIDAD_ORDER,
  formatDateTime,
  type Estado,
  type Prioridad,
} from "@/lib/format";
import {
  updateCategoria,
  updateDepartamento,
  updateEstado,
  updatePrioridad,
  updateTipo,
} from "./actions";

type Catalog = { id: number; nombre: string };

function PropertyRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-[12.5px] text-ink-muted">{label}</span>
      {children}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[12.5px] text-ink-muted">{label}</span>
      <span className="text-[12.5px] text-ink-secondary">{value}</span>
    </div>
  );
}

function CatalogPropertyRow({
  label,
  emptyLabel,
  items,
  value,
  disabled,
  onSelect,
}: {
  label: string;
  emptyLabel: string;
  items: Catalog[];
  value: number | null;
  disabled: boolean;
  onSelect: (id: number) => void;
}) {
  const nombre = items.find((i) => i.id === value)?.nombre ?? emptyLabel;
  return (
    <PropertyRow label={label}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="flex items-center gap-1 text-[13px] font-medium text-ink"
          >
            {nombre}
            <ChevronDown size={12} className="text-ink-muted" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {items.map((item) => (
            <DropdownMenuItem key={item.id} selected={item.id === value} onSelect={() => onSelect(item.id)}>
              {item.nombre}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </PropertyRow>
  );
}

export function PropertiesPanel({
  ticketId,
  estado,
  prioridad,
  categoriaId,
  categorias,
  tipoId,
  tipos,
  departamentoId,
  departamentos,
  solicitanteNombre,
  createdAt,
  triagedAt,
  firstResponseAt,
  resolvedAt,
}: {
  ticketId: number;
  estado: Estado;
  prioridad: Prioridad;
  categoriaId: number | null;
  categorias: Catalog[];
  tipoId: number | null;
  tipos: Catalog[];
  departamentoId: number | null;
  departamentos: Catalog[];
  solicitanteNombre: string;
  createdAt: string;
  triagedAt: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
}) {
  const [pending, startTransition] = useTransition();

  function handle(promise: Promise<{ error: string | null }>, okMessage: string) {
    startTransition(async () => {
      const { error } = await promise;
      if (error) toast.error(error);
      else toast.success(okMessage);
    });
  }

  return (
    <aside className="w-[280px] shrink-0 border-l border-border px-5 py-5">
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
        Propiedades
      </p>

      <div className="divide-y divide-border">
        <PropertyRow label="Estado">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" disabled={pending} className="flex items-center gap-1">
                <StatusBadge estado={estado} />
                <ChevronDown size={12} className="text-ink-muted" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {ESTADO_ORDER.map((value) => (
                <DropdownMenuItem
                  key={value}
                  selected={value === estado}
                  onSelect={() => handle(updateEstado(ticketId, value), `Estado cambiado a ${ESTADO_LABEL[value]}`)}
                >
                  {ESTADO_LABEL[value]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </PropertyRow>

        <PropertyRow label="Prioridad">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" disabled={pending} className="flex items-center gap-1">
                <PriorityBadge prioridad={prioridad} />
                <ChevronDown size={12} className="text-ink-muted" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {PRIORIDAD_ORDER.map((value) => (
                <DropdownMenuItem
                  key={value}
                  selected={value === prioridad}
                  onSelect={() => handle(updatePrioridad(ticketId, value), "Prioridad actualizada")}
                >
                  {PRIORIDAD_LABEL[value]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </PropertyRow>

        <CatalogPropertyRow
          label="Categoría"
          emptyLabel="Sin categoría"
          items={categorias}
          value={categoriaId}
          disabled={pending}
          onSelect={(id) => handle(updateCategoria(ticketId, id), "Categoría actualizada")}
        />

        <CatalogPropertyRow
          label="Tipo"
          emptyLabel="Sin tipo"
          items={tipos}
          value={tipoId}
          disabled={pending}
          onSelect={(id) => handle(updateTipo(ticketId, id), "Tipo actualizado")}
        />

        <CatalogPropertyRow
          label="Departamento"
          emptyLabel="Sin departamento"
          items={departamentos}
          value={departamentoId}
          disabled={pending}
          onSelect={(id) => handle(updateDepartamento(ticketId, id), "Departamento actualizado")}
        />
      </div>

      <div className="mt-4 border-t border-border pt-2">
        <Fact label="Solicitante" value={solicitanteNombre} />
        <Fact label="Creado" value={formatDateTime(createdAt)} />
        <Fact label="Triaje" value={triagedAt && formatDateTime(triagedAt)} />
        <Fact label="1ª respuesta" value={firstResponseAt && formatDateTime(firstResponseAt)} />
        <Fact label="Resuelto" value={resolvedAt && formatDateTime(resolvedAt)} />
      </div>
    </aside>
  );
}
