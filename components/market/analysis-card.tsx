"use client";

import { LineChart } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { buyAnalysis } from "@/app/team/market/actions";
import { AnalysisReportBody } from "@/components/market/analysis-report";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { fetchMyAnalyses } from "@/lib/analysis/data";
import { analysisBlockedText, type AnalysisOffer, type AnalysisReport } from "@/lib/analysis/view";
import { formatRupiah } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";

/**
 * Kartu "Analisa Pasar" (pay to win, docs/18) di Pasar: beli laporan 4 paragraf tentang berita yang SEDANG tayang
 * (ciri perusahaan yang akan naik/turun, kekuatan, perkiraan waktu). Harga dan syarat dari database (`get_analysis_offer`);
 * sekali beli per berita per tim, membeli lagi tidak memotong saldo. `onChanged` menyegarkan saldo dan tawaran.
 */
export function AnalysisCard({
  offer,
  cash,
  onChanged,
}: {
  offer: AnalysisOffer;
  cash: number | null;
  onChanged: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  // Satu `request_id` per niat beli: dipakai ulang bila koneksi putus (idempotensi), dibuat baru setelah selesai.
  const intent = useRef<string | null>(null);

  const blocked = analysisBlockedText(offer, cash);

  const buy = async () => {
    if (busy) return;
    intent.current ??= crypto.randomUUID();
    setBusy(true);
    setError(null);
    try {
      const res = await buyAnalysis({ requestId: intent.current });
      if (res.ok) {
        intent.current = null;
        setConfirmOpen(false);
        setReport(res.data);
        toast.success(`Analisa dibeli (${formatRupiah(res.data.price)}). Laporan ada di Riwayat.`);
        onChanged();
        return;
      }
      if (!res.retryable) intent.current = null; // galat bisnis: percobaan berikutnya adalah niat baru
      setError(res.message);
      onChanged(); // tawaran/saldo mungkin berubah (berita habis, saldo kurang, dsb.)
    } catch {
      setError("Koneksi bermasalah. Coba lagi."); // `request_id` yang sama dipakai saat coba lagi
    } finally {
      setBusy(false);
    }
  };

  const view = async () => {
    if (loadingReport) return;
    setLoadingReport(true);
    const list = await fetchMyAnalyses(createClient(), 20);
    setLoadingReport(false);
    const mine = list?.find((r) => r.newsTitle === offer.newsTitle) ?? null;
    if (mine) setReport(mine);
    else toast.error("Laporan belum bisa dimuat. Coba lagi.");
  };

  return (
    <Card aria-labelledby="analisa-judul" className="flex flex-col gap-3 p-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="bg-tint text-brand-text rounded-control grid size-10 shrink-0 place-items-center"
        >
          <LineChart className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase">
            Bantuan analisa
          </p>
          <h2 id="analisa-judul" className="text-ink text-xl leading-tight font-semibold">
            Analisa Pasar
          </h2>
        </div>
      </div>
      <p className="text-ink-muted text-sm">
        Laporan 4 paragraf tentang berita yang sedang tayang: ciri perusahaan yang akan naik dan turun,
        seberapa kuat, dan perkiraan waktunya.
      </p>
      {offer.newsTitle && offer.reason !== "no_live_news" && offer.reason !== "market_closed" ? (
        <p className="text-ink text-sm font-medium">Berita: {offer.newsTitle}</p>
      ) : null}

      {offer.owned ? (
        <Button variant="soft" size="lg" block onClick={() => void view()} loading={loadingReport}>
          Lihat laporan
        </Button>
      ) : (
        <Button
          variant="secondary"
          size="lg"
          block
          disabled={blocked !== null}
          onClick={() => {
            setError(null);
            setConfirmOpen(true);
          }}
        >
          Beli analisa · {formatRupiah(offer.price)}
        </Button>
      )}
      {offer.owned ? (
        <p role="status" className="text-ok-text text-sm font-medium">
          Sudah dibeli untuk berita ini.
        </p>
      ) : blocked ? (
        <p role="status" className="text-ink-muted text-sm">
          {blocked}
        </p>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(o) => {
          setConfirmOpen(o);
          if (!o) setError(null);
        }}
        title="Beli analisa ini?"
        description={
          <>
            Saldo dipotong <strong>{formatRupiah(offer.price)}</strong>
            {cash !== null ? ` (sisa ${formatRupiah(Math.max(cash - offer.price, 0))})` : ""}. Laporan untuk
            berita <em>{offer.newsTitle}</em> hanya untuk timmu. Membeli lagi untuk berita yang sama tidak
            memotong saldo.
          </>
        }
        confirmLabel={`Beli · ${formatRupiah(offer.price)}`}
        loading={busy}
        error={error}
        onConfirm={() => void buy()}
      />

      <Dialog open={report !== null} onOpenChange={(o) => !o && setReport(null)}>
        <DialogContent className="w-[min(640px,94vw)]">
          {report ? (
            <>
              <DialogTitle className="text-ink pr-12 text-2xl leading-tight font-semibold">
                Analisa Pasar
              </DialogTitle>
              <DialogDescription className="text-ink-muted mt-1 mb-4 text-base">
                Berita: {report.newsTitle}
              </DialogDescription>
              <AnalysisReportBody report={report} />
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
