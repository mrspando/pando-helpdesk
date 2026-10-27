// Outlook (web y escritorio) antepone el mensaje nuevo y marca el inicio de
// la cita del hilo anterior con uno de estos contenedores, precedido de un
// <hr>. Cortamos ahí para no guardar en el ticket el hilo completo cada vez
// que alguien responde — ver CONTEXT.md → "Flujo de correo".
const QUOTE_MARKERS = [/id=["']divRplyFwdMsg["']/i, /id=["']appendonsend["']/i];

export function stripQuotedReply(html: string): string {
  let cutIndex = html.length;
  for (const marker of QUOTE_MARKERS) {
    const match = marker.exec(html);
    if (match && match.index < cutIndex) cutIndex = match.index;
  }

  if (cutIndex === html.length) return html.trim();

  return html
    .slice(0, cutIndex)
    .replace(/<hr[^>]*>\s*$/i, "")
    .trim();
}

const BLOCK_BREAKS = /<\/(p|div|tr|li|h[1-6])>|<br\s*\/?>/gi;
const HTML_ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

// Extracción de texto deliberadamente simple (sin librería nueva): basta
// para mostrar el cuerpo del correo en la conversación del ticket, que solo
// renderiza `cuerpo_texto` (ver conversation.tsx).
export function htmlToPlainText(html: string): string {
  const withBreaks = html.replace(BLOCK_BREAKS, "\n");
  const withoutTags = withBreaks.replace(/<[^>]+>/g, "");
  const decoded = withoutTags.replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;/g, (m) => HTML_ENTITIES[m]);

  return decoded
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
