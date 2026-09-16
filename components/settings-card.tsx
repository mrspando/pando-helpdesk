import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

export function SettingsCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-card border border-border bg-surface p-4 transition-colors duration-150 hover:border-pando/30 hover:bg-surface-hover"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-btn bg-surface-2 text-ink-secondary">
        <Icon size={17} strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-[12.5px] leading-snug text-ink-muted">{description}</p>
      </div>
      <ChevronRight
        size={15}
        className="mt-1 shrink-0 text-ink-disabled transition-colors duration-150 group-hover:text-ink-muted"
      />
    </Link>
  );
}
