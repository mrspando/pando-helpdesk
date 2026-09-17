# Pando Helpdesk — Rediseño de `/informes`

## Objetivo

Rediseñar la página `/informes` de Pando Helpdesk para convertirla en una pantalla de análisis operativo realmente útil.

La finalidad no es mostrar unos pocos contadores, sino disponer de una **visión global del soporte IT** que permita entender:

- el estado actual de los tickets;
- la carga de trabajo;
- si el backlog crece o disminuye;
- los tiempos de respuesta y resolución;
- qué categorías generan más incidencias;
- qué departamentos concentran más carga;
- qué tipos de trabajo predominan;
- qué tickets requieren atención;
- dónde están los puntos débiles;
- y qué datos pueden servir para respaldar decisiones ante Dirección.

La página debe funcionar correctamente tanto ahora, con muy pocos tickets, como en el futuro con cientos o miles.

---

# 1. Principio general

`/informes` debe responder a cinco preguntas principales:

## 1.1 ¿Cómo estamos ahora mismo?

Mostrar una fotografía actual del soporte:

- tickets abiertos;
- tickets de prioridad Alta o Urgente;
- tickets esperando usuario o proveedor;
- tickets pendientes de clasificar;
- antigüedad del ticket abierto más antiguo.

## 1.2 ¿Estamos absorbiendo el trabajo o se acumula?

Comparar:

- tickets creados;
- tickets resueltos;
- variación neta del backlog;
- evolución temporal del backlog.

La pregunta que debe poder responderse es:

> ¿Está entrando más trabajo del que somos capaces de resolver?

## 1.3 ¿Qué tal estamos respondiendo?

Medir:

- tiempo medio de primera respuesta;
- tiempo mediano de primera respuesta;
- tiempo medio de resolución;
- tiempo mediano de resolución;
- tiempo neto atribuible a IT descontando esperas externas cuando sea posible;
- tasa de reapertura.

La **mediana** debe tener protagonismo, porque con muchos tickets representa mejor el comportamiento habitual que una media distorsionada por casos extremos.

## 1.4 ¿Dónde están los problemas?

Analizar los tickets por:

- Categoría;
- Departamento;
- Tipo;
- Prioridad;
- Estado;
- reaperturas;
- antigüedad.

No basta con saber cuántos tickets tiene una categoría. También interesa saber:

- cuánto backlog genera;
- cuánto tarda en resolverse;
- cuántas reaperturas genera;
- qué departamentos la sufren más.

## 1.5 ¿Qué requiere atención?

Debe existir una sección operativa que destaque tickets que merecen revisión:

- urgentes todavía abiertos;
- altas con mucha antigüedad;
- tickets sin primera respuesta;
- tickets demasiado tiempo en Nuevo o Triaje;
- tickets sin categoría, tipo o departamento;
- tickets reabiertos;
- tickets especialmente antiguos.

No debe usarse una puntuación opaca ni inventarse un SLA.

---

# 2. Estructura conceptual de la pantalla

```text
Informes
Visión global del servicio de soporte

[ Últimos 30 días ▾ ] [ Departamento ▾ ] [ Categoría ▾ ] [ Tipo ▾ ] [ Prioridad ▾ ]

──────────────────────────────────────────────────────────────────

ESTADO ACTUAL

18 abiertos        3 alta/urgente       2 sin clasificar
6 esperando        más antiguo 8d 4h

──────────────────────────────────────────────────────────────────

RENDIMIENTO · ÚLTIMOS 30 DÍAS

42 creados         39 resueltos          +3 backlog
34m 1ª respuesta   5h 18m resolución     3h 42m resolución neta
4,8% reabiertos

vs. periodo anterior
+12% tickets       -18% primera respuesta      +1 backlog

──────────────────────────────────────────────────────────────────

EVOLUCIÓN

Tickets creados / resueltos
             ───────────────────── gráfico temporal ─────────────

Backlog
             ───────────────────── gráfico temporal ─────────────

──────────────────────────────────────────────────────────────────

PRINCIPALES FOCOS

Desglose por: [ Categoría | Departamento | Tipo ]

Categoría        Tickets   %    Abiertos   Resolución mediana   Reaperturas
ERP / BC           18     43%       7           6h 14m              2
Hardware            8     19%       2           2h 03m              0
Accesos             6     14%       1              48m              0

──────────────────────────────────────────────────────────────────

DISTRIBUCIÓN

Por estado                         Por departamento
En curso        ███████  7         Comercial      ███████ 12
Esperando       █████    5         Producción     █████   8
Nuevo           ██       2         ...

──────────────────────────────────────────────────────────────────

ENVEJECIMIENTO DEL BACKLOG

< 1 día         █████████  8
1-3 días        ██████     5
3-7 días        ███        3
7-14 días       ██         2
> 14 días       █          1

──────────────────────────────────────────────────────────────────

REQUIERE ATENCIÓN

PANDO-128   Error BC14...             Urgente   abierto 4d 8h
PANDO-119   Problema VPN...           —         sin clasificar
PANDO-104   ...                                  reabierto 2 veces
```

---

# 3. Filtros

La cabecera debe tener una toolbar compacta.

## Periodo

- Últimos 7 días
- Últimos 30 días
- Últimos 90 días
- Este año
- Rango personalizado, si encaja bien con la arquitectura

Por defecto:

**Últimos 30 días**

## Filtros adicionales

- Departamento
- Categoría
- Tipo
- Prioridad

Los filtros deben afectar a las métricas correspondientes al periodo y a las tablas/gráficas.

No deben utilizarse como mecanismo de seguridad.

El acceso real a datos debe continuar dependiendo de Supabase RLS.

---

# 4. Estado actual

Esta sección representa **stock actual**, no actividad del periodo.

Por ejemplo, si se seleccionan "Últimos 30 días", un ticket abierto desde hace 45 días debe seguir apareciendo en el backlog actual.

Mostrar como mínimo:

- Tickets abiertos actualmente.
- Tickets abiertos con prioridad Alta o Urgente.
- Tickets esperando usuario o proveedor.
- Tickets sin clasificar completamente.
- Antigüedad del ticket abierto más antiguo.

## Tickets sin clasificar

Considerar tickets que tengan algún dato esencial pendiente, especialmente:

- `categoria_id IS NULL`
- `tipo_id IS NULL`
- `departamento_id IS NULL`

Adaptar la lógica a los nombres reales del esquema.

---

# 5. Rendimiento del periodo

Mostrar métricas correspondientes exclusivamente al periodo seleccionado.

## KPIs

- Tickets creados.
- Tickets resueltos.
- Variación neta de backlog = creados - resueltos.
- Tiempo medio de primera respuesta.
- Tiempo mediano de primera respuesta.
- Tiempo medio de resolución.
- Tiempo mediano de resolución.
- Tiempo neto de resolución atribuible a IT.
- Tasa de reapertura.

No es necesario que cada dato sea una card.

Puede agruparse de forma compacta:

```text
Primera respuesta
34m mediana
41m media

Resolución
5h 18m mediana
6h 03m media
```

---

# 6. Comparación con el periodo anterior

Para los KPIs principales, calcular el periodo anterior de la misma duración.

Ejemplo:

- Periodo actual: últimos 30 días.
- Periodo anterior: los 30 días inmediatamente anteriores.

Mostrar diferencias discretas:

```text
Tickets
42
+12% vs periodo anterior

Primera respuesta
34m
-18%
```

No interpretar cualquier incremento o decremento automáticamente como bueno o malo.

Ejemplos:

- más tiempo de respuesta = negativo;
- menos tiempo de respuesta = positivo;
- más tickets = neutral;
- más backlog = requiere atención.

Cuando el periodo anterior sea 0 o no exista base suficiente:

- mostrar `—`;
- o `Sin comparación`.

---

# 7. Evolución de entradas y resoluciones

Crear una gráfica temporal que responda:

> ¿Está entrando más trabajo del que somos capaces de resolver?

Representar:

- tickets creados;
- tickets resueltos.

Agrupación sugerida:

- 7 días → por día
- 30 días → por día
- 90 días → por semana si mejora la lectura
- año → por semana o mes según densidad

La gráfica debe ser limpia y sobria.

---

# 8. Evolución del backlog

Crear una serie temporal que responda:

> ¿La cola pendiente está creciendo o disminuyendo?

Debe reconstruirse correctamente con la información temporal disponible.

No calcular el histórico del backlog simplemente contando estados actuales.

Si `events` ofrece una fuente temporal más fiable, utilizarla.

Si no existe información suficiente para reconstruirlo correctamente, no inventar una aproximación silenciosa.

---

# 9. Visión por Categoría, Departamento y Tipo

Esta es una parte fundamental.

Debe existir una única sección analítica con selector:

```text
Desglose por:
[ Categoría | Departamento | Tipo ]
```

Por defecto:

**Categoría**

La tabla debe cambiar de dimensión sin crear tres módulos independientes.

## 9.1 Por Categoría

Permite responder:

- ¿Qué áreas tecnológicas generan más tickets?
- ¿Qué categorías acumulan más backlog?
- ¿Cuáles tardan más en resolverse?
- ¿Cuáles generan reaperturas?

Ejemplo:

| Categoría | Tickets | % | Abiertos | Mediana resolución | Reaperturas |
|---|---:|---:|---:|---:|---:|
| ERP / BC | 38 | 42% | 11 | 7h 20m | 4 |
| Hardware | 19 | 21% | 3 | 2h 14m | 0 |
| Accesos | 14 | 16% | 2 | 46m | 1 |

## 9.2 Por Departamento

Permite responder:

- ¿De dónde viene la carga de IT?
- ¿Qué departamento genera más tickets?
- ¿Qué departamento tiene más backlog?
- ¿Dónde se tarda más en resolver?

Ejemplo:

| Departamento | Tickets | % | Abiertos | Mediana resolución | Reaperturas |
|---|---:|---:|---:|---:|---:|
| Comercial | 27 | 30% | 8 | 5h 14m | 3 |
| Producción | 22 | 24% | 7 | 8h 02m | 2 |
| Administración | 17 | 19% | 2 | 1h 48m | 0 |

## 9.3 Por Tipo

Permite responder:

- ¿El trabajo de IT es principalmente reactivo?
- ¿Cuánto corresponde a incidencias?
- ¿Cuánto a solicitudes?
- ¿Cuánto a proyectos?

Ejemplo:

| Tipo | Tickets | % | Abiertos | Mediana resolución | Reaperturas |
|---|---:|---:|---:|---:|---:|
| Incidencia | 48 | 53% | 14 | 4h 32m | 5 |
| Solicitud | 29 | 32% | 5 | 1h 51m | 0 |
| Proyecto | 9 | 10% | 6 | 3d 4h | 1 |

---

# 10. Análisis cruzado

El selector de desglose debe ser independiente de los filtros superiores.

Esto permite cruzar dimensiones.

## Ejemplo 1

Filtro:

```text
Departamento = Producción
```

Desglose:

```text
Categoría
```

Resultado:

> Qué categorías generan tickets dentro de Producción.

## Ejemplo 2

Filtro:

```text
Categoría = ERP / BC
```

Desglose:

```text
Departamento
```

Resultado:

> Qué departamentos generan más tickets relacionados con ERP / BC.

## Ejemplo 3

Filtro:

```text
Tipo = Incidencia
```

Desglose:

```text
Categoría
```

Resultado:

> Qué categorías concentran más incidencias.

Este tipo de cruces es especialmente útil para detectar problemas recurrentes y justificar decisiones con datos.

---

# 11. Distribuciones

Añadir distribuciones compactas.

Como mínimo:

- Tickets por estado.
- Tickets por departamento.

Preferentemente mediante barras horizontales.

Ejemplo:

```text
En curso               ███████████  14
Esperando usuario      ███████       8
Nuevo                   ███          4
```

Opcional, si aporta valor:

- prioridad;
- tipo;
- origen email/manual.

Evitar donuts o pie charts salvo necesidad clara.

---

# 12. Envejecimiento del backlog

Responder a:

> ¿Cuánto tiempo llevan abiertos los tickets pendientes?

Buckets sugeridos:

- < 1 día
- 1-3 días
- 3-7 días
- 7-14 días
- > 14 días

Puede ajustarse si los datos reales sugieren una agrupación mejor.

---

# 13. Requiere atención

Crear una sección final operativa.

No utilizar IA ni una puntuación opaca.

Usar reglas transparentes.

Candidatos:

- prioridad Urgente y abierto;
- prioridad Alta con mucha antigüedad;
- sin primera respuesta;
- demasiado tiempo en Nuevo/Triaje;
- sin categoría;
- sin tipo;
- sin departamento;
- reabierto;
- especialmente antiguo.

Ejemplo:

```text
PANDO-128
Error impresión etiquetas BC14
Urgente · abierto 4d 8h

PANDO-119
Problema VPN
Sin clasificar · abierto 2d 3h

PANDO-104
...
Reabierto 2 veces
```

Cada fila debe enlazar al detalle del ticket.

Limitar la lista a unos 5-10 tickets.

---

# 14. Drill-down

Siempre que tenga sentido, los agregados deben llevar a los tickets que los forman.

Ejemplos:

```text
7 abiertos ERP / BC
→ /tickets filtrado por categoría y estado
```

```text
3 urgentes
→ /tickets filtrado por prioridad Urgente y tickets activos
```

Reutilizar el sistema actual de filtros por URL.

No crear una navegación paralela.

---

# 15. Roles y permisos

La página debe respetar el modelo de seguridad existente.

## Admin

Puede consultar todos los datos permitidos por su RLS.

## Dirección General

Puede consultar la visión global.

Es read-only.

## Responsable de departamento

Todos los KPIs, agregaciones y gráficas deben calcularse únicamente con los datos que su sesión Supabase pueda consultar.

No debe filtrarse solo en frontend.

Para este rol:

- no mostrar selector de Departamento si solo puede acceder al suyo;
- mostrar discretamente el departamento analizado;
- ocultar "Desglose por Departamento" si solo produciría una única fila.

## Empleado

No debe acceder a informes corporativos.

## Regla de seguridad

No utilizar `service_role` para generar informes.

Las estadísticas no deben permitir inferir datos que la RLS no permita consultar.

---

# 16. Estados vacíos y pocos datos

Actualmente puede haber solo 0, 1 o 2 tickets.

La página debe verse correctamente igualmente.

No rellenar con datos ficticios.

Ejemplos:

```text
No hay suficientes datos para mostrar una tendencia todavía.
```

```text
Cuando haya más tickets podrás comparar este periodo con el anterior.
```

No mostrar gráficas enormes sin valor cuando la muestra es mínima.

---

# 17. Rendimiento

La implementación debe estar preparada para crecer.

No descargar miles de tickets al navegador para calcular estadísticas en cliente.

Preferir:

- Server Components;
- consultas agregadas;
- helpers server-side;
- RPC SQL cuando aporte una ventaja clara.

No introducir SQL complejo innecesario.

Mantener RLS.

Si se crea una función RPC PostgreSQL, verificar que no pueda saltarse la seguridad de Responsable de departamento.

---

# 18. Gráficas

Antes de instalar nada, revisar dependencias actuales.

Si ya existe una librería adecuada, reutilizarla.

Si no:

- valorar SVG/CSS para gráficas simples;
- o añadir una librería ligera y mantenida.

No introducir una librería enorme para unas pocas visualizaciones.

Todas las gráficas deben:

- respetar el diseño Pando;
- disponer de tooltip accesible;
- tener labels legibles;
- funcionar bien en desktop;
- degradarse correctamente en mobile;
- no depender exclusivamente del color.

---

# 19. Diseño visual

La pantalla debe seguir el diseño actual de Pando Helpdesk.

## Personalidad

- minimalista;
- sobria;
- limpia;
- precisa;
- desktop-first;
- alta densidad de información;
- datos como protagonistas.

Referencia conceptual:

**Pando × Linear × Vercel × Notion**

## Evitar

- dashboard genérico;
- cards gigantes;
- sombras fuertes;
- gradientes;
- números enormes;
- donuts por todas partes;
- iconos decorativos;
- fondos multicolor;
- widgets dentro de widgets;
- aspecto de SaaS financiero.

## Preferir

- whitespace;
- líneas divisorias;
- jerarquía tipográfica;
- barras compactas;
- tablas;
- pequeñas variaciones;
- información muy legible.

---

# 20. SLA

No inventar objetivos.

No mostrar:

- `SLA 95%`
- `SLA incumplido`
- `Primera respuesta objetivo: 4h`

salvo que exista ya una configuración real en el proyecto.

Puede añadirse en una fase posterior cuando se defina formalmente el objetivo.

---

# 21. Prompt completo para el agente de Visual Studio

Copia y pega el siguiente bloque en el agente:

---

```text
Quiero rediseñar e implementar completamente la página `/informes` de Pando Helpdesk.

Antes de modificar nada, analiza el proyecto existente, especialmente:

- `app/(agente)/informes` o la ruta equivalente actual.
- Las queries actuales utilizadas por `/informes`.
- El esquema real de `tickets`.
- Las migraciones Supabase.
- Las columnas temporales actualmente disponibles.
- La tabla `events`.
- Los catálogos `categorias`, `tipos` y `departamentos`.
- El sistema actual de roles y RLS.
- Los componentes reutilizables existentes.
- Las dependencias disponibles para gráficas.
- El sistema visual existente de Pando Helpdesk.

NO quiero simplemente embellecer el informe actual.

Quiero convertir `/informes` en una pantalla de análisis operativo que permita entender de un vistazo:

1. estado actual del soporte;
2. carga de trabajo;
3. evolución del volumen;
4. capacidad de resolución;
5. tiempos de respuesta;
6. envejecimiento del backlog;
7. categorías/departamentos/tipos que generan más incidencias;
8. posibles puntos débiles;
9. tickets que requieren atención.

La finalidad de esta pantalla es poder utilizar datos reales del Helpdesk tanto para gestionar IT como para presentar una visión objetiva a Dirección.

No quiero un dashboard genérico lleno de cards, donuts y colores.

Debe respetar estrictamente la identidad actual de Pando Helpdesk:

- minimalista;
- sobria;
- muy limpia;
- desktop-first;
- alta densidad de información;
- fondo claro;
- negro/antracita como identidad;
- colores únicamente con significado semántico;
- bordes sutiles;
- prácticamente sin sombras;
- gráficas solamente cuando respondan una pregunta concreta;
- datos como protagonistas.

Debe sentirse como:

Pando × Linear × Vercel × Notion

y NO como una plantilla de dashboard de administración.

==================================================
1. FILTROS DEL INFORME
==================================================

Añade en la cabecera una toolbar compacta de filtros.

Periodo:

- Últimos 7 días
- Últimos 30 días
- Últimos 90 días
- Este año
- Si resulta sencillo con la arquitectura actual, rango personalizado

Por defecto:

Últimos 30 días.

Añadir también filtros, si los datos y permisos actuales lo permiten:

- Departamento
- Categoría
- Tipo
- Prioridad

No quiero una zona enorme de filtros.

Deben estar en una única toolbar compacta.

Los filtros deben afectar a TODAS las métricas y gráficas del periodo.

IMPORTANTE:

No implementar seguridad mediante estos filtros.

El ámbito de datos accesible debe seguir dependiendo de las políticas RLS existentes de Supabase.

Admin / Dirección General:
pueden trabajar con todos los tickets permitidos por su RLS.

Responsable de departamento:
TODOS los KPIs, agregaciones y gráficas deben calcularse exclusivamente con los tickets que devuelve su sesión Supabase.

No utilizar `service_role` para construir los informes.

Empleado no debe tener acceso a `/informes`, conforme al sistema actual.

==================================================
2. SECCIÓN "ESTADO ACTUAL"
==================================================

Primera sección después de la cabecera.

No utilizar cards gigantes.

Mostrar KPIs compactos en una fila o grid discreto.

Quiero como mínimo:

- Tickets abiertos actualmente.
- Tickets abiertos con prioridad Alta o Urgente.
- Tickets esperando usuario/proveedor.
- Tickets sin clasificar completamente.
- Antigüedad del ticket abierto más antiguo.

Considerar como backlog todos los tickets que todavía no estén en estados terminales.

Revisa los estados reales existentes antes de implementar la definición.

Estados terminales previsibles:

- cerrado
- cancelado

Analiza si `resuelto` debe considerarse todavía backlog o no según el comportamiento actual de la aplicación y utiliza la decisión más coherente con el flujo existente.

Tickets "sin clasificar":

considerar los tickets que tengan algún dato esencial de triaje pendiente, especialmente:

- categoria_id NULL
- tipo_id NULL
- departamento_id NULL

No inventes columnas.

Adapta la lógica al esquema real.

Estos KPIs representan el ESTADO ACTUAL y por tanto no deben limitarse necesariamente al periodo seleccionado cuando conceptualmente representan stock actual.

==================================================
3. SECCIÓN "RENDIMIENTO DEL PERIODO"
==================================================

Mostrar una segunda fila de KPIs correspondiente exclusivamente al periodo seleccionado.

Quiero:

- Tickets creados.
- Tickets resueltos.
- Variación neta de backlog = creados - resueltos.
- Tiempo medio de primera respuesta.
- Tiempo MEDIANO de primera respuesta.
- Tiempo medio de resolución.
- Tiempo MEDIANO de resolución.
- Tiempo de resolución neto atribuible a IT, utilizando `espera_segundos` si el esquema actual permite calcularlo correctamente.
- Tasa de reapertura.

No mostrar necesariamente todos como elementos visuales independientes si genera demasiado ruido.

Agrupa de manera inteligente.

La MEDIANA debe tener más protagonismo que la media cuando sea razonable.

Revisa las columnas reales disponibles.

No inventes timestamps.

Si una métrica no puede calcularse correctamente con el modelo actual, NO simules el dato.

Indícalo al terminar la tarea.

==================================================
4. COMPARACIÓN CON EL PERIODO ANTERIOR
==================================================

Para los KPIs principales del periodo, calcula el periodo inmediatamente anterior de la misma duración.

Mostrar pequeñas variaciones discretas.

No utilizar verde/rojo automáticamente para cualquier incremento/decremento.

El significado depende del KPI.

Evitar divisiones absurdas cuando el periodo anterior sea 0.

Mostrar "—" o "Sin comparación" cuando corresponda.

==================================================
5. EVOLUCIÓN DE ENTRADAS Y RESOLUCIONES
==================================================

Crear una gráfica temporal principal que responda:

"¿Está entrando más trabajo del que somos capaces de resolver?"

Representar:

- tickets creados;
- tickets resueltos.

En el mismo eje temporal.

Agrupación recomendada:

7 días:
por día

30 días:
por día

90 días:
por semana, si visualmente tiene más sentido

año:
por mes o semana según densidad

Debe ser una gráfica limpia y muy sobria.

No usar degradados decorativos.

Tooltip sencillo con valores exactos.

==================================================
6. EVOLUCIÓN DEL BACKLOG
==================================================

Quiero poder responder:

"¿La cola pendiente está creciendo o disminuyendo?"

Implementa una serie temporal del backlog si puede calcularse correctamente con las fechas existentes.

No infieras la evolución histórica contando únicamente estados presentes si eso produce datos incorrectos.

Si `events` ofrece una fuente temporal más fiable para reconstruir el backlog, utilízala.

Si no existe información suficiente para reconstruirlo sin errores, explícame la limitación antes de inventar una implementación aproximada.

==================================================
7. PRINCIPALES FOCOS
==================================================

Esta debe ser una de las partes más importantes de `/informes`.

Añadir un selector compacto:

Desglose por:
[ Categoría | Departamento | Tipo ]

Por defecto:
Categoría.

Al cambiar la dimensión, recalcular la misma tabla utilizando ese eje.

Las columnas serán conceptualmente:

Dimensión
Tickets
% del total
Abiertos actualmente
Mediana de resolución
Reaperturas

Ejemplo Categoría:

ERP / BC       18    43%     7 abiertos     6h 14m     2
Hardware        8    19%     2 abiertos     2h 03m     0
Accesos         6    14%     1 abierto         48m     0

Ejemplo Departamento:

Comercial       27    30%     8 abiertos     5h 14m     3
Producción      22    24%     7 abiertos     8h 02m     2

Ejemplo Tipo:

Incidencia      48    53%    14 abiertos     4h 32m     5
Solicitud       29    32%     5 abiertos     1h 51m     0
Proyecto         9    10%     6 abiertos     3d 4h      1

Ordenar inicialmente por número de tickets descendente.

El selector "Desglose por" es independiente de los filtros superiores.

Esto debe permitir análisis cruzados.

Ejemplos:

Filtro:
Departamento = Producción

Desglose:
Categoría

=> muestra qué categorías generan tickets dentro de Producción.

Filtro:
Categoría = ERP / BC

Desglose:
Departamento

=> muestra qué departamentos generan más tickets relacionados con ERP / BC.

Filtro:
Tipo = Incidencia

Desglose:
Categoría

=> muestra qué categorías generan más incidencias.

Todos los KPIs y la tabla deben respetar simultáneamente:

1. periodo seleccionado;
2. filtros activos;
3. ámbito permitido por RLS.

Para un Responsable de departamento:

- no mostrar el filtro Departamento si solo puede acceder a uno;
- mostrar de forma discreta el departamento que está consultando;
- si "Desglose por Departamento" solo produciría una única fila, ocultar esa opción porque no aporta información.

Para Admin y Dirección General:
permitir el análisis completo por departamento.

No crear tres tablas distintas.

Debe ser un único componente analítico reutilizable cuya dimensión cambia.

==================================================
8. DISTRIBUCIONES
==================================================

Añadir una zona secundaria con distribuciones útiles.

Como mínimo:

Tickets por estado
Tickets por departamento

Utilizar preferentemente barras horizontales compactas.

Evitar donuts/pie charts salvo que exista una justificación excepcional.

Si el usuario actual solo puede ver un departamento mediante RLS, no tiene sentido mostrar una gráfica departamental con un único valor.

En ese caso adapta la interfaz y evita bloques inútiles.

Opcional, si no sobrecarga:

- distribución por prioridad;
- distribución por tipo;
- origen email/manual.

==================================================
9. ENVEJECIMIENTO DEL BACKLOG
==================================================

Añadir una visualización compacta para responder:

"¿Cuánto tiempo llevan abiertos los tickets pendientes?"

Crear buckets de antigüedad.

Ejemplo conceptual:

< 1 día
1-3 días
3-7 días
7-14 días
> 14 días

Adapta los rangos si encuentras una agrupación más útil.

==================================================
10. "REQUIERE ATENCIÓN"
==================================================

Crear al final una sección operativa llamada:

"Requiere atención"

Debe mostrar una pequeña lista priorizada de tickets que merezcan revisión.

No crear una puntuación arbitraria de IA.

Utilizar reglas transparentes basadas en datos reales.

Posibles razones:

- prioridad Urgente todavía abierto;
- prioridad Alta con mucha antigüedad;
- ticket sin primera respuesta;
- ticket todavía en Nuevo/Triaje durante demasiado tiempo;
- ticket sin categoría/tipo/departamento;
- ticket reabierto;
- ticket especialmente antiguo.

No inventes un SLA si todavía no existe.

Cada fila debe enlazar al detalle real del ticket.

Limitar la lista, por ejemplo, a los 5-10 elementos más relevantes.

==================================================
11. INTERACTIVIDAD / DRILL DOWN
==================================================

Cuando sea razonable, los datos agregados deben permitir llegar a los tickets que los forman.

Ejemplos:

clic en "7 abiertos ERP / BC"
-> `/tickets` filtrado por categoría ERP/BC y estado correspondiente.

clic en "3 urgentes"
-> `/tickets` con prioridad Urgente y tickets activos.

Reutiliza el sistema actual de filtros mediante URL de `/tickets`.

No implementes navegación paralela si ya existe esa funcionalidad.

==================================================
12. ESTADOS VACÍOS Y POCOS DATOS
==================================================

Actualmente el proyecto está en desarrollo y puede haber únicamente 2 tickets.

La pantalla debe funcionar bien con:

- 0 tickets;
- 1 ticket;
- 2 tickets;
- cientos o miles de tickets.

No quiero que con pocos datos aparezcan gráficas absurdas ocupando toda la página.

Para datasets insuficientes utiliza estados vacíos discretos.

Nunca utilizar datos ficticios.

==================================================
13. RENDIMIENTO
==================================================

La implementación debe estar pensada para crecer.

No quiero descargar miles de tickets completos al navegador para calcular allí todas las estadísticas.

Los cálculos deben realizarse preferentemente en servidor.

Analiza qué estrategia encaja mejor con la arquitectura actual:

- consultas agregadas;
- Server Component;
- helper server-side;
- RPC SQL de Supabase si aporta una mejora clara;
- combinación de varias queries razonables.

No introduzcas funciones SQL complejas innecesariamente.

Conserva RLS.

Si creas una función RPC PostgreSQL utilizada por usuarios autenticados, verifica explícitamente que NO permita saltarse las políticas de acceso de Responsable de departamento.

No utilices `service_role`.

==================================================
14. GRÁFICAS
==================================================

Primero revisa si el proyecto ya dispone de una librería de charts.

Si existe una adecuada, reutilízala.

Si no existe, decide entre:

- implementar gráficas simples con SVG/CSS;
- añadir una dependencia ligera y mantenida.

No añadas una librería enorme para tres gráficas sencillas sin necesidad.

Todas las gráficas deben:

- respetar el diseño Pando;
- tener tooltip accesible;
- tener labels legibles;
- funcionar en desktop;
- degradarse correctamente en pantallas pequeñas;
- no depender exclusivamente del color.

==================================================
15. DISEÑO
==================================================

Respeta el sistema visual existente.

No rehagas sidebar ni layout global.

No cambies el estilo de otras páginas salvo componentes compartidos que necesiten una mejora compatible.

Mantén el lenguaje visual actual:

- fondo claro;
- superficies blancas;
- gris neutro;
- negro Pando;
- Geist;
- bordes sutiles;
- muy pocas sombras;
- alta legibilidad.

No abuses de cards.

Una sección puede estar delimitada simplemente por:

- whitespace;
- border-top;
- jerarquía tipográfica.

No quiero:

- ocho cards grandes en la cabecera;
- sombras fuertes;
- gradientes;
- donuts por todas partes;
- números gigantes;
- iconos decorativos;
- fondos multicolor;
- diseño de SaaS financiero;
- widgets dentro de widgets.

==================================================
16. RESPONSIVE
==================================================

Mantener filosofía desktop-first.

Desktop:
experiencia completa.

Tablet:
los bloques pueden reorganizarse.

Mobile:
debe seguir siendo legible, aunque no sea la experiencia prioritaria.

No reduzcas la densidad del diseño desktop para facilitar mobile.

==================================================
17. IMPLEMENTACIÓN
==================================================

Trabaja de forma incremental.

Antes de modificar código:

1. inspecciona la implementación actual de `/informes`;
2. inspecciona el esquema real;
3. identifica qué timestamps existen;
4. identifica cómo se calcula actualmente primera respuesta;
5. identifica `espera_segundos`;
6. inspecciona `events`;
7. inspecciona los filtros actuales de `/tickets`;
8. inspecciona RLS y roles;
9. inspecciona componentes visuales reutilizables;
10. inspecciona las dependencias.

Después diseña internamente la implementación mínima necesaria.

NO reescribas partes que ya funcionan sin necesidad.

No hagas cambios destructivos en base de datos.

Si necesitas modificar BD:

- siempre mediante una nueva migración en `supabase/migrations/`;
- no modificar migraciones históricas;
- no debilitar RLS.

==================================================
18. DEFINICIONES Y CONSISTENCIA
==================================================

Centraliza las definiciones de las métricas.

No quiero que un componente considere "abierto" de una manera y otro de otra.

Crea helpers reutilizables para conceptos como:

- estados activos;
- estados terminales;
- duración;
- primera respuesta;
- resolución;
- resolución neta;
- periodo actual;
- periodo anterior;
- formato de duraciones.

Usa tipos TypeScript estrictos.

No utilizar `any`.

Evitar duplicar lógica de fechas.

Ten especial cuidado con:

- timezone;
- timestamps NULL;
- división por cero;
- periodos sin datos;
- tickets todavía no resueltos;
- tickets sin primera respuesta;
- reaperturas;
- tickets sin clasificación.

==================================================
19. NO IMPLEMENTAR SLA INVENTADO
==================================================

Actualmente NO quiero que inventes objetivos como:

"primera respuesta inferior a 4 horas"

o:

"SLA 95%"

Si el código ya tiene un SLA real configurado, puedes reutilizarlo.

Si no existe, no implementar métricas de cumplimiento SLA.

Podemos añadirlo en una fase posterior.

==================================================
20. VALIDACIÓN
==================================================

Una vez implementado:

ejecuta:

- typecheck;
- lint;
- tests existentes;
- build.

Corrige los problemas encontrados.

Comprueba también manualmente desde el código los siguientes escenarios:

0 tickets
2 tickets
muchos tickets conceptualmente

Admin
Dirección General
Responsable de departamento

En particular verifica que Responsable de departamento nunca pueda provocar que una agregación revele datos de otro departamento.

==================================================
21. RESULTADO FINAL
==================================================

Cuando termines, dame un resumen conciso indicando:

1. enfoque utilizado;
2. archivos creados;
3. archivos modificados;
4. migraciones creadas, si existen;
5. queries/RPCs añadidas;
6. definición exacta de cada KPI;
7. comportamiento por roles;
8. librería de gráficas usada, si se añadió alguna;
9. limitaciones de datos detectadas;
10. resultado de typecheck;
11. resultado de lint;
12. resultado de tests;
13. resultado de build.

Si durante el análisis descubres que alguna de las métricas que pido NO puede calcularse correctamente con el modelo actual, no inventes una aproximación silenciosa.

Explícame:

- qué dato falta;
- para qué KPI;
- cuál sería el cambio mínimo necesario.

Prioridades:

1. exactitud de los datos;
2. respetar RLS;
3. utilidad real del informe;
4. simplicidad visual;
5. rendimiento;
6. menor cambio arquitectónico posible.
```

---

# 22. Idea central

La página debe ofrecer dos niveles:

## Nivel 1 — Visión global

Permite ver en segundos:

- cuánto trabajo hay;
- cuánto entra;
- cuánto se resuelve;
- cuánto tarda;
- cuánto backlog existe;
- si se está acumulando.

## Nivel 2 — Diagnóstico

Permite cortar los datos por:

- Categoría;
- Departamento;
- Tipo;

y cruzarlos mediante filtros.

Ejemplos útiles:

```text
ERP / BC → por Departamento
```

para saber qué áreas de la empresa concentran incidencias de BC.

```text
Producción → por Categoría
```

para saber qué problemas tecnológicos afectan más a Producción.

```text
Incidencia → por Categoría
```

para separar trabajo reactivo de solicitudes y proyectos.

La pantalla no debe ser un escaparate de gráficas.

Debe ser una herramienta para **entender, priorizar y justificar decisiones con datos**.
