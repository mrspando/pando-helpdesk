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

## Esquema de datos (resumen — ver `supabase/migrations/` para el SQL completo)

- **`categorias`**, **`tipos`**, **`departamentos`** — tres catálogos
  hermanos, misma estructura (`nombre`, `activa`, `orden`), cada uno un
  eje de clasificación independiente del ticket: Categoría (ERP/BC,
  Hardware, Accesos...), Tipo (Incidencia, Solicitud, Proyecto...) y
  Departamento al que afecta. Los tres se gestionan (alta/baja/borrado)
  desde `Ajustes → Catálogos`, solo por agentes.
- **`personas`** — solicitantes y agentes, enlazados a `auth.users`
  vía `auth_user_id`. `departamento_id` es una relación al catálogo
  `departamentos` (antes era texto libre; se migró para no tener cada
  quien escribiendo el departamento distinto). Editable por completo
  (nombre, departamento, `es_agente`, `activo`) desde
  `Ajustes → Personas`.
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
acceso de aplicación al buzón `it@pando.es` — para que esa app no
pueda leer correo de nadie más en el tenant. Requiere al administrador
de Exchange de Pando para crear la política de acceso a la aplicación
(New-ApplicationAccessPolicy vía PowerShell), ya que Manu no tiene ese
rol.

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
- [ ] **Riesgo abierto:** la política RLS `attachments_visibles` no
      filtra por propiedad del ticket ni por `es_nota_interna` —
      cualquier autenticado puede leer metadatos de cualquier adjunto.
      No se ha corregido todavía.

**Pantallas de agente (`/tickets`, `/ajustes`) — implementadas
siguiendo el sistema de diseño Pando de este documento**
- [x] Cola de tickets (`/tickets`) como bandeja de trabajo: tabs por
      estado, filtros de prioridad/categoría/tipo/departamento vía URL,
      búsqueda, botón **"+ Nuevo"** para dar de alta tickets a mano
      (peticiones que llegan por pasillo/teléfono, `origen = 'manual'`)
- [x] Ficha de ticket (`/tickets/[id]`): panel de propiedades editable
      (estado/prioridad/categoría/tipo/departamento por dropdown),
      conversación con distinción visual de notas internas, composer
      Responder/Nota interna — **el "Responder" solo guarda el mensaje
      en `messages`, todavía no envía el correo real vía Graph**
- [x] Pestaña **"Cronología"** en la ficha de ticket: timeline de todos
      los `events` del ticket (creación, cada cambio de estado con su
      badge, prioridad, categoría, tipo, departamento) con quién y
      cuándo, de un vistazo
- [x] `/informes`: resumen de los últimos 30 días (total, tiempo medio
      de 1ª respuesta, tickets por categoría)
- [x] `/ajustes` reestructurado como landing de tarjetas → `Catálogos`
      (gestión de categorías/tipos/departamentos: alta, desactivar,
      borrar) y `Personas` (listado editable de todos los dados de
      alta: nombre, departamento, rol de agente, activo/inactivo)
- [ ] `/mis-tickets` (solicitante) — sigue siendo solo un placeholder
      "Próximamente"; no hay pantallas de solicitante diseñadas aún

**Correo (sin empezar)**
- [ ] Segundo registro de app en Entra ID (permisos de aplicación sobre
      el buzón) para la ingesta de Graph
- [ ] Lógica de ingesta de correo (Graph)
- [ ] Envío real de respuestas por correo (Graph `sendMail`) — hoy el
      composer de la ficha de ticket no llega a enviar nada, solo
      registra el mensaje

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

