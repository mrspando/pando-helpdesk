"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { sendMessage } from "./actions";

function EmailChipsInput({
  label,
  emails,
  onChange,
  placeholder,
}: {
  label: string;
  emails: string[];
  onChange: (emails: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  function commitDraft() {
    const value = draft.trim().replace(/,$/, "");
    if (value && !emails.includes(value)) onChange([...emails, value]);
    setDraft("");
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-1">
      <span className="text-[12px] font-medium text-ink-muted">{label}</span>
      {emails.map((email) => (
        <span
          key={email}
          className="inline-flex items-center gap-1 rounded-badge bg-surface-2 px-2 py-0.5 text-[12px] text-ink-secondary"
        >
          {email}
          <button
            type="button"
            onClick={() => onChange(emails.filter((e) => e !== email))}
            className="text-ink-muted hover:text-ink"
          >
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commitDraft();
          }
        }}
        onBlur={commitDraft}
        placeholder={placeholder}
        className="min-w-[140px] flex-1 bg-transparent text-[12.5px] text-ink placeholder:text-ink-muted focus:outline-none"
      />
    </div>
  );
}

export function Composer({ ticketId, defaultTo }: { ticketId: number; defaultTo: string }) {
  const [mode, setMode] = useState<"reply" | "nota">("reply");
  const [text, setText] = useState("");
  const [to, setTo] = useState<string[]>(defaultTo ? [defaultTo] : []);
  const [cc, setCc] = useState<string[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [pending, startTransition] = useTransition();
  const isNota = mode === "nota";

  function submit() {
    if (!text.trim()) return;
    if (!isNota && to.length === 0) {
      toast.error("Añade al menos un destinatario");
      return;
    }
    startTransition(async () => {
      const { error } = await sendMessage(ticketId, text, isNota, { to, cc });
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

        {!isNota && (
          <div className="mb-2 border-b border-border pb-1.5">
            <EmailChipsInput label="Para" emails={to} onChange={setTo} placeholder="añadir destinatario..." />
            {showCc ? (
              <EmailChipsInput label="CC" emails={cc} onChange={setCc} placeholder="añadir en copia..." />
            ) : (
              <button
                type="button"
                onClick={() => setShowCc(true)}
                className="text-[12px] text-ink-muted hover:text-ink"
              >
                + Añadir CC
              </button>
            )}
          </div>
        )}

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
            disabled={pending || !text.trim() || (!isNota && to.length === 0)}
            onClick={submit}
          >
            {isNota ? "Guardar nota" : "Enviar respuesta"}
          </Button>
        </div>
      </div>
    </div>
  );
}
