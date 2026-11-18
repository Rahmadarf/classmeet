"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/**
 * Konfirmasi aksi berbahaya (docs/07 §7 `ConfirmDialog`). Fokus awal ada di "Batal" (bukan aksi), dan tombol
 * aksi dinonaktifkan selama berjalan supaya tidak terkirim dua kali. Dialog tetap terbuka bila aksi gagal, dengan
 * pesan galat di dalamnya.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  tone = "primary",
  loading = false,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  tone?: "primary" | "danger";
  loading?: boolean;
  error?: string | null;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <DialogContent
        onOpenAutoFocus={(e) => {
          // Fokus ke "Batal", bukan ke aksi.
          e.preventDefault();
          (e.currentTarget as HTMLElement | null)?.querySelector<HTMLButtonElement>("[data-cancel]")?.focus();
        }}
      >
        <DialogTitle className="text-ink pr-12 text-2xl leading-tight font-semibold">{title}</DialogTitle>
        <DialogDescription asChild>
          <div className="text-ink-muted mt-3 text-lg leading-[1.5]">{description}</div>
        </DialogDescription>
        {error ? (
          <p role="alert" className="text-bad-text mt-4 text-base font-semibold">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-3">
          <Button data-cancel variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Batal
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
