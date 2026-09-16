"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCatalogItem, deleteCatalogItem, toggleCatalogItemActiva } from "./actions";

type Item = { id: number; nombre: string; activa: boolean };
type Catalog = "categorias" | "tipos" | "departamentos";

export function CatalogManager({
  catalog,
  title,
  description,
  items,
}: {
  catalog: Catalog;
  title: string;
  description: string;
  items: Item[];
}) {
  const [nombre, setNombre] = useState("");
  const [pending, startTransition] = useTransition();

  function handleCreate() {
    if (!nombre.trim()) return;
    startTransition(async () => {
      const { error } = await createCatalogItem(catalog, nombre);
      if (error) toast.error(error);
      else {
        toast.success("Añadido");
        setNombre("");
      }
    });
  }

  function handleToggle(item: Item) {
    startTransition(async () => {
      const { error } = await toggleCatalogItemActiva(catalog, item.id, !item.activa);
      if (error) toast.error(error);
    });
  }

  function handleDelete(item: Item) {
    if (!confirm(`¿Borrar "${item.nombre}"? Esta acción no se puede deshacer.`)) return;
    startTransition(async () => {
      const { error } = await deleteCatalogItem(catalog, item.id);
      if (error) toast.error(error);
      else toast.success("Borrado");
    });
  }

  return (
    <div className="rounded-card border border-border p-4">
      <p className="text-[14px] font-semibold text-ink">{title}</p>
      <p className="mt-0.5 text-[12.5px] text-ink-muted">{description}</p>

      <div className="mt-3 space-y-1">
        {items.length === 0 && (
          <p className="py-3 text-center text-[12.5px] text-ink-muted">Todavía no hay ninguno.</p>
        )}
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-btn px-2 py-1.5 hover:bg-surface-hover"
          >
            <button
              type="button"
              disabled={pending}
              onClick={() => handleToggle(item)}
              className={cn(
                "text-[13px]",
                item.activa ? "text-ink" : "text-ink-disabled line-through",
              )}
              title={item.activa ? "Clic para desactivar" : "Clic para activar"}
            >
              {item.nombre}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => handleDelete(item)}
              className="flex h-6 w-6 items-center justify-center rounded-btn text-ink-muted transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
              title="Borrar"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <Input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="Nombre..."
          className="flex-1"
        />
        <Button type="button" variant="secondary" size="sm" disabled={pending || !nombre.trim()} onClick={handleCreate}>
          <Plus size={14} />
          Añadir
        </Button>
      </div>
    </div>
  );
}
