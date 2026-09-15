"use client";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const handleLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // Supabase exige explícitamente este scope para poder leer el
        // email del usuario desde Azure; sin él, el login falla con
        // "Error getting user email from external provider".
        scopes: "email",
      },
    });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-xl font-semibold">Pando Helpdesk</h1>
      <button
        onClick={handleLogin}
        className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        Entrar con Microsoft
      </button>
    </div>
  );
}
