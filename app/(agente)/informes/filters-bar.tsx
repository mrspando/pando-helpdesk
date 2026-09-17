"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIORIDAD_LABEL, PRIORIDAD_ORDER } from "@/lib/format";
import { PERIODO_LABEL, PERIODO_ORDER, type PeriodoKey } from "@/lib/informes/periodo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Catalogo = { id: number; nombre: string };

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

export function FiltersBar({
  categorias,
  tipos,
  departamentos,
  mostrarDepartamento,
}: {
  categorias: Catalogo[];
  tipos: Catalogo[];
  departamentos: Catalogo[];
  mostrarDepartamento: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const periodo = (searchParams.get("periodo") as PeriodoKey) || "30d";
  const departamentoId = searchParams.get("departamento");
  const categoriaId = searchParams.get("categoria");
  const tipoId = searchParams.get("tipo");
  const prioridad = searchParams.get("prioridad");

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  const categoriaNombre = categorias.find((c) => String(c.id) === categoriaId)?.nombre;
  const tipoNombre = tipos.find((t) => String(t.id) === tipoId)?.nombre;
  const departamentoNombre = departamentos.find((d) => String(d.id) === departamentoId)?.nombre;

  return (
    <div className="flex flex-wrap items-center gap-2 px-8 pb-4">
      <FilterDropdown label={PERIODO_LABEL["30d"]} activeLabel={PERIODO_LABEL[periodo]}>
        {PERIODO_ORDER.map((p) => (
          <DropdownMenuItem key={p} selected={periodo === p} onSelect={() => setParam("periodo", p)}>
            {PERIODO_LABEL[p]}
          </DropdownMenuItem>
        ))}
      </FilterDropdown>

      {mostrarDepartamento && (
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
      )}

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
          <DropdownMenuItem key={t.id} selected={tipoId === String(t.id)} onSelect={() => setParam("tipo", String(t.id))}>
            {t.nombre}
          </DropdownMenuItem>
        ))}
      </FilterDropdown>

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
    </div>
  );
}
