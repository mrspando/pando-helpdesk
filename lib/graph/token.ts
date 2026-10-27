type CachedToken = { value: string; expiresAt: number };

// Flujo client credentials (app-only) común a los dos registros de app de
// Entra que usa el proyecto (envío sobre buzones de agentes, ingesta sobre
// it@pando.es) — ver getGraphToken()/getGraphIngestToken() más abajo.
async function fetchGraphToken(
  tenantId: string,
  clientId: string,
  clientSecret: string,
): Promise<CachedToken> {
  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`No se pudo obtener token de Microsoft Graph (${response.status}): ${detail}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  return { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
}

let sendTokenCache: CachedToken | null = null;

// Registro de app de Entra dedicado a envío de correo (permiso Mail.Send,
// restringido por política de acceso de aplicación al grupo de buzones de
// agentes). No confundir con `pando-helpdesk-auth`, el registro usado para
// el login SSO, ni con el de ingesta de abajo (mismo tenant, apps distintas).
export async function getGraphToken(): Promise<string> {
  if (sendTokenCache && sendTokenCache.expiresAt > Date.now()) {
    return sendTokenCache.value;
  }

  const tenantId = process.env.GRAPH_TENANT_ID;
  const clientId = process.env.GRAPH_CLIENT_ID;
  const clientSecret = process.env.GRAPH_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      "Envío de correo no configurado: faltan GRAPH_TENANT_ID, GRAPH_CLIENT_ID o GRAPH_CLIENT_SECRET.",
    );
  }

  sendTokenCache = await fetchGraphToken(tenantId, clientId, clientSecret);
  return sendTokenCache.value;
}

let ingestTokenCache: CachedToken | null = null;

// Registro de app de Entra dedicado a ingesta de correo (permiso
// Mail.ReadWrite, restringido por política de acceso de aplicación
// únicamente al buzón it@pando.es). Mismo tenant que el de envío, app y
// secreto distintos a propósito (menor radio de exposición, ver CONTEXT.md).
export async function getGraphIngestToken(): Promise<string> {
  if (ingestTokenCache && ingestTokenCache.expiresAt > Date.now()) {
    return ingestTokenCache.value;
  }

  const tenantId = process.env.GRAPH_TENANT_ID;
  const clientId = process.env.GRAPH_INGEST_CLIENT_ID;
  const clientSecret = process.env.GRAPH_INGEST_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      "Ingesta de correo no configurada: faltan GRAPH_TENANT_ID, GRAPH_INGEST_CLIENT_ID o GRAPH_INGEST_CLIENT_SECRET.",
    );
  }

  ingestTokenCache = await fetchGraphToken(tenantId, clientId, clientSecret);
  return ingestTokenCache.value;
}
