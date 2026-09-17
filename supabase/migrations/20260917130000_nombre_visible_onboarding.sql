-- 1) Un solicitante debe poder ver el nombre real del agente que le
-- responde en sus propios tickets, no solo el texto genérico "Agente"
-- que usa hoy el frontend como fallback. `personas_self` solo deja ver
-- la propia fila (o todas si eres admin); esta política añade: "también
-- puedes ver a quien te haya escrito un mensaje (no nota interna) en
-- un ticket del que tú eres el solicitante". No abre el directorio de
-- empleados en general — solo a quien ya te ha contactado de verdad.
CREATE POLICY "personas_visible_por_conversacion" ON "public"."personas"
  FOR SELECT
  TO "authenticated"
  USING (
    EXISTS (
      SELECT 1
      FROM messages m
      JOIN tickets t ON t.id = m.ticket_id
      WHERE m.autor_id = personas.id
        AND NOT m.es_nota_interna
        AND t.solicitante_id = current_persona_id()
    )
  );

-- 2) Sustituye set_own_departamento() por una versión que también deja
-- fijar el nombre en el mismo paso de onboarding. El departamento
-- sigue bloqueado a "solo una vez" (mismo motivo que antes: es el
-- campo con peso en RLS); el nombre es puramente informativo, así que
-- se puede volver a fijar sin ese candado — no hay ningún riesgo de
-- seguridad en dejarlo más abierto.
DROP FUNCTION IF EXISTS public.set_own_departamento(smallint);

CREATE OR REPLACE FUNCTION public.complete_own_onboarding(p_nombre text, p_departamento_id smallint)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  update personas
     set nombre = coalesce(nullif(trim(p_nombre), ''), nombre),
         departamento_id = coalesce(departamento_id, p_departamento_id)
   where auth_user_id = auth.uid();
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."complete_own_onboarding"(text, smallint) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";
