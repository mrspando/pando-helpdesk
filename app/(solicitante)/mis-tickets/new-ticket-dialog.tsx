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
import { createOwnTicket } from "./actions";

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

export function NewTicketDialog({ categorias, tipos }: { categorias: Catalog[]; tipos: Catalog[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createOwnTicket, initialState);
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [tipoId, setTipoId] = useState<number | null>(null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm">
          <Plus size={14} />
          Nuevo ticket
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Nuevo ticket</DialogTitle>
        <DialogDescription>Cuéntanos qué necesitas, IT lo revisará en breve.</DialogDescription>

        <form action={formAction} className="mt-4 space-y-3">
          <input type="hidden" name="categoria_id" value={categoriaId ?? ""} />
          <input type="hidden" name="tipo_id" value={tipoId ?? ""} />

          <div>
            <label className="mb-1 block text-[12.5px] font-medium text-ink-secondary">Título</label>
            <Input name="titulo" required placeholder="No puedo acceder a la VPN" className="w-full" />
          </div>

          <div>
            <label className="mb-1 block text-[12.5px] font-medium text-ink-secondary">Descripción</label>
            <textarea
              name="descripcion"
              rows={4}
              placeholder="Cuenta con más detalle qué está pasando..."
              className="w-full resize-none rounded-input border border-border bg-surface px-2.5 py-2 text-[13px] text-ink placeholder:text-ink-muted focus:border-border-strong focus:outline-none"
            />
          </div>

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

          {state?.error && <p className="text-[12.5px] text-red-600">{state.error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={pending}>
              Enviar ticket
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
