import { createClient } from "@supabase/supabase-js";

// Bypassa RLS por completo — reservado para procesos de servidor realmente
// privilegiados (hoy, el cron de ingesta de correo en
// app/api/cron/ingest-mail). Nunca se expone al navegador ni se usa para
// peticiones normales de usuario. Ver PERMISOS.md → "BACKEND".
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
