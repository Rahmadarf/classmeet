"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTitle = DialogPrimitive.Title;
export const SheetDescription = DialogPrimitive.Description;
export const SheetClose = DialogPrimitive.Close;

/**
 * Lembar dari bawah (form nominal penjaga) atau dari kiri (laci menu penjaga). Kartu putih di atas `--overlay` (biru
 * transparan, bukan hitam). `bottom` memuat pegangan; fokus dijebak dan dikembalikan oleh Radix.
 */
export const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { side?: "bottom" | "left" }
>(function SheetContent({ className, children, side = "bottom", ...props }, ref) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[color:var(--overlay)]" />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "bg-card shadow-dialog fixed z-50 overflow-y-auto",
          side === "bottom"
            ? "inset-x-0 bottom-0 mx-auto max-h-[92dvh] w-full max-w-[520px] rounded-t-[24px] px-5 pt-3 pb-6"
            : "inset-y-0 left-0 flex w-[min(320px,86vw)] flex-col gap-6 p-4",
          className,
        )}
        {...props}
      >
        {side === "bottom" ? (
          <span aria-hidden className="bg-line-strong mx-auto mb-4 block h-1 w-10 rounded-full" />
        ) : null}
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});
