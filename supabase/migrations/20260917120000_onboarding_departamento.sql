-- Permite que cualquier persona fije su propio departamento la primera
-- vez que entra (cuando todavía es NULL), sin necesitar a un Admin.
-- Deliberadamente NO es una política RLS de UPDATE genérica sobre
-- `personas`: una política así solo puede restringir por fila, no por
-- columna, así que cualquiera podría colar un cambio de `rol` en la
-- misma petición. Una función SECURITY DEFINER de un solo propósito,
-- que solo toca `departamento_id` y solo mientras esté a NULL, evita
-- ese riesgo por diseño.

CREATE OR REPLACE FUNCTION public.set_own_departamento(p_departamento_id smallint)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  update personas
     set departamento_id = p_departamento_id
   where auth_user_id = auth.uid()
     and departamento_id is null;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."set_own_departamento"(smallint) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";
