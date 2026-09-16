"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Persona = { id: string; nombre: string | null; email: string };

export function SolicitanteCombobox({
  personas,
  value,
  onChange,
}: {
  personas: Persona[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = personas.find((p) => p.id === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return personas;
    return personas.filter(
      (p) => (p.nombre ?? "").toLowerCase().includes(q) || p.email.toLowerCase().includes(q),
    );
  }, [personas, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-8 w-full items-center justify-between rounded-input border border-border bg-surface px-2.5 text-[13px]",
            selected ? "text-ink" : "text-ink-muted",
          )}
        >
          {selected ? selected.nombre ?? selected.email : "Selecciona solicitante..."}
          <ChevronDown size={13} className="text-ink-muted" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="relative border-b border-border p-1.5">
          <Search size={13} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar empleado..."
            className="h-7 w-full rounded-[6px] bg-transparent pl-6 pr-2 text-[13px] text-ink placeholder:text-ink-muted focus:outline-none"
          />
        </div>
        <div className="max-h-56 overflow-y-auto p-1">
          {filtered.length === 0 && (
            <p className="px-2 py-3 text-center text-[12.5px] text-ink-muted">Sin resultados</p>
          )}
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onChange(p.id);
                setOpen(false);
                setQuery("");
              }}
              className={cn(
                "flex w-full flex-col items-start rounded-[6px] px-2 py-1.5 text-left transition-colors duration-150 hover:bg-surface-hover",
                p.id === value && "bg-surface-2",
              )}
            >
              <span className="text-[13px] text-ink">{p.nombre ?? p.email}</span>
              {p.nombre && <span className="text-[11.5px] text-ink-muted">{p.email}</span>}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
