"use client";

import { Download } from "lucide-react";
import { useId, useState } from "react";
import { createTeam, type NewTeam } from "@/app/admin/teams/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const field =
  "rounded-control border-line bg-field text-ink min-h-12 w-full border px-4 text-lg focus:border-brand-text disabled:opacity-60";

/**
 * Tambah tim baru: hanya nama. Username (`timN`), QR, dan kode cadangan dibuat server. Sesudah berhasil, kartu QR tampil sebagai
 * GAMBAR (token tidak pernah jadi teks); QR itu kredensial tim, jadi diunduh/dicetak lalu tidak dibagikan.
 */
export function TeamCreateDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const uid = useId();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<NewTeam | null>(null);

  const close = () => {
    if (busy) return;
    onOpenChange(false);
    if (created) onDone();
    window.setTimeout(() => {
      setName("");
      setError(null);
      setCreated(null);
    }, 200);
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await createTeam({ name });
      if (res.ok) setCreated(res.data);
      else setError(res.message);
    } catch {
      setError("Koneksi bermasalah. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="w-[min(520px,92vw)]">
        {created ? (
          <div className="flex flex-col gap-4">
            <DialogTitle className="text-ink pr-12 text-2xl leading-tight font-semibold">
              {created.name} ditambahkan
            </DialogTitle>
            <DialogDescription className="text-ink-muted text-base">
              Akun <strong>{created.username}</strong> dengan saldo Rp 0. Kartu QR di bawah adalah kredensial
              tim: unduh atau cetak sekarang, lalu jangan dibagikan. QR tidak bisa dilihat lagi dari halaman
              ini.
            </DialogDescription>
            {created.qr ? (
              <div className="flex flex-col items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- data URI dari server, bukan aset statis */}
                <img
                  src={created.qr}
                  alt={`QR kartu ${created.name}`}
                  className="border-line size-60 rounded-[12px] border bg-white p-2"
                />
                <a
                  href={created.qr}
                  download={`qr-${created.username}.png`}
                  className="text-brand-text inline-flex min-h-11 items-center gap-2 text-base font-semibold"
                >
                  <Download className="size-5" aria-hidden /> Unduh QR (PNG)
                </a>
              </div>
            ) : (
              <p role="alert" className="text-bad-text text-base font-semibold">
                Gambar QR gagal dibuat. Cetak kartunya lewat <code>npm run print-qr</code> memakai berkas
                seed.
              </p>
            )}
            <Button onClick={close}>Selesai</Button>
          </div>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <DialogTitle className="text-ink pr-12 text-2xl leading-tight font-semibold">
              Tambah tim
            </DialogTitle>
            <DialogDescription className="text-ink-muted text-base">
              Username, kartu QR, dan kode cadangan dibuat otomatis. Tim baru mulai dengan saldo Rp 0.
            </DialogDescription>
            <label htmlFor={`${uid}-nama`} className="text-ink-muted text-lg font-medium">
              Nama tim
            </label>
            <input
              id={`${uid}-nama`}
              autoFocus
              autoComplete="off"
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="mis. Tim Rajawali"
              className={field}
            />
            {error ? (
              <p role="alert" className="text-bad-text text-base font-semibold">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={close} disabled={busy}>
                Batal
              </Button>
              <Button type="submit" loading={busy} loadingText="Membuat…" disabled={name.trim().length < 2}>
                Buat tim
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
