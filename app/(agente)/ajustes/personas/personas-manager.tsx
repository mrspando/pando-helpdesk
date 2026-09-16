"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronDown, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { updatePersonaNombre, updatePersonaDepartamento, togglePersonaFlag } from "./actions";

type Departamento = { id: number; nombre: string };

type Persona = {
  id: string;
  nombre: string | null;
  email: string;
  departamento_id: number | null;
  es_agente: boolean;
  activo: boolean;
};

function FlagPill({
  active,
  activeLabel,
  inactiveLabel,
  disabled,
  onClick,
}: {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-badge px-2 py-0.5 text-[12px] font-medium transition-colors duration-150",
        active ? "bg-green-50 text-green-700 hover:bg-green-100" : "bg-surface-2 text-ink-muted hover:bg-surface-hover",
      )}
    >
      {active ? activeLabel : inactiveLabel}
    </button>
  );
}

function NombreField({
  personaId,
  value,
  disabled,
}: {
  personaId: string;
  value: string;
  disabled: boolean;
}) {
  const [local, setLocal] = useState(value);
  const [, startTransition] = useTransition();

  function commit() {
    if (local === value) return;
    startTransition(async () => {
      const { error } = await updatePersonaNombre(personaId, local);
      if (error) {
        toast.error(error);
        setLocal(value);
      }
    });
  }

  return (
    <input
      value={local}
      disabled={disabled}
      placeholder="Sin nombre"
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
      className="w-full rounded-[6px] border border-transparent bg-transparent px-1.5 py-1 text-[13px] text-ink placeholder:text-ink-muted hover:border-border focus:border-border-strong focus:bg-surface focus:outline-none"
    />
  );
}

function DepartamentoField({
  personaId,
  departamentoId,
  departamentos,
  disabled,
}: {
  personaId: string;
  departamentoId: number | null;
  departamentos: Departamento[];
  disabled: boolean;
}) {
  const [, startTransition] = useTransition();
  const nombre = departamentos.find((d) => d.id === departamentoId)?.nombre ?? "Sin departamento";

  function select(id: number | null) {
    startTransition(async () => {
      const { error } = await updatePersonaDepartamento(personaId, id);
      if (error) toast.error(error);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex items-center gap-1 rounded-[6px] px-1.5 py-1 text-[13px] hover:bg-surface-hover",
            departamentoId ? "text-ink" : "text-ink-muted",
          )}
        >
          {nombre}
          <ChevronDown size={12} className="text-ink-muted" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem selected={departamentoId === null} onSelect={() => select(null)}>
          Sin departamento
        </DropdownMenuItem>
        {departamentos.map((d) => (
          <DropdownMenuItem key={d.id} selected={departamentoId === d.id} onSelect={() => select(d.id)}>
            {d.nombre}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PersonasManager({
  personas,
  departamentos,
}: {
  personas: Persona[];
  departamentos: Departamento[];
}) {
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return personas;
    return personas.filter(
      (p) => (p.nombre ?? "").toLowerCase().includes(q) || p.email.toLowerCase().includes(q),
    );
  }, [personas, query]);

  function handleToggle(personaId: string, field: "es_agente" | "activo", value: boolean) {
    startTransition(async () => {
      const { error } = await togglePersonaFlag(personaId, field, value);
      if (error) toast.error(error);
    });
  }

  return (
    <div>
      <div className="relative mb-3 w-64">
        <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre o email..."
          className="h-8 w-full rounded-input border border-border bg-surface pl-7 pr-2.5 text-[13px] text-ink placeholder:text-ink-muted focus:border-border-strong focus:outline-none"
        />
      </div>

      <div className="rounded-card border border-border">
        <div className="grid grid-cols-[1.2fr_1.4fr_1fr_auto_auto] gap-3 border-b border-border bg-surface-2 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
          <span>Nombre</span>
          <span>Email</span>
          <span>Departamento</span>
          <span>Agente</span>
          <span>Activo</span>
        </div>

        {filtered.length === 0 && (
          <p className="px-3 py-6 text-center text-[12.5px] text-ink-muted">Sin resultados.</p>
        )}

        <div className="divide-y divide-border">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="grid grid-cols-[1.2fr_1.4fr_1fr_auto_auto] items-center gap-3 px-3 py-1.5"
            >
              <NombreField personaId={p.id} value={p.nombre ?? ""} disabled={pending} />
              <span className="truncate text-[12.5px] text-ink-muted">{p.email}</span>
              <DepartamentoField
                personaId={p.id}
                departamentoId={p.departamento_id}
                departamentos={departamentos}
                disabled={pending}
              />
              <FlagPill
                active={p.es_agente}
                activeLabel="Agente"
                inactiveLabel="Solicitante"
                disabled={pending}
                onClick={() => handleToggle(p.id, "es_agente", !p.es_agente)}
              />
              <FlagPill
                active={p.activo}
                activeLabel="Activo"
                inactiveLabel="Inactivo"
                disabled={pending}
                onClick={() => handleToggle(p.id, "activo", !p.activo)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
