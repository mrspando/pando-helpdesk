-- Corrige el hueco de permisos documentado en supabase/README.md: los
-- triggers de auditoría (tg_tickets_alta, tg_tickets_audit) insertan en
-- `events`, pero `authenticated` no tiene GRANT INSERT ahí y solo existe
-- una política de SELECT para agentes. Al no ser SECURITY DEFINER, esos
-- triggers corrían con el rol de quien disparaba el UPDATE/INSERT en
-- `tickets`, así que cualquier creación o cambio de ticket hecho por un
-- agente autenticado (no service_role) fallaba por falta de permiso al
-- intentar auditar el cambio.
--
-- Se marcan SECURITY DEFINER (igual que is_agente/current_persona_id/
-- tg_alta_persona_desde_auth ya en el baseline) para que puedan escribir
-- en `events` sin depender de los grants del invocador. No se toca el
-- GRANT/policy de `events` en sí: `authenticated` sigue sin poder
-- insertar ahí directamente, solo los triggers.

CREATE OR REPLACE FUNCTION public.tg_tickets_alta()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  insert into events (ticket_id, tipo, valor_nuevo, actor_id)
  values (new.id, 'creacion', new.origen, current_persona_id());
  return new;
end $function$;

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

  if new.agente_id is distinct from old.agente_id then
    insert into events (ticket_id, tipo, valor_anterior, valor_nuevo, actor_id)
    values (new.id, 'asignacion', old.agente_id::text, new.agente_id::text, actor);
  end if;

  return new;
end $function$;
