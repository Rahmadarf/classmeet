"use client";

import { useCallback, useMemo, useState } from "react";
import { StockBadge } from "@/components/market/stock-badge";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/states";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { fetchTransactionsPage } from "@/lib/admin/data";
import type { TransactionsPage } from "@/lib/admin/transactions";
import { usePolling } from "@/lib/hooks/use-polling";
import { formatBps, formatCompactRupiah } from "@/lib/market/rules";
import { formatNumber, formatRupiah, formatTimeSecondsWib } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const POLL_MS = 10_000;

/**
 * Transaksi (model toko, docs/17): HANYA tampilan pengawasan. Kiri: 100 transaksi terbaru semua tim (waktu, tim, aset,
 * beli/jual, jumlah, harga satuan, total). Kanan: ringkasan per aset dari seluruh transaksi (unit dibeli/dijual, nilai)
 * beserta stok dan tekanan sekarang. Tidak ada tombol yang mengubah transaksi; salah transaksi tidak dibatalkan
 * (koreksi saldo lewat halaman Hadiah bila perlu).
 */
export function TransactionsBoard({ initial }: { initial: TransactionsPage }) {
  const supabase = useMemo(() => createClient(), []);
  const [page, setPage] = useState(initial);
  const [stale, setStale] = useState(false);

  const refresh = useCallback(async () => {
    const next = await fetchTransactionsPage(supabase);
    if (next) setPage(next);
    setStale(next === null);
  }, [supabase]);
  usePolling(refresh, POLL_MS);

  const { rows, flows, totals } = page;

  return (
    <>
      <PageHeader
        eyebrow="Pengawasan"
        title="Transaksi"
        subtitle="Beli dan jual tim ke pasar, serta keadaan stok tiap aset. Tampilan saja."
      />
      {stale ? (
        <p role="status" className="text-ink-muted mb-4 text-sm">
          Data belum bisa diperbarui, mencoba lagi…
        </p>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Total label="Transaksi" value={formatNumber(totals.count)} />
        <Total label="Nilai total" value={formatCompactRupiah(totals.volume)} />
        <Total label="Unit dibeli" value={formatNumber(totals.bought)} />
        <Total label="Unit dijual" value={formatNumber(totals.sold)} />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <Card aria-labelledby="tx-judul" className="flex flex-col gap-1">
          <p className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase">Terbaru</p>
          <h2 id="tx-judul" className="text-ink mb-2 text-2xl font-bold">
            100 transaksi terakhir
          </h2>
          {rows.length === 0 ? (
            <EmptyState title="Belum ada transaksi" description="Beli dan jual tim muncul di sini." />
          ) : (
            <ul>
              {rows.map((r) => (
                <li key={r.id} className="border-line flex items-center gap-3 border-t py-3 first:border-t-0">
                  <span className="tnum text-ink-muted w-[4.5rem] shrink-0 text-sm">
                    {formatTimeSecondsWib(r.at)}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-base">
                    <span className="text-ink font-bold">{r.teamName}</span>{" "}
                    <span
                      className={cn("font-semibold", r.side === "buy" ? "text-ok-text" : "text-bad-text")}
                    >
                      {r.side === "buy" ? "beli" : "jual"}
                    </span>{" "}
                    <span className="text-ink">
                      {formatNumber(r.qty)} {r.symbol}
                    </span>
                    <span className="text-ink-muted"> @ {formatNumber(r.price)}</span>
                  </p>
                  <span className="money text-ink shrink-0 text-right text-base font-bold whitespace-nowrap">
                    {formatRupiah(r.total)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card aria-labelledby="aset-judul" className="flex flex-col gap-1">
          <p className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase">Per aset</p>
          <h2 id="aset-judul" className="text-ink mb-2 text-2xl font-bold">
            Arus, stok, dan tekanan
          </h2>
          <DataTable
            caption="Ringkasan transaksi per aset"
            head={["Kode", "Dibeli", "Dijual", "Nilai", "Stok", "Tekanan", "Label"]}
            widths={[58, 64, 64, 84, 84, 74, 130]}
            minWidth={560}
            align={["left", "right", "right", "right", "right", "right", "left"]}
          >
            {flows.map((f) => (
              <tr key={f.assetId}>
                <td className="text-brand-text text-base font-bold">{f.symbol}</td>
                <td className="tnum text-right">{formatNumber(f.bought)}</td>
                <td className="tnum text-right">{formatNumber(f.sold)}</td>
                <td className="money text-right">{f.volume > 0 ? formatCompactRupiah(f.volume) : "–"}</td>
                <td className="tnum text-right">
                  {formatNumber(f.stock)} / {formatNumber(f.initStock)}
                </td>
                <td className="tnum text-right">
                  {f.factorBps === 0
                    ? "–"
                    : `${f.factorBps > 0 ? "+" : "−"}${formatBps(Math.abs(f.factorBps))}`}
                </td>
                <td>
                  <StockBadge level={f.level} className="px-2 py-0.5 text-xs" />
                </td>
              </tr>
            ))}
          </DataTable>
          <p className="text-ink-muted text-sm">
            Dibeli dan dijual dalam unit; nilai = jumlah rupiah semua transaksi aset itu. Tekanan stok naik
            saat dibeli, turun saat dijual, dan kembali ke netral sendiri.
          </p>
        </Card>
      </div>
    </>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-panel border-line bg-card shadow-card flex flex-col gap-1 border px-5 py-4">
      <p className="text-ink-muted text-[13px] font-semibold">{label}</p>
      <p className="money text-ink text-2xl font-bold">{value}</p>
    </div>
  );
}
