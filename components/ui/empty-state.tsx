import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1 py-16 text-center",
        className,
      )}
    >
      {Icon && <Icon size={20} className="mb-2 text-ink-disabled" strokeWidth={1.5} />}
      <p className="text-sm font-medium text-ink-secondary">{title}</p>
      {description && <p className="text-[13px] text-ink-muted">{description}</p>}
    </div>
  );
}
