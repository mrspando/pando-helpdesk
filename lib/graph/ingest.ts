import { getGraphIngestToken } from "./token";

type GraphMessage = {
  id: string;
  subject: string | null;
  from: { emailAddress: { address: string } } | null;
  conversationId: string | null;
  receivedDateTime: string | null;
  body: { contentType: string; content: string } | null;
  internetMessageHeaders: { name: string; value: string }[] | null;
};

export type IngestedMessage = {
  id: string;
  subject: string;
  from: string | null;
  conversationId: string | null;
  receivedDateTime: string | null;
  bodyHtml: string;
  isAutoReply: boolean;
};

const AUTO_REPLY_HEADERS = ["x-autoreply", "x-autorespond", "x-auto-response-suppress"];

function isAutoReply(headers: { name: string; value: string }[]): boolean {
  const autoSubmitted = headers.find((h) => h.name.toLowerCase() === "auto-submitted");
  if (autoSubmitted && autoSubmitted.value.toLowerCase() !== "no") return true;
  return headers.some((h) => AUTO_REPLY_HEADERS.includes(h.name.toLowerCase()));
}

// Solo no leídos del buzón compartido — la propia bandeja hace de cola: lo
// que no se procese en esta pasada (p. ej. por encima de $top) sigue sin
// leer y se recoge en la siguiente, sin necesidad de paginar.
export async function listUnreadMessages(mailbox: string): Promise<IngestedMessage[]> {
  const token = await getGraphIngestToken();
  const select = "id,subject,from,conversationId,receivedDateTime,body,internetMessageHeaders";
  const url =
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/mailFolders/inbox/messages` +
    `?$filter=isRead eq false&$top=25&$select=${select}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Microsoft Graph rechazó la lectura del buzón (${response.status}): ${detail}`);
  }

  const data = (await response.json()) as { value: GraphMessage[] };

  return data.value.map((m) => ({
    id: m.id,
    subject: m.subject ?? "",
    from: m.from?.emailAddress?.address ?? null,
    conversationId: m.conversationId ?? null,
    receivedDateTime: m.receivedDateTime ?? null,
    bodyHtml: m.body?.content ?? "",
    isAutoReply: isAutoReply(m.internetMessageHeaders ?? []),
  }));
}

// Marca el correo como procesado para que el cron no lo vuelva a recoger —
// requiere Mail.ReadWrite (no solo Mail.Read) en el registro de app, ver
// CONTEXT.md → "Flujo de correo".
export async function markMessageRead(mailbox: string, messageId: string): Promise<void> {
  const token = await getGraphIngestToken();
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/messages/${encodeURIComponent(messageId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ isRead: true }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`No se pudo marcar el correo como leído (${response.status}): ${detail}`);
  }
}
