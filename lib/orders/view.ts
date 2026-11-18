import type { ClosedOrder, GameState, Holding, OpenOrder } from "@/lib/market/data";
import { dayKeyWib } from "@/lib/money";

/** Order yang dibuat hari ini menurut WIB (skema tidak punya konsep "hari permainan"; docs/13 log). */
export function isTodayWib<T extends { createdAt: string }>(orders: T[], nowMs: number): T[] {
  const today = dayKeyWib(nowMs);
  return orders.filter((o) => dayKeyWib(o.createdAt) === today);
}

/** Ringkasan tiga angka di kepala halaman Order (Figma 1122:927). */
export type OrdersSummary = {
  open: number;
  buys: number;
  sells: number;
  /** Aset yang terkunci di order jual: total unit dan unit per aset (hanya yang > 0). */
  lockedUnits: number;
  lockedByAsset: { assetId: string; units: number }[];
};

export function summarizeOrders(orders: OpenOrder[], holdings: Record<string, Holding>): OrdersSummary {
  const lockedByAsset = Object.entries(holdings)
    .filter(([, h]) => h.locked > 0)
    .map(([assetId, h]) => ({ assetId, units: h.locked }));
  return {
    open: orders.length,
    buys: orders.filter((o) => o.side === "buy").length,
    sells: orders.filter((o) => o.side === "sell").length,
    lockedUnits: lockedByAsset.reduce((sum, a) => sum + a.units, 0),
    lockedByAsset,
  };
}

/** Teks status riwayat (Figma 1122:977): "Terisi 3 / 3", "Terisi 1 / 2 · sisa dibatalkan", "Dibatalkan oleh tim". */
export function closedStatusText(order: ClosedOrder, state: GameState): string {
  const filled = order.qty - order.remaining;
  if (order.status === "filled" || order.remaining === 0) return `Terisi ${filled} / ${order.qty}`;
  if (filled > 0) return `Terisi ${filled} / ${order.qty} · sisa dibatalkan`;
  if (order.kind === "market") return "Tidak terisi · tidak ada lawan";
  return state === "finished" ? "Dibatalkan saat pasar ditutup" : "Dibatalkan oleh tim";
}
