"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition, useEffect, useRef } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIORIDAD_LABEL, PRIORIDAD_ORDER } from "@/lib/format";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Categoria = { id: number; nombre: string };
type Tipo = { id: number; nombre: string };
type Departamento = { id: number; nombre: string };

function FilterDropdown({
  label,
  activeLabel,
  children,
}: {
  label: string;
  activeLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-btn border border-border bg-surface px-2.5 text-[13px] font-medium transition-colors duration-150 hover:bg-surface-hover",
            activeLabel ? "text-ink" : "text-ink-secondary",
          )}
        >
          {activeLabel ?? label}
          <ChevronDown size={13} className="text-ink-muted" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TicketsToolbar({
  categorias,
  tipos,
  departamentos,
}: {
  categorias: Categoria[];
  tipos: Tipo[];
  departamentos: Departamento[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prioridad = searchParams.get("prioridad");
  const categoriaId = searchParams.get("categoria");
  const tipoId = searchParams.get("tipo");
  const departamentoId = searchParams.get("departamento");

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (q !== (searchParams.get("q") ?? "")) setParam("q", q || null);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const categoriaNombre = categorias.find((c) => String(c.id) === categoriaId)?.nombre;
  const tipoNombre = tipos.find((t) => String(t.id) === tipoId)?.nombre;
  const departamentoNombre = departamentos.find((d) => String(d.id) === departamentoId)?.nombre;

  const activeChips = [
    prioridad && { key: "prioridad", label: `Prioridad: ${PRIORIDAD_LABEL[prioridad as keyof typeof PRIORIDAD_LABEL]}` },
    categoriaNombre && { key: "categoria", label: `Categoría: ${categoriaNombre}` },
    tipoNombre && { key: "tipo", label: `Tipo: ${tipoNombre}` },
    departamentoNombre && { key: "departamento", label: `Departamento: ${departamentoNombre}` },
  ].filter(Boolean) as { key: string; label: string }[];

  return (
    <div className="flex flex-col gap-2 px-8 pb-3">
      <div className="flex items-center gap-2">
        <FilterDropdown label="Prioridad" activeLabel={prioridad ? PRIORIDAD_LABEL[prioridad as keyof typeof PRIORIDAD_LABEL] : undefined}>
          <DropdownMenuItem selected={!prioridad} onSelect={() => setParam("prioridad", null)}>
            Todas
          </DropdownMenuItem>
          {PRIORIDAD_ORDER.map((p) => (
            <DropdownMenuItem key={p} selected={prioridad === p} onSelect={() => setParam("prioridad", p)}>
              {PRIORIDAD_LABEL[p]}
            </DropdownMenuItem>
          ))}
        </FilterDropdown>

        <FilterDropdown label="Categoría" activeLabel={categoriaNombre}>
          <DropdownMenuItem selected={!categoriaId} onSelect={() => setParam("categoria", null)}>
            Todas
          </DropdownMenuItem>
          {categorias.map((c) => (
            <DropdownMenuItem
              key={c.id}
              selected={categoriaId === String(c.id)}
              onSelect={() => setParam("categoria", String(c.id))}
            >
              {c.nombre}
            </DropdownMenuItem>
          ))}
        </FilterDropdown>

        <FilterDropdown label="Tipo" activeLabel={tipoNombre}>
          <DropdownMenuItem selected={!tipoId} onSelect={() => setParam("tipo", null)}>
            Todos
          </DropdownMenuItem>
          {tipos.map((t) => (
            <DropdownMenuItem
              key={t.id}
              selected={tipoId === String(t.id)}
              onSelect={() => setParam("tipo", String(t.id))}
            >
              {t.nombre}
            </DropdownMenuItem>
          ))}
        </FilterDropdown>

        <FilterDropdown label="Departamento" activeLabel={departamentoNombre}>
          <DropdownMenuItem selected={!departamentoId} onSelect={() => setParam("departamento", null)}>
            Todos
          </DropdownMenuItem>
          {departamentos.map((d) => (
            <DropdownMenuItem
              key={d.id}
              selected={departamentoId === String(d.id)}
              onSelect={() => setParam("departamento", String(d.id))}
            >
              {d.nombre}
            </DropdownMenuItem>
          ))}
        </FilterDropdown>

        <div className="relative ml-auto w-56">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar..."
            className="h-8 w-full rounded-input border border-border bg-surface pl-7 pr-2.5 text-[13px] text-ink placeholder:text-ink-muted focus:border-border-strong focus:outline-none"
          />
        </div>
      </div>

      {activeChips.length > 0 && (
        <div className="flex items-center gap-1.5">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              onClick={() => setParam(chip.key, null)}
              className="inline-flex items-center gap-1 rounded-badge bg-surface-2 px-2 py-0.5 text-[12px] text-ink-secondary hover:bg-surface-hover"
            >
              {chip.label}
              <X size={11} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
