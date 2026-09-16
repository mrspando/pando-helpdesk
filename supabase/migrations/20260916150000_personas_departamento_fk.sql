-- `personas.departamento` era texto libre, sin relación con el catálogo
-- `departamentos` que ya usan los tickets. Se sustituye por
-- `departamento_id` (misma relación que tickets.departamento_id), para
-- que el departamento de una persona sea uno de los valores gestionados
-- en Ajustes → Catálogos, no texto suelto que cada uno escribe distinto.
--
-- Antes de borrar la columna de texto, se intenta emparejar cada valor
-- existente con una fila de `departamentos` por nombre exacto, para no
-- perder en silencio lo que ya hubiera cargado a mano. Lo que no
-- encuentre pareja queda simplemente sin departamento (null), editable
-- después desde Ajustes → Personas.

ALTER TABLE "public"."personas"
  ADD COLUMN "departamento_id" smallint REFERENCES public.departamentos(id);

UPDATE "public"."personas" p
SET "departamento_id" = d.id
FROM "public"."departamentos" d
WHERE d.nombre = p.departamento;

ALTER TABLE "public"."personas"
  DROP COLUMN "departamento";
