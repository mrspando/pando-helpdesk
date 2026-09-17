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
- **Ingesta/salida de correo:** Microsoft Graph API sobre el buzón
  compartido `it@pando.es`, no IMAP ni proveedores externos tipo
  SendGrid — el correo debe salir del dominio propio para no caer en
  spam. Buzón creado por el administrador de Exchange de Pando (Manu
  no tiene ese rol).

## Nombres

- Proyecto Supabase: `pando-helpdesk`
- Repositorio GitHub: `pando-helpdesk` (privado)

## Modelo de acceso: cuatro roles (ver `PERMISOS.md` para el detalle completo)

No hay roles de Supabase ni de Entra ID implicados. Todo se resuelve
con la columna `personas.rol` (enum `rol_persona`), que sustituyó al
booleano original `es_agente` (`true → admin`, `false → empleado`
en la migración de conversión; la columna `es_agente` sigue existiendo
en la base de datos pero ya no la usa ningún código ni política —
pendiente de una limpieza futura).

- **`admin`** — control total (Manu). Único rol que puede escribir:
  crear/editar tickets, responder, notas internas, gestionar catálogos
  y personas, entrar en `/ajustes`.
- **`gerencia`** (mostrado en la interfaz como **"Dirección General"**)
  — lectura de todos los tickets/informes de todos los departamentos.
  Solo lectura.
- **`direccion`** (mostrado como **"Responsable de departamento"**) —
  lectura limitada a `tickets.departamento_id = personas.departamento_id`,
  igualdad estricta (los tickets aún sin departamento asignado no son
  visibles para este rol — corregido el 2026-09-17, ver
  `PERMISOS.md`/`supabase/README.md`: la excepción original dejaba ver
  tickets sin triar de cualquier departamento). Solo lectura.
- **`empleado`** — ve únicamente sus propios tickets. Cualquier rol,
  incluido empleado, puede **crear** un ticket a su propio nombre (la
  política `tickets_propios_insert` nunca se restringió a admin); solo
  `admin` puede crear un ticket en nombre de otra persona.

Al hacer login por primera vez vía SSO se crea automáticamente una fila
en `personas` con `rol = 'empleado'` (trigger sobre `auth.users`, valor
por defecto de la columna).

Row Level Security en Postgres impone el límite a nivel de base de
datos, no de interfaz — funciones reutilizables en `public`:
`is_admin()`, `current_rol()`, `current_departamento_id()`,
`can_view_ticket(ticket_id)`. `is_agente()` se mantiene como alias de
compatibilidad de `is_admin()` (la usan las políticas de catálogos y
personas que aún no se migraron a llamarla directamente).

Notas internas de `messages`: solo `admin` las ve; `gerencia`,
`direccion` y `empleado` nunca, ya filtrado por RLS antes de llegar a
la aplicación.

`/ajustes` (y sus subrutas) están protegidas también a nivel de
servidor (no solo ocultas en la sidebar): cualquier rol que no sea
`admin` es redirigido a `/tickets` si intenta entrar por URL.

**Onboarding obligatorio de departamento.** Cualquier persona (menos
`admin`, exento a propósito para no bloquearse a sí mismo si aún no
hay ningún departamento creado) sin `departamento_id` es redirigida a
`/onboarding` desde ambos layouts (`(agente)` y `(solicitante)`) hasta
que elige uno. Solo puede fijarlo una vez por sí misma: la función
`set_own_departamento()` (`SECURITY DEFINER`) solo actúa mientras el
campo sigue a `NULL` — a partir de ahí, cambiarlo es cosa de `admin`
desde `Ajustes → Personas`. Deliberadamente no es una política RLS de
`UPDATE` genérica sobre `personas` (esa permitiría colar un cambio de
`rol` en la misma petición).

## Esquema de datos (resumen — ver `supabase/migrations/` para el SQL completo)

- **`categorias`**, **`tipos`**, **`departamentos`** — tres catálogos
  hermanos, misma estructura (`nombre`, `activa`, `orden`), cada uno un
  eje de clasificación independiente del ticket: Categoría (ERP/BC,
  Hardware, Accesos...), Tipo (Incidencia, Solicitud, Proyecto...) y
  Departamento al que afecta. Los tres se gestionan (alta/baja/borrado)
  desde `Ajustes → Catálogos`, solo por `admin`.
- **`personas`** — solicitantes y agentes, enlazados a `auth.users`
  vía `auth_user_id`. `departamento_id` es una relación al catálogo
  `departamentos` (antes era texto libre; se migró para no tener cada
  quien escribiendo el departamento distinto). `rol` (enum
  `rol_persona`: admin/gerencia/direccion/empleado) sustituye al
  antiguo booleano `es_agente` como modelo de acceso — ver sección
  "Modelo de acceso" más arriba. Editable por completo (nombre,
  departamento, rol, activo) desde `Ajustes → Personas`, con la regla
  de que no se puede quitar el rol `admin` (ni desactivar) a la última
  persona que lo tiene.
- **`tickets`** — título (= asunto del correo, editable en triaje) y
  descripción (= cuerpo del correo) son campos separados. Incluye
  categoría, tipo y departamento (los tres opcionales, vía los
  catálogos de arriba), prioridad (la fija el agente, nunca el
  usuario), estado, origen (`email` o `manual`, este último para
  tickets creados a mano desde el botón "+ Nuevo"), `conversation_id`
  de Graph para threading, y fechas completas de ciclo de vida
  (creación, triaje, primera respuesta, resuelto, cerrado, reapertura)
  más un "reloj neto" (`espera_segundos`) que excluye el tiempo en
  estados de espera ajena (usuario/proveedor) del tiempo de resolución
  atribuible al agente.
- **`messages`** — hilo de conversación de cada ticket; distingue
  mensajes entrantes/salientes y notas internas (nunca visibles para
  el solicitante); `graph_message_id` único para idempotencia.
  `destinatarios`/`copia` (`text[]`, solo en salientes no-nota) guardan
  a quién se envió realmente cada respuesta — el composer permite
  añadir destinatarios manuales y CC más allá del solicitante.
- **`attachments`** — ficheros colgados de cada mensaje.
- **`events`** — auditoría automática (vía triggers) de cada cambio de
  estado/prioridad/categoría/tipo/departamento/asignación. Es la
  fuente de verdad temporal; solo escriben en ella los triggers, nunca
  la aplicación directamente. Es lo que alimenta la pestaña
  "Cronología" de la ficha de ticket (ver más abajo).
- **`email_ingesta`** — traza de cada correo procesado (creado,
  adjuntado, descartado, cuarentena, error) — la "caja negra" para
  depurar quejas de "escribí y no pasó nada".

Estados de ticket: `nuevo → triaje → en_curso → esperando_usuario /
esperando_proveedor → resuelto → cerrado` (o `cancelado`). Reapertura
posible tras cierre, cuenta en `reopen_count`.

## Flujo de correo

- **Entrada — sin implementar.** cron cada ~2 min leyendo mensajes no
  leídos del buzón compartido vía Graph. Se descartan webhooks de
  Graph para v1 (caducan cada ~3 días, complejidad innecesaria a este
  volumen).
- **Salida — implementada.** `lib/graph/mail.ts` llama a `sendMail`
  (acción, no crear-borrador-y-enviar) desde el composer de
  "Responder" en la ficha de ticket. **`it@pando.es` es solo de
  recepción** — cada respuesta se envía "como" el email de la persona
  que la escribe (`persona.email`, no un buzón fijo), para que llegue
  al solicitante desde el agente real que resolvió el ticket, no desde
  una dirección compartida. Requiere un **segundo registro de app en
  Entra**, distinto del usado para login (ver más abajo), con permiso
  de aplicación `Mail.Send` — variables
  `GRAPH_TENANT_ID`/`GRAPH_CLIENT_ID`/`GRAPH_CLIENT_SECRET` en
  `.env.local` (ver `.env.local.example`). No hay `conversationId`
  real de Graph todavía (`sendMail` no lo devuelve) — el asunto lleva
  `[PANDO-123]` como red de seguridad de threading, tal cual se había
  previsto aquí desde el principio. El agente puede añadir
  destinatarios manuales y CC además del solicitante, editable en el
  propio composer.
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

**Pendiente, y ya bloqueante:** el "Responder" de la ficha de ticket
(`lib/graph/mail.ts`) ya está programado para enviar por Graph, pero
necesita un **segundo** registro de app en Entra ID —
distinto de `pando-helpdesk-auth`—, con permiso de **aplicación** (no
delegado) `Mail.Send`. A diferencia de la ingesta (que sí será sobre
`it@pando.es`, buzón solo de recepción), el envío suplanta el buzón
**del agente que responde** (hoy `mramirez@pando.es`; el día que haya
compañeros resolviendo tickets, los suyos también) — así que la
política de acceso de aplicación debe restringir este registro a un
**grupo de seguridad con los buzones de los agentes**, no a un único
buzón. Requiere al administrador de Exchange de Pando para crear esa
política (`New-ApplicationAccessPolicy` vía PowerShell, apuntando al
grupo) y mantener el grupo actualizado si se suman agentes, ya que
Manu no tiene ese rol. Hasta que exista ese registro y sus credenciales
estén en `.env.local`
(`GRAPH_TENANT_ID`/`GRAPH_CLIENT_ID`/`GRAPH_CLIENT_SECRET`),
"Responder" falla con un error explícito en vez de fallar en silencio.

Cuando se monte además la **ingesta** de correo sobre `it@pando.es`,
hará falta un permiso `Mail.Read` de aplicación adicional (mismo
registro u otro), con su propia política de acceso restringida
únicamente a ese buzón.

## Alcance de la v1 (deliberadamente acotado)

**Incluye:** ingesta de correo → ticket automático, cola de tickets,
triaje (categoría + prioridad + título), respuesta (sale como email),
cambio de estado, cierre, informe básico a dirección basado en
`events`.

**Fuera de v1, a propósito:**
- ~~Portal de autoservicio para que el usuario abra tickets
  directamente~~ — adelantado: ver `/mis-tickets` en el checklist de
  más abajo. Sigue pendiente la parte de "formularios estructurados
  como altas/bajas de usuario" — hoy es un formulario libre
  (título + descripción + categoría/tipo), no un flujo guiado por tipo
  de solicitud.
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

**Infraestructura y auth**
- [x] Esquema versionado en `supabase/migrations/` (baseline capturado
      + migraciones incrementales; `supabase/schema.sql` ya no existe,
      ver `supabase/README.md`)
- [x] Registro de app en Entra ID para login (`pando-helpdesk-auth`)
- [x] Provider Azure configurado en Supabase Auth
- [x] Login probado end-to-end desde una app real
- [x] Repositorio GitHub creado, proyecto Next.js inicializado
- [x] Buzón de correo compartido decidido: `it@pando.es` (creación en
      curso por el admin de Exchange)
- [x] Bug de permisos corregido: los triggers de auditoría sobre
      `events` son ahora `SECURITY DEFINER` — antes, crear o modificar
      cualquier ticket como agente autenticado (no `service_role`)
      fallaba en silencio porque el trigger no tenía permiso de
      `INSERT` en `events`. Ver `supabase/README.md`.
- [x] Corregido también el hueco de `attachments`: la política
      `attachments_visibles` no filtraba por propiedad del ticket ni
      por `es_nota_interna`. Sustituida por `attachments_lectura`,
      que delega en `can_view_ticket()` (ver más abajo).

- [x] Favicon propio: `app/icon.svg` (monograma "P" blanco sobre
      cuadrado redondeado en `#111111`, el mismo negro de marca que
      `--color-pando`), recogido automáticamente por Next.js vía
      convención de archivo — no hizo falta tocar `metadata` en
      `app/layout.tsx`. Sustituye al `app/favicon.ico` por defecto de
      Next.js (el logo de Next/Turbopack), que se eliminó. No existe
      todavía ningún logotipo real de Pando en el proyecto — este
      monograma es un sustituto mínimo hasta que se aporte uno.

**Pantallas de agente (`/tickets`, `/ajustes`) — implementadas
siguiendo el sistema de diseño Pando de este documento**
- [x] Cola de tickets (`/tickets`) como bandeja de trabajo: tabs por
      estado, filtros de prioridad/categoría/tipo/departamento vía URL,
      búsqueda, botón **"+ Nuevo"** para dar de alta tickets a mano
      (peticiones que llegan por pasillo/teléfono, `origen = 'manual'`).
      Listado en formato tabla por columnas (Ticket/Solicitante/
      Categoría/**Departamento**/Prioridad/Estado/Creado — columna
      Departamento añadida el 2026-09-17, a petición del usuario),
      cabecera clicable para ordenar ascendente/descendente (estado en
      la URL, sobrevive a filtros y pestañas) — Solicitante, Categoría
      y Departamento no son ordenables a propósito (serían sort sobre
      tabla relacionada, sin forma de probarlo aquí con sesión real).
- [x] Ficha de ticket (`/tickets/[id]`): panel de propiedades editable
      (estado/prioridad/categoría/tipo/departamento por dropdown),
      conversación con distinción visual de notas internas, composer
      de tres modos — **Responder** (envío real de correo vía Graph,
      como el propio agente logueado, con Para/CC), **Chat** (mensaje
      que entra en el histórico del ticket exactamente igual que una
      respuesta — lo ve el solicitante y Gerencia/Dirección — pero sin
      disparar ningún correo: pensado para ida y vuelta rápida con el
      solicitante sin el peso de redactar un email) y **Nota interna**
      (privada, nunca visible fuera de admin). Los tres se guardan como
      `direccion = 'saliente'`; lo único que distingue a "Chat" de
      "Responder" es que no lleva `destinatarios`/`enviado_at` ni pasa
      por `sendMailAsUser`. El trigger `tg_first_response` ya contaba
      cualquier mensaje saliente no-nota para `first_response_at`, así
      que un "Chat" cuenta como primera respuesta igual que un
      "Responder" — no hizo falta tocar ningún trigger.
      **Corregido (2026-09-17):** Gerencia/Dirección pueden crear
      tickets a su propio nombre (Fase 3), pero al abrirlos en
      `/tickets/[id]` (no tienen `/mis-tickets`, esa ruta es solo para
      `empleado`) no había ninguna forma de escribir en su propio
      ticket — el composer entero está oculto para quien no sea
      `admin`. Se añadió `isOwnTicket` (`ticket.solicitante_id ===
      persona.id`): cuando es su propio ticket y no es admin, se
      muestra el mismo `ReplyForm` simple que usa un empleado en
      `/mis-tickets/[id]` (reutilizado directamente, ahora acepta una
      `action` en vez de tener siempre `replyToOwnTicket` fijo), con
      una acción nueva `replyAsSolicitante` en
      `app/(agente)/tickets/[id]/actions.ts` — mismo INSERT que
      `replyToOwnTicket` pero revalidando `/tickets/[id]` en vez de
      `/mis-tickets/[id]`. Sin cambios de RLS: `messages_propios_insert`
      ya lo permitía para cualquier rol, nunca estuvo restringido a
      `empleado`.
- [x] Pestaña **"Cronología"** en la ficha de ticket: timeline de todos
      los `events` del ticket (creación, cada cambio de estado con su
      badge, prioridad, categoría, tipo, departamento) con quién y
      cuándo, de un vistazo
- [x] `/informes` reconstruido por completo según `Informes.md` (ver
      cabecera de ese documento para el detalle de KPIs y decisiones):
      selector de periodo (7/30/90 días, año) con comparación contra
      el periodo anterior; Estado actual (abiertos, alta/urgente,
      esperando, sin clasificar, más antiguo abierto — con
      drill-down a `/tickets` filtrado donde existe pestaña
      equivalente); Rendimiento del periodo (creados/resueltos,
      variación de backlog, primera respuesta y resolución en
      mediana+media, resolución neta sin esperas, tasa de
      reapertura); dos gráficas de evolución temporal en SVG propio
      (sin librería nueva) — entradas/resoluciones y backlog
      reconstruido día a día desde `events` (no aproximado desde el
      estado actual); Principales focos por categoría/tipo/
      departamento con tabla ordenable y drill-down; distribución por
      estado y por departamento del backlog actual; envejecimiento en
      buckets; "Requiere atención" (reglas heurísticas explícitas
      sobre el backlog, no un SLA inventado). Todo calculado en
      TypeScript en el servidor sobre una única consulta ya recortada
      por RLS — sin funciones RPC nuevas, sin `service_role`. Para
      Responsable de departamento se oculta el filtro y el desglose
      por Departamento (solo vería su propia fila) y se indica qué
      departamento está viendo; Empleado sigue sin acceso.
- [x] `/ajustes` reestructurado como landing de tarjetas → `Catálogos`
      (gestión de categorías/tipos/departamentos: alta, desactivar,
      borrar) y `Personas` (listado editable de todos los dados de
      alta: nombre, departamento, **rol**, activo/inactivo, y ahora
      también **eliminar**, solo `admin`). Borrar falla con mensaje
      claro si esa persona ya tiene tickets/mensajes/eventos asociados
      (FK `RESTRICT` a propósito, para no perder historial) — sugiere
      desactivar en su lugar. Bloqueado también borrarse a uno mismo o
      al último `admin` activo.
- [x] `/mis-tickets` (empleado) — portal de autoservicio: listado de
      los tickets propios con prioridad, estado, categoría, tipo,
      departamento y fecha de última actualización visibles por fila
      (antes solo mostraba categoría + fecha de creación); botón
      "Nuevo ticket" (sin selector de solicitante ni de prioridad — la
      prioridad la sigue fijando solo el agente). La ficha
      `/mis-tickets/[id]` reutiliza los mismos componentes que la
      ficha de agente — `PropertiesPanel` en modo solo lectura
      (`canEdit={false}`), pestañas Conversación/Cronología y
      `Timeline` — así que un empleado ve exactamente la misma
      información que un agente sobre su propio ticket (estado,
      prioridad, categoría, tipo, departamento, fechas de triaje/1ª
      respuesta/resolución, e historial completo de cambios), solo que
      sin controles de edición y sin el composer de agente
      (Responder/Nota interna). Mantiene su propia caja simple para
      añadir mensajes (`ReplyForm` → `replyToOwnTicket`, inserta como
      `direccion = 'entrante'`, igual que simularía un correo
      entrante) — no ve ni puede crear notas internas.
      `tickets_propios_insert`/`_select` y
      `messages_propios_insert`/`_select` ya lo permitían desde el
      baseline. Se añadieron dos políticas: `personas_visible_por_conversacion`,
      para que el solicitante vea el nombre real de quien le responde
      (antes cualquier fila de `personas` que no fuera la propia
      quedaba oculta por `personas_self`, y se veía el genérico
      "Agente") — solo abre la fila de quien te haya escrito de verdad
      en un ticket tuyo, no el directorio completo de empleados — y
      `events_propios_select`, para que pueda leer la Cronología de
      sus propios tickets (antes `events` solo tenía políticas para
      admin y Gerencia/Dirección, ningún solicitante podía leer ni un
      evento).
      **Corregido (2026-09-17):** `createOwnTicket` nunca rellenaba
      `departamento_id` (a propósito, igual que la prioridad — "eso lo
      tría el agente"), pero a diferencia de la prioridad, el
      departamento del empleado ya se conoce desde el onboarding y no
      hay ninguna razón para dejarlo en blanco. Además, con la RLS
      estricta de Dirección (`20260917160000_direccion_solo_su_departamento.sql`,
      sin fallback a `departamento_id IS NULL`), un ticket de empleado
      sin departamento quedaba invisible para el responsable de ese
      departamento hasta que alguien lo triara a mano. Ahora se
      autorrellena con el propio departamento del empleado (sigue
      siendo editable por el agente en el triaje); la prioridad sigue
      sin tocarse.
      **Bug corregido de esta misma pasada:** al copiar el layout de
      ficha de agente (`h-screen flex-col overflow-hidden`, pensado
      para un `<main>` sin cabecera propia) a `/mis-tickets/[id]`, el
      `<header>` + `p-6` del layout de solicitante hacían que el
      formulario de respuesta quedara recortado fuera del viewport
      visible — visible en el DOM pero inalcanzable, como si se hubiera
      eliminado. Se sustituyó por un layout de flujo normal (sin altura
      fija ni scroll interno), que es además más apropiado para esta
      pantalla más sencilla.

**Roles y permisos (ver `PERMISOS.md` para el detalle completo,
incluida la matriz de comportamiento esperado)**
- [x] Fase 1 — modelo de datos: enum `rol_persona`
      (admin/gerencia/direccion/empleado), columna `personas.rol`
      (migrada desde `es_agente`), funciones `is_admin()`,
      `current_rol()`, `current_departamento_id()`,
      `can_view_ticket(ticket_id)`. Políticas de lectura extendida en
      `tickets`/`messages`/`events` para Gerencia (todo) y Responsable
      de departamento (su departamento + tickets sin departamento
      asignar). Admin ya puede leer `email_ingesta` desde la app.
- [x] Fase 2 — rutas y navegación: `/ajustes` y subrutas protegidas a
      nivel de servidor (no solo ocultas en sidebar), redirigen a
      `/tickets` si el rol no es `admin`. Sidebar solo muestra
      "Ajustes" a `admin`. `/tickets` e `/informes` no necesitaron
      ningún filtro adicional en el código — el recorte por rol y
      departamento ya lo hace RLS antes de que la query llegue a la
      página.
- [x] Fase 3 — experiencia de solo lectura: en la ficha de ticket,
      Estado/Prioridad se muestran como badge fijo y
      Categoría/Tipo/Departamento como texto plano (sin dropdown) para
      quien no sea `admin`; el composer de Responder/Nota interna
      desaparece por completo para esos roles. **Excepción explícita
      del usuario:** crear tickets no se restringió a `admin` —
      cualquier rol puede crear un ticket a su propio nombre (política
      `tickets_propios_insert`, sin tocar); solo `admin` puede elegir
      un solicitante distinto en "+ Nuevo".
      **Corregido (2026-09-17):** el campo Departamento del diálogo "+
      Nuevo" empezaba siempre en "Sin departamento" para cualquier rol,
      obligando a un Responsable de departamento a elegirlo a mano cada
      vez en su propio ticket. Ahora `NewTicketDialog` recibe
      `defaultDepartamentoId` (el `departamento_id` de quien ha
      iniciado sesión, ahora expuesto por `getCurrentPersona()`) y
      preselecciona ese departamento — sigue siendo editable, solo
      cambia el valor inicial. Para `admin` no cambia nada en la
      práctica (no tiene departamento propio, por eso queda exento del
      onboarding).
- [x] Eliminar ticket (solo `admin`): botón "Eliminar ticket" al pie
      del panel de propiedades en `/tickets/[id]` (`canEdit`, así que
      nunca visible para Gerencia/Dirección/Empleado — es una "acción
      destructiva", ocultas por completo para esos roles), con
      confirmación nativa antes de borrar. Es borrado real, no
      soft-delete (la columna `tickets.deleted_at` existe en el
      esquema pero ninguna acción la usa; solo se lee en los `SELECT`
      para dejar la puerta abierta a un soft-delete futuro si hiciera
      falta) — `DELETE FROM tickets` arrastra mensajes, eventos y
      adjuntos vía `ON DELETE CASCADE` (ya existían desde el baseline).
      Requirió una migración pequeña,
      `20260917170000_tickets_delete.sql`, para que
      `email_ingesta.ticket_id` no bloqueara el borrado con una
      violación de FK (pasa a `ON DELETE SET NULL`: es un log de
      auditoría de correos entrantes, no contenido del ticket, tiene
      sentido conservarlo). Sin política RLS nueva: `tickets_agente` ya
      era `FOR ALL` para Admin desde siempre.
- [x] Onboarding obligatorio de nombre + departamento: toda persona
      nueva entra con `rol = 'empleado'` (el mínimo, ya era el valor
      por defecto); no puede usar el resto de la app hasta confirmar
      su nombre y elegir departamento en `/onboarding`. `admin` exento
      a propósito. El nombre se puede reintentar sin límite (campo
      cosmético, sin peso en RLS); el departamento solo se puede fijar
      una vez por uno mismo (`complete_own_onboarding()`,
      `SECURITY DEFINER` de un solo propósito) — cambiarlo después ya
      es cosa de `admin` desde `Ajustes → Personas`.
- [ ] Pendiente / explícitamente aparcado: tests de seguridad
      automatizados contra RLS (omitidos a petición del usuario);
      migrar `categorias_agente`/`tipos_agente`/`departamentos_agente`/
      `personas_agente_update` para llamar a `is_admin()` directamente
      en vez de al alias `is_agente()`; borrar la columna `es_agente`
      (inerte, sin ningún consumidor); permitir que Gerencia/Responsable
      de departamento creen tickets en nombre de otra persona (hoy
      solo `admin` puede); políticas de bucket de Storage para
      adjuntos (no aplica todavía — no existe ningún bucket creado).

**Correo**
- [x] Envío real de respuestas (`lib/graph/mail.ts`, Graph `sendMail`)
      desde el composer — permite añadir destinatarios manuales y CC
      además del solicitante (`messages.destinatarios`/`copia`). **No
      funciona todavía en producción**: falta crear el segundo
      registro de app en Entra con `Mail.Send` y rellenar
      `GRAPH_TENANT_ID`/`GRAPH_CLIENT_ID`/`GRAPH_CLIENT_SECRET` en
      `.env.local` (ver sección "Auth con Entra ID" arriba).
- [ ] Segundo registro de app en Entra ID: `Mail.Send` de aplicación ya
      necesario (política de acceso sobre el grupo de buzones de
      agentes), `Mail.Read` de aplicación sobre `it@pando.es` cuando
      llegue la ingesta
- [ ] Lógica de ingesta de correo (Graph)

**Nota operativa — probar roles no-admin:** para probar Gerencia/
Responsable de departamento/Empleado de verdad hace falta que una
**segunda persona real** entre una vez por SSO (RLS depende de
`auth.uid()`, no se puede simular). La regla de "no te quedes sin
Admin" bloquea cambiarte tu propio rol si eres el único Admin — no es
un bug, es la protección funcionando.

## Diseño UI/UX — Pando Helpdesk

### Visión

La aplicación debe sentirse como un **producto interno premium de Pando**, no como una plantilla genérica de administración ni como una copia de la web corporativa.

Debe trasladar al software los valores visuales de Pando:

**diseño · precisión · integración · simplicidad · tecnología · calidad**

La referencia visual conceptual es:

**Pando × Linear × Vercel × Notion**

El resultado debe ser una interfaz:

* minimalista;
* muy limpia;
* rápida de entender;
* elegante pero sobria;
* con sensación de producto profesional;
* fluida en las interacciones;
* diseñada para trabajar durante horas sin cansancio visual.

La funcionalidad y la legibilidad siempre tienen prioridad sobre la decoración.

---

# 1. Dirección visual

Inspirarse en los acabados Pando:

* negro;
* antracita;
* grafito;
* acero;
* blanco;
* superficies mate;
* líneas muy limpias;
* contraste elegante.

No convertir toda la aplicación en dark mode.

El modo principal será **claro**, utilizando el negro/antracita como elemento de identidad y contraste.

La interfaz debe recordar a un producto tecnológico de gama alta más que a un ERP tradicional.

Evitar:

* degradados decorativos;
* sombras fuertes;
* colores excesivamente saturados;
* tarjetas dentro de tarjetas;
* bordes redondeados exagerados;
* interfaces excesivamente grandes;
* iconos de colores sin significado;
* dashboards llenos de widgets;
* efectos visuales que ralenticen el trabajo.

---

# 2. Paleta

Usar una base neutral.

### Background

```text
App background       #F7F7F6
Surface              #FFFFFF
Surface secondary    #F3F3F2
Surface hover        #EEEEEC
```

### Texto

```text
Text primary         #181818
Text secondary       #666666
Text muted           #929292
Text disabled        #B5B5B5
```

### Bordes

```text
Border               #E5E5E3
Border strong        #D5D5D2
```

### Identidad Pando

```text
Pando black          #111111
Pando anthracite     #292929
```

El negro Pando será el principal color de identidad.

Utilizarlo para:

* botones primarios;
* navegación seleccionada;
* iconos importantes;
* estados de focus seleccionados;
* elementos de marca.

No utilizar negro en exceso.

---

# 3. Colores semánticos

Los colores se utilizan principalmente para comunicar estados, nunca como decoración.

### Prioridad

```text
Urgente     rojo
Alta        ámbar / naranja
Normal      gris neutro
Baja        gris claro
```

La prioridad normal no necesita un badge llamativo.

Una interfaz llena de badges de colores genera ruido visual.

### Estados

```text
Nuevo                  azul suave
Triaje                 violeta suave
En curso               azul
Esperando usuario      ámbar
Esperando proveedor    ámbar/gris
Resuelto                verde
Cerrado                 gris
Cancelado               gris
```

Los badges deben utilizar:

* fondo muy suave;
* texto más oscuro;
* pequeño indicador opcional;
* poco contraste visual salvo cuando realmente requiere atención.

Ejemplo conceptual:

```text
● En curso
● Esperando usuario
✓ Resuelto
```

---

# 4. Tipografía

Utilizar **Geist** como primera opción.

Alternativa: Inter.

```text
font-family: Geist, Inter, sans-serif
```

Jerarquía:

```text
Page title       24px / 600
Section title    16px / 600
Body             14px / 400
UI controls      14px / 500
Secondary        13px / 400
Metadata         12px / 400
```

Evitar utilizar `font-bold` de forma habitual.

La interfaz debe conseguir jerarquía mediante:

* tamaño;
* espacio;
* posición;
* color;
* peso tipográfico.

No mediante textos enormes.

---

# 5. Espaciado

Utilizar una escala coherente basada en múltiplos de 4:

```text
4
8
12
16
20
24
32
40
48
```

Las pantallas deben tener espacio suficiente para respirar, pero el Help Desk es una herramienta operativa: no desperdiciar espacio vertical.

La cola de tickets debe tener una densidad media-alta.

La ficha de ticket puede ser más espaciosa.

---

# 6. Bordes y superficies

Border radius general:

```text
Inputs      6-8px
Buttons     7-8px
Cards       10px
Popovers    10px
Badges      6px o pill según contexto
```

Evitar el estilo excesivamente redondeado.

Priorizar:

```text
background + border + whitespace
```

sobre:

```text
box-shadow
```

Las sombras, cuando existan, deben ser extremadamente sutiles y reservarse principalmente para elementos flotantes:

* dropdowns;
* command palette;
* popovers;
* modales.

---

# 7. Layout principal

Desktop-first.

La aplicación de agente utilizará:

```text
┌─────────────┬───────────────────────────────────────┐
│             │                                       │
│  SIDEBAR    │              CONTENT                  │
│             │                                       │
│             │                                       │
│             │                                       │
└─────────────┴───────────────────────────────────────┘
```

### Sidebar

Ancho aproximado:

```text
220-240px
```

Debe ser simple y estable.

Parte superior:

```text
PANDO
HELPDESK
```

Preferiblemente utilizando el logotipo real de Pando de manera discreta.

Navegación:

```text
Tickets
Informes

────────────

Configuración
```

Cuando se implemente la zona de solicitantes:

```text
Mis tickets
```

No mostrar funcionalidades todavía inexistentes salvo que sea necesario indicar claramente que están próximas.

Parte inferior:

```text
Avatar
Manu Ramírez
IT
```

La sidebar puede ser blanca o ligeramente diferenciada del fondo principal mediante un borde derecho.

Evitar una sidebar completamente negra si hace que la aplicación resulte visualmente pesada.

Puede utilizarse negro/antracita de manera mucho más elegante en logotipo, selección y controles.

---

# 8. Cabecera

Evitar una navbar superior grande.

Cada página tendrá una cabecera pequeña dentro del contenido.

Ejemplo:

```text
Tickets                                  Buscar    + Nuevo

Gestiona y prioriza las incidencias internas
```

Cuando una descripción no aporte información útil, omitirla.

Mantener las acciones principales a la derecha.

---

# 9. Cola de tickets — pantalla más importante

`/tickets` es la pantalla operativa principal y debe recibir especial atención.

Debe parecer una **bandeja de trabajo**, no un listado administrativo.

Ejemplo conceptual:

```text
Tickets                                              ⌘ K

Todos   Nuevos   En curso   Esperando   Resueltos

──────────────────────────────────────────────────────────

●  PANDO-184   Error impresión etiquetas BC14
   Marta Sánchez · ERP / BC
   Hace 12 min                         Urgente    En curso

   ─────────────────────────────────────────────────────

   PANDO-183   No puedo acceder a la VPN
   Javier Ruiz · Accesos
   Hace 34 min                         Alta       Nuevo

   ─────────────────────────────────────────────────────

   PANDO-182   Instalar Adobe Acrobat
   Laura Costa · Software
   Hace 1 h                                       Nuevo
```

No es obligatorio utilizar una tabla HTML clásica.

Preferir filas que permitan leer visualmente:

1. qué ocurre;
2. quién lo solicita;
3. cuánto tiempo lleva abierto;
4. categoría;
5. prioridad;
6. estado.

El **título del ticket debe ser el elemento visual principal**.

El ID debe ser secundario.

---

# 10. Filtros

No crear una gran zona de filtros ocupando media pantalla.

Utilizar una toolbar compacta:

```text
[ Estado ▾ ] [ Prioridad ▾ ] [ Categoría ▾ ]       Buscar...
```

Los filtros activos deben poder eliminarse rápidamente.

Ejemplo:

```text
Estado: En curso ×
Prioridad: Alta ×
```

Permitir combinaciones sin complicar visualmente la pantalla.

---

# 11. Detalle de ticket

El detalle será una de las pantallas más utilizadas.

Estructura recomendada:

```text
← Tickets

PANDO-184                                           En curso ▾

Error al imprimir etiquetas desde BC14

Marta Sánchez · hace 23 minutos

┌───────────────────────────────────┬──────────────────┐
│                                   │                  │
│       CONVERSACIÓN                │    PROPIEDADES   │
│                                   │                  │
│                                   │  Estado          │
│                                   │  En curso        │
│                                   │                  │
│                                   │  Prioridad       │
│                                   │  Alta            │
│                                   │                  │
│                                   │  Categoría       │
│                                   │  ERP / BC        │
│                                   │                  │
└───────────────────────────────────┴──────────────────┘
```

Distribución aproximada:

```text
Conversación    70-75%
Propiedades     25-30%
```

Las propiedades deben poder editarse directamente.

Evitar obligar al agente a entrar en "modo edición".

Estado, prioridad y categoría deben cambiarse mediante dropdown/popover.

---

# 12. Conversación

El hilo debe parecer más cercano a un email limpio que a WhatsApp.

Mensajes entrantes:

```text
Marta Sánchez
09:42

Desde esta mañana BC14 muestra un error al intentar...
```

Respuesta del agente:

```text
Tú
10:03

He revisado el servicio y...
```

No utilizar enormes burbujas de chat.

Separar mensajes mediante:

* espacio;
* avatar;
* autor;
* timestamp;
* borde muy sutil cuando sea necesario.

---

# 13. Notas internas

Las notas internas deben diferenciarse claramente del correo enviado al solicitante.

Utilizar un fondo cálido extremadamente suave:

```text
┌──────────────────────────────────────┐
│ 🔒 Nota interna                      │
│                                      │
│ Revisar este problema con BC antes… │
└──────────────────────────────────────┘
```

Debe ser imposible confundir visualmente una nota interna con una respuesta que llegará por email.

---

# 14. Composer de respuesta

La caja de respuesta debe permanecer cerca del hilo.

Ejemplo:

```text
┌─────────────────────────────────────────────────────┐
│ Responder                                           │
│                                                     │
│ Escribe una respuesta...                            │
│                                                     │
│ 📎 Adjuntar                                         │
│                                                     │
│                         [Enviar respuesta]           │
└─────────────────────────────────────────────────────┘
```

Si existen ambos modos:

```text
Responder | Nota interna
```

El cambio entre ambos debe ser muy evidente.

`Nota interna` debe modificar visualmente el composer para evitar errores.

---

# 15. Interacciones

La aplicación debe sentirse inmediata.

Duraciones:

```text
Hover           100-150ms
Popover         120-180ms
Modal           150-200ms
Page UI         evitar animaciones innecesarias
```

Utilizar preferentemente:

```css
transition-colors duration-150
```

No animar elementos solo porque sea posible.

Evitar:

* rebotes;
* zoom exagerado;
* parallax;
* animaciones largas;
* skeletons que permanezcan más de lo necesario.

La sensación de fluidez debe provenir principalmente de la rapidez de respuesta.

---

# 16. Feedback inmediato

Cuando se modifica un ticket:

```text
Prioridad actualizada
Estado cambiado a En curso
Respuesta enviada
```

Utilizar toast pequeños y discretos.

No mostrar modales de confirmación para acciones reversibles.

Solicitar confirmación únicamente cuando exista riesgo real:

```text
Cancelar ticket
Eliminar archivo
Descartar cambios importantes
```

---

# 17. Loading

Evitar spinners grandes en el centro de la pantalla.

Utilizar skeletons que reproduzcan aproximadamente la estructura final.

Ejemplo para tickets:

```text
████████████████████
██████   █████
────────────────────

██████████████
███████   ████
```

Las acciones pequeñas pueden utilizar un spinner dentro del propio botón.

---

# 18. Empty states

Los estados vacíos deben ser sencillos.

Ejemplo:

```text
No hay tickets esperando respuesta.

Todo al día.
```

No utilizar ilustraciones enormes ni confeti.

---

# 19. Iconografía

Utilizar una sola familia de iconos.

Preferencia:

**Lucide Icons**

Tamaños habituales:

```text
16px controles
18px navegación
20px acciones destacadas
```

Stroke consistente.

No utilizar emojis como iconografía habitual del producto.

---

# 20. Componentes

Antes de crear un componente nuevo, comprobar si puede resolverse con los componentes existentes.

Componentes base recomendados:

```text
Button
IconButton
Input
Textarea
Select
DropdownMenu
Popover
Dialog
Tooltip
Badge
Avatar
Tabs
Toast
Skeleton
CommandMenu
TicketRow
StatusBadge
PriorityBadge
EmptyState
```

Puede utilizarse **shadcn/ui** como base técnica, pero debe personalizarse para que la aplicación tenga identidad Pando y no parezca una demo estándar de shadcn.

---

# 21. Command palette y teclado

Como el agente principal utilizará la aplicación muchas horas, añadir progresivamente soporte de teclado.

Ejemplos:

```text
⌘/Ctrl + K      búsqueda / command palette
/               buscar tickets
Esc             cerrar popover/modal
```

En el futuro:

```text
E               cambiar estado
P               cambiar prioridad
R               responder
N               nota interna
```

No implementar shortcuts si pueden causar acciones accidentales.

---

# 22. Dashboard / informes

Evitar el clásico dashboard lleno de tarjetas gigantes.

Ejemplo:

```text
Resumen · últimos 30 días

142 tickets         3h 12m respuesta media       38 ERP/BC

────────────────────────────────────────────────────

Tickets por categoría

ERP / BC       █████████████████  38
Hardware       ███████████        25
Accesos        ████████           18
Software       ██████             14
```

Los datos son los protagonistas.

Utilizar gráficas únicamente cuando respondan una pregunta concreta.

---

# 23. Responsive

La aplicación se diseña principalmente para escritorio.

Breakpoints:

```text
Desktop    experiencia completa
Tablet     sidebar colapsable
Mobile     experiencia funcional simplificada
```

No sacrificar la experiencia desktop para conseguir una interfaz mobile perfecta, ya que el uso principal del agente será desde ordenador.

---

# 24. Accesibilidad

Todos los controles deben:

* tener estados `hover`, `focus` y `disabled`;
* poder utilizarse con teclado cuando sea razonable;
* tener contraste suficiente;
* disponer de labels accesibles;
* no depender exclusivamente del color.

Utilizar focus rings discretos pero visibles.

---

# 25. Regla de simplicidad

Antes de añadir cualquier elemento a la interfaz preguntarse:

> ¿Ayuda a Manu a entender, priorizar o resolver un ticket más rápido?

Si la respuesta es no, probablemente no debe estar visible.

La interfaz debe revelar complejidad progresivamente, no mostrarla toda desde el principio.

---

# 26. Regla de consistencia visual

Toda nueva pantalla o componente deberá respetar este sistema.

No introducir arbitrariamente:

* nuevos colores;
* nuevos radios;
* nuevas sombras;
* tamaños de botón diferentes;
* tipografías diferentes;
* patrones de navegación diferentes.

Si aparece una necesidad nueva, ampliar primero el sistema de diseño y después implementar el componente.

---

# 27. Sensación final buscada

La aplicación debe transmitir:

> **"Pando ha construido su propia herramienta interna de soporte."**

No:

> **"Se ha instalado una plantilla de dashboard."**

Debe sentirse sobria, precisa y cuidada, igual que un producto físico Pando:

**tecnología visible solo cuando aporta valor, acabado limpio, controles sencillos y atención al detalle.**

