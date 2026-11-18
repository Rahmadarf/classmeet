"use client";

import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { failureText, type PayoutJob } from "@/lib/guard/queue";
import type { SuccessNotice } from "@/lib/guard/use-payout-queue";
import { formatRupiah } from "@/lib/money";

/**
 * Hasil pengiriman di bawah kamera (Figma `Penjaga — Toast sukses dan gagal`, 1084:455; docs/07 §3.4). Sukses: kartu hijau
 * yang hilang sendiri. Gagal permanen: kartu merah yang TETAP tampil dengan "Kirim ulang" dan "Tutup" sampai penjaga
 * menutupnya (tidak boleh hilang diam-diam). Sedang dikirim: kartu netral. Diumumkan lewat `aria-live`.
 */
export function PayoutNotices({
  jobs,
  notices,
  onRetry,
  onDismiss,
  onCloseNotice,
}: {
  jobs: PayoutJob[];
  notices: SuccessNotice[];
  onRetry: (requestId: string) => void;
  onDismiss: (requestId: string) => void;
  onCloseNotice: (id: string) => void;
}) {
  if (jobs.length === 0 && notices.length === 0) return null;
  const card = "rounded-panel bg-nav-active flex items-start gap-3 border-l-4 px-4 py-3.5";
  return (
    <div aria-live="polite" className="flex flex-col gap-2.5">
      {notices.map((n) => (
        <div key={n.id} className={`${card} border-ok-text`}>
          <Check className="text-ok-text mt-0.5 size-5 shrink-0" aria-hidden />
          <p className="text-ink min-w-0 flex-1 text-base font-semibold">{n.text}</p>
          <button
            type="button"
            onClick={() => onCloseNotice(n.id)}
            aria-label="Tutup pemberitahuan"
            className="text-ink-muted -m-2 grid size-11 shrink-0 place-items-center"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ))}
      {jobs.map((j) =>
        j.status === "sending" ? (
          <div key={j.requestId} className={`${card} border-line-strong`}>
            <Loader2
              className="text-ink-muted mt-0.5 size-5 shrink-0 animate-spin motion-reduce:animate-none"
              aria-hidden
            />
            <p className="text-ink min-w-0 flex-1 text-base font-semibold">
              {j.attempts > 0
                ? `Mengirim ulang ${formatRupiah(j.amount)} ke ${j.teamName}…`
                : `Mengirim ${formatRupiah(j.amount)} ke ${j.teamName}…`}
            </p>
          </div>
        ) : (
          <div key={j.requestId} role="alert" className={`${card} border-bad-text flex-col`}>
            <div className="flex items-start gap-3">
              <X className="text-bad-text mt-0.5 size-5 shrink-0" aria-hidden />
              <p className="text-ink min-w-0 flex-1 text-base font-semibold">{failureText(j)}</p>
            </div>
            <div className="flex items-center gap-2 pl-8">
              <Button variant="danger" size="md" onClick={() => onRetry(j.requestId)}>
                Kirim ulang
              </Button>
              <Button variant="ghost" size="md" onClick={() => onDismiss(j.requestId)}>
                Tutup
              </Button>
            </div>
          </div>
        ),
      )}
    </div>
  );
}
