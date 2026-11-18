"use client";

import { useEffect, useId, useState } from "react";
import { adjustCash } from "@/app/admin/teams/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { groupThousands, formatRupiah } from "@/lib/money";
import type { ActionResult } from "@/lib/schemas/common";
import { cn } from "@/lib/utils";

export type CorrectionTeam = { id: string; name: string; cash: number };

/** "-100.000" / "−100000" / "5.000" → bilangan bulat bertanda; kosong atau "-" saja → null. */
export function parseDelta(text: string): number | null {
  const negative = /^\s*[-−–]/.test(text);
  const digits = text.replace(/\D/g, "");
  if (digits === "" || digits.length > 12) return null;
  const n = Number(digits);
  return n === 0 ? 0 : negative ? -n : n;
}

/**
 * Koreksi saldo (Figma `Admin — Koreksi saldo`, 1106:378; docs/07 §2.3, docs/04 §3.5): saldo sekarang, selisih
 * (negatif untuk mengurangi), alasan wajib, dan pratinjau saldo sesudah. Tercatat di Audit dengan nama admin dan
 * alasan; tidak bisa dibatalkan, hanya dikoreksi lagi. `Saldo` di sini adalah saldo BEBAS (di luar yang terkunci di order).
 */
export function CorrectionDialog({
  open,
  onOpenChange,
  teams,
  teamId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: CorrectionTeam[];
  /** Tim yang sudah ditentukan; null = admin memilih dari daftar. */
  teamId: string | null;
  onDone: () => void;
}) {
  const uid = useId();
  const [chosen, setChosen] = useState<string>("");
  const [deltaText, setDeltaText] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Isian dibersihkan setiap dialog dibuka.
  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => {
        setChosen(teamId ?? "");
        setDeltaText("");
        setReason("");
        setError(null);
      }, 0);
      return () => window.clearTimeout(id);
    }
  }, [open, teamId]);

  const team = teams.find((t) => t.id === (teamId ?? chosen));
  const delta = parseDelta(deltaText);
  const after = team && delta !== null ? team.cash + delta : null;
  const invalidAfter = after !== null && after < 0;

  const submit = async () => {
    if (!team || busy) return;
    if (delta === null || delta === 0) return setError("Isi selisih saldo (bukan nol).");
    if (reason.trim().length < 3) return setError("Alasan wajib diisi (minimal 3 huruf).");
    setBusy(true);
    setError(null);
    const res = await adjustCash({ teamId: team.id, delta, reason }).catch(
      (): ActionResult<{ after: number }> => ({
        ok: false,
        message: "Koneksi bermasalah. Coba lagi.",
        code: null,
        retryable: true,
      }),
    );
    setBusy(false);
    if (res.ok) {
      onOpenChange(false);
      onDone();
    } else setError(res.message);
  };

  const field =
    "rounded-control border-line bg-field text-ink min-h-12 w-full border px-4 text-lg focus:border-brand-text";

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="w-[min(520px,92vw)]">
        <p className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase">Koreksi saldo</p>
        <DialogTitle className="text-ink mt-1 pr-12 text-2xl leading-tight font-semibold">
          {team ? team.name : "Pilih tim"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Ubah saldo bebas tim dengan alasan yang tercatat di audit.
        </DialogDescription>

        <div className="mt-4 flex flex-col gap-4">
          {teamId === null ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${uid}-team`} className="text-ink text-[15px] font-semibold">
                Tim
              </label>
              <select
                id={`${uid}-team`}
                value={chosen}
                onChange={(e) => setChosen(e.target.value)}
                className={field}
              >
                <option value="">Pilih tim…</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {team ? (
            <div className="flex items-center justify-between gap-3 text-lg">
              <span className="text-ink-muted">Saldo sekarang</span>
              <span className="money text-ink font-bold">{formatRupiah(team.cash)}</span>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${uid}-delta`} className="text-ink text-[15px] font-semibold">
              Selisih (negatif untuk mengurangi)
            </label>
            <input
              id={`${uid}-delta`}
              inputMode="text"
              autoComplete="off"
              value={deltaText}
              placeholder="-100.000"
              onChange={(e) => {
                const raw = e.target.value;
                const neg = /^\s*[-−–]/.test(raw);
                const digits = raw.replace(/\D/g, "");
                setDeltaText(
                  digits === "" ? (neg ? "-" : "") : `${neg ? "-" : ""}${groupThousands(Number(digits))}`,
                );
                setError(null);
              }}
              className={cn(field, "tnum")}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${uid}-reason`} className="text-ink text-[15px] font-semibold">
              Alasan (wajib)
            </label>
            <input
              id={`${uid}-reason`}
              value={reason}
              maxLength={300}
              onChange={(e) => {
                setReason(e.target.value);
                setError(null);
              }}
              className={field}
            />
          </div>

          {team ? (
            <div
              className={cn(
                "rounded-row flex items-center justify-between gap-3 px-4 py-3.5",
                invalidAfter ? "bg-bad/14" : "bg-tint",
              )}
            >
              <span className="text-ink text-lg">Saldo sesudah</span>
              <span className={cn("money text-xl font-bold", invalidAfter ? "text-bad-text" : "text-ink")}>
                {after === null ? "–" : formatRupiah(after)}
              </span>
            </div>
          ) : null}
          {invalidAfter ? (
            <p className="text-bad-text text-sm font-medium">
              Saldo sesudah tidak boleh negatif; database akan menolak.
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-bad-text text-base font-semibold">
              {error}
            </p>
          ) : null}
          <p className="text-ink-muted text-sm">
            Tercatat di Audit dengan nama admin dan alasan. Tidak bisa dibatalkan, hanya dikoreksi lagi.
          </p>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Batal
          </Button>
          <Button onClick={() => void submit()} loading={busy} loadingText="Menyimpan…" disabled={!team}>
            Simpan koreksi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
