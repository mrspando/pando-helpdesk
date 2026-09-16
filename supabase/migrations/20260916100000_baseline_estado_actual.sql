-- Baseline: captura del esquema tal y como existe hoy en producción
-- (proyecto pando-helpdesk, generado con `supabase db pull --declarative`
-- y reordenado a mano en un único archivo de migración porque el modo
-- migración de la CLI requiere Docker/Podman para la shadow database,
-- no disponibles en esta máquina).
--
-- No inventado: cada bloque es una copia literal de lo que devolvió el
-- pull contra la base real. Ver supabase/README.md para el detalle de
-- las dos discrepancias encontradas frente a CONTEXT.md (RLS de
-- attachments y permisos INSERT de events).

-- ============================================================
-- Permisos de esquema
-- ============================================================

COMMENT ON SCHEMA "public" IS 'standard public schema';

REVOKE ALL ON SCHEMA "public" FROM PUBLIC;
GRANT USAGE ON SCHEMA "public" TO PUBLIC;

REVOKE ALL ON SCHEMA "public" FROM "anon";
GRANT USAGE ON SCHEMA "public" TO "anon";

REVOKE ALL ON SCHEMA "public" FROM "authenticated";
GRANT USAGE ON SCHEMA "public" TO "authenticated";

REVOKE ALL ON SCHEMA "public" FROM "pg_database_owner";
GRANT CREATE, USAGE ON SCHEMA "public" TO "pg_database_owner";

REVOKE ALL ON SCHEMA "public" FROM "postgres";
GRANT USAGE ON SCHEMA "public" TO "postgres";

REVOKE ALL ON SCHEMA "public" FROM "service_role";
GRANT USAGE ON SCHEMA "public" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT, UPDATE, USAGE ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT, UPDATE, USAGE ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT, UPDATE, USAGE ON SEQUENCES TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT EXECUTE ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT EXECUTE ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT EXECUTE ON FUNCTIONS TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLES TO "service_role";

-- ============================================================
-- Extensiones
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA "extensions";
COMMENT ON EXTENSION "pgcrypto" IS 'cryptographic functions';

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA "extensions";
COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';

CREATE EXTENSION IF NOT EXISTS "citext" SCHEMA "public";
COMMENT ON EXTENSION "citext" IS 'data type for case-insensitive character strings';

-- ============================================================
-- Tipos
-- ============================================================

CREATE TYPE "public"."estado_t" AS ENUM (
  'nuevo',
  'triaje',
  'en_curso',
  'esperando_usuario',
  'esperando_proveedor',
  'resuelto',
  'cerrado',
  'cancelado'
);
GRANT USAGE ON TYPE "public"."estado_t" TO "postgres";

CREATE TYPE "public"."prioridad_t" AS ENUM (
  'baja',
  'normal',
  'alta',
  'critica'
);
GRANT USAGE ON TYPE "public"."prioridad_t" TO "postgres";

-- ============================================================
-- Secuencias
-- ============================================================

CREATE SEQUENCE "public"."categorias_id_seq" AS smallint INCREMENT BY 1 MINVALUE 1 MAXVALUE 32767 START WITH 1 CACHE 1 NO CYCLE;
GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."categorias_id_seq" TO "anon", "authenticated", "postgres", "service_role";

CREATE SEQUENCE "public"."tickets_id_seq" AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;
GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."tickets_id_seq" TO "anon", "authenticated", "postgres", "service_role";

CREATE SEQUENCE "public"."messages_id_seq" AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;
GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."messages_id_seq" TO "anon", "authenticated", "postgres", "service_role";

CREATE SEQUENCE "public"."events_id_seq" AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;
GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."events_id_seq" TO "anon", "authenticated", "postgres", "service_role";

CREATE SEQUENCE "public"."attachments_id_seq" AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;
GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."attachments_id_seq" TO "anon", "authenticated", "postgres", "service_role";

CREATE SEQUENCE "public"."email_ingesta_id_seq" AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;
GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."email_ingesta_id_seq" TO "anon", "authenticated", "postgres", "service_role";

-- ============================================================
-- Tablas (estructura, RLS on, índices, grants — políticas y
-- triggers van en sus propias secciones más abajo porque
-- dependen de funciones que aún no existen en este punto)
-- ============================================================

CREATE TABLE "public"."categorias" (
  "id"     smallint NOT NULL DEFAULT nextval('public.categorias_id_seq'::regclass),
  "nombre" text     NOT NULL,
  "activa" boolean  NOT NULL DEFAULT true,
  "orden"  smallint NOT NULL DEFAULT 0,
  CONSTRAINT "categorias_pkey" PRIMARY KEY (id)
);
ALTER TABLE "public"."categorias" ENABLE ROW LEVEL SECURITY;
ALTER SEQUENCE "public"."categorias_id_seq" OWNED BY "public"."categorias"."id";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."categorias" TO "anon", "authenticated", "postgres", "service_role";

CREATE TABLE "public"."personas" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "email"        public.citext            NOT NULL,
  "nombre"       text,
  "departamento" text,
  "es_agente"    boolean                  NOT NULL DEFAULT false,
  "activo"       boolean                  NOT NULL DEFAULT true,
  "auth_user_id" uuid,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "personas_auth_user_id_fkey" FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT "personas_auth_user_id_key" UNIQUE (auth_user_id),
  CONSTRAINT "personas_email_key" UNIQUE (email),
  CONSTRAINT "personas_pkey" PRIMARY KEY (id)
);
ALTER TABLE "public"."personas" ENABLE ROW LEVEL SECURITY;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."personas" TO "anon", "authenticated", "postgres", "service_role";

CREATE TABLE "public"."tickets" (
  "id"                bigint                   NOT NULL DEFAULT nextval('public.tickets_id_seq'::regclass),
  "titulo"            text                     NOT NULL,
  "descripcion"       text,
  "solicitante_id"    uuid                     NOT NULL,
  "agente_id"         uuid,
  "categoria_id"      smallint,
  "origen"            text                     NOT NULL DEFAULT 'email'::text,
  "conversation_id"   text,
  "bloquea_trabajo"   boolean                  NOT NULL DEFAULT false,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "triaged_at"        timestamp with time zone,
  "first_response_at" timestamp with time zone,
  "resolved_at"       timestamp with time zone,
  "closed_at"         timestamp with time zone,
  "reopened_at"       timestamp with time zone,
  "reopen_count"      smallint                 NOT NULL DEFAULT 0,
  "due_at"            timestamp with time zone,
  "espera_segundos"   integer                  NOT NULL DEFAULT 0,
  "espera_desde"      timestamp with time zone,
  "deleted_at"        timestamp with time zone,
  CONSTRAINT "tickets_agente_id_fkey" FOREIGN KEY (agente_id) REFERENCES public.personas(id),
  CONSTRAINT "tickets_categoria_id_fkey" FOREIGN KEY (categoria_id) REFERENCES public.categorias(id),
  CONSTRAINT "tickets_pkey" PRIMARY KEY (id),
  CONSTRAINT "tickets_solicitante_id_fkey" FOREIGN KEY (solicitante_id) REFERENCES public.personas(id)
);
ALTER TABLE "public"."tickets" ENABLE ROW LEVEL SECURITY;
ALTER SEQUENCE "public"."tickets_id_seq" OWNED BY "public"."tickets"."id";

ALTER TABLE "public"."tickets" ADD COLUMN "ref" text GENERATED ALWAYS AS (('PANDO-'::text || (id)::text)) STORED;
ALTER TABLE "public"."tickets" ADD COLUMN "estado" public.estado_t NOT NULL DEFAULT 'nuevo'::public.estado_t;
ALTER TABLE "public"."tickets" ADD COLUMN "prioridad" public.prioridad_t NOT NULL DEFAULT 'normal'::public.prioridad_t;

CREATE INDEX idx_tickets_cola ON public.tickets USING btree (estado, prioridad, created_at DESC);
CREATE INDEX idx_tickets_conversation ON public.tickets USING btree (conversation_id);
CREATE INDEX idx_tickets_solicitante ON public.tickets USING btree (solicitante_id);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tickets" TO "anon", "authenticated", "postgres", "service_role";

CREATE TABLE "public"."messages" (
  "id"               bigint                   NOT NULL DEFAULT nextval('public.messages_id_seq'::regclass),
  "ticket_id"        bigint                   NOT NULL,
  "direccion"        text                     NOT NULL,
  "autor_id"         uuid,
  "cuerpo_texto"     text                     NOT NULL,
  "cuerpo_html"      text,
  "es_nota_interna"  boolean                  NOT NULL DEFAULT false,
  "graph_message_id" text,
  "enviado_at"       timestamp with time zone,
  "created_at"       timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "messages_direccion_check" CHECK ((direccion = ANY (ARRAY['entrante'::text, 'saliente'::text]))),
  CONSTRAINT "messages_graph_message_id_key" UNIQUE (graph_message_id),
  CONSTRAINT "messages_pkey" PRIMARY KEY (id),
  CONSTRAINT "messages_autor_id_fkey" FOREIGN KEY (autor_id) REFERENCES public.personas(id),
  CONSTRAINT "messages_ticket_id_fkey" FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE
);
ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;
ALTER SEQUENCE "public"."messages_id_seq" OWNED BY "public"."messages"."id";
CREATE INDEX idx_messages_ticket ON public.messages USING btree (ticket_id, created_at);
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."messages" TO "anon", "authenticated", "postgres", "service_role";

CREATE TABLE "public"."events" (
  "id"             bigint                   NOT NULL DEFAULT nextval('public.events_id_seq'::regclass),
  "ticket_id"      bigint                   NOT NULL,
  "tipo"           text                     NOT NULL,
  "valor_anterior" text,
  "valor_nuevo"    text,
  "actor_id"       uuid,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "events_pkey" PRIMARY KEY (id),
  CONSTRAINT "events_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES public.personas(id),
  CONSTRAINT "events_ticket_id_fkey" FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE
);
ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;
ALTER SEQUENCE "public"."events_id_seq" OWNED BY "public"."events"."id";
CREATE INDEX idx_events_ticket ON public.events USING btree (ticket_id, created_at);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."events" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."events" TO "postgres", "service_role";
REVOKE ALL ON TABLE "public"."events" FROM "authenticated";
GRANT DELETE, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."events" TO "authenticated";

CREATE TABLE "public"."attachments" (
  "id"           bigint                   NOT NULL DEFAULT nextval('public.attachments_id_seq'::regclass),
  "message_id"   bigint                   NOT NULL,
  "filename"     text                     NOT NULL,
  "mime_type"    text,
  "size_bytes"   integer,
  "storage_path" text                     NOT NULL,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "attachments_pkey" PRIMARY KEY (id),
  CONSTRAINT "attachments_message_id_fkey" FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE
);
ALTER TABLE "public"."attachments" ENABLE ROW LEVEL SECURITY;
ALTER SEQUENCE "public"."attachments_id_seq" OWNED BY "public"."attachments"."id";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."attachments" TO "anon", "authenticated", "postgres", "service_role";

CREATE TABLE "public"."email_ingesta" (
  "id"               bigint                   NOT NULL DEFAULT nextval('public.email_ingesta_id_seq'::regclass),
  "graph_message_id" text                     NOT NULL,
  "remitente"        text,
  "asunto"           text,
  "resultado"        text                     NOT NULL,
  "motivo"           text,
  "ticket_id"        bigint,
  "recibido_at"      timestamp with time zone,
  "procesado_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "email_ingesta_graph_message_id_key" UNIQUE (graph_message_id),
  CONSTRAINT "email_ingesta_pkey" PRIMARY KEY (id),
  CONSTRAINT "email_ingesta_ticket_id_fkey" FOREIGN KEY (ticket_id) REFERENCES public.tickets(id)
);
ALTER TABLE "public"."email_ingesta" ENABLE ROW LEVEL SECURITY;
ALTER SEQUENCE "public"."email_ingesta_id_seq" OWNED BY "public"."email_ingesta"."id";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."email_ingesta" TO "anon", "authenticated", "postgres", "service_role";

-- ============================================================
-- Funciones
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_agente()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select exists (
    select 1 from personas
    where auth_user_id = auth.uid() and es_agente and activo
  );
$function$;
GRANT EXECUTE ON FUNCTION "public"."is_agente"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

CREATE OR REPLACE FUNCTION public.current_persona_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select coalesce(
    (select id from personas where auth_user_id = auth.uid()),
    nullif(current_setting('app.actor_id', true), '')::uuid
  );
$function$;
GRANT EXECUTE ON FUNCTION "public"."current_persona_id"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

CREATE OR REPLACE FUNCTION public.tg_alta_persona_desde_auth()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  insert into personas (email, nombre, auth_user_id, es_agente)
  values (new.email, new.raw_user_meta_data->>'name', new.id, false)
  on conflict (email) do update set auth_user_id = excluded.auth_user_id;
  return new;
end $function$;
GRANT EXECUTE ON FUNCTION "public"."tg_alta_persona_desde_auth"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

CREATE OR REPLACE FUNCTION public.tg_tickets_alta()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
begin
  insert into events (ticket_id, tipo, valor_nuevo, actor_id)
  values (new.id, 'creacion', new.origen, current_persona_id());
  return new;
end $function$;
GRANT EXECUTE ON FUNCTION "public"."tg_tickets_alta"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

CREATE OR REPLACE FUNCTION public.tg_tickets_audit()
  RETURNS TRIGGER
  LANGUAGE plpgsql
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

  if new.agente_id is distinct from old.agente_id then
    insert into events (ticket_id, tipo, valor_anterior, valor_nuevo, actor_id)
    values (new.id, 'asignacion', old.agente_id::text, new.agente_id::text, actor);
  end if;

  return new;
end $function$;
GRANT EXECUTE ON FUNCTION "public"."tg_tickets_audit"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

CREATE OR REPLACE FUNCTION public.tg_first_response()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
begin
  if new.direccion = 'saliente' and not new.es_nota_interna then
    update tickets
       set first_response_at = now()
     where id = new.ticket_id
       and first_response_at is null;
  end if;
  return new;
end $function$;
GRANT EXECUTE ON FUNCTION "public"."tg_first_response"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
begin
  new.updated_at := now();
  return new;
end $function$;
GRANT EXECUTE ON FUNCTION "public"."tg_touch_updated_at"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

-- ============================================================
-- Triggers
-- ============================================================

CREATE TRIGGER t_alta_persona
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_alta_persona_desde_auth();

CREATE TRIGGER t_tickets_alta
  AFTER INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_tickets_alta();

CREATE TRIGGER t_tickets_audit
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_tickets_audit();

CREATE TRIGGER t_tickets_touch
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_touch_updated_at();

CREATE TRIGGER t_first_response
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_first_response();

-- ============================================================
-- Políticas RLS
-- ============================================================

CREATE POLICY "categorias_lectura" ON "public"."categorias"
  FOR SELECT
  TO "authenticated"
  USING (activa);

CREATE POLICY "personas_self" ON "public"."personas"
  FOR SELECT
  TO "authenticated"
  USING (((auth_user_id = auth.uid()) OR public.is_agente()));

CREATE POLICY "tickets_agente" ON "public"."tickets"
  FOR ALL
  TO "authenticated"
  USING (public.is_agente())
  WITH CHECK (public.is_agente());

CREATE POLICY "tickets_propios_insert" ON "public"."tickets"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((solicitante_id = public.current_persona_id()) AND (estado = 'nuevo'::public.estado_t)));

CREATE POLICY "tickets_propios_select" ON "public"."tickets"
  FOR SELECT
  TO "authenticated"
  USING (((solicitante_id = public.current_persona_id()) AND (deleted_at IS NULL)));

CREATE POLICY "messages_agente" ON "public"."messages"
  FOR ALL
  TO "authenticated"
  USING (public.is_agente())
  WITH CHECK (public.is_agente());

CREATE POLICY "messages_propios_insert" ON "public"."messages"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((direccion = 'entrante'::text) AND (NOT es_nota_interna) AND (EXISTS ( SELECT 1
   FROM public.tickets t
  WHERE ((t.id = messages.ticket_id) AND (t.solicitante_id = public.current_persona_id()))))));

CREATE POLICY "messages_propios_select" ON "public"."messages"
  FOR SELECT
  TO "authenticated"
  USING (((NOT es_nota_interna) AND (EXISTS ( SELECT 1
   FROM public.tickets t
  WHERE ((t.id = messages.ticket_id) AND (t.solicitante_id = public.current_persona_id()))))));

CREATE POLICY "events_agente" ON "public"."events"
  FOR SELECT
  TO "authenticated"
  USING (public.is_agente());

-- NOTA: esta política no filtra por propiedad del ticket ni por
-- es_nota_interna del mensaje asociado — ver discrepancia documentada
-- en supabase/README.md frente a CONTEXT.md.
CREATE POLICY "attachments_visibles" ON "public"."attachments"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.messages m
  WHERE (m.id = attachments.message_id))));

-- email_ingesta no tiene ninguna política: con RLS activado y sin
-- policies, queda denegado por defecto para "anon"/"authenticated";
-- solo postgres/service_role pueden leerla o escribirla.

-- ============================================================
-- Vistas
-- ============================================================

CREATE VIEW "public"."v_tickets_metricas" AS  SELECT id,
    ref,
    titulo,
    descripcion,
    solicitante_id,
    agente_id,
    categoria_id,
    prioridad,
    estado,
    origen,
    conversation_id,
    bloquea_trabajo,
    created_at,
    updated_at,
    triaged_at,
    first_response_at,
    resolved_at,
    closed_at,
    reopened_at,
    reopen_count,
    due_at,
    espera_segundos,
    espera_desde,
    deleted_at,
    (espera_segundos +
        CASE
            WHEN (espera_desde IS NOT NULL) THEN (EXTRACT(epoch FROM (now() - espera_desde)))::integer
            ELSE 0
        END) AS espera_total_seg,
    (EXTRACT(epoch FROM (COALESCE(resolved_at, now()) - created_at)))::integer AS bruto_seg
   FROM public.tickets t
  WHERE (deleted_at IS NULL);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."v_tickets_metricas" TO "anon", "authenticated", "postgres", "service_role";
