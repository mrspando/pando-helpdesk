"use client";

import { useActionState, useState } from "react";
import { Plus, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SolicitanteCombobox } from "@/components/solicitante-combobox";
import { PRIORIDAD_LABEL, PRIORIDAD_ORDER, type Prioridad } from "@/lib/format";
import { createTicket } from "./actions";

type Persona = { id: string; nombre: string | null; email: string };
type Catalog = { id: number; nombre: string };

const initialState: { error: string | null } = { error: null };

function CatalogField({
  label,
  emptyLabel,
  items,
  value,
  onChange,
}: {
  label: string;
  emptyLabel: string;
  items: Catalog[];
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  return (
    <div className="flex-1">
      <label className="mb-1 block text-[12.5px] font-medium text-ink-secondary">{label}</label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-8 w-full items-center justify-between rounded-input border border-border bg-surface px-2.5 text-[13px] text-ink"
          >
            {items.find((i) => i.id === value)?.nombre ?? emptyLabel}
            <ChevronDown size={13} className="text-ink-muted" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
          <DropdownMenuItem selected={value === null} onSelect={() => onChange(null)}>
            {emptyLabel}
          </DropdownMenuItem>
          {items.map((item) => (
            <DropdownMenuItem key={item.id} selected={value === item.id} onSelect={() => onChange(item.id)}>
              {item.nombre}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function NewTicketDialog({
  isAdmin,
  personas,
  categorias,
  tipos,
  departamentos,
  defaultDepartamentoId = null,
}: {
  isAdmin: boolean;
  personas: Persona[];
  categorias: Catalog[];
  tipos: Catalog[];
  departamentos: Catalog[];
  defaultDepartamentoId?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createTicket, initialState);
  const [solicitanteId, setSolicitanteId] = useState("");
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [tipoId, setTipoId] = useState<number | null>(null);
  const [departamentoId, setDepartamentoId] = useState<number | null>(defaultDepartamentoId);
  const [prioridad, setPrioridad] = useState<Prioridad>("normal");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm">
          <Plus size={14} />
          Nuevo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Nuevo ticket</DialogTitle>
        <DialogDescription>
          Para peticiones que llegan por pasillo, teléfono o Teams.
        </DialogDescription>

        <form action={formAction} className="mt-4 space-y-3">
          {isAdmin && <input type="hidden" name="solicitante_id" value={solicitanteId} />}
          <input type="hidden" name="categoria_id" value={categoriaId ?? ""} />
          <input type="hidden" name="tipo_id" value={tipoId ?? ""} />
          <input type="hidden" name="departamento_id" value={departamentoId ?? ""} />
          <input type="hidden" name="prioridad" value={prioridad} />

          <div>
            <label className="mb-1 block text-[12.5px] font-medium text-ink-secondary">
              Título
            </label>
            <Input name="titulo" required placeholder="Error al imprimir etiquetas" className="w-full" />
          </div>

          <div>
            <label className="mb-1 block text-[12.5px] font-medium text-ink-secondary">
              Descripción
            </label>
            <textarea
              name="descripcion"
              rows={3}
              placeholder="Detalle opcional..."
              className="w-full resize-none rounded-input border border-border bg-surface px-2.5 py-2 text-[13px] text-ink placeholder:text-ink-muted focus:border-border-strong focus:outline-none"
            />
          </div>

          {isAdmin && (
            <div>
              <label className="mb-1 block text-[12.5px] font-medium text-ink-secondary">
                Solicitante
              </label>
              <SolicitanteCombobox personas={personas} value={solicitanteId} onChange={setSolicitanteId} />
            </div>
          )}

          <div className="flex gap-3">
            <CatalogField label="Tipo" emptyLabel="Sin tipo" items={tipos} value={tipoId} onChange={setTipoId} />
            <CatalogField
              label="Categoría"
              emptyLabel="Sin categoría"
              items={categorias}
              value={categoriaId}
              onChange={setCategoriaId}
            />
          </div>

          <div className="flex gap-3">
            <CatalogField
              label="Departamento"
              emptyLabel="Sin departamento"
              items={departamentos}
              value={departamentoId}
              onChange={setDepartamentoId}
            />

            <div className="flex-1">
              <label className="mb-1 block text-[12.5px] font-medium text-ink-secondary">
                Prioridad
              </label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex h-8 w-full items-center justify-between rounded-input border border-border bg-surface px-2.5 text-[13px] text-ink"
                  >
                    {PRIORIDAD_LABEL[prioridad]}
                    <ChevronDown size={13} className="text-ink-muted" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                  {PRIORIDAD_ORDER.map((p) => (
                    <DropdownMenuItem key={p} selected={prioridad === p} onSelect={() => setPrioridad(p)}>
                      {PRIORIDAD_LABEL[p]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {state?.error && <p className="text-[12.5px] text-red-600">{state.error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={pending || (isAdmin && !solicitanteId)}>
              Crear ticket
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
