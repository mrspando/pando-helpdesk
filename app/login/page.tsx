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
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-app">
      <div className="text-center">
        <p className="text-[13px] font-semibold tracking-wide text-pando">PANDO</p>
        <p className="text-[13px] text-ink-muted">HELPDESK</p>
      </div>
      <button
        onClick={handleLogin}
        className="rounded-btn bg-pando px-4 py-2 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-pando-anthracite"
      >
        Entrar con Microsoft
      </button>
    </div>
  );
}
