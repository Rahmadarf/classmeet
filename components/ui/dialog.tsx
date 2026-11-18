"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

/**
 * Dialog: kartu putih di atas `--overlay` (biru transparan, bukan hitam). Radius panel 10,
 * bayangan dialog biru (DESIGN.md §6). Fokus dijebak dan dikembalikan oleh Radix.
 */
export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    /** Mengganti latar belakang (bawaan: biru transparan `--overlay`), mis. abu-abu buram untuk dialog berita. */
    overlayClassName?: string;
  }
>(function DialogContent({ className, overlayClassName, children, ...props }, ref) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn("fixed inset-0 z-50 bg-[color:var(--overlay)]", overlayClassName)}
      />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed top-1/2 left-1/2 z-50 max-h-[85dvh] w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto",
          "rounded-panel border-line bg-card shadow-dialog border p-6",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label="Tutup"
          className="rounded-control text-ink-muted hover:bg-soft absolute top-4 right-4 grid size-11 place-items-center"
        >
          <X className="size-5" aria-hidden />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});
