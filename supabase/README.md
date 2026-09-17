# Esquema de base de datos

La fuente de verdad del esquema es **`supabase/migrations/`**, no el
dashboard de Supabase. `20260916100000_baseline_estado_actual.sql` es
la captura inicial del estado real en producción (proyecto
`pando-helpdesk`, tablas, tipos, secuencias, funciones, triggers,
políticas RLS y la vista `v_tickets_metricas`), obtenida con
`supabase db pull --declarative` y reordenada a mano en un único
archivo porque el modo migración estándar de la CLI necesita Docker o
Podman para la shadow database, y esta máquina no los tiene.

Las migraciones posteriores a esa se aplican con `supabase db push
--db-url <connection-string>` desde PowerShell (el agente de Claude
Code no puede ejecutar este comando directamente, lo bloquea el
clasificador de seguridad — hay que correrlo a mano).

## Discrepancias encontradas frente a `CONTEXT.md`

Al capturar el esquema real aparecieron dos huecos que el documento no
reflejaba:

1. **RLS de `attachments`** (política `attachments_visibles`) — **corregida**
   en `20260917100000_roles_rls_fase1.sql`. La condición original era
   `EXISTS (SELECT 1 FROM messages m WHERE m.id = attachments.message_id)`
   — no comprobaba ni la propiedad del ticket ni `es_nota_interna`.
   Sustituida por `attachments_lectura`, que delega en la función
   `can_view_ticket()` y hereda así el mismo alcance por rol/departamento
   que `tickets` y `messages`.
2. **Permisos de `events`** — **corregido** en
   `20260916110000_fix_events_trigger_permissions.sql`. Las funciones
   `tg_tickets_alta`/`tg_tickets_audit` (las que escriben en `events`)
   ahora son `SECURITY DEFINER`, igual que `is_agente()` /
   `current_persona_id()` / `tg_alta_persona_desde_auth()`. Antes, como
   no lo eran, corrían con el rol de quien disparaba el trigger, y como
   `authenticated` no tiene `GRANT INSERT` en `events`, cualquier
   creación o cambio de ticket hecho por un agente con su sesión normal
   (no `service_role`) fallaba.

## Catálogos y permisos añadidos después del baseline

- `20260916120000_add_tipos.sql` — catálogo `tipos` (Incidencia,
  Solicitud, Proyecto...) hermano de `categorias`, más columna
  `tickets.tipo_id`. De paso añade políticas de escritura para agentes
  en `categorias` (antes solo tenía lectura, nadie podía gestionarla
  desde la app).
- `20260916130000_add_departamentos.sql` — mismo patrón que `tipos`,
  catálogo `departamentos` + `tickets.departamento_id`.
- `20260916140000_personas_agente_update.sql` — política de `UPDATE`
  para que un agente pueda editar cualquier fila de `personas` desde
  `Ajustes → Personas` (antes solo había `SELECT`).
- `20260916150000_personas_departamento_fk.sql` — sustituye
  `personas.departamento` (texto libre) por `personas.departamento_id`,
  relacionado con el mismo catálogo `departamentos` que usan los
  tickets.
- `20260917100000_roles_rls_fase1.sql` — Fase 1 del sistema de roles
  descrito en `PERMISOS.md`: enum `rol_persona`, columna `personas.rol`
  (migrada desde `es_agente`, que queda en la tabla sin usarse por
  nadie), funciones `is_admin()`/`current_rol()`/
  `current_departamento_id()`/`can_view_ticket()`, políticas de lectura
  extendida en `tickets`/`messages`/`events` para Gerencia y Responsable
  de departamento, arreglo de `attachments` (ver arriba) y lectura de
  `email_ingesta` para Admin. Las fases 2 (rutas/navegación) y 3
  (UI de solo lectura) de `PERMISOS.md` no necesitaron ninguna
  migración nueva, solo código de aplicación.
- `20260917110000_messages_destinatarios.sql` — columnas
  `messages.destinatarios`/`copia` (`text[]`, nulas salvo en salientes
  no-nota) para registrar a quién se envió realmente cada respuesta,
  ahora que el composer permite añadir destinatarios manuales y CC
  además del solicitante (ver `lib/graph/mail.ts`).
- `20260917120000_onboarding_departamento.sql` — función
  `set_own_departamento(smallint)` (`SECURITY DEFINER`, de un solo
  propósito) para que cualquier persona pueda fijar su propio
  departamento la primera vez que entra, sin RLS de `UPDATE` genérica
  sobre `personas` que pudiera colar un cambio de `rol` de paso. Solo
  actúa mientras `departamento_id` sigue a `NULL`.
- `20260917130000_nombre_visible_onboarding.sql` — dos cosas:
  1. Política `personas_visible_por_conversacion`: un solicitante
     puede ver la fila de `personas` de quien le haya escrito (no nota
     interna) en un ticket suyo — antes `personas_self` lo ocultaba
     todo salvo la fila propia, y el frontend mostraba "Agente"
     genérico en vez del nombre real.
  2. Sustituye `set_own_departamento(smallint)` por
     `complete_own_onboarding(text, smallint)`, que fija nombre y
     departamento en el mismo paso — el nombre sin candado (no pesa en
     RLS), el departamento sigue solo-una-vez como antes.
- `20260917140000_personas_agente_delete.sql` — política
  `personas_agente_delete` (`FOR DELETE`, `is_admin()`). `personas`
  nunca había tenido ninguna política de `DELETE`, así que nadie podía
  borrar una fila desde la app hasta ahora, ni siquiera Admin. El
  borrado sigue protegido por las FK `RESTRICT` de `tickets`/`messages`/
  `events` (no se puede borrar a nadie con historial asociado).
- `20260917150000_events_propios_select.sql` — política
  `events_propios_select` (`FOR SELECT`, propio solicitante). La ficha
  de `/mis-tickets/[id]` pasa a reutilizar el mismo `PropertiesPanel` y
  `Timeline` de solo lectura que ve un agente, y `events` no tenía
  ninguna política que cubriera al solicitante de sus propios tickets
  (solo admin y Gerencia/Dirección podían leer esa tabla).
- `20260917160000_direccion_solo_su_departamento.sql` — corrige un bug
  real reportado por el usuario probando con Ruth Martínez
  (`direccion`, Ventas): veía tickets de otros departamentos porque
  `tickets_direccion_select` y `can_view_ticket()` dejaban pasar
  también los tickets con `departamento_id IS NULL` (decisión de la
  Fase 1 para no penalizar tickets sin triar). En la práctica, un
  ticket sin triar de cualquier departamento se mostraba como si fuera
  del suyo. Se retira esa excepción por completo — Dirección ahora
  exige igualdad estricta de departamento, tal y como pedía
  `PERMISOS.md` desde el principio. Los tickets sin triar dejan de ser
  visibles para Dirección hasta que Admin/Gerencia les asigne
  departamento.
- `20260917170000_tickets_delete.sql` — cambia la FK
  `email_ingesta_ticket_id_fkey` de `NO ACTION` a `ON DELETE SET NULL`.
  Era la única pieza que faltaba para poder borrar un ticket entero:
  `messages`/`events` ya cascadeaban desde `tickets` en el baseline (y
  `attachments` a su vez desde `messages`), así que un `DELETE FROM
  tickets` ya arrastraba mensajes/eventos/adjuntos; solo
  `email_ingesta` (log de auditoría de correos entrantes, no contenido
  del ticket) habría bloqueado el borrado con una violación de FK. No
  hizo falta ninguna política RLS nueva — `tickets_agente` ya es `FOR
  ALL` para Admin desde el baseline, DELETE incluido.

## Próximos cambios de esquema

Para cambios futuros, instalar Docker Desktop o Podman permite usar el
flujo normal de la CLI: `supabase db diff` (o `db pull` en modo
migración) genera el archivo de migración correspondiente en esta
carpeta, y `supabase db push` lo aplica contra el proyecto remoto.
