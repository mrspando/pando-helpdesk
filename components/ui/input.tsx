import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-8 rounded-input border border-border bg-surface px-2.5 text-[13px] text-ink placeholder:text-ink-muted focus:border-border-strong focus:outline-2 focus:outline-offset-0 focus:outline-pando/20",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
