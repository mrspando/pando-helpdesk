"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, BarChart3, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { signOut } from "@/lib/supabase/actions";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Inbox;
};

const AGENTE_NAV: NavItem[] = [
  { href: "/tickets", label: "Tickets", icon: Inbox },
  { href: "/informes", label: "Informes", icon: BarChart3 },
];

const AGENTE_NAV_SECONDARY: NavItem[] = [
  { href: "/ajustes", label: "Ajustes", icon: Settings },
];

export function Sidebar({
  nombre,
  email,
  departamento,
}: {
  nombre: string | null;
  email: string;
  departamento: string | null;
}) {
  const pathname = usePathname();

  function navLink(item: NavItem) {
    const active = pathname.startsWith(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex items-center gap-2.5 rounded-btn px-2.5 py-1.5 text-[13px] font-medium transition-colors duration-150",
          active
            ? "bg-surface-2 text-pando"
            : "text-ink-secondary hover:bg-surface-hover hover:text-ink",
        )}
      >
        <Icon size={16} strokeWidth={1.75} />
        {item.label}
      </Link>
    );
  }

  return (
    <aside className="flex h-screen w-[232px] shrink-0 flex-col border-r border-border bg-surface">
      <div className="px-5 pb-5 pt-6">
        <p className="text-[13px] font-semibold leading-tight tracking-wide text-pando">
          PANDO
        </p>
        <p className="text-[13px] leading-tight text-ink-muted">HELPDESK</p>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {AGENTE_NAV.map(navLink)}
        <div className="my-2 h-px bg-border" />
        {AGENTE_NAV_SECONDARY.map(navLink)}
      </nav>

      <div className="border-t border-border px-3 py-3">
        <div className="flex items-center gap-2.5 rounded-btn px-2 py-1.5">
          <Avatar name={nombre ?? email} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium leading-tight text-ink">
              {nombre ?? email}
            </p>
            {departamento && (
              <p className="truncate text-[12px] leading-tight text-ink-muted">
                {departamento}
              </p>
            )}
          </div>
          <form action={signOut}>
            <button
              type="submit"
              title="Cerrar sesión"
              className="flex h-6 w-6 items-center justify-center rounded-btn text-ink-muted transition-colors duration-150 hover:bg-surface-hover hover:text-ink"
            >
              <LogOut size={14} strokeWidth={1.75} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
