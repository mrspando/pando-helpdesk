# Estado de implementación (2026-09-17)

> Esta sección se actualiza después de cada tramo de trabajo sobre este
> documento. El texto original de la petición se conserva íntegro más
> abajo — no se reescribe, para no perder el razonamiento y las
> decisiones que motivaron cada punto.

**Hecho — Fase 1 (modelo de datos + RLS real):**
- Migración `supabase/migrations/20260917100000_roles_rls_fase1.sql`.
- Enum `rol_persona` (`admin`, `gerencia`, `direccion`, `empleado`) y
  columna `personas.rol`, migrada desde `es_agente`
  (`true → admin`, `false → empleado`). `es_agente` sigue en la tabla,
  sin ningún consumidor en código ni RLS — pendiente de borrarla en una
  limpieza posterior, cuando se decida que es completamente segura.
- Funciones de seguridad `SECURITY DEFINER`: `is_admin()`,
  `current_rol()`, `current_departamento_id()`,
  `can_view_ticket(ticket_id)`. `is_agente()` se conserva como alias de
  `is_admin()` — la siguen usando `categorias_agente`, `tipos_agente`,
  `departamentos_agente` y `personas_agente_update`, que no se
  migraron todavía a llamar a `is_admin()` directamente (deuda técnica
  menor, mismo comportamiento).
- Políticas nuevas: `tickets_gerencia_select` (todo), `tickets_direccion_select`
  (su departamento — ver corrección del 2026-09-17 más abajo),
  `messages_lectura_extendida` y `events_lectura_extendida` (mismo
  alcance, excluyendo siempre notas internas), `email_ingesta_admin_select`.
- De paso se corrigió `attachments_visibles` (bug ya documentado en
  `supabase/README.md`), sustituida por `attachments_lectura` sobre
  `can_view_ticket()`.

**Hecho — Fase 2 (rutas y navegación):**
- `app/(agente)/ajustes/layout.tsx`: `/ajustes` y subrutas protegidas
  en servidor, redirige a `/tickets` si `rol !== "admin"` — no basta
  con ocultar el enlace, como pedía el documento.
- Sidebar: el bloque "Ajustes" solo se renderiza para `admin`.
- `/tickets` e `/informes` no necesitaron ningún filtro nuevo en el
  código: al consultar Supabase con la sesión del usuario (no
  `service_role`), las políticas de la Fase 1 ya recortan las filas
  por rol/departamento antes de que la página las reciba.

**Hecho — Fase 3 (experiencia de solo lectura), con una corrección
del usuario sobre el documento original:**
- Ficha de ticket: Estado/Prioridad como badge fijo y
  Categoría/Tipo/Departamento como texto plano (sin dropdown) para
  quien no sea `admin`; composer de Responder/Nota interna oculto por
  completo para esos roles.
- **Corrección explícita:** el documento original decía "Crear ticket
  manual: Admin sí, el resto no". El usuario indicó que **todo el
  mundo puede crear tickets** — se interpretó como autoservicio:
  cualquier rol crea un ticket a su propio nombre (política
  `tickets_propios_insert`, que ya existía y nunca se tocó); el
  selector de solicitante en "+ Nuevo" solo aparece para `admin`, que
  es el único que puede crear en nombre de otra persona.

**Decisiones tomadas sobre puntos que el documento original dejaba
abiertos** (confirmadas por el usuario antes de implementar):
1. Nombres en interfaz: `gerencia` se muestra como **"Dirección
   General"**, `direccion` como **"Responsable de departamento"** —
   los valores del enum en base de datos no cambiaron.
2. Admin tiene lectura de `email_ingesta` desde la app (antes nadie).
3. Storage: se comprobó contra el proyecto real y **no existe ningún
   bucket todavía** — no hay subida de adjuntos implementada en
   ningún sitio, así que la parte de "revisa las policies del bucket"
   no aplica por ahora.

**Hecho — `/mis-tickets` (autoservicio de empleado), en dos pasadas:**
- Primera pasada: listado propio + creación (sin selector de
  solicitante ni de prioridad) + ficha básica de solo lectura con
  conversación y una caja simple para añadir mensajes
  (`replyToOwnTicket`, inserta como `direccion = 'entrante'`).
- Segunda pasada (2026-09-17, a petición del usuario — "dentro del
  ticket tiene que ver lo que ve el admin, sin poder editar nada y
  dejando la función de poder escribir"): la ficha `/mis-tickets/[id]`
  se reconstruyó para reutilizar directamente los mismos componentes
  que la ficha de agente — `PropertiesPanel` (con `canEdit={false}`,
  ya soportaba ese modo desde la Fase 3), pestañas
  Conversación/Cronología y `Timeline` — en vez de mantener una versión
  simplificada aparte. Esto es exactamente el "modo read only"
  descrito más abajo para Gerencia/Dirección/Empleado, ahora también
  aplicado a la vista de un empleado sobre su propio ticket. El
  composer de agente (Responder/Nota interna) sigue oculto; se
  mantiene el `ReplyForm` propio del solicitante, sin tocar. Requirió
  una política nueva, `events_propios_select`
  (`supabase/migrations/20260917150000_events_propios_select.sql`):
  `events` no tenía ninguna política para el propio solicitante, solo
  para admin/Gerencia/Dirección. También se enriqueció el listado
  `/mis-tickets` con prioridad, tipo, departamento y fecha de última
  actualización (antes solo mostraba categoría y fecha de creación).

**Bug corregido (2026-09-17), reportado por el usuario probando con un
usuario real de `direccion`:** con Ruth Martínez (Responsable de
departamento, Ventas), la app mostraba tickets de otros departamentos.
Causa: la Fase 1 había decidido que `tickets_direccion_select` y
`can_view_ticket()` dejaran ver también los tickets con
`departamento_id IS NULL` ("no penalizar tickets sin triar"), pero en
la práctica cualquier ticket sin triar de cualquier departamento se
veía como si fuera del suyo — justo lo que este documento pedía evitar
("Todos los cálculos deben incorporar obligatoriamente:
`tickets.departamento_id = usuario.departamento_id`"). Corregido en
`supabase/migrations/20260917160000_direccion_solo_su_departamento.sql`:
se retira la excepción, Dirección ahora exige igualdad estricta de
departamento. Los tickets sin triar solo los ve Admin/Gerencia hasta
que se les asigne departamento.

**Explícitamente aparcado / fuera de esta pasada:**
- Tests de seguridad automatizados contra RLS — omitidos a petición
  del usuario.
- Que Gerencia/Responsable de departamento puedan crear tickets **en
  nombre de otra persona** (hoy solo `admin` puede).
- Migrar `categorias_agente`/`tipos_agente`/`departamentos_agente`/
  `personas_agente_update` de `is_agente()` a `is_admin()` directamente.
- Borrar la columna `personas.es_agente`.

---

Quiero que implementes un sistema completo de **roles, permisos y Row Level Security (RLS)** en la aplicación Pando Helpdesk.

Antes de modificar código, analiza la estructura actual del proyecto, las migraciones existentes de Supabase, las políticas RLS, los tipos TypeScript, la autenticación y las pantallas actuales.

NO quiero únicamente ocultar botones en frontend.

Los permisos deben estar protegidos de verdad en **PostgreSQL/Supabase mediante RLS**, de forma que un usuario no pueda saltarse las restricciones haciendo peticiones manuales a Supabase, modificando el frontend o llamando directamente a la API.

## CONTEXTO TÉCNICO

La aplicación utiliza:

* Next.js con App Router
* TypeScript
* Tailwind
* Supabase

  * Postgres
  * Auth
  * Storage
  * Row Level Security
* SSO con Microsoft Entra ID mediante Supabase Auth.
* Tabla `personas` relacionada con `auth.users` mediante `auth_user_id`.
* `personas.departamento_id` relaciona cada persona con `departamentos`.
* Actualmente existe un booleano `es_agente`.
* Actualmente `es_agente = true` permite acceso de agente a todos los tickets.
* Manu es actualmente el único agente/administrador.
* Los tickets disponen de `departamento_id`.
* Existen tablas relacionadas como:

  * `personas`
  * `tickets`
  * `messages`
  * `attachments`
  * `events`
  * `categorias`
  * `tipos`
  * `departamentos`
  * `email_ingesta`

Quiero evolucionar ese sistema hacia un sistema de roles explícito.

---

# ROLES

Implementar exactamente estos cuatro roles:

```text
admin
gerencia
direccion
empleado
```

Los nombres mostrados en interfaz serán:

```text
Admin
Gerencia
Dirección
Empleado
```

---

# 1. ADMIN

El rol `admin` corresponde inicialmente a Manu.

Debe tener **control absoluto de la aplicación**.

No debe existir ninguna limitación funcional para Admin derivada del sistema de permisos.

Puede:

* ver todos los tickets;
* crear tickets;
* editar tickets;
* cambiar estado;
* cambiar prioridad;
* cambiar categoría;
* cambiar tipo;
* cambiar departamento;
* responder tickets;
* crear notas internas;
* gestionar adjuntos;
* cerrar/reabrir/cancelar tickets;
* consultar toda la cronología;
* consultar todos los informes;
* consultar todas las estadísticas;
* gestionar personas;
* cambiar roles;
* cambiar departamentos;
* activar/desactivar personas;
* gestionar categorías;
* gestionar tipos;
* gestionar departamentos;
* utilizar `/ajustes`;
* realizar cualquier otra acción administrativa presente o futura.

IMPORTANTE:

El Admin debe conservar como mínimo todas las capacidades que actualmente proporciona `es_agente = true`.

---

# 2. GERENCIA

El rol `gerencia` es completamente **READ ONLY**.

Puede consultar:

* TODOS los tickets de TODOS los departamentos;
* detalle de los tickets;
* conversación asociada al ticket;
* cronología;
* propiedades del ticket;
* informes;
* estadísticas globales;
* estadísticas de cualquier departamento.

NO puede modificar absolutamente nada.

No puede:

* crear tickets;
* editar tickets;
* modificar propiedades;
* cambiar estados;
* cambiar prioridades;
* cambiar categorías;
* cambiar tipos;
* cambiar departamentos;
* responder;
* añadir notas;
* subir/eliminar adjuntos;
* gestionar usuarios;
* gestionar catálogos;
* acceder a acciones administrativas;
* realizar INSERT, UPDATE o DELETE sobre datos operativos.

Aunque manipule una petición HTTP o llame directamente a Supabase, la base de datos debe rechazar cualquier modificación.

---

# 3. DIRECCIÓN

El rol `direccion` también es completamente **READ ONLY**.

Su ámbito está determinado por:

```text
personas.departamento_id
```

Puede consultar únicamente:

* tickets cuyo `tickets.departamento_id` coincida con su `personas.departamento_id`;
* detalle de esos tickets;
* conversación de esos tickets;
* cronología de esos tickets;
* estadísticas de su departamento;
* informes de su departamento.

Ejemplo:

Si una persona de Dirección pertenece al departamento `Comercial`, solo debe poder obtener tickets de Comercial.

No debe ser posible cambiar un parámetro de URL o realizar una consulta manual para ver tickets de otro departamento.

NO puede modificar absolutamente nada.

No puede:

* crear tickets;
* editar tickets;
* modificar propiedades;
* responder;
* añadir notas;
* cambiar estados;
* cambiar prioridades;
* cambiar categorías;
* cambiar tipos;
* cambiar departamentos;
* subir/eliminar adjuntos;
* gestionar usuarios;
* gestionar catálogos;
* acceder a `/ajustes`;
* realizar INSERT, UPDATE o DELETE.

Si `departamento_id` es NULL para un usuario con rol Dirección, debe mostrarse un estado de configuración incorrecta y NO conceder acceso a tickets de otros departamentos.

Nunca interpretar `departamento_id = NULL` como acceso global.

---

# 4. EMPLEADO

El rol `empleado` también es **READ ONLY**.

Solo puede ver los tickets que le pertenecen.

Debe conservarse la lógica existente que identifica al solicitante/propietario del ticket.

Puede consultar:

* sus propios tickets;
* detalle de sus propios tickets;
* mensajes visibles para el solicitante;
* adjuntos que tenga permitido visualizar.

NO puede:

* consultar tickets de otros empleados;
* consultar informes globales;
* consultar estadísticas;
* consultar estadísticas departamentales;
* crear tickets desde la aplicación;
* editar tickets;
* cambiar propiedades;
* responder desde la aplicación;
* añadir notas;
* cambiar estados;
* acceder a `/ajustes`.

Aunque conozca el UUID de otro ticket, Supabase debe impedir que pueda recuperarlo.

---

# NOTAS INTERNAS

Mantén la regla de privacidad actual.

Las notas internas (`messages.es_nota_interna` o equivalente) deben continuar protegidas.

Por defecto:

```text
Admin      → puede verlas
Gerencia   → NO
Dirección  → NO
Empleado   → NO
```

No abras el acceso a notas internas accidentalmente al implementar los nuevos roles.

---

# MODELO DE DATOS

Analiza la mejor migración posible, pero mi intención es sustituir el booleano:

```text
es_agente boolean
```

por algo equivalente a:

```text
rol
```

con uno de estos valores:

```text
admin
gerencia
direccion
empleado
```

Preferiblemente utiliza un enum PostgreSQL si encaja correctamente con la arquitectura existente.

Por ejemplo:

```sql
create type public.rol_persona as enum (
  'admin',
  'gerencia',
  'direccion',
  'empleado'
);
```

Y:

```text
personas.rol
```

No ejecutes cambios destructivos innecesarios.

La migración debe preservar los usuarios existentes.

Como regla de migración:

```text
es_agente = true  -> admin
es_agente = false -> empleado
```

Una vez migrado todo el código y comprobado que ninguna parte depende de `es_agente`, se puede eliminar esa columna en una migración posterior o dentro de la misma migración únicamente si es completamente seguro.

Busca TODAS las referencias a:

```text
es_agente
```

antes de modificarla.

---

# SEGURIDAD: MUY IMPORTANTE

No quiero un sistema basado simplemente en:

```tsx
if (user.role === 'admin') {
  mostrarBoton()
}
```

El frontend debe adaptar la interfaz, pero la fuente real de seguridad debe estar en Supabase/Postgres.

Implementa políticas RLS para cada tabla sensible.

Debes revisar como mínimo:

```text
tickets
messages
attachments
events
personas
categorias
tipos
departamentos
email_ingesta
```

y cualquier otra tabla que encuentres en las migraciones.

---

# POLÍTICAS DE TICKETS

Conceptualmente quiero algo equivalente a:

## SELECT

Admin:

```text
todos
```

Gerencia:

```text
todos
```

Dirección:

```text
ticket.departamento_id = persona_actual.departamento_id
```

Empleado:

```text
ticket pertenece a persona_actual
```

## INSERT

```text
Admin únicamente
```

salvo operaciones realizadas legítimamente mediante backend/service role para procesos automáticos como futura ingesta de correo.

## UPDATE

```text
Admin únicamente
```

## DELETE

```text
Admin únicamente
```

No permitas que Gerencia, Dirección o Empleado puedan modificar datos mediante llamadas directas a Supabase.

---

# TABLAS RELACIONADAS

No basta con proteger `tickets`.

Si Gerencia/Dirección/Empleado pueden consultar:

```text
messages
attachments
events
```

la política debe comprobar también si el usuario tiene permiso para acceder al **ticket padre**.

Ejemplo conceptual:

```text
messages.ticket_id -> tickets.id
```

La autorización debe derivarse del acceso al ticket.

Especial cuidado con `attachments`.

Existe riesgo de fuga de información si se permite consultar adjuntos únicamente por estar autenticado.

Asegúrate de que una persona nunca pueda obtener metadatos ni archivos de tickets a los que no tenga acceso.

---

# FUNCIONES DE SEGURIDAD

Si mejora claridad, rendimiento y mantenibilidad, crea funciones PostgreSQL reutilizables como:

```text
current_person_id()
current_user_role()
current_user_department_id()
can_view_ticket(ticket_id)
is_admin()
```

o nombres equivalentes.

Deben ser seguras y evitar recursión de RLS.

Si utilizas `SECURITY DEFINER`:

* fija correctamente `search_path`;
* limita permisos;
* evita escaladas de privilegios;
* documenta por qué se utiliza.

No copies la misma subconsulta compleja en veinte políticas si puede centralizarse de forma segura.

---

# BACKEND

Además de RLS, revisa:

* Server Components;
* Server Actions;
* Route Handlers;
* clientes Supabase server/client;
* APIs internas;
* acciones que utilicen service role.

No utilices `service_role` para peticiones normales de usuarios porque saltaría RLS.

El `service_role` debe quedar reservado para procesos internos realmente privilegiados, por ejemplo futura ingesta automática de correo, y nunca exponerse al navegador.

---

# SESIÓN / USUARIO ACTUAL

Crea una forma centralizada y tipada de obtener:

```ts
type UserRole =
  | 'admin'
  | 'gerencia'
  | 'direccion'
  | 'empleado'
```

junto a:

```ts
{
  personaId
  nombre
  rol
  departamentoId
}
```

Evita repetir consultas para determinar los permisos en cada componente.

Si el proyecto ya tiene una función equivalente, reutilízala/refactorízala.

---

# CAPABILITIES

Preferiría no llenar la aplicación de comprobaciones del tipo:

```ts
role === 'admin'
```

por todas partes.

Crea una capa pequeña de capacidades, por ejemplo:

```ts
canEditTickets
canCreateTickets
canViewAllTickets
canViewDepartmentTickets
canViewReports
canManagePeople
canManageCatalogs
canViewInternalNotes
```

Ejemplo aproximado:

```ts
admin = {
  canEditTickets: true,
  canCreateTickets: true,
  canViewReports: true,
  canManagePeople: true,
  canManageCatalogs: true,
  ...
}

gerencia = {
  canEditTickets: false,
  canCreateTickets: false,
  canViewReports: true,
  ...
}
```

Pero recuerda:

Esta capa sirve para comportamiento/UI.

**RLS sigue siendo la autoridad real de seguridad.**

---

# NAVEGACIÓN

Adapta la sidebar en función del rol.

## Admin

Mostrar:

```text
Tickets
Informes
Configuración
```

y el resto de opciones administrativas existentes.

## Gerencia

Mostrar:

```text
Tickets
Informes
```

No mostrar:

```text
Configuración
```

## Dirección

Mostrar:

```text
Tickets
Informes
```

pero ambos limitados automáticamente a su departamento.

No mostrar Configuración.

## Empleado

Mostrar únicamente la zona correspondiente a:

```text
Mis tickets
```

No mostrar:

```text
Informes
Configuración
Tickets globales
```

---

# RUTAS

Protege también las rutas del servidor.

No basta con quitarlas de la sidebar.

Por ejemplo:

```text
/ajustes
/ajustes/personas
/ajustes/catalogos
```

deben ser únicamente Admin.

Si otro rol introduce manualmente la URL:

* no debe cargarse información sensible;
* mostrar 403 / acceso no autorizado o redirigir a su página permitida.

`/informes`:

```text
Admin      -> datos globales
Gerencia   -> datos globales
Dirección  -> exclusivamente su departamento
Empleado   -> sin acceso
```

`/tickets`:

```text
Admin      -> todos
Gerencia   -> todos
Dirección  -> su departamento
Empleado   -> redirigir a /mis-tickets
```

`/mis-tickets`:

```text
Empleado -> sus tickets
```

El resto puede utilizarlo si técnicamente resulta útil, pero no debe interferir con su experiencia principal.

---

# MODO READ ONLY

Gerencia, Dirección y Empleado deben tener una experiencia claramente de solo lectura.

Cuando un usuario read-only abre un ticket:

NO renderizar controles editables.

En lugar de:

```text
Estado      [En curso ▼]
Prioridad   [Alta ▼]
Categoría   [ERP / BC ▼]
```

mostrar:

```text
Estado      En curso
Prioridad   Alta
Categoría   ERP / BC
```

No quiero simplemente:

```text
<select disabled>
```

para todos los casos.

Preferiblemente renderiza componentes de lectura limpia, ya que visualmente deja claro que están consultando información y no editándola.

Ocultar completamente:

* composer de respuesta;
* pestaña/acción Nota interna;
* botones de modificar;
* botón `+ Nuevo`;
* acciones destructivas;
* acciones sobre adjuntos;
* menús de edición.

---

# INFORMES Y ESTADÍSTICAS

La pantalla `/informes` actual debe adaptarse según el rol.

## Admin

Puede consultar todos los datos.

## Gerencia

Puede consultar todos los datos.

Debe ser read-only.

Puede ver estadísticas globales y por departamento.

## Dirección

Todos los cálculos deben incorporar obligatoriamente:

```text
tickets.departamento_id = usuario.departamento_id
```

Esto incluye:

* total de tickets;
* tickets por categoría;
* tickets por estado;
* tiempos medios;
* primera respuesta;
* resolución;
* cualquier estadística futura.

No filtres únicamente los tickets mostrados en frontend.

El filtrado debe hacerse antes de calcular las métricas.

## Empleado

No debe acceder a informes corporativos.

---

# GESTIÓN DE PERSONAS

En:

```text
Ajustes -> Personas
```

solo Admin puede entrar.

Sustituye el control actual relacionado con:

```text
es_agente
```

por un selector:

```text
Rol
Admin
Gerencia
Dirección
Empleado
```

Mostrar también el departamento.

Para Dirección, el departamento debe ser obligatorio funcionalmente.

Si se selecciona Dirección y no tiene departamento:

* impedir guardar, o
* mostrar un error claro.

Gerencia puede tener departamento asignado como información organizativa, pero ese departamento NO limita su acceso.

Empleado utiliza el departamento como dato organizativo, pero su acceso a tickets depende de ser el solicitante, no de compartir departamento.

---

# REGLA DE ADMINISTRADOR

Evita que accidentalmente la aplicación pueda quedarse sin ningún Admin.

Al cambiar el rol de una persona que actualmente sea Admin:

* comprobar si existe otro Admin activo;
* si es el último Admin, impedir quitarle ese rol.

Lo mismo si se intenta desactivar al último Admin.

La validación importante debe existir también del lado servidor/base de datos si es razonable, no exclusivamente en frontend.

---

# AUDITORÍA

El proyecto ya dispone de `events` para auditoría automática de cambios.

Mantén este comportamiento.

Los usuarios read-only no deben generar eventos porque no pueden modificar tickets.

Los cambios de rol/persona realizados por Admin deben seguir un patrón auditable si ya existe infraestructura apropiada.

No modifiques directamente la tabla `events` desde frontend.

---

# COMPORTAMIENTO DEL SISTEMA

Matriz esperada:

| Acción                         | Admin | Gerencia | Dirección                    | Empleado       |
| ------------------------------ | ----- | -------- | ---------------------------- | -------------- |
| Ver todos los tickets          | Sí    | Sí       | No                           | No             |
| Ver tickets de su departamento | Sí    | Sí       | Sí                           | Solo los suyos |
| Ver sus tickets                | Sí    | Sí       | Sí si son de su departamento | Sí             |
| Editar tickets                 | Sí    | No       | No                           | No             |
| Crear ticket manual            | Sí    | No       | No                           | No             |
| Responder                      | Sí    | No       | No                           | No             |
| Crear nota interna             | Sí    | No       | No                           | No             |
| Ver notas internas             | Sí    | No       | No                           | No             |
| Ver estadísticas globales      | Sí    | Sí       | No                           | No             |
| Ver estadísticas departamento  | Sí    | Sí       | Solo el suyo                 | No             |
| Gestionar personas             | Sí    | No       | No                           | No             |
| Gestionar catálogos            | Sí    | No       | No                           | No             |
| Acceder a Ajustes              | Sí    | No       | No                           | No             |

Utiliza esta tabla como contrato funcional.

---

# TESTS DE SEGURIDAD

Quiero tests específicos para los permisos.

No pruebes únicamente la interfaz.

Comprueba las políticas reales.

Como mínimo:

### Admin

* puede SELECT cualquier ticket;
* puede INSERT;
* puede UPDATE;
* puede DELETE;
* puede consultar informes globales.

### Gerencia

* puede SELECT tickets de diferentes departamentos;
* no puede INSERT;
* no puede UPDATE;
* no puede DELETE;
* no puede modificar messages;
* no puede modificar attachments.

### Dirección

Crear:

```text
Usuario dirección departamento A
Ticket departamento A
Ticket departamento B
```

Comprobar:

```text
SELECT ticket A -> permitido
SELECT ticket B -> no aparece / denegado
UPDATE ticket A -> denegado
UPDATE ticket B -> denegado
```

### Empleado

Crear:

```text
Empleado A
Empleado B
Ticket de empleado A
Ticket de empleado B
```

Comprobar:

```text
Empleado A ve ticket A
Empleado A NO ve ticket B
Empleado A NO puede modificar ticket A
```

### Notas internas

Comprobar que:

```text
Admin -> visible
Gerencia -> no visible
Dirección -> no visible
Empleado -> no visible
```

### Adjuntos

Comprobar que ningún usuario puede recuperar adjuntos de un ticket al que no tenga acceso.

---

# NO ROMPER FUNCIONALIDAD ACTUAL

La aplicación ya dispone de:

* login mediante Entra ID;
* cola de tickets;
* detalle de ticket;
* edición de propiedades;
* conversación;
* notas internas;
* cronología;
* informes;
* ajustes;
* catálogos;
* personas.

No quiero reescribir innecesariamente componentes que ya funcionan.

Haz cambios incrementales y reutiliza la arquitectura existente.

Respeta el diseño visual actual de Pando Helpdesk.

No conviertas la aplicación en un dashboard genérico.

---

# MIGRACIONES

Toda modificación de base de datos debe realizarse mediante nuevas migraciones dentro de:

```text
supabase/migrations/
```

No modificar migraciones históricas ya aplicadas salvo que la estructura actual del repositorio indique expresamente lo contrario.

La migración debe:

1. crear el modelo de roles;
2. migrar datos existentes;
3. actualizar funciones auxiliares;
4. sustituir políticas RLS;
5. actualizar permisos necesarios;
6. preservar comportamiento Admin;
7. corregir cualquier política insegura relacionada;
8. poder ejecutarse limpiamente sobre el estado actual.

---

# MUY IMPORTANTE: ATTACHMENTS

Revisa específicamente la política RLS actual de `attachments`.

Quiero que quede solucionado cualquier escenario donde un usuario autenticado pueda consultar adjuntos de tickets ajenos.

El permiso de un attachment debe depender siempre de:

```text
attachment
 -> message
 -> ticket
 -> permiso del usuario sobre ese ticket
```

y además deben respetarse las notas internas.

Si el archivo está en Supabase Storage, revisa también las policies del bucket correspondiente.

No sirve proteger únicamente la fila de `attachments` si el objeto del Storage sigue siendo descargable.

---

# TYPESCRIPT

Actualiza los tipos TypeScript afectados.

Busca:

```text
es_agente
```

en:

* componentes;
* server actions;
* helpers;
* middleware;
* queries;
* tipos;
* layouts;
* navegación;
* tests.

Sustituye la lógica antigua por el nuevo sistema.

Evita:

```ts
any
```

y comparaciones de strings duplicadas innecesariamente.

Centraliza tipos y permisos.

---

# RENDIMIENTO

Las políticas RLS se ejecutarán frecuentemente.

Evita crear políticas extremadamente costosas.

Si consultas repetidamente el rol/persona del usuario actual, utiliza un patrón eficiente compatible con Supabase/Postgres.

Añade índices si son necesarios, especialmente en:

```text
personas.auth_user_id
personas.departamento_id
tickets.departamento_id
tickets.solicitante_id
messages.ticket_id
attachments.message_id
events.ticket_id
```

pero primero verifica cuáles ya existen.

No crear índices duplicados.

---

# ORDEN DE TRABAJO

Trabaja siguiendo este orden:

1. Inspecciona el proyecto actual.
2. Localiza todo lo relacionado con autenticación y `es_agente`.
3. Localiza todas las RLS existentes.
4. Localiza cómo se relaciona actualmente ticket -> solicitante.
5. Localiza cómo funcionan informes y estadísticas.
6. Diseña internamente el cambio mínimo necesario.
7. Implementa la migración SQL.
8. Actualiza helpers y tipos.
9. Actualiza consultas.
10. Actualiza navegación y protección de rutas.
11. Actualiza las interfaces read-only.
12. Actualiza Ajustes -> Personas.
13. Corrige RLS de attachments/storage.
14. Añade tests.
15. Ejecuta:

* typecheck;
* lint;
* tests;
* build.

16. Corrige cualquier error encontrado.

No me pidas que haga cambios manuales que puedas realizar tú en el repositorio.

---

# VALIDACIÓN FINAL

Antes de considerar terminada la tarea, verifica explícitamente los cuatro escenarios usando usuarios/roles diferentes.

Quiero que confirmes técnicamente:

```text
ADMIN
Puede verlo y modificarlo todo.

GERENCIA
Puede verlo todo.
No puede modificar absolutamente nada.

DIRECCIÓN
Solo puede ver tickets y estadísticas de su departamento.
No puede modificar absolutamente nada.

EMPLEADO
Solo puede ver sus propios tickets.
No puede modificar absolutamente nada.
```

Comprueba estas restricciones tanto:

```text
UI
Server
Supabase RLS
Storage
```

No des por terminada la implementación si una restricción existe solo en la interfaz.

---

# RESULTADO FINAL

Cuando acabes, dame un resumen conciso con:

1. archivos modificados;
2. migraciones creadas;
3. modelo de roles implementado;
4. políticas RLS creadas/modificadas;
5. protección de rutas;
6. cambios de interfaz;
7. tests añadidos;
8. riesgos o decisiones técnicas importantes;
9. resultado de typecheck/lint/tests/build.

Si encuentras durante la implementación alguna contradicción entre este requisito y el esquema real del proyecto, prioriza:

1. seguridad;
2. no perder datos;
3. mantener el comportamiento existente de Admin;
4. hacer el menor cambio arquitectónico necesario.
