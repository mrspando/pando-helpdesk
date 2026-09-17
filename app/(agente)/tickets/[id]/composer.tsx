"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { sendMessage, type MessageMode } from "./actions";

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

const MODE_STYLES: Record<MessageMode, string> = {
  reply: "border-border bg-surface",
  chat: "border-blue-200 bg-blue-50",
  nota: "border-amber-200 bg-amber-50",
};

const MODE_TAB_STYLES: Record<MessageMode, string> = {
  reply: "text-ink",
  chat: "text-blue-800",
  nota: "text-amber-800",
};

const MODE_PLACEHOLDER: Record<MessageMode, string> = {
  reply: "Escribe una respuesta...",
  chat: "Escribe un mensaje visible para quien abrió el ticket, sin enviar un correo...",
  nota: "Escribe una nota solo visible para agentes...",
};

const MODE_SUBMIT_LABEL: Record<MessageMode, string> = {
  reply: "Enviar respuesta",
  chat: "Enviar mensaje",
  nota: "Guardar nota",
};

const MODE_SUCCESS_MESSAGE: Record<MessageMode, string> = {
  reply: "Respuesta enviada",
  chat: "Mensaje enviado",
  nota: "Nota interna guardada",
};

export function Composer({ ticketId, defaultTo }: { ticketId: number; defaultTo: string }) {
  const [mode, setMode] = useState<MessageMode>("reply");
  const [text, setText] = useState("");
  const [to, setTo] = useState<string[]>(defaultTo ? [defaultTo] : []);
  const [cc, setCc] = useState<string[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [pending, startTransition] = useTransition();
  const isReply = mode === "reply";

  function submit() {
    if (!text.trim()) return;
    if (isReply && to.length === 0) {
      toast.error("Añade al menos un destinatario");
      return;
    }
    startTransition(async () => {
      const { error } = await sendMessage(ticketId, text, mode, { to, cc });
      if (error) {
        toast.error(error);
        return;
      }
      setText("");
      toast.success(MODE_SUCCESS_MESSAGE[mode]);
    });
  }

  return (
    <div className="border-t border-border px-8 py-4">
      <div className={cn("rounded-card border px-3 py-2.5 transition-colors duration-150", MODE_STYLES[mode])}>
        <div className="mb-2 flex items-center gap-3 text-[13px] font-medium">
          <button
            type="button"
            onClick={() => setMode("reply")}
            className={cn(mode === "reply" ? MODE_TAB_STYLES.reply : "text-ink-muted hover:text-ink-secondary")}
          >
            Responder
          </button>
          <button
            type="button"
            onClick={() => setMode("chat")}
            className={cn(mode === "chat" ? MODE_TAB_STYLES.chat : "text-ink-muted hover:text-ink-secondary")}
          >
            Chat
          </button>
          <button
            type="button"
            onClick={() => setMode("nota")}
            className={cn(mode === "nota" ? MODE_TAB_STYLES.nota : "text-ink-muted hover:text-ink-secondary")}
          >
            Nota interna
          </button>
        </div>

        {isReply && (
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
          placeholder={MODE_PLACEHOLDER[mode]}
          className="w-full resize-none bg-transparent text-[13.5px] text-ink placeholder:text-ink-muted focus:outline-none"
        />

        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant={isReply ? "primary" : "secondary"}
            size="sm"
            disabled={pending || !text.trim() || (isReply && to.length === 0)}
            onClick={submit}
          >
            {MODE_SUBMIT_LABEL[mode]}
          </Button>
        </div>
      </div>
    </div>
  );
}
