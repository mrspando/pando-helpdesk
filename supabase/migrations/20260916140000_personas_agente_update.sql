-- Permite que un agente edite los datos de cualquier persona (nombre,
-- departamento, es_agente, activo) desde la nueva pantalla de Ajustes →
-- Personas. Hasta ahora `personas` solo tenía política de SELECT
-- (`personas_self`) — nadie podía editar estos campos vía la app, solo
-- a mano en el dashboard. No se añade INSERT/DELETE: las personas se
-- siguen creando únicamente por el trigger de alta en login (SSO), y no
-- se contempla borrarlas desde aquí (dejaría tickets huérfanos de
-- solicitante).

CREATE POLICY "personas_agente_update" ON "public"."personas"
  FOR UPDATE
  TO "authenticated"
  USING (public.is_agente())
  WITH CHECK (public.is_agente());
