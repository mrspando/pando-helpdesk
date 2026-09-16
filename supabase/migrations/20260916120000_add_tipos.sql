-- Añade "Tipo" de ticket (Incidencia / Solicitud / Proyecto, configurable
-- por el agente) como catálogo hermano de `categorias`, y las políticas
-- de escritura que permiten gestionar ambos catálogos (categorías y
-- tipos) desde la pantalla de Ajustes. Hasta ahora `categorias` solo
-- tenía política de lectura (`categorias_lectura`) — ningún rol podía
-- crear/editar/borrar categorías vía la app, solo a mano en el
-- dashboard. Se añade el mismo patrón "agente FOR ALL" que ya usan
-- tickets/messages.

CREATE SEQUENCE "public"."tipos_id_seq" AS smallint INCREMENT BY 1 MINVALUE 1 MAXVALUE 32767 START WITH 1 CACHE 1 NO CYCLE;
GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."tipos_id_seq" TO "anon", "authenticated", "postgres", "service_role";

CREATE TABLE "public"."tipos" (
  "id"     smallint NOT NULL DEFAULT nextval('public.tipos_id_seq'::regclass),
  "nombre" text     NOT NULL,
  "activa" boolean  NOT NULL DEFAULT true,
  "orden"  smallint NOT NULL DEFAULT 0,
  CONSTRAINT "tipos_pkey" PRIMARY KEY (id)
);
ALTER TABLE "public"."tipos" ENABLE ROW LEVEL SECURITY;
ALTER SEQUENCE "public"."tipos_id_seq" OWNED BY "public"."tipos"."id";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tipos" TO "anon", "authenticated", "postgres", "service_role";

CREATE POLICY "tipos_lectura" ON "public"."tipos"
  FOR SELECT
  TO "authenticated"
  USING (activa);

CREATE POLICY "tipos_agente" ON "public"."tipos"
  FOR ALL
  TO "authenticated"
  USING (public.is_agente())
  WITH CHECK (public.is_agente());

CREATE POLICY "categorias_agente" ON "public"."categorias"
  FOR ALL
  TO "authenticated"
  USING (public.is_agente())
  WITH CHECK (public.is_agente());

ALTER TABLE "public"."tickets"
  ADD COLUMN "tipo_id" smallint REFERENCES public.tipos(id);

CREATE OR REPLACE FUNCTION public.tg_tickets_audit()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
  actor uuid := current_persona_id();
begin
  if new.estado is distinct from old.estado then
    insert into events (ticket_id, tipo, valor_anterior, valor_nuevo, actor_id)
    values (new.id, 'estado', old.estado::text, new.estado::text, actor);

    if new.estado = 'triaje' and new.triaged_at is null then
      new.triaged_at := now();
    end if;
    if new.estado = 'resuelto' and new.resolved_at is null then
      new.resolved_at := now();
    end if;
    if new.estado = 'cerrado' and new.closed_at is null then
      new.closed_at := now();
    end if;

    -- Reapertura: limpia hitos de cierre y cuenta
    if old.estado in ('resuelto','cerrado')
       and new.estado not in ('resuelto','cerrado','cancelado') then
      new.reopened_at  := now();
      new.reopen_count := old.reopen_count + 1;
      new.resolved_at  := null;
      new.closed_at    := null;
    end if;

    -- Reloj neto: entra en espera
    if new.estado in ('esperando_usuario','esperando_proveedor')
       and old.estado not in ('esperando_usuario','esperando_proveedor') then
      new.espera_desde := now();
    end if;

    -- Reloj neto: sale de espera y acumula
    if old.estado in ('esperando_usuario','esperando_proveedor')
       and new.estado not in ('esperando_usuario','esperando_proveedor') then
      new.espera_segundos := old.espera_segundos
        + greatest(0, extract(epoch from now() - coalesce(old.espera_desde, now()))::int);
      new.espera_desde := null;
    end if;
  end if;

  if new.prioridad is distinct from old.prioridad then
    insert into events (ticket_id, tipo, valor_anterior, valor_nuevo, actor_id)
    values (new.id, 'prioridad', old.prioridad::text, new.prioridad::text, actor);
  end if;

  if new.categoria_id is distinct from old.categoria_id then
    insert into events (ticket_id, tipo, valor_anterior, valor_nuevo, actor_id)
    values (new.id, 'categoria', old.categoria_id::text, new.categoria_id::text, actor);
  end if;

  if new.tipo_id is distinct from old.tipo_id then
    insert into events (ticket_id, tipo, valor_anterior, valor_nuevo, actor_id)
    values (new.id, 'tipo', old.tipo_id::text, new.tipo_id::text, actor);
  end if;

  if new.agente_id is distinct from old.agente_id then
    insert into events (ticket_id, tipo, valor_anterior, valor_nuevo, actor_id)
    values (new.id, 'asignacion', old.agente_id::text, new.agente_id::text, actor);
  end if;

  return new;
end $function$;
