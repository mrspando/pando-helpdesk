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

1. **RLS de `attachments`** (política `attachments_visibles`) — **sin
   corregir**. La condición es `EXISTS (SELECT 1 FROM messages m WHERE
   m.id = attachments.message_id)` — no comprueba ni la propiedad del
   ticket ni `es_nota_interna`. Cualquier usuario autenticado puede leer
   los metadatos de cualquier adjunto, incluidos los de notas internas,
   pese a que el modelo de acceso documentado dice que un solicitante
   nunca debe verlas.
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

## Próximos cambios de esquema

Para cambios futuros, instalar Docker Desktop o Podman permite usar el
flujo normal de la CLI: `supabase db diff` (o `db pull` en modo
migración) genera el archivo de migración correspondiente en esta
carpeta, y `supabase db push` lo aplica contra el proyecto remoto.
