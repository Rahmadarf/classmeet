"use client";

import { ArrowDown, ArrowUp, ChevronRight, ReceiptText } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmptyState } from "@/components/states";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { fetchHistory } from "@/lib/history/data";
import { groupByDay, type HistoryItem } from "@/lib/history/view";
import { usePolling } from "@/lib/hooks/use-polling";
import { formatDateWib, formatNumber, formatRupiah, formatTimeSecondsWib, formatTimeWib } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const POLL_MS = 10_000;
/** Jam hanya untuk label "Hari ini"/"Kemarin": `null` sampai terpasang di browser (server dan klien harus sama). */
const CLOCK_MS = 60_000;

const MINUS = "−";
/** "+ Rp 300.000" / "− Rp 1.600.000" (tanda dan panah, bukan hanya warna). */
const signed = (n: number) => `${n < 0 ? MINUS : "+"} ${formatRupiah(Math.abs(n))}`;

/**
 * Riwayat Transaksi (Figma `Tim — Riwayat`, 1083:459; docs/07 §2.1): semua pembelian, penjualan, dan hadiah pos
 * tim, dikelompokkan per hari (WIB). Ketuk baris untuk rincian. Nominal = pengaruh ke saldo (termasuk biaya).
 * Polling 10 dtk dan Realtime `payouts` milik tim ini sebagai pemberitahuan (data diambil ulang dari tabel).
 */
export function HistoryBoard({ teamId, initial }: { teamId: string; initial: HistoryItem[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState(initial);
  const [stale, setStale] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const [selected, setSelected] = useState<HistoryItem | null>(null);
  const dropped = useRef(false);

  const refresh = useCallback(async () => {
    const next = await fetchHistory(supabase, teamId);
    if (next) setItems(next);
    setStale(next === null);
  }, [supabase, teamId]);
  usePolling(refresh, POLL_MS);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, CLOCK_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`history:${teamId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "payouts", filter: `team_id=eq.${teamId}` },
        () => void refresh(),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          if (dropped.current) {
            dropped.current = false;
            void refresh();
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          dropped.current = true;
        }
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, teamId, refresh]);

  // Sebelum terpasang di browser, patokan "hari ini" = waktu transaksi terbaru (tanpa Date.now() saat render).
  const groups = useMemo(
    () => groupByDay(items, now ?? (items.length > 0 ? Date.parse(items[0].at) : 0)),
    [items, now],
  );

  return (
    <>
      {stale ? (
        <p role="status" className="text-ink-muted mb-4 text-sm">
          Data belum bisa diperbarui, mencoba lagi…
        </p>
      ) : null}

      <Card aria-labelledby="aktivitas-judul" className="flex flex-col gap-1">
        <p className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase">
          Aktivitas terbaru
        </p>
        <h2 id="aktivitas-judul" className="text-ink mb-2 text-2xl font-bold">
          Transaksi
        </h2>

        {items.length === 0 ? (
          <EmptyState
            icon={<ReceiptText />}
            title="Belum ada transaksi"
            description="Pembelian, penjualan, hadiah pos, dan dividen timmu akan tercatat di sini."
            action={
              <Link href="/team/market" className={buttonVariants({ variant: "secondary" })}>
                Buka Pasar
              </Link>
            }
          />
        ) : (
          groups.map((group) => (
            <section key={group.key} aria-label={group.label} className="flex flex-col">
              <h3 className="text-ink-muted pt-3 pb-1 text-sm font-semibold tracking-[0.08em] uppercase">
                {group.label}
              </h3>
              <ul>
                {group.items.map((item) => (
                  <li key={item.key} className="border-line border-t first:border-t-0">
                    <Row item={item} onOpen={() => setSelected(item)} />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </Card>

      <Detail item={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function Row({ item, onOpen }: { item: HistoryItem; onOpen: () => void }) {
  const title = rowTitle(item);
  const out = item.net < 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${title}, ${signed(item.net)}. Lihat rincian`}
      className="rounded-row hover:bg-soft flex w-full items-center gap-4 py-3 text-left transition-colors"
    >
      <Tile item={item} size="row" />
      <span className="min-w-0 flex-1">
        <span className="text-ink block truncate text-lg font-semibold">{title}</span>
        <span className="tnum text-ink-muted block text-base">
          {item.kind === "trade"
            ? `${formatNumber(item.qty)} × ${formatRupiah(item.price)} · ${formatTimeWib(item.at)}`
            : item.kind === "dividend"
              ? `${formatNumber(item.qty)} unit × ${formatRupiah(item.perUnit)} · ${formatTimeWib(item.at)}`
              : `Dari penjaga pos · ${formatTimeWib(item.at)}`}
        </span>
      </span>
      <span className={cn("flex shrink-0 items-center gap-2", out ? "text-accent-text" : "text-cyan-text")}>
        {out ? (
          <ArrowDown className="size-[18px]" aria-hidden />
        ) : (
          <ArrowUp className="size-[18px]" aria-hidden />
        )}
        <span className="money text-xl font-bold">{signed(item.net)}</span>
      </span>
      <ChevronRight className="text-ink-muted size-[22px] shrink-0" aria-hidden />
    </button>
  );
}

function rowTitle(item: HistoryItem): string {
  if (item.kind === "trade") return `${item.side === "buy" ? "Beli" : "Jual"} ${item.name}`;
  if (item.kind === "dividend") return `Dividen ${item.name}`;
  return `Hadiah ${item.postName}`;
}

function Tile({ item, size }: { item: HistoryItem; size: "row" | "dialog" }) {
  const box = size === "row" ? "size-[52px]" : "size-14";
  if (item.kind === "trade" || item.kind === "dividend") {
    return (
      <span
        aria-hidden
        className={cn(
          item.kind === "trade" ? "bg-brand" : "bg-cyan-text",
          "rounded-control grid shrink-0 place-items-center text-xl font-bold text-white",
          box,
        )}
      >
        {item.symbol}
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "rounded-control bg-tint text-ink grid shrink-0 place-items-center text-lg font-bold",
        box,
      )}
    >
      {item.postNumber ?? "Pos"}
    </span>
  );
}

/** Rincian satu transaksi/hadiah (ketuk baris). Catatan hadiah dari penjaga SELALU teks biasa. */
function Detail({ item, onClose }: { item: HistoryItem | null; onClose: () => void }) {
  return (
    <Dialog open={item !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        {item ? (
          <>
            <div className="flex items-center gap-4 pr-12">
              <Tile item={item} size="dialog" />
              <div className="min-w-0">
                <DialogTitle className="text-ink text-2xl leading-tight font-semibold">
                  {rowTitle(item)}
                </DialogTitle>
                <DialogDescription className="tnum text-ink-dim mt-0.5 text-sm">
                  {formatDateWib(item.at)} · {formatTimeSecondsWib(item.at)} WIB
                </DialogDescription>
              </div>
            </div>

            <dl className="bg-field rounded-row mt-5 flex flex-col gap-2.5 px-4 py-3.5">
              {item.kind === "trade" ? (
                <>
                  <Line label="Aset" value={`${item.name} (${item.symbol})`} />
                  <Line label="Jumlah" value={`${formatNumber(item.qty)} lot`} />
                  <Line label="Harga per lot" value={formatRupiah(item.price)} />
                  <Line label="Nilai" value={formatRupiah(item.gross)} />
                  <Line label="Biaya" value={formatRupiah(item.fee)} />
                  <Line
                    strong
                    label={item.side === "buy" ? "Total dibayar" : "Total diterima"}
                    value={formatRupiah(Math.abs(item.net))}
                  />
                </>
              ) : item.kind === "dividend" ? (
                <>
                  <Line label="Aset" value={`${item.name} (${item.symbol})`} />
                  <Line label="Unit dipegang" value={formatNumber(item.qty)} />
                  <Line label="Dividen per unit" value={formatRupiah(item.perUnit)} />
                  <Line strong label="Dividen diterima" value={formatRupiah(item.net)} />
                </>
              ) : (
                <>
                  <Line label="Pos" value={item.postName} />
                  {item.location ? <Line label="Lokasi" value={item.location} /> : null}
                  {item.note ? <Line label="Catatan" value={item.note} wrap /> : null}
                  <Line strong label="Hadiah diterima" value={formatRupiah(item.net)} />
                </>
              )}
            </dl>
            <p className="text-ink-muted mt-3 text-sm">
              {item.kind === "trade"
                ? "Nilai di sini adalah uang yang benar-benar keluar atau masuk ke saldo, termasuk biaya."
                : item.kind === "dividend"
                  ? "Dividen dibayar ke semua tim yang memegang aset itu saat berita berlaku, langsung ke saldo."
                  : "Hadiah langsung masuk ke saldo saat penjaga mengirimnya."}
            </p>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Line({
  label,
  value,
  strong,
  wrap,
}: {
  label: string;
  value: string;
  strong?: boolean;
  wrap?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className={cn("text-[15px]", strong ? "text-ink font-semibold" : "text-ink-muted")}>{label}</dt>
      <dd
        className={cn(
          "tnum text-right text-base",
          strong ? "text-ink font-bold" : "text-ink font-semibold",
          wrap && "whitespace-pre-line",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
