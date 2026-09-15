# Pando Helpdesk — Contexto del proyecto

Aplicación interna de gestión de tickets/incidencias IT para INOXPAN, S.L.
(Pando). Desarrollada a medida por Manu, IT Manager y único agente del
sistema. ~73 empleados como solicitantes.

## Por qué existe

Manu es el único recurso IT interno. Las peticiones llegan hoy de forma
dispersa (pasillo, llamadas, Teams, email) sin cola priorizable ni
evidencia de carga de trabajo para dirección. El objetivo de la
aplicación no es solo gestionar tickets: es generar datos duros
(volumen por categoría, tiempos, incidencias recurrentes de BC14) que
respalden decisiones como la migración de Business Central.

## Decisión de build vs. buy

Se evaluaron Freshservice ($19/agente/mes anual) y Jira Service
Management (gratis hasta 3 agentes) — ambos viables y baratos porque
cobran por agente, no por usuario, y Manu es el único agente. Se
descartaron a favor de desarrollo propio por decisión explícita del
usuario. Contrapartida asumida: más tiempo de desarrollo y
mantenimiento propio a cambio de control total.

## Stack

- **Frontend + backend:** Next.js (App Router, TypeScript, Tailwind),
  desplegado en Vercel.
- **Base de datos / Auth / Storage:** Supabase (Postgres + Auth + Storage),
  región EU (por RGPD — datos de empleados no salen de la UE).
- **Sin servidor físico propio:** se descartó explícitamente para evitar
  la carga de mantenimiento (certificados, backups, parcheo) que no
  aporta ventaja aquí.
- **Autenticación:** SSO con Microsoft Entra ID vía Supabase Auth
  (provider Azure). Nadie en Pando crea contraseña nueva.
- **Ingesta/salida de correo:** Microsoft Graph API sobre un buzón
  compartido (`soporte@pando.es` o similar, pendiente de definir),
  no IMAP ni proveedores externos tipo SendGrid — el correo debe salir
  del dominio propio para no caer en spam.

## Nombres

- Proyecto Supabase: `pando-helpdesk`
- Repositorio GitHub: `pando-helpdesk` (privado)

## Modelo de acceso: agentes vs. solicitantes

No hay roles de Supabase ni de Entra ID implicados. Todo se resuelve
con la columna `es_agente` (boolean) en la tabla `personas`:

- Al hacer login por primera vez vía SSO, se crea automáticamente una
  fila en `personas` con `es_agente = false` (trigger sobre
  `auth.users`).
- Manu es el único con `es_agente = true`, fijado a mano.
- Row Level Security en Postgres impone el límite a nivel de base de
  datos, no de interfaz: un agente ve y edita todos los tickets; un
  solicitante solo ve (lectura) los suyos propios, y nunca las notas
  internas.

## Esquema de datos (resumen — ver `supabase/schema.sql` para el SQL completo)

- **`categorias`** — catálogo simple, máx. 6-8 activas (ERP/BC,
  Hardware, Accesos, Software, Red, Informes, Otro).
- **`personas`** — solicitantes y agentes, enlazados a `auth.users`
  vía `auth_user_id`.
- **`tickets`** — título (= asunto del correo, editable en triaje) y
  descripción (= cuerpo del correo) son campos separados. Incluye
  categoría, prioridad (la fija el agente, nunca el usuario), estado,
  origen, `conversation_id` de Graph para threading, y fechas completas
  de ciclo de vida (creación, triaje, primera respuesta, resuelto,
  cerrado, reapertura) más un "reloj neto" (`espera_segundos`) que
  excluye el tiempo en estados de espera ajena (usuario/proveedor) del
  tiempo de resolución atribuible al agente.
- **`messages`** — hilo de conversación de cada ticket; distingue
  mensajes entrantes/salientes y notas internas (nunca visibles para
  el solicitante); `graph_message_id` único para idempotencia.
- **`attachments`** — ficheros colgados de cada mensaje.
- **`events`** — auditoría automática (vía triggers) de cada cambio de
  estado/prioridad/categoría/asignación. Es la fuente de verdad
  temporal; solo escriben en ella los triggers, nunca la aplicación
  directamente.
- **`email_ingesta`** — traza de cada correo procesado (creado,
  adjuntado, descartado, cuarentena, error) — la "caja negra" para
  depurar quejas de "escribí y no pasó nada".

Estados de ticket: `nuevo → triaje → en_curso → esperando_usuario /
esperando_proveedor → resuelto → cerrado` (o `cancelado`). Reapertura
posible tras cierre, cuenta en `reopen_count`.

## Flujo de correo (diseño, aún no implementado)

- **Entrada:** cron cada ~2 min leyendo mensajes no leídos del buzón
  compartido vía Graph. Se descartan webhooks de Graph para v1 (caducan
  cada ~3 días, complejidad innecesaria a este volumen).
- **Salida:** `sendMail` desde el mismo buzón, respondiendo sobre el
  `conversationId` original. Asunto lleva además `[PANDO-123]` como
  red de seguridad para el threading.
- **Riesgos a mitigar explícitamente:**
  - Idempotencia por `graph_message_id` único (evita duplicados si el
    cron se solapa).
  - Filtrar autorespuestas (`Auto-Submitted`, `X-Autoreply`) para no
    generar bucles de correo.
  - Solo crear ticket automático desde remitentes `@pando.es`; el resto
    a cuarentena.
  - Recortar la cita del hilo anterior en el HTML de Outlook antes de
    guardar el cuerpo.
- El título del ticket nace del asunto del correo; si viene vacío, cae
  a un fallback tipo "Sin asunto — categoría por defecto".

## Auth con Entra ID — estado

Registro de app en Azure Portal: **`pando-helpdesk-auth`**
(tenant único, solo cuentas `@pando.es`; plataforma Web; permisos
Graph delegados, solo `User.Read` — sin permisos de correo en este
registro).

- Client ID, Tenant ID y Client Secret ya configurados en Supabase
  (Authentication → Sign In / Providers → Azure).
- Azure Tenant URL usado: `https://login.microsoftonline.com/<tenant-id>`
  (verificado contra "Puntos de conexión" en Azure).
- **Pendiente:** probar el login real desde la app Next.js (no es
  posible probarlo pegando la URL de `/authorize` directamente en el
  navegador — el flujo PKCE de Supabase necesita que el cliente
  `supabase-js` gestione el `state`, así que la prueba real solo
  funciona desde código).

Cuando se monte la ingesta de correo, hará falta un **segundo**
registro de app en Entra ID, con permisos de **aplicación** (no
delegados) sobre `Mail.Read` / `Mail.Send`, restringido por política de
acceso de aplicación al buzón compartido concreto — para que esa app
no pueda leer correo de nadie más en el tenant. Buzón aún por decidir.

## Alcance de la v1 (deliberadamente acotado)

**Incluye:** ingesta de correo → ticket automático, cola de tickets,
triaje (categoría + prioridad + título), respuesta (sale como email),
cambio de estado, cierre, informe básico a dirección basado en
`events`.

**Fuera de v1, a propósito:**
- Portal de autoservicio para que el usuario abra tickets directamente
  (fase 2 — para formularios estructurados como altas/bajas de
  usuario, donde el email no basta).
- Base de conocimiento.
- SLA de tiempo de resolución (solo se compromete tiempo de primera
  respuesta).
- Inventario/CMDB de equipos.
- Soporte multi-agente.

Principio guía: construir primero como herramienta de uso personal de
Manu durante varias semanas antes de abrirla a los 73 solicitantes. Si
para entonces el motor de correo funciona sin intervención manual, el
resto es más fácil.

## Estado actual (última actualización de este documento)

- [x] Esquema SQL completo ejecutado en Supabase (`supabase/schema.sql`)
- [x] Registro de app en Entra ID para login (`pando-helpdesk-auth`)
- [x] Provider Azure configurado en Supabase Auth
- [ ] Login probado end-to-end desde una app real
- [ ] Repositorio GitHub creado
- [ ] Proyecto Next.js inicializado
- [ ] Buzón de correo compartido decidido y creado
- [ ] Segundo registro de app en Entra ID (permisos de aplicación sobre
      el buzón) para la ingesta de Graph
- [ ] Lógica de ingesta de correo (Graph)
- [ ] UI de cola, triaje y ficha de ticket