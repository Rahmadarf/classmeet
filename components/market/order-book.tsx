"use client";

import { Skeleton } from "@/components/states";
import type { OrderBook as Book } from "@/lib/market/data";
import type { BookLevel } from "@/lib/market/rules";
import { formatNumber, formatRupiah, tickFor } from "@/lib/money";
import { cn } from "@/lib/utils";

const LEVELS = 5;

/**
 * Order book 5 level per sisi (Figma `Order book`, 1121:822): bid (beli) di kiri, offer (jual) di kanan,
 * level 1 = terbaik di atas. Kedalaman diperlihatkan lewat kepekatan latar (selain angkanya).
 * Garis biru = order milik tim sendiri di level itu. Hanya untuk tim (docs/12 §9).
 */
export function OrderBook({
  book,
  lastPrice,
}: {
  /** null = belum dimuat untuk aset ini. */
  book: Book | null;
  lastPrice: number;
}) {
  const rows = Array.from({ length: LEVELS }, (_, i) => ({
    bid: book?.bids[i] ?? null,
    offer: book?.offers[i] ?? null,
  }));
  const maxLots = Math.max(1, ...(book ? [...book.bids, ...book.offers].map((l) => l.lots) : [1]));
  const totalBid = book?.bids.reduce((s, l) => s + l.lots, 0) ?? 0;
  const totalOffer = book?.offers.reduce((s, l) => s + l.lots, 0) ?? 0;
  const mine = book
    ? [
        ...book.bids.filter((l) => l.mine > 0).map((l) => `bid ${formatNumber(l.price)} · ${l.mine} lot`),
        ...book.offers.filter((l) => l.mine > 0).map((l) => `offer ${formatNumber(l.price)} · ${l.mine} lot`),
      ]
    : [];

  return (
    <section
      aria-label="Order book"
      className="rounded-panel border-line bg-card shadow-card flex flex-col gap-3 border p-5"
    >
      <div className="border-line flex items-baseline justify-between gap-3 border-b pb-3">
        <h2 className="text-brand-text text-xs font-semibold tracking-[0.12em] uppercase">Order book</h2>
        <p className="text-ink-muted text-xs">
          Jarak 1 fraksi = {formatRupiah(tickFor(lastPrice))} · {LEVELS} level
        </p>
      </div>

      {book === null ? (
        <div role="status" aria-label="Memuat order book" className="flex flex-col gap-1">
          {rows.map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <>
          {/* Garis tengah memisahkan sisi beli (kiri) dan sisi jual (kanan); jatuh di tengah celah antar-kolom. */}
          <div className="relative flex flex-col gap-3">
            <span aria-hidden className="bg-line-strong absolute inset-y-0 left-1/2 w-px -translate-x-1/2" />
            <div
              className="text-ink-muted border-line grid grid-cols-2 gap-6 border-b pb-2 text-[11px] font-semibold tracking-[0.06em]"
              aria-hidden
            >
              <div className="divide-ink/25 grid grid-cols-[3fr_3fr_6fr] divide-x">
                <span className="px-2.5">Freq</span>
                <span className="px-2.5">Lot</span>
                <span className="px-2.5 text-right">Bid</span>
              </div>
              <div className="divide-ink/25 grid grid-cols-[6fr_3fr_3fr] divide-x">
                <span className="px-2.5">Offer</span>
                <span className="px-2.5">Lot</span>
                <span className="px-2.5 text-right">Freq</span>
              </div>
            </div>

            <ol className="flex flex-col gap-1.5" aria-label="Level harga, terbaik di atas">
              {rows.map((row, i) => (
                <li key={i} className="grid grid-cols-2 gap-6">
                  <Cell side="bid" level={row.bid} maxLots={maxLots} />
                  <Cell side="offer" level={row.offer} maxLots={maxLots} />
                </li>
              ))}
            </ol>
          </div>

          <div className="border-line flex items-center gap-3 border-t pt-3 text-xs">
            <p className="text-ok-text flex-1 font-semibold">Total bid {formatNumber(totalBid)} lot</p>
            <p className="tnum text-ink shrink-0 font-bold">Terakhir {formatRupiah(lastPrice)}</p>
            <p className="text-bad-text flex-1 text-right font-semibold">
              Total offer {formatNumber(totalOffer)} lot
            </p>
          </div>

          {book.bids.length === 0 && book.offers.length === 0 ? (
            <p className="text-ink-muted text-xs">Belum ada antrean di aset ini.</p>
          ) : null}
          {mine.length > 0 ? (
            <p className="text-ink-muted flex items-center gap-2 text-xs">
              <span aria-hidden className="bg-primary size-2.5 shrink-0 rounded-full" />
              Garis biru = order milik timmu ({mine.join("; ")})
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

function Cell({ side, level, maxLots }: { side: "bid" | "offer"; level: BookLevel | null; maxLots: number }) {
  const bid = side === "bid";
  if (!level) {
    return (
      <div
        className={cn(
          "rounded-control divide-ink/15 grid min-h-10 items-center divide-x py-2 text-sm",
          bid ? "grid-cols-[3fr_3fr_6fr]" : "grid-cols-[6fr_3fr_3fr]",
          bid ? "bg-ok/[.05]" : "bg-bad/[.05]",
        )}
      >
        <span className="text-ink-dim px-2.5">–</span>
        <span className="h-full" />
        <span className="h-full" />
      </div>
    );
  }
  // Kepekatan latar: 8 % (sedikit) sampai 22 % (terbanyak di antara 10 level yang tampil).
  const alpha = 0.08 + 0.14 * (level.lots / maxLots);
  const price = (
    <span className={cn("tnum px-2.5 font-bold", bid ? "text-ok-text text-right" : "text-bad-text")}>
      {formatNumber(level.price)}
    </span>
  );
  const lots = <span className="tnum text-ink px-2.5 font-semibold">{formatNumber(level.lots)}</span>;
  const freq = (
    <span className={cn("tnum text-ink-muted px-2.5", !bid && "text-right")}>{formatNumber(level.freq)}</span>
  );
  return (
    <div
      role="group"
      aria-label={`${bid ? "Bid" : "Offer"} ${formatNumber(level.price)}, ${level.lots} lot, ${level.freq} antrean${level.mine > 0 ? `, termasuk ${level.mine} lot milik timmu` : ""}`}
      className={cn(
        "rounded-control divide-ink/25 grid min-h-10 items-center divide-x py-2 text-sm",
        bid ? "grid-cols-[3fr_3fr_6fr]" : "grid-cols-[6fr_3fr_3fr]",
        level.mine > 0 && "border-primary border-2",
      )}
      style={{
        backgroundColor: `color-mix(in srgb, var(${bid ? "--ok" : "--bad"}) ${Math.round(alpha * 100)}%, transparent)`,
      }}
    >
      {bid ? (
        <>
          {freq}
          {lots}
          {price}
        </>
      ) : (
        <>
          {price}
          {lots}
          {freq}
        </>
      )}
    </div>
  );
}
