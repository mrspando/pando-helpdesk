-- La ficha de ticket de un empleado (/mis-tickets/[id]) pasa a mostrar
-- la misma pestaña "Cronología" que ya ve un agente (solo lectura),
-- para que un solicitante entienda por qué cambió el estado de su
-- ticket sin tener que preguntar. Hasta ahora `events` no tenía
-- ninguna política que cubriera al propio solicitante (solo
-- `events_agente` para admin y `events_lectura_extendida` para
-- Gerencia/Dirección) — un empleado no podía leer ni un solo evento,
-- ni siquiera de sus propios tickets.
--
-- Mismo patrón que `tickets_propios_select`/`messages_propios_select`:
-- solo sus propios tickets, y no depende de is_agente()/current_rol()
-- porque cualquier rol que ya vea el ticket por otra vía sigue
-- teniendo su propia política (esta simplemente añade la pieza que
-- faltaba para "es el solicitante de este ticket").
CREATE POLICY "events_propios_select" ON "public"."events"
  FOR SELECT
  TO "authenticated"
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = events.ticket_id
        AND t.solicitante_id = public.current_persona_id()
    )
  );
