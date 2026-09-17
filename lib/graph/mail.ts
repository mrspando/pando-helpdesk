import { getGraphToken } from "./token";

export type OutgoingMail = {
  to: string[];
  cc?: string[];
  subject: string;
  bodyHtml: string;
};

function toRecipients(addresses: string[]) {
  return addresses.map((address) => ({ emailAddress: { address } }));
}

// Envía "como" el buzón que se le pase (el email del agente que
// responde), nunca uno fijo: it@pando.es es solo de recepción. El
// permiso de aplicación Mail.Send + la Application Access Policy que
// configure el admin de Exchange son los que deciden qué buzones puede
// suplantar esta app — normalmente un grupo de seguridad con los
// buzones de los agentes, ampliable según se sumen compañeros.
//
// sendMail (no crear-borrador-y-enviar) a propósito: solo necesita
// Mail.Send, no Mail.ReadWrite. No devuelve un id de mensaje de Graph
// ni hilo real de conversación — el `[REF]` en el asunto es la red de
// seguridad de threading que ya preveía CONTEXT.md, no `conversationId`.
export async function sendMailAsUser(mailbox: string, mail: OutgoingMail): Promise<void> {
  const token = await getGraphToken();

  const response = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/sendMail`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        subject: mail.subject,
        body: { contentType: "HTML", content: mail.bodyHtml },
        toRecipients: toRecipients(mail.to),
        ...(mail.cc && mail.cc.length > 0 ? { ccRecipients: toRecipients(mail.cc) } : {}),
      },
      saveToSentItems: true,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Microsoft Graph rechazó el envío (${response.status}): ${detail}`);
  }
}
