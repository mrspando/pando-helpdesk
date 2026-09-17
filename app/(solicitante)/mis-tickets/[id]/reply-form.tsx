"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { replyToOwnTicket } from "../actions";

export function ReplyForm({ ticketId }: { ticketId: number }) {
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!text.trim()) return;
    startTransition(async () => {
      const { error } = await replyToOwnTicket(ticketId, text);
      if (error) {
        toast.error(error);
        return;
      }
      setText("");
      toast.success("Mensaje enviado");
    });
  }

  return (
    <div className="mt-4 rounded-card border border-border bg-surface px-3 py-2.5">
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
        placeholder="Añade más información o responde a IT..."
        className="w-full resize-none bg-transparent text-[13.5px] text-ink placeholder:text-ink-muted focus:outline-none"
      />
      <div className="flex items-center justify-end">
        <Button type="button" variant="primary" size="sm" disabled={pending || !text.trim()} onClick={submit}>
          Enviar
        </Button>
      </div>
    </div>
  );
}
