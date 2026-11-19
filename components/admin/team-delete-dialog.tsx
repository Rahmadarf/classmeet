"use client";

import { useId, useState } from "react";
import { deleteTeam } from "@/app/admin/teams/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/** Konfirmasi hapus tim dengan pascode 6 digit (diperiksa di server). Aksi ini tidak bisa dibatalkan dari aplikasi. */
export function TeamDeleteDialog({
  team,
  onOpenChange,
  onDone,
}: {
  team: { id: string; name: string } | null;
  onOpenChange: (open: boolean) => void;
  onDone: (name: string, loginDisabled: boolean) => void;
}) {
  return (
    <Dialog open={team !== null} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent className="w-[min(480px,92vw)]">
        {team ? <Body key={team.id} team={team} onClose={() => onOpenChange(false)} onDone={onDone} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function Body({
  team,
  onClose,
  onDone,
}: {
  team: { id: string; name: string };
  onClose: () => void;
  onDone: (name: string, loginDisabled: boolean) => void;
}) {
  const id = useId();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy || code.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      const res = await deleteTeam({ teamId: team.id, passcode: code });
      if (res.ok) {
        onClose();
        onDone(team.name, res.data.loginDisabled);
        return;
      }
      setError(res.message);
      if (res.code === "pin_invalid") setCode("");
    } catch {
      setError("Koneksi bermasalah. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <DialogTitle className="text-ink pr-12 text-2xl leading-tight font-semibold">
        Hapus {team.name}?
      </DialogTitle>
      <DialogDescription className="text-ink-muted text-base leading-[1.5]">
        Order antre tim dibatalkan, tim hilang dari peringkat, kartu QR lama mati, dan akun loginnya
        dinonaktifkan. Riwayat transaksinya tetap tersimpan. Masukkan pascode 6 digit untuk melanjutkan.
      </DialogDescription>
      <label htmlFor={`${id}-kode`} className="text-ink-muted text-lg font-medium">
        Pascode
      </label>
      <input
        id={`${id}-kode`}
        autoFocus
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        value={code}
        onChange={(e) => {
          setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
          if (error) setError(null);
        }}
        aria-invalid={error ? true : undefined}
        className="rounded-control border-line bg-field text-ink tnum focus:border-brand-text min-h-14 w-full border-2 px-4 text-[26px] font-bold tracking-[0.4em]"
      />
      {error ? (
        <p role="alert" className="text-bad-text text-base font-semibold">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
          Batal
        </Button>
        <Button
          type="submit"
          variant="danger"
          loading={busy}
          loadingText="Menghapus…"
          disabled={code.length !== 6}
        >
          Hapus tim
        </Button>
      </div>
    </form>
  );
}
