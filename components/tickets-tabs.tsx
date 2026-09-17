import Link from "next/link";
import { cn } from "@/lib/utils";

export const TICKET_TABS = [
  { key: "todos", label: "Todos" },
  { key: "nuevos", label: "Nuevos" },
  { key: "en_curso", label: "En curso" },
  { key: "esperando", label: "Esperando" },
  { key: "resueltos", label: "Resueltos" },
] as const;

export type TicketTabKey = (typeof TICKET_TABS)[number]["key"];

export function TicketsTabs({
  active,
  otherParams,
}: {
  active: TicketTabKey;
  otherParams: Record<string, string | undefined>;
}) {
  const suffix = new URLSearchParams(
    Object.entries(otherParams).filter((entry): entry is [string, string] => Boolean(entry[1])),
  ).toString();

  return (
    <div className="flex items-center gap-1 px-8">
      {TICKET_TABS.map((tab) => {
        const href = `/tickets?${new URLSearchParams({
          ...(tab.key !== "todos" ? { estado: tab.key } : {}),
          ...Object.fromEntries(new URLSearchParams(suffix)),
        }).toString()}`;
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={href}
            scroll={false}
            className={cn(
              "rounded-btn px-2.5 py-1.5 text-[13px] font-medium transition-colors duration-150",
              isActive ? "bg-surface-2 text-ink" : "text-ink-secondary hover:text-ink",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
