"use client";

import { AlertTriangle, Inbox, WifiOff } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Kerangka (skeleton) untuk daftar; bukan spinner layar penuh (docs/07 §4). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton h-5 w-full", className)} />;
}

export function SkeletonRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div role="status" aria-label="Memuat" className={cn("flex flex-col gap-3", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-11 shrink-0" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3.5 w-3/5" />
          </div>
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
      <span className="sr-only">Memuat…</span>
    </div>
  );
}

/** Keadaan kosong: ikon garis --blue-text, judul, keterangan (DESIGN.md §6). */
export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string;
  description?: string;
  /** Elemen ikon yang sudah dirender (komponen fungsi tidak bisa dilewatkan dari server). */
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2 px-6 py-12 text-center", className)}>
      <span aria-hidden className="text-brand-text [&>svg]:size-10">
        {icon ?? <Inbox />}
      </span>
      <p className="text-ink text-xl font-semibold">{title}</p>
      {description ? <p className="text-ink-muted max-w-sm text-base">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

/** Keadaan galat dengan "Coba lagi". Pesan harus sudah ramah (lihat lib/errors.ts). */
export function ErrorState({
  title = "Gagal memuat data",
  message,
  onRetry,
  className,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={cn("flex flex-col items-center gap-2 px-6 py-12 text-center", className)}>
      <AlertTriangle className="text-bad-text size-10" aria-hidden />
      <p className="text-ink text-xl font-semibold">{title}</p>
      {message ? <p className="text-bad-text max-w-sm text-base">{message}</p> : null}
      {onRetry ? (
        <Button variant="secondary" className="mt-3" onClick={onRetry}>
          Coba lagi
        </Button>
      ) : null}
    </div>
  );
}

/** Pelacak status jaringan peramban. Nilai awal `true` agar render server dan klien sama. */
export function useOnline(): boolean {
  const [online, setOnline] = React.useState(true);
  React.useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  return online;
}

/** Banner offline: "Koneksi terputus, mencoba menyambung kembali…" (docs/07 §4). */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      className="border-accent-2 bg-accent-2/25 text-ink flex items-center gap-2 border-b px-4 py-2.5 text-[15px]"
    >
      <WifiOff className="size-5 shrink-0" aria-hidden />
      Koneksi terputus, mencoba menyambung kembali…
    </div>
  );
}
