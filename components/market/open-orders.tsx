"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { cancelOrder } from "@/app/team/market/actions";
import { Chip } from "@/components/ui/chip";
import type { MarketAsset, OpenOrder } from "@/lib/market/data";
import { formatNumber } from "@/lib/money";

const SHOWN = 4;

/**
 * Ringkasan order terbuka di bawah form (Figma `Order terbuka (ringkas)`, 1121:935).
 * Hasil order (terisi / sebagian / antre) terlihat di sini. Pembatalan hanya diterima server saat pasar
 * `open` (docs/12 §5: pembatalan ditolak saat setup/paused/finished), jadi tombol ikut nonaktif di luar itu.
 */
export function OpenOrders({
  orders,
  assets,
  canCancel,
  onChanged,
}: {
  orders: OpenOrder[];
  assets: MarketAsset[];
  canCancel: boolean;
  onChanged: () => void;
}) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const symbol = (id: string) => assets.find((a) => a.id === id)?.symbol ?? "—";

  const cancel = async (order: OpenOrder) => {
    if (busyId !== null) return;
    setBusyId(order.id);
    try {
      const res = await cancelOrder({ orderId: order.id });
      if (res.ok) toast.success(`Order ${symbol(order.assetId)} dibatalkan.`);
      else toast.error(res.message);
      onChanged();
    } catch {
      toast.error("Koneksi bermasalah. Coba lagi.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section
      aria-label="Order terbuka"
      className="rounded-panel border-line bg-card shadow-card flex flex-col gap-2.5 border p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-brand-text text-xs font-semibold tracking-[0.12em] uppercase">
          Order terbuka · {orders.length}
        </h2>
        <Link href="/team/orders" className="text-brand-text text-xs font-semibold hover:underline">
          Lihat semua →
        </Link>
      </div>

      {orders.length === 0 ? (
        <p className="text-ink-muted text-[13px]">Belum ada order terbuka.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {orders.slice(0, SHOWN).map((o) => (
            <li key={o.id} className="flex items-center gap-2">
              <Chip tone={o.side === "buy" ? "ok" : "bad"} className="border-0 px-2 py-0.5 text-xs font-bold">
                {o.side === "buy" ? "Beli" : "Jual"}
              </Chip>
              <p className="tnum text-ink min-w-0 flex-1 truncate text-[13px] font-semibold">
                {symbol(o.assetId)} · {formatNumber(o.remaining)}
                {o.remaining !== o.qty ? ` dari ${formatNumber(o.qty)}` : ""} lot @{" "}
                {formatNumber(o.price ?? 0)}
              </p>
              <button
                type="button"
                onClick={() => void cancel(o)}
                disabled={!canCancel || busyId !== null}
                aria-label={`Batalkan order ${o.side === "buy" ? "beli" : "jual"} ${symbol(o.assetId)}`}
                className="border-line text-bad-text hover:bg-soft min-h-9 shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45"
              >
                {busyId === o.id ? "…" : "Batalkan"}
              </button>
            </li>
          ))}
        </ul>
      )}
      {orders.length > SHOWN ? (
        <p className="text-ink-muted text-xs">dan {orders.length - SHOWN} order lain</p>
      ) : null}
    </section>
  );
}
