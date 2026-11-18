"use client";

import { useOnline } from "@/components/states";
import { cn } from "@/lib/utils";

/** "● Terhubung" / "● Terputus" di kartu akun admin (Figma `Status koneksi`). Titik + teks, bukan hanya warna. */
export function ConnectionStatus() {
  const online = useOnline();
  return (
    <p role="status" className="text-ink-muted flex items-center gap-2 text-base font-medium">
      <span aria-hidden className={cn("size-2.5 rounded-full", online ? "bg-ok-text" : "bg-bad-text")} />
      {online ? "Terhubung" : "Terputus"}
    </p>
  );
}
