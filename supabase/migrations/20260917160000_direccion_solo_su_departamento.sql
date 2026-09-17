-- Bug real reportado por el usuario: con el usuario de prueba de Ruth
-- Martínez (rol `direccion`, departamento Ventas) se veían tickets de
-- otros departamentos (p. ej. tickets de IT sin triar). Causa:
-- `tickets_direccion_select` y `can_view_ticket()` (ambas de
-- 20260917100000_roles_rls_fase1.sql) dejaban pasar también cualquier
-- ticket con `departamento_id IS NULL`, pensado en su momento para "no
-- penalizar tickets sin triar" — pero en la práctica un ticket sin
-- triar de OTRO departamento (no necesariamente del suyo) se mostraba
-- igualmente. PERMISOS.md pide igualdad estricta
-- (`tickets.departamento_id = usuario.departamento_id`), así que se
-- retira la excepción por completo: Responsable de departamento ahora
-- solo ve tickets ya asignados a su propio departamento. Los tickets
-- sin triar quedan reservados a Admin/Gerencia hasta que alguien les
-- asigne un departamento.

DROP POLICY IF EXISTS "tickets_direccion_select" ON "public"."tickets";

CREATE POLICY "tickets_direccion_select" ON "public"."tickets"
  FOR SELECT
  TO "authenticated"
  USING (
    current_rol() = 'direccion'
    AND deleted_at IS NULL
    AND departamento_id = current_departamento_id()
  );

-- Mismo ajuste en can_view_ticket(): messages_lectura_extendida,
-- events_lectura_extendida y attachments_lectura delegan en esta
-- función en vez de repetir la condición, así que si no se corrige
-- aquí también, Dirección seguiría viendo los mensajes/eventos de
-- tickets sin triar de otros departamentos aunque ya no viera la fila
-- del ticket en sí.
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
          and t.departamento_id = public.current_departamento_id()
        )
        or (public.current_rol() = 'empleado' and t.solicitante_id = public.current_persona_id())
      )
  );
$function$;
