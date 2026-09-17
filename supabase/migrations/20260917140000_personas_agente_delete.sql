-- `personas` nunca tuvo política de DELETE (solo SELECT y UPDATE) — con
-- RLS activado eso significa que nadie, ni siquiera Admin, podía borrar
-- una fila desde la app. La añadimos para el botón "Eliminar" de
-- Ajustes → Personas.
--
-- El borrado en sí seguirá fallando con violación de FK si esa persona
-- ya tiene tickets/mensajes/eventos asociados (las FK son RESTRICT a
-- propósito, para no perder historial de tickets) — la aplicación
-- captura ese error y sugiere desactivar en su lugar.

CREATE POLICY "personas_agente_delete" ON "public"."personas"
  FOR DELETE
  TO "authenticated"
  USING (is_admin());
