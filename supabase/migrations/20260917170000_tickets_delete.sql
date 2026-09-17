-- Añade la opción de borrar un ticket por completo (Admin), incluyendo
-- todo su historial. `messages` y `events` ya tenían `ON DELETE CASCADE`
-- sobre `ticket_id` desde el baseline, y `attachments` cascada a su vez
-- desde `messages` — así que un `DELETE FROM tickets` ya se llevaba por
-- delante mensajes, eventos y adjuntos sin tocar nada más.
--
-- La única pieza que faltaba era `email_ingesta.ticket_id`: no tenía
-- ninguna acción `ON DELETE` (por defecto `NO ACTION`), así que borrar
-- un ticket que ya tuviera algún correo de ingesta asociado habría
-- fallado con una violación de FK. A diferencia de messages/events (que
-- SON el contenido del ticket y deben desaparecer con él),
-- `email_ingesta` es un log de auditoría de correos entrantes
-- procesados — tiene sentido conservar la fila del log aunque el
-- ticket al que apuntaba ya no exista, así que se cambia a
-- `ON DELETE SET NULL` en vez de CASCADE.
--
-- No hace falta ninguna política RLS nueva: `tickets_agente` (baseline)
-- ya es `FOR ALL` con `is_agente()`, así que Admin ya podía hacer
-- DELETE sobre `tickets` desde siempre.

ALTER TABLE "public"."email_ingesta"
  DROP CONSTRAINT "email_ingesta_ticket_id_fkey";

ALTER TABLE "public"."email_ingesta"
  ADD CONSTRAINT "email_ingesta_ticket_id_fkey"
  FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE SET NULL;
