"use client";

import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const DropdownMenu = RadixDropdown.Root;
export const DropdownMenuTrigger = RadixDropdown.Trigger;

export function DropdownMenuContent({
  className,
  align = "start",
  sideOffset = 6,
  ...props
}: RadixDropdown.DropdownMenuContentProps) {
  return (
    <RadixDropdown.Portal>
      <RadixDropdown.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-40 rounded-card border border-border bg-surface p-1 text-[13px] text-ink shadow-[0_4px_16px_-4px_rgba(17,17,17,0.12)] outline-none",
          className,
        )}
        {...props}
      />
    </RadixDropdown.Portal>
  );
}

export function DropdownMenuItem({
  className,
  selected,
  ...props
}: RadixDropdown.DropdownMenuItemProps & { selected?: boolean }) {
  return (
    <RadixDropdown.Item
      className={cn(
        "flex cursor-pointer items-center justify-between gap-2 rounded-[6px] px-2 py-1.5 outline-none transition-colors duration-150 data-[highlighted]:bg-surface-hover",
        className,
      )}
      {...props}
    >
      <span>{props.children}</span>
      {selected && <Check size={13} className="text-ink-secondary" />}
    </RadixDropdown.Item>
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: RadixDropdown.DropdownMenuLabelProps) {
  return (
    <RadixDropdown.Label
      className={cn("px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-ink-muted", className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: RadixDropdown.DropdownMenuSeparatorProps) {
  return <RadixDropdown.Separator className={cn("my-1 h-px bg-border", className)} {...props} />;
}
