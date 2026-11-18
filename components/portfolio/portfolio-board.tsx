"use client";

import { Wallet } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { EmptyState } from "@/components/states";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePolling } from "@/lib/hooks/use-polling";
import { formatNumber, formatPercent, formatRupiah, formatSignedRupiah } from "@/lib/money";
import { fetchPortfolio } from "@/lib/portfolio/data";
import type { Portfolio } from "@/lib/portfolio/view";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/** Harga peringkat berubah oleh transaksi dan berita; ambil ulang tiap 10 dtk dan saat tab aktif lagi. */
const POLL_MS = 10_000;

type Tone = "gain" | "loss" | "flat";
const toneOf = (pnl: number): Tone => (pnl > 0 ? "gain" : pnl < 0 ? "loss" : "flat");

/** "▲ +Rp 72.000 (+3,0 %)": panah + tanda + teks, bukan hanya warna (docs/07 §6). */
function pnlText(pnl: number, pct: number | null): string {
  const arrow = pnl > 0 ? "▲ " : pnl < 0 ? "▼ " : "";
  return `${arrow}${formatSignedRupiah(pnl)}${pct === null ? "" : ` (${formatPercent(pct)})`}`;
}

/**
 * Halaman Portofolio (Figma `Tim — Portofolio`, 1083:350; docs/07 §2.1): total nilai aset yang dipegang dan
 * untung/rugi terhadap harga beli, lalu satu baris per aset dengan tombol Jual (membuka Pasar pada aset itu).
 * NILAI memakai HARGA PERINGKAT (VWAP 10 menit), sama dengan Beranda dan peringkat; bukan harga terakhir di Pasar.
 */
export function PortfolioBoard({ initial }: { initial: Portfolio }) {
  const supabase = useMemo(() => createClient(), []);
  const [portfolio, setPortfolio] = useState(initial);
  const [stale, setStale] = useState(false);

  const refresh = useCallback(async () => {
    const next = await fetchPortfolio(supabase);
    if (next) setPortfolio(next);
    setStale(next === null);
  }, [supabase]);
  usePolling(refresh, POLL_MS);

  const { rows, totalValue, totalCost, totalPnl, totalPnlPct } = portfolio;
  const totalTone = toneOf(totalPnl);

  return (
    <div className="flex flex-col gap-6">
      {stale ? (
        <p role="status" className="text-ink-muted -mt-2 text-sm">
          Data belum bisa diperbarui, mencoba lagi…
        </p>
      ) : null}

      <Card aria-labelledby="total-judul" className="flex flex-col gap-4">
        <h2
          id="total-judul"
          className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase"
        >
          Total nilai portofolio
        </h2>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <p className="money text-ink text-[40px] leading-tight font-bold">{formatRupiah(totalValue)}</p>
          {rows.length > 0 ? (
            <span
              className={cn(
                "tnum inline-flex items-center rounded-full px-3.5 py-1.5 text-[15px] font-semibold",
                totalTone === "gain" && "bg-cyan/16 text-cyan-text",
                totalTone === "loss" && "bg-accent/16 text-accent-text",
                totalTone === "flat" && "bg-soft text-ink-muted",
              )}
            >
              {pnlText(totalPnl, totalPnlPct)}
              <span className="sr-only"> dibanding harga beli</span>
            </span>
          ) : null}
        </div>
        <p className="text-ink-muted text-base">
          {rows.length > 0 ? <>Harga beli total {formatRupiah(totalCost)} (termasuk biaya). </> : null}
          Nilai memakai harga peringkat, yaitu rata-rata harga transaksi 10 menit terakhir. Angka ini sama
          dengan Beranda dan peringkat, jadi bisa sedikit berbeda dari harga terakhir di Pasar.
        </p>
      </Card>

      <Card aria-labelledby="aset-judul" className="flex flex-col gap-1">
        <p className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase">Aset</p>
        <h2 id="aset-judul" className="text-ink mb-2 text-2xl font-bold">
          Yang kamu pegang
        </h2>

        {rows.length === 0 ? (
          <EmptyState
            icon={<Wallet />}
            title="Kamu belum punya aset"
            description="Buka Pasar untuk membeli aset pertamamu."
            action={
              <Link href="/team/market" className={buttonVariants({ variant: "secondary" })}>
                Buka Pasar
              </Link>
            }
          />
        ) : (
          <ul>
            {rows.map((r) => {
              const tone = toneOf(r.pnl);
              return (
                <li
                  key={r.assetId}
                  className="border-line flex items-center gap-4 border-t py-3.5 first:border-t-0"
                >
                  <span
                    aria-hidden
                    className="rounded-control bg-brand grid size-14 shrink-0 place-items-center text-[22px] font-bold text-white"
                  >
                    {r.symbol}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-ink truncate text-xl font-semibold">{r.name}</p>
                    <p className="tnum text-ink-muted text-base">
                      {formatNumber(r.qty)} × {formatRupiah(r.avgCost)}
                      {r.locked > 0 ? ` · ${formatNumber(r.locked)} terkunci di order jual` : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 text-right">
                    <p className="money text-ink text-xl font-bold">{formatRupiah(r.value)}</p>
                    <p
                      className={cn(
                        "tnum text-[15px] font-semibold",
                        tone === "gain" && "text-cyan-text",
                        tone === "loss" && "text-accent-text",
                        tone === "flat" && "text-ink-muted",
                      )}
                    >
                      {pnlText(r.pnl, r.pnlPct)}
                    </p>
                  </div>
                  <Link
                    href={`/team/market?asset=${encodeURIComponent(r.symbol)}&side=sell`}
                    aria-label={`Jual ${r.name}`}
                    className={buttonVariants({ variant: "secondary", size: "lg" })}
                  >
                    Jual
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
