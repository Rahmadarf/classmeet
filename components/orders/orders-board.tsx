"use client";

import { ListChecks, ReceiptText } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { cancelOrder } from "@/app/team/market/actions";
import { MarketStateBanner } from "@/components/market/market-state-banner";
import { EmptyState } from "@/components/states";
import { useSetOpenOrdersCount } from "@/components/team/open-orders-count";
import { Chip } from "@/components/ui/chip";
import { DataTable as Table } from "@/components/ui/data-table";
import { usePolling } from "@/lib/hooks/use-polling";
import {
  fetchAssetNames,
  fetchClosedOrders,
  fetchGame,
  fetchHoldings,
  fetchOpenOrders,
  type ClosedOrder,
  type Game,
  type Holding,
  type OpenOrder,
} from "@/lib/market/data";
import { formatBps } from "@/lib/market/rules";
import { formatNumber, formatRupiah, formatTimeWib } from "@/lib/money";
import { closedStatusText, isTodayWib, summarizeOrders } from "@/lib/orders/view";
import { createClient } from "@/lib/supabase/client";
import { fetchSummary } from "@/lib/team/data";

const FAST_POLL_MS = 5_000;
const CASH_POLL_MS = 10_000;

/** Lima kolom pertama sama di kedua tabel supaya sejajar (Aset, Sisi, Jenis, Harga, Lot). */
const COMMON_WIDTHS = [210, 70, 80, 180, 60];

type Names = Record<string, { symbol: string; name: string }>;

export type OrdersInitial = {
  game: Game;
  open: OpenOrder[];
  closedToday: ClosedOrder[];
  holdings: Record<string, Holding>;
  lockedCash: number | null;
  names: Names;
};

/**
 * Halaman Order (Figma `Tim — Order terbuka`, 1122:612; docs/07 §2.1): tiga angka, tabel Order antre dengan
 * Batalkan, dan Riwayat order hari ini. Polling 5 dtk (order, kepemilikan, status) dan 10 dtk (saldo terkunci);
 * `game_settings` lewat Realtime sebagai pemberitahuan. Tanpa `postgres_changes` di `orders`/`trades`.
 */
export function OrdersBoard({ initial }: { initial: OrdersInitial }) {
  const supabase = useMemo(() => createClient(), []);
  const setOpenCount = useSetOpenOrdersCount();
  const [game, setGame] = useState(initial.game);
  const [open, setOpen] = useState(initial.open);
  const [closed, setClosed] = useState(initial.closedToday);
  const [holdings, setHoldings] = useState(initial.holdings);
  const [lockedCash, setLockedCash] = useState(initial.lockedCash);
  const [names, setNames] = useState(initial.names);
  const [stale, setStale] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const dropped = useRef(false);

  const refreshFast = useCallback(async () => {
    const [g, o, c, h, n] = await Promise.all([
      fetchGame(supabase),
      fetchOpenOrders(supabase),
      fetchClosedOrders(supabase),
      fetchHoldings(supabase),
      fetchAssetNames(supabase),
    ]);
    if (g) setGame(g);
    if (o) setOpen(o);
    if (c) setClosed(isTodayWib(c, Date.now()));
    if (h) setHoldings(h);
    if (n) setNames(n);
    setStale(!(g && o && c && h && n));
  }, [supabase]);

  const refreshCash = useCallback(async () => {
    const s = await fetchSummary(supabase);
    if (s) setLockedCash(s.lockedCash);
  }, [supabase]);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshFast(), refreshCash()]);
  }, [refreshFast, refreshCash]);

  usePolling(refreshFast, FAST_POLL_MS);
  usePolling(refreshCash, CASH_POLL_MS);

  // Lencana sidebar mengikuti daftar yang terlihat di halaman ini.
  useEffect(() => {
    setOpenCount(open.length);
  }, [open.length, setOpenCount]);

  useEffect(() => {
    const channel = supabase
      .channel("orders-board")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "game_settings" }, () => {
        void refreshFast();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          if (dropped.current) {
            dropped.current = false;
            void refreshAll();
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          dropped.current = true;
        }
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, refreshFast, refreshAll]);

  const summary = summarizeOrders(open, holdings);
  const label = (assetId: string) => {
    const a = names[assetId];
    return a ? { title: `${a.name} (${a.symbol})`, symbol: a.symbol } : { title: "Aset", symbol: "—" };
  };
  const canCancel = game.state === "open";

  const cancel = async (order: OpenOrder) => {
    if (busyId !== null) return;
    setBusyId(order.id);
    try {
      const res = await cancelOrder({ orderId: order.id });
      if (res.ok) toast.success(`Order ${label(order.assetId).symbol} dibatalkan.`);
      else toast.error(res.message);
      void refreshAll();
    } catch {
      toast.error("Koneksi bermasalah. Coba lagi.");
    } finally {
      setBusyId(null);
    }
  };

  const lockedNames = summary.lockedByAsset.map((a) => names[a.assetId]?.name ?? "Aset").join(", ");

  return (
    <div className="flex flex-col gap-6">
      <MarketStateBanner state={game.state} />
      {stale ? (
        <p role="status" className="text-ink-muted -mt-2 text-sm">
          Data belum bisa diperbarui, mencoba lagi…
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Stat
          label="Order antre"
          value={formatNumber(summary.open)}
          note={`${summary.buys} beli · ${summary.sells} jual`}
        />
        <Stat
          label="Saldo terkunci"
          value={lockedCash === null ? "Rp –" : formatRupiah(lockedCash)}
          note={`untuk order beli (termasuk biaya ${formatBps(game.feeBps)})`}
        />
        <Stat
          label="Aset terkunci"
          value={`${formatNumber(summary.lockedUnits)} unit`}
          note={
            summary.lockedUnits > 0 ? `${lockedNames} untuk order jual` : "tidak ada order jual yang antre"
          }
        />
      </div>

      <section
        aria-label="Order antre"
        className="rounded-panel border-line bg-card flex flex-col gap-2.5 border p-5"
      >
        <h2 className="text-brand-text text-xs font-semibold tracking-[0.12em] uppercase">Order antre</h2>
        {open.length === 0 ? (
          <EmptyState
            icon={<ListChecks />}
            title="Tidak ada order antre"
            description="Order yang belum terisi muncul di sini. Pasang order di halaman Pasar."
            action={
              <Link href="/team/market" className="text-brand-text text-base font-semibold hover:underline">
                Buka Pasar →
              </Link>
            }
          />
        ) : (
          <Table
            caption="Order antre"
            head={["Aset", "Sisi", "Jenis", "Harga", "Lot", "Terisi", "Dikunci", "Waktu", ""]}
            widths={[...COMMON_WIDTHS, 90, 160, 80]}
          >
            {open.map((o) => {
              const { title, symbol } = label(o.assetId);
              return (
                <tr key={o.id}>
                  <td className="text-ink font-bold">{title}</td>
                  <td>
                    <SideChip side={o.side} />
                  </td>
                  <td>{o.kind === "limit" ? "Limit" : "Market"}</td>
                  <td className="tnum">{o.price === null ? "Harga pasar" : formatNumber(o.price)}</td>
                  <td className="tnum">{formatNumber(o.qty)}</td>
                  <td className="tnum">
                    {formatNumber(o.qty - o.remaining)} / {formatNumber(o.qty)}
                  </td>
                  <td className="tnum">
                    {o.side === "buy"
                      ? formatRupiah(o.lockPerLot * o.remaining)
                      : `${formatNumber(o.remaining)} unit ${symbol}`}
                  </td>
                  <td className="tnum">{formatTimeWib(o.createdAt)}</td>
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={() => void cancel(o)}
                      disabled={!canCancel || busyId !== null}
                      aria-label={`Batalkan order ${o.side === "buy" ? "beli" : "jual"} ${title}`}
                      className="border-line bg-card text-bad-text hover:bg-soft min-h-11 rounded-full border px-4 py-2 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {busyId === o.id ? "Membatalkan…" : "Batalkan"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
        {open.length > 0 && !canCancel ? (
          <p className="text-ink-muted text-sm">
            Pembatalan tidak bisa dilakukan selagi pasar tidak buka. Order tetap antre.
          </p>
        ) : null}
      </section>

      <section
        aria-label="Riwayat order hari ini"
        className="rounded-panel border-line bg-card flex flex-col gap-2.5 border p-5"
      >
        <h2 className="text-brand-text text-xs font-semibold tracking-[0.12em] uppercase">
          Riwayat order hari ini
        </h2>
        {closed.length === 0 ? (
          <EmptyState
            icon={<ReceiptText />}
            title="Belum ada order selesai hari ini"
            description="Order yang terisi atau dibatalkan akan tercatat di sini."
          />
        ) : (
          <Table
            caption="Riwayat order hari ini"
            head={["Aset", "Sisi", "Jenis", "Harga", "Lot", "Status", "Waktu"]}
            widths={[...COMMON_WIDTHS, 250]}
          >
            {closed.map((o) => (
              <tr key={o.id}>
                <td className="text-ink font-bold">{label(o.assetId).title}</td>
                <td>
                  <SideChip side={o.side} />
                </td>
                <td>{o.kind === "limit" ? "Limit" : "Market"}</td>
                <td className="tnum">
                  {o.price !== null
                    ? formatNumber(o.price)
                    : o.avgFillPrice !== null
                      ? `${formatNumber(o.avgFillPrice)} (rata-rata)`
                      : "–"}
                </td>
                <td className="tnum">{formatNumber(o.qty)}</td>
                <td>{closedStatusText(o, game.state)}</td>
                <td className="tnum">{formatTimeWib(o.createdAt)}</td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-panel border-line bg-card flex min-w-0 flex-col gap-1.5 border p-[18px]">
      <p className="text-ink-muted text-[11px] font-semibold tracking-[0.1em] uppercase">{label}</p>
      <p className="money text-ink truncate text-[30px] leading-tight font-bold">{value}</p>
      <p className="text-ink-muted text-[13px]">{note}</p>
    </div>
  );
}

function SideChip({ side }: { side: "buy" | "sell" }) {
  return (
    <Chip tone={side === "buy" ? "ok" : "bad"} className="border-0 px-2.5 py-0.5 text-xs font-bold">
      {side === "buy" ? "Beli" : "Jual"}
    </Chip>
  );
}
