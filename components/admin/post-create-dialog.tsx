"use client";

import { useId, useState } from "react";
import { createPost, type NewPost } from "@/app/admin/posts/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const field =
  "rounded-control border-line bg-field text-ink min-h-12 w-full border px-4 text-lg focus:border-brand-text disabled:opacity-60";

/**
 * Tambah pos baru: nama game, lokasi, dan kata sandi awal untuk akun penjaga (username `guardN` dibuat otomatis, nomor pos
 * berikutnya otomatis). Pos baru mulai Tidak tersedia; penjaga (atau admin) mengubahnya saat siap.
 */
export function PostCreateDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const uid = useId();
  const [gameName, setGameName] = useState("");
  const [location, setLocation] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<NewPost | null>(null);

  const close = () => {
    if (busy) return;
    onOpenChange(false);
    if (created) onDone();
    window.setTimeout(() => {
      setGameName("");
      setLocation("");
      setPassword("");
      setError(null);
      setCreated(null);
    }, 200);
  };

  const valid = gameName.trim().length >= 2 && location.trim().length >= 2 && password.length >= 8;

  const submit = async () => {
    if (busy || !valid) return;
    setBusy(true);
    setError(null);
    try {
      const res = await createPost({ gameName, location, password });
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
              Pos dibuat
            </DialogTitle>
            <DialogDescription className="text-ink-muted text-base">
              <strong>{created.name}</strong> sudah terdaftar dan mulai <strong>Tidak tersedia</strong>.
              Penjaga masuk dengan username <strong>{created.guardUsername}</strong> dan kata sandi yang baru
              kamu isi.
            </DialogDescription>
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
              Tambah pos
            </DialogTitle>
            <DialogDescription className="text-ink-muted text-base">
              Nomor pos dan akun penjaga (guardN) dibuat otomatis.
            </DialogDescription>
            <label htmlFor={`${uid}-game`} className="text-ink-muted text-lg font-medium">
              Nama game
            </label>
            <input
              id={`${uid}-game`}
              autoFocus
              autoComplete="off"
              maxLength={60}
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              placeholder="mis. Lompat Tali"
              className={field}
            />
            <label htmlFor={`${uid}-lokasi`} className="text-ink-muted text-lg font-medium">
              Lokasi
            </label>
            <input
              id={`${uid}-lokasi`}
              autoComplete="off"
              maxLength={80}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="mis. Lapangan Basket"
              className={field}
            />
            <label htmlFor={`${uid}-sandi`} className="text-ink-muted text-lg font-medium">
              Kata sandi penjaga (minimal 8 karakter)
            </label>
            <input
              id={`${uid}-sandi`}
              type="password"
              autoComplete="new-password"
              maxLength={72}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
              <Button type="submit" loading={busy} loadingText="Membuat…" disabled={!valid}>
                Buat pos
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
