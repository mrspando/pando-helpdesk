"use client";

import { useActionState, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { completeOnboarding } from "./actions";

type Departamento = { id: number; nombre: string };

const initialState: { error: string | null } = { error: null };

export function OnboardingForm({ departamentos }: { departamentos: Departamento[] }) {
  const [state, formAction, pending] = useActionState(completeOnboarding, initialState);
  const [departamentoId, setDepartamentoId] = useState<number | null>(null);

  if (departamentos.length === 0) {
    return (
      <p className="mt-4 text-[13px] text-ink-muted">
        Todavía no hay departamentos configurados. Pide a IT que añada al menos uno en
        Ajustes → Catálogos.
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-4 space-y-3">
      <input type="hidden" name="departamento_id" value={departamentoId ?? ""} />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-9 w-full items-center justify-between rounded-input border border-border bg-surface px-3 text-[13px] text-ink"
          >
            {departamentos.find((d) => d.id === departamentoId)?.nombre ?? "Selecciona un departamento"}
            <ChevronDown size={14} className="text-ink-muted" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
          {departamentos.map((d) => (
            <DropdownMenuItem
              key={d.id}
              selected={departamentoId === d.id}
              onSelect={() => setDepartamentoId(d.id)}
            >
              {d.nombre}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {state?.error && <p className="text-[12.5px] text-red-600">{state.error}</p>}

      <Button
        type="submit"
        variant="primary"
        size="sm"
        disabled={pending || !departamentoId}
        className="w-full justify-center"
      >
        Continuar
      </Button>
    </form>
  );
}
