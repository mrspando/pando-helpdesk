-- Guarda quién recibió realmente cada mensaje saliente (para poder
-- añadir destinatarios manuales y copia desde el composer, y dejar
-- rastro de a quién se envió de verdad). Null para notas internas y
-- para los mensajes entrantes ya existentes.

ALTER TABLE "public"."messages" ADD COLUMN "destinatarios" text[];
ALTER TABLE "public"."messages" ADD COLUMN "copia" text[];
