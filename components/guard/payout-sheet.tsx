"use client";

import { Check, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { COUNT_UP_STEP_MS, COUNT_UP_STEPS, countUpValue } from "@/lib/guard/count-up";
import { formatRupiah } from "@/lib/money";
import { cn } from "@/lib/utils";

export type SheetTeam = { requestId: string; teamId: string; name: string; cash: number };

/**
 * Lembar form nominal (Figma `Penjaga — Siap pindai (form nominal muncul)`, 1096:483; docs/07 §3.4) di atas layar pindai:
 * nama tim, SALDO TIM saat QR terbaca (tidak diperbarui selama form terbuka dan tidak membatasi nominal), kolom nominal,
 * tombol "Kirim Rp …" dan "Batal". Tidak ada tombol nominal cepat, dialog konfirmasi, atau catatan.
 * Setelah "Kirim" ditekan, form TIDAK langsung hilang: isian diganti saldo tim yang naik bertahap dari saldo awal ke saldo
 * baru (mis. 100 → 110 → 120 … → 150), lalu form menutup sendiri sebentar setelah angka selesai naik. Pengiriman tetap
 * berjalan di antrean latar belakang; angka naik itu tampilan saja (saldo awal + nominal), bukan saldo hasil bacaan
 * ulang, dan keterangan di bawahnya menunjukkan apakah hadiah masih dikirim, sudah terkirim, atau gagal.
 */
export type PayoutPhase = "sending" | "sent" | "failed";

/** Jeda setelah angka selesai naik sebelum form menutup sendiri. */
const HOLD_MS = 1_400;

export function PayoutSheet({
  team,
  submittedAmount,
  phase,
  onSend,
  onCancel,
}: {
  team: SheetTeam | null;
  /** Terisi setelah "Kirim" ditekan: form beralih ke tampilan saldo naik. */
  submittedAmount: number | null;
  phase: PayoutPhase;
  onSend: (team: SheetTeam, amount: number) => void;
  onCancel: () => void;
}) {
  return (
    <Sheet open={team !== null} onOpenChange={(o) => !o && onCancel()}>
      <SheetContent side="bottom" aria-describedby={undefined}>
        {team ? (
          submittedAmount !== null ? (
            <Counting
              key={team.requestId}
              team={team}
              amount={submittedAmount}
              phase={phase}
              onDone={onCancel}
            />
          ) : (
            <Form key={team.requestId} team={team} onSend={onSend} onCancel={onCancel} />
          )
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Form({
  team,
  onSend,
  onCancel,
}: {
  team: SheetTeam;
  onSend: (team: SheetTeam, amount: number) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const amount = text === "" ? null : Number(text);
  const valid = amount !== null && Number.isSafeInteger(amount) && amount >= 1;

  const submit = () => {
    if (valid) onSend(team, amount);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-4"
    >
      <div>
        <p className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase">Tim terbaca</p>
        <SheetTitle className="text-ink mt-1 text-[28px] leading-tight font-bold">{team.name}</SheetTitle>
        <SheetDescription className="sr-only">
          Isi nominal hadiah untuk {team.name}, lalu kirim.
        </SheetDescription>
      </div>

      <div className="rounded-panel bg-nav-active px-4 py-3">
        <p className="text-ink-muted text-[13px] font-medium">Saldo tim saat ini</p>
        <p className="money text-ink text-[28px] leading-tight font-bold">{formatRupiah(team.cash)}</p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="nominal-hadiah" className="text-ink-muted text-lg font-medium">
          Nominal
        </label>
        <input
          id="nominal-hadiah"
          autoFocus
          inputMode="numeric"
          enterKeyHint="send"
          autoComplete="off"
          value={text}
          onChange={(e) => setText(e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 12))}
          className="rounded-panel border-cyan-text bg-field text-ink tnum min-h-16 w-full border-2 px-5 text-[28px] font-bold"
        />
      </div>

      <div className="flex flex-col gap-3">
        <Button type="submit" size="lg" block disabled={!valid} className="min-h-14 text-[17px] font-bold">
          {valid ? `Kirim ${formatRupiah(amount)}` : "Kirim"}
        </Button>
        <Button type="button" variant="secondary" size="lg" block onClick={onCancel} className="min-h-14">
          Batal
        </Button>
      </div>
    </form>
  );
}

/**
 * Saldo tim naik bertahap dari saldo awal ke saldo awal + nominal (`countUpValue`), lalu form menutup sendiri
 * (`onDone`). Pengguna yang meminta gerak dikurangi (`prefers-reduced-motion`) langsung melihat angka akhir.
 * Pembaca layar hanya mendengar hasil akhir, bukan tiap angka yang berubah.
 */
function Counting({
  team,
  amount,
  phase,
  onDone,
}: {
  team: SheetTeam;
  amount: number;
  phase: PayoutPhase;
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const finished = step >= COUNT_UP_STEPS;
  const failed = phase === "failed";

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = window.setTimeout(() => setStep(COUNT_UP_STEPS), 0);
      return () => window.clearTimeout(id);
    }
    const id = window.setInterval(() => {
      setStep((s) => {
        if (s + 1 >= COUNT_UP_STEPS) window.clearInterval(id);
        return Math.min(s + 1, COUNT_UP_STEPS);
      });
    }, COUNT_UP_STEP_MS);
    return () => window.clearInterval(id);
  }, []);

  // Tutup sendiri: sebentar setelah angka selesai naik, atau lebih cepat bila pengiriman gagal (kartu merah tetap tampil di bawah kamera).
  useEffect(() => {
    if (!finished && !failed) return;
    const id = window.setTimeout(onDone, HOLD_MS);
    return () => window.clearTimeout(id);
  }, [finished, failed, onDone]);

  const shown = failed ? team.cash : countUpValue(team.cash, amount, step);
  const caption =
    phase === "failed"
      ? {
          icon: <X className="text-bad-text size-5" aria-hidden />,
          text: "Gagal terkirim",
          tone: "text-bad-text",
        }
      : phase === "sent"
        ? {
            icon: <Check className="text-ok-text size-5" aria-hidden />,
            text: "Terkirim",
            tone: "text-ok-text",
          }
        : {
            icon: (
              <Loader2
                className="text-ink-muted size-5 animate-spin motion-reduce:animate-none"
                aria-hidden
              />
            ),
            text: "Mengirim…",
            tone: "text-ink-muted",
          };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase">
          Hadiah dikirim ke
        </p>
        <SheetTitle className="text-ink mt-1 text-[28px] leading-tight font-bold">{team.name}</SheetTitle>
        <SheetDescription className="sr-only">
          {failed
            ? `Hadiah ${formatRupiah(amount)} untuk ${team.name} gagal terkirim.`
            : `Saldo ${team.name} bertambah ${formatRupiah(amount)}.`}
        </SheetDescription>
      </div>

      <div
        className={cn(
          "rounded-panel px-4 py-4 transition-colors duration-500",
          finished && !failed ? "bg-ok/16" : "bg-nav-active",
        )}
      >
        <p className="text-ink-muted text-[13px] font-medium">Saldo tim</p>
        <p aria-hidden className="money text-ink text-[40px] leading-tight font-bold">
          {formatRupiah(shown)}
        </p>
        {!failed ? (
          <p aria-hidden className="money text-ok-text mt-1 text-[20px] font-bold">
            + {formatRupiah(amount)}
          </p>
        ) : null}
        <p className="sr-only" role="status">
          {finished && !failed ? `Saldo ${team.name} sekarang ${formatRupiah(team.cash + amount)}.` : ""}
        </p>
      </div>

      <p className={cn("flex items-center gap-2 text-lg font-semibold", caption.tone)}>
        {caption.icon}
        {caption.text}
      </p>

      <Button type="button" variant="secondary" size="lg" block onClick={onDone} className="min-h-14">
        {finished || failed ? "Lanjut pindai" : "Tutup"}
      </Button>
    </div>
  );
}
