"use client";

import { Toaster as Sonner } from "sonner";

/**
 * Toast: kartu putih, bayangan dialog biru, garis kiri 4 px (DESIGN.md §6):
 * --ok sukses, --bad gagal, --cyan info. Tidak ada latar gelap.
 */
export function Toaster() {
  return (
    <Sonner
      position="top-right"
      theme="light"
      closeButton
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-[356px] items-start gap-3 rounded-panel border border-line border-l-4 bg-card p-4 text-[15px] text-ink shadow-dialog",
          title: "font-semibold text-ink",
          description: "text-ink-muted",
          success: "border-l-ok",
          error: "border-l-bad",
          info: "border-l-cyan",
          closeButton: "border border-line bg-card text-ink-muted",
        },
      }}
    />
  );
}
