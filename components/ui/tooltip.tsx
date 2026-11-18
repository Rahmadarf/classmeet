"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as React from "react";
import { cn } from "@/lib/utils";

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

/** Isi tooltip: kartu putih, garis --border, bayangan dialog biru (DESIGN.md §6). Tidak ada permukaan gelap. */
export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(function TooltipContent({ className, sideOffset = 8, ...props }, ref) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          "rounded-panel border-line bg-card text-ink-muted shadow-dialog z-50 max-w-[344px] border px-4 py-3.5 text-[12.5px] leading-snug",
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
});
