"use client";

import { useEffect, useState } from "react";
import { getTeamQr, type TeamQrView } from "@/app/admin/teams/actions";
import { QrCard } from "@/components/admin/qr-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/**
 * Lihat kartu QR tim yang sudah ada (menggantikan "Ganti QR"). Gambar dibuat server saat dialog dibuka (admin saja, tercatat di
 * audit) dan dibuang saat ditutup; token tidak pernah jadi teks. Tampilan sama dengan dialog "Tambah tim".
 */
export function TeamQrDialog({
  team,
  onOpenChange,
}: {
  team: { id: string; name: string } | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [view, setView] = useState<TeamQrView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const teamId = team?.id ?? null;

  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;
    getTeamQr({ teamId })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) setView(res.data);
        else setError(res.message);
      })
      .catch(() => !cancelled && setError("Koneksi bermasalah. Coba lagi."));
    return () => {
      cancelled = true;
      setView(null);
      setError(null);
    };
  }, [teamId]);

  return (
    <Dialog open={team !== null} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(520px,92vw)]">
        <div className="flex flex-col gap-4">
          <DialogTitle className="text-ink pr-12 text-2xl leading-tight font-semibold">
            QR {team?.name}
          </DialogTitle>
          <DialogDescription className="text-ink-muted text-base">
            Kartu QR ini adalah kredensial tim: unduh atau cetak, lalu jangan dibagikan. Setiap pembukaan
            tercatat di audit.
          </DialogDescription>
          {view ? (
            <QrCard qr={view.qr} name={view.name} username={view.username} />
          ) : error ? (
            <p role="alert" className="text-bad-text text-base font-semibold">
              {error}
            </p>
          ) : (
            <p role="status" className="text-ink-muted py-16 text-center text-base">
              Membuat QR…
            </p>
          )}
          <Button onClick={() => onOpenChange(false)}>Selesai</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
