import { Lock } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { formatDateTime } from "@/lib/format";
import { EmptyState } from "@/components/ui/empty-state";
import { MessageCircle } from "lucide-react";

export type ConversationMessage = {
  id: number;
  direccion: "entrante" | "saliente";
  cuerpo_texto: string;
  es_nota_interna: boolean;
  created_at: string;
  autor_nombre: string;
  is_self: boolean;
};

export function Conversation({ messages }: { messages: ConversationMessage[] }) {
  if (messages.length === 0) {
    return (
      <EmptyState
        icon={MessageCircle}
        title="Sin mensajes todavía"
        description="La conversación aparecerá aquí en cuanto llegue el primer correo o respondas."
      />
    );
  }

  return (
    <div className="space-y-5 px-8 py-6">
      {messages.map((message) =>
        message.es_nota_interna ? (
          <div key={message.id} className="rounded-card border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-amber-800">
              <Lock size={12} strokeWidth={2} />
              Nota interna · {message.autor_nombre} · {formatDateTime(message.created_at)}
            </div>
            <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">
              {message.cuerpo_texto}
            </p>
          </div>
        ) : (
          <div key={message.id} className="flex gap-3">
            <Avatar name={message.autor_nombre} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-[13px] font-medium text-ink">
                  {message.is_self ? "Tú" : message.autor_nombre}
                </span>
                <span className="text-[12px] text-ink-muted">
                  {formatDateTime(message.created_at)}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">
                {message.cuerpo_texto}
              </p>
            </div>
          </div>
        ),
      )}
    </div>
  );
}
