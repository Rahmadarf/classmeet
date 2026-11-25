"use client";

import { Check, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { verifyGuardPin } from "@/app/guard/actions";
import type { ActionResult } from "@/lib/schemas/common";
import { AnimatedRupiah } from "@/components/guard/animated-rupiah";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { PIN_MAX, PIN_MIN } from "@/lib/guard/pin-shape";
import { formatRupiah } from "@/lib/money";
import { cn } from "@/lib/utils";

export type SheetTeam = { requestId: string; teamId: string; name: string; cash: number };

/**
 * Lembar form nominal (Figma `Penjaga — Siap pindai (form nominal muncul)`, 1096:483; docs/07 §3.4) di atas layar pindai:
 * nama tim, SALDO TIM saat QR terbaca (tidak diperbarui selama form terbuka dan tidak membatasi nominal), kolom nominal,
 * tombol "Kirim Rp …" dan "Batal". "Kirim" membuka pop-up **PIN penjaga** (diperiksa di server sebelum hadiah masuk antrean). Tidak ada tombol
 * nominal cepat, dialog konfirmasi, atau catatan.
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
  verifyPin = verifyGuardPin,
}: {
  team: SheetTeam | null;
  /** Terisi setelah "Kirim" ditekan: form beralih ke tampilan saldo naik. */
  submittedAmount: number | null;
  phase: PayoutPhase;
  onSend: (team: SheetTeam, amount: number) => void;
  onCancel: () => void;
  /** Pemeriksa PIN di server; bawaan PIN penjaga, PIC lomba memakai PIN-nya sendiri. */
  verifyPin?: (input: unknown) => Promise<ActionResult>;
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
            <Form
              key={team.requestId}
              team={team}
              onSend={onSend}
              onCancel={onCancel}
              verifyPin={verifyPin}
            />
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
  verifyPin,
}: {
  team: SheetTeam;
  onSend: (team: SheetTeam, amount: number) => void;
  onCancel: () => void;
  verifyPin: (input: unknown) => Promise<ActionResult>;
}) {
  const [text, setText] = useState("");
  const [pinOpen, setPinOpen] = useState(false);
  const amount = text === "" ? null : Number(text);
  const valid = amount !== null && Number.isSafeInteger(amount) && amount >= 1;

  // Form ditutup (Batal/geser) saat PIN sedang diperiksa: jangan memasukkan hadiah ke antrean sesudahnya.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /** Periksa PIN di server; benar → hadiah masuk antrean. Mengembalikan pesan galat, atau null bila berhasil. */
  const verify = async (pin: string): Promise<{ error: string | null; clear: boolean }> => {
    if (amount === null) return { error: null, clear: false };
    try {
      const res = await verifyPin({ pin });
      if (!alive.current) return { error: null, clear: false };
      if (res.ok) {
        onSend(team, amount);
        return { error: null, clear: false };
      }
      return { error: res.message, clear: res.code === "pin_invalid" };
    } catch {
      return { error: "Koneksi bermasalah. Coba lagi.", clear: false };
    }
  };

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) setPinOpen(true);
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
      <PinDialog
        open={pinOpen}
        onOpenChange={setPinOpen}
        amount={amount ?? 0}
        teamName={team.name}
        onVerify={verify}
      />
    </>
  );
}

/**
 * Pop-up PIN penjaga: muncul saat "Kirim" ditekan (bukan kolom di form nominal). Hadiah baru masuk antrean setelah PIN
 * benar; PIN salah mengosongkan kolom dan menampilkan galat di dalam pop-up. Isi pop-up dibuat ulang tiap dibuka
 * (Radix membongkarnya saat tutup), jadi PIN dan galat lama tidak tersisa.
 */
function PinDialog({
  open,
  onOpenChange,
  amount,
  teamName,
  onVerify,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  teamName: string;
  onVerify: (pin: string) => Promise<{ error: string | null; clear: boolean }>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(420px,92vw)]">
        <PinBody
          amount={amount}
          teamName={teamName}
          onVerify={onVerify}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function PinBody({
  amount,
  teamName,
  onVerify,
  onCancel,
}: {
  amount: number;
  teamName: string;
  onVerify: (pin: string) => Promise<{ error: string | null; clear: boolean }>;
  onCancel: () => void;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const ready = pin.length >= PIN_MIN;

  const submit = async () => {
    if (!ready || checking) return;
    setChecking(true);
    setError(null);
    const res = await onVerify(pin);
    setChecking(false);
    if (res.error) {
      setError(res.error);
      if (res.clear) setPin("");
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-4"
    >
      <div className="pr-12">
        <DialogTitle className="text-ink text-2xl leading-tight font-semibold">Masukkan PIN</DialogTitle>
        <DialogDescription className="text-ink-muted mt-2 text-base leading-[1.5]">
          Kirim {formatRupiah(amount)} ke {teamName}.
        </DialogDescription>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="pin-penjaga" className="text-ink-muted text-lg font-medium">
          PIN penjaga
        </label>
        <input
          id="pin-penjaga"
          autoFocus
          type="password"
          inputMode="numeric"
          enterKeyHint="send"
          autoComplete="off"
          maxLength={PIN_MAX}
          value={pin}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "pin-penjaga-galat" : undefined}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, "").slice(0, PIN_MAX));
            if (error) setError(null);
          }}
          className={cn(
            "rounded-panel bg-field text-ink tnum min-h-16 w-full border-2 px-5 text-[28px] font-bold tracking-[0.3em]",
            error ? "border-bad-text" : "border-cyan-text",
          )}
        />
        {error ? (
          <p id="pin-penjaga-galat" role="alert" className="text-bad-text text-base font-semibold">
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-3">
        <Button
          type="submit"
          size="lg"
          block
          disabled={!ready}
          loading={checking}
          loadingText="Memeriksa PIN…"
          className="min-h-14 text-[17px] font-bold"
        >
          Konfirmasi
        </Button>
        <Button type="button" variant="secondary" size="lg" block onClick={onCancel} disabled={checking}>
          Batal
        </Button>
      </div>
    </form>
  );
}

/**
 * Saldo tim naik bertahap dari saldo awal ke saldo awal + nominal (`AnimatedRupiah`, library `motion`), lalu form menutup sendiri
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
  const [finished, setFinished] = useState(false);
  const failed = phase === "failed";
  const done = useCallback(() => setFinished(true), []);

  // Tutup sendiri: sebentar setelah angka selesai naik, atau lebih cepat bila pengiriman gagal (kartu merah tetap tampil di bawah kamera).
  useEffect(() => {
    if (!finished && !failed) return;
    const id = window.setTimeout(onDone, HOLD_MS);
    return () => window.clearTimeout(id);
  }, [finished, failed, onDone]);

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
        {failed ? (
          <p aria-hidden className="money text-ink text-[40px] leading-tight font-bold">
            {formatRupiah(team.cash)}
          </p>
        ) : (
          <AnimatedRupiah
            from={team.cash}
            to={team.cash + amount}
            onDone={done}
            className="text-ink text-[40px] leading-tight font-bold"
          />
        )}
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
