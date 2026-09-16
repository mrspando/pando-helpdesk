-- Añade "Departamento" de ticket como tercer catálogo configurable,
-- mismo patrón que `tipos` (ver 20260916120000_add_tipos.sql): tabla
-- hermana de categorias/tipos, políticas de lectura + gestión por
-- agente, columna en tickets, y auditoría del cambio.
--
-- No confundir con `personas.departamento` (texto libre, el departamento
-- del propio empleado, usado en el pie del sidebar) — esto es un
-- catálogo aparte para clasificar a qué departamento afecta el ticket,
-- que el agente puede re-triar independientemente de quién lo pidió.

CREATE SEQUENCE "public"."departamentos_id_seq" AS smallint INCREMENT BY 1 MINVALUE 1 MAXVALUE 32767 START WITH 1 CACHE 1 NO CYCLE;
GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."departamentos_id_seq" TO "anon", "authenticated", "postgres", "service_role";

CREATE TABLE "public"."departamentos" (
  "id"     smallint NOT NULL DEFAULT nextval('public.departamentos_id_seq'::regclass),
  "nombre" text     NOT NULL,
  "activa" boolean  NOT NULL DEFAULT true,
  "orden"  smallint NOT NULL DEFAULT 0,
  CONSTRAINT "departamentos_pkey" PRIMARY KEY (id)
);
ALTER TABLE "public"."departamentos" ENABLE ROW LEVEL SECURITY;
ALTER SEQUENCE "public"."departamentos_id_seq" OWNED BY "public"."departamentos"."id";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."departamentos" TO "anon", "authenticated", "postgres", "service_role";

CREATE POLICY "departamentos_lectura" ON "public"."departamentos"
  FOR SELECT
  TO "authenticated"
  USING (activa);

CREATE POLICY "departamentos_agente" ON "public"."departamentos"
  FOR ALL
  TO "authenticated"
  USING (public.is_agente())
  WITH CHECK (public.is_agente());

ALTER TABLE "public"."tickets"
  ADD COLUMN "departamento_id" smallint REFERENCES public.departamentos(id);

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

  if new.departamento_id is distinct from old.departamento_id then
    insert into events (ticket_id, tipo, valor_anterior, valor_nuevo, actor_id)
    values (new.id, 'departamento', old.departamento_id::text, new.departamento_id::text, actor);
  end if;

  if new.agente_id is distinct from old.agente_id then
    insert into events (ticket_id, tipo, valor_anterior, valor_nuevo, actor_id)
    values (new.id, 'asignacion', old.agente_id::text, new.agente_id::text, actor);
  end if;

  return new;
end $function$;
