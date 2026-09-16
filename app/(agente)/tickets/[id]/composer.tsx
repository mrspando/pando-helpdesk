"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { sendMessage } from "./actions";

export function Composer({ ticketId }: { ticketId: number }) {
  const [mode, setMode] = useState<"reply" | "nota">("reply");
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const isNota = mode === "nota";

  function submit() {
    if (!text.trim()) return;
    startTransition(async () => {
      const { error } = await sendMessage(ticketId, text, isNota);
      if (error) {
        toast.error(error);
        return;
      }
      setText("");
      toast.success(isNota ? "Nota interna guardada" : "Respuesta enviada");
    });
  }

  return (
    <div className="border-t border-border px-8 py-4">
      <div
        className={cn(
          "rounded-card border px-3 py-2.5 transition-colors duration-150",
          isNota ? "border-amber-200 bg-amber-50" : "border-border bg-surface",
        )}
      >
        <div className="mb-2 flex items-center gap-3 text-[13px] font-medium">
          <button
            type="button"
            onClick={() => setMode("reply")}
            className={cn(!isNota ? "text-ink" : "text-ink-muted hover:text-ink-secondary")}
          >
            Responder
          </button>
          <button
            type="button"
            onClick={() => setMode("nota")}
            className={cn(isNota ? "text-amber-800" : "text-ink-muted hover:text-ink-secondary")}
          >
            Nota interna
          </button>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          rows={3}
          placeholder={isNota ? "Escribe una nota solo visible para agentes..." : "Escribe una respuesta..."}
          className="w-full resize-none bg-transparent text-[13.5px] text-ink placeholder:text-ink-muted focus:outline-none"
        />

        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant={isNota ? "secondary" : "primary"}
            size="sm"
            disabled={pending || !text.trim()}
            onClick={submit}
          >
            {isNota ? "Guardar nota" : "Enviar respuesta"}
          </Button>
        </div>
      </div>
    </div>
  );
}
