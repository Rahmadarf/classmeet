"use client";

import { useState } from "react";
import { setMyPostOpen } from "@/app/guard/actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

/**
 * Saklar buka/tutup pos (Figma `Penjaga — Siap pindai`, 1084:412; docs/07 §3.4). Tanpa teks status: hijau + bulatan di
 * kanan = pos tersedia, merah + bulatan di kiri = tutup (posisi bulatan juga membedakan tanpa warna; `aria-label`
 * "Pos tersedia"/"Pos tutup"). Tiap perubahan meminta konfirmasi satu ketukan. Nonaktif setelah game selesai.
 */
export function PostToggle({
  open,
  disabled,
  onChanged,
}: {
  open: boolean;
  disabled: boolean;
  onChanged: (open: boolean) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = !open;
  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await setMyPostOpen({ open: next });
      if (res.ok) {
        onChanged(res.data);
        setConfirm(false);
      } else setError(res.message);
    } catch {
      setError("Koneksi bermasalah. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={open}
        aria-label={open ? "Pos tersedia" : "Pos tutup"}
        disabled={disabled}
        onClick={() => {
          setError(null);
          setConfirm(true);
        }}
        className={cn(
          "relative h-11 w-[72px] shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          open ? "bg-ok" : "bg-bad",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute top-1 size-9 rounded-full bg-white shadow-sm transition-[left]",
            open ? "left-[32px]" : "left-1",
          )}
        />
      </button>

      <ConfirmDialog
        open={confirm}
        onOpenChange={(o) => {
          setConfirm(o);
          if (!o) setError(null);
        }}
        title={open ? "Tutup pos sementara?" : "Buka pos?"}
        description={
          open
            ? "Selama ditutup, pos tidak bisa memberi hadiah baru. Hadiah yang sudah terkirim tidak berubah."
            : "Pos akan tersedia dan bisa memberi hadiah."
        }
        confirmLabel={open ? "Tutup pos" : "Buka pos"}
        tone={open ? "danger" : "primary"}
        loading={busy}
        error={error}
        onConfirm={() => void submit()}
      />
    </>
  );
}
