-- Fase 1 del sistema de roles (ver PERMISOS.md): modelo de datos +
-- funciones de seguridad + políticas reales de tickets/messages/events.
-- Todo esto es aditivo: no se toca `personas.es_agente` ni ningún
-- código de la aplicación en esta migración, así que el comportamiento
-- actual de Admin (hoy el único rol que existe de verdad) no cambia.
-- `es_agente` se retira en una fase posterior, cuando el frontend ya
-- lea `rol` en vez de ese booleano.

-- ============================================================
-- Modelo de rol
-- ============================================================

CREATE TYPE "public"."rol_persona" AS ENUM (
  'admin',
  'gerencia',
  'direccion',
  'empleado'
);

ALTER TABLE "public"."personas" ADD COLUMN "rol" public.rol_persona;

UPDATE "public"."personas"
SET "rol" = CASE WHEN es_agente THEN 'admin' ELSE 'empleado' END::public.rol_persona;

ALTER TABLE "public"."personas" ALTER COLUMN "rol" SET NOT NULL;
ALTER TABLE "public"."personas" ALTER COLUMN "rol" SET DEFAULT 'empleado';

GRANT USAGE ON TYPE "public"."rol_persona" TO "postgres";

-- ============================================================
-- Funciones de seguridad
--
-- Todas SECURITY DEFINER + search_path fijo: necesitan leer `personas`
-- para el usuario actual sin quedar atrapadas por la propia RLS de esa
-- tabla (evita recursión), y sin depender de qué permisos de tabla
-- tenga el rol que las invoca. Ninguna acepta parámetros que vengan de
-- fuera sin validar contra el ticket real.
-- ============================================================

-- Sustituye el cuerpo de is_agente() para que siga significando "es
-- admin" sin tocar las políticas que ya la usan (categorias_agente,
-- tipos_agente, departamentos_agente, personas_agente_update). Se
-- retira en la fase en que esas políticas se reescriban directamente
-- sobre is_admin().
CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select exists (
    select 1 from personas
    where auth_user_id = auth.uid() and rol = 'admin' and activo
  );
$function$;
GRANT EXECUTE ON FUNCTION "public"."is_admin"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

CREATE OR REPLACE FUNCTION public.is_agente()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select public.is_admin();
$function$;
GRANT EXECUTE ON FUNCTION "public"."is_agente"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

CREATE OR REPLACE FUNCTION public.current_rol()
  RETURNS public.rol_persona
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select rol from personas where auth_user_id = auth.uid() and activo;
$function$;
GRANT EXECUTE ON FUNCTION "public"."current_rol"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

CREATE OR REPLACE FUNCTION public.current_departamento_id()
  RETURNS smallint
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select departamento_id from personas where auth_user_id = auth.uid() and activo;
$function$;
GRANT EXECUTE ON FUNCTION "public"."current_departamento_id"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

-- Único punto donde vive la regla "¿puede este usuario ver este
-- ticket?". Gerencia ve todo; un Responsable de departamento ve los
-- de su departamento MÁS los que aún no tienen departamento asignado
-- (decisión explícita: no penalizar tickets sin triar); un empleado
-- solo los suyos. Admin no la necesita (tiene políticas FOR ALL
-- propias) pero se incluye por completitud/reuso futuro.
CREATE OR REPLACE FUNCTION public.can_view_ticket(p_ticket_id bigint)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select exists (
    select 1 from tickets t
    where t.id = p_ticket_id
      and t.deleted_at is null
      and (
        public.current_rol() in ('admin', 'gerencia')
        or (
          public.current_rol() = 'direccion'
          and (t.departamento_id = public.current_departamento_id() or t.departamento_id is null)
        )
        or (public.current_rol() = 'empleado' and t.solicitante_id = public.current_persona_id())
      )
  );
$function$;
GRANT EXECUTE ON FUNCTION "public"."can_view_ticket"(bigint) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

-- ============================================================
-- tickets — lectura extendida para Gerencia y Responsable de
-- departamento. Las políticas de Admin (tickets_agente) y Empleado
-- (tickets_propios_select / tickets_propios_insert) no se tocan: el
-- autoservicio de creación se deja tal cual, a propósito, para la
-- futura fase 2 de autoservicio.
-- ============================================================

CREATE POLICY "tickets_gerencia_select" ON "public"."tickets"
  FOR SELECT
  TO "authenticated"
  USING (current_rol() = 'gerencia' AND deleted_at IS NULL);

CREATE POLICY "tickets_direccion_select" ON "public"."tickets"
  FOR SELECT
  TO "authenticated"
  USING (
    current_rol() = 'direccion'
    AND deleted_at IS NULL
    AND (departamento_id = current_departamento_id() OR departamento_id IS NULL)
  );

-- ============================================================
-- messages / events — misma lectura extendida, siempre excluyendo
-- notas internas (Gerencia y Dirección nunca las ven, igual que un
-- solicitante) y siempre a través de can_view_ticket() para no
-- duplicar la lógica de alcance por departamento.
-- ============================================================

CREATE POLICY "messages_lectura_extendida" ON "public"."messages"
  FOR SELECT
  TO "authenticated"
  USING (
    NOT es_nota_interna
    AND current_rol() IN ('gerencia', 'direccion')
    AND can_view_ticket(ticket_id)
  );

CREATE POLICY "events_lectura_extendida" ON "public"."events"
  FOR SELECT
  TO "authenticated"
  USING (
    current_rol() IN ('gerencia', 'direccion')
    AND can_view_ticket(ticket_id)
  );

-- ============================================================
-- attachments — arregla el hueco ya documentado en supabase/README.md:
-- la política anterior (attachments_visibles) no comprobaba ni
-- propiedad del ticket ni nota interna. Se sustituye por una que
-- delega en can_view_ticket(), así que automáticamente respeta el
-- mismo alcance por rol/departamento que tickets y messages.
-- ============================================================

DROP POLICY IF EXISTS "attachments_visibles" ON "public"."attachments";

CREATE POLICY "attachments_lectura" ON "public"."attachments"
  FOR SELECT
  TO "authenticated"
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      WHERE m.id = attachments.message_id
        AND NOT m.es_nota_interna
        AND can_view_ticket(m.ticket_id)
    )
  );

-- ============================================================
-- email_ingesta — Admin puede leerla desde la app (antes no tenía
-- ninguna política, ni siquiera para el rol admin). Sigue sin GRANT de
-- escritura para ningún rol: solo triggers/service_role escriben ahí.
-- ============================================================

CREATE POLICY "email_ingesta_admin_select" ON "public"."email_ingesta"
  FOR SELECT
  TO "authenticated"
  USING (is_admin());
