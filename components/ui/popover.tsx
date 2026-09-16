"use client";

import * as RadixPopover from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

export const Popover = RadixPopover.Root;
export const PopoverTrigger = RadixPopover.Trigger;

export function PopoverContent({
  className,
  align = "start",
  sideOffset = 6,
  ...props
}: RadixPopover.PopoverContentProps) {
  return (
    <RadixPopover.Portal>
      <RadixPopover.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 rounded-card border border-border bg-surface p-1.5 text-[13px] text-ink shadow-[0_4px_16px_-4px_rgba(17,17,17,0.12)] outline-none",
          className,
        )}
        {...props}
      />
    </RadixPopover.Portal>
  );
}
