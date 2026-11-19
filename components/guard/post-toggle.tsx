"use client";

import { useState } from "react";
import { setMyPostOpen } from "@/app/guard/actions";
import { cn } from "@/lib/utils";

/**
 * Saklar ketersediaan pos (Figma `Penjaga — Siap pindai`, 1084:412; docs/07 §3.4). Tanpa teks status: hijau + bulatan di
 * kanan = pos Tersedia (masih kurang tim atau belum ada tim untuk memulai permainan), merah + bulatan di kiri =
 * Tidak tersedia (pos penuh atau permainan sedang dimulai); posisi bulatan juga membedakan tanpa warna; `aria-label`
 * "Pos tersedia"/"Pos tidak tersedia". TANPA konfirmasi (19 Nov): saklar langsung berpindah saat ditekan, lalu
 * disimpan ke server; bila gagal, saklar kembali dan pesan galat tampil di bawahnya. Nonaktif setelah game selesai.
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
  // Nilai yang sedang disimpan: ditampilkan seketika, dibuang begitu server menjawab.
  const [pending, setPending] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const shown = pending ?? open;
  const toggle = async () => {
    if (pending !== null) return;
    const next = !open;
    setPending(next);
    setError(null);
    try {
      const res = await setMyPostOpen({ open: next });
      if (res.ok) onChanged(res.data);
      else setError(res.message);
    } catch {
      setError("Koneksi bermasalah. Coba lagi.");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        role="switch"
        aria-checked={shown}
        aria-label={shown ? "Pos tersedia" : "Pos tidak tersedia"}
        disabled={disabled}
        onClick={() => void toggle()}
        className={cn(
          "relative h-11 w-[72px] shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          shown ? "bg-ok" : "bg-bad",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute top-1 size-9 rounded-full bg-white shadow-sm transition-[left]",
            shown ? "left-[32px]" : "left-1",
          )}
        />
      </button>
      {error ? (
        <p role="alert" className="text-bad-text max-w-[200px] text-right text-sm font-medium">
          {error}
        </p>
      ) : null}
    </div>
  );
}
