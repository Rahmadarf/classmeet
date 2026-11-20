import type { StockLevel } from "@/lib/market/rules";
import { stockLevel } from "@/lib/market/rules";

/** Satu transaksi beli/jual untuk daftar admin. `price` = harga satuan yang dibayar/diterima. */
export type TxRow = {
  id: number;
  at: string;
  teamName: string;
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  price: number;
  total: number;
};

/** Ringkasan satu aset: arus unit, nilai, dan keadaan stok/tekanan sekarang. */
export type AssetFlow = {
  assetId: string;
  symbol: string;
  name: string;
  bought: number;
  sold: number;
  /** Σ total semua transaksi (beli + jual). */
  volume: number;
  count: number;
  stock: number;
  initStock: number;
  factorBps: number;
  level: StockLevel;
};

export type TransactionsPage = {
  rows: TxRow[];
  flows: AssetFlow[];
  totals: { count: number; volume: number; bought: number; sold: number };
};

type TxIn = {
  id: number;
  teamId: string;
  assetId: string;
  side: string;
  qty: number;
  unitPrice: number;
  total: number;
  createdAt: string;
};
type SummaryIn = { assetId: string; bought: number; sold: number; volume: number; n: number };
type AssetIn = {
  id: string;
  symbol: string;
  name: string;
  stock: number;
  initStock: number;
  factorBps: number;
};

/**
 * Susun halaman Transaksi admin. `txs` = transaksi terbaru (daftar), `summary` = agregat SELURUH transaksi per aset
 * (`admin_transaction_summary`). Aset yang belum pernah bertransaksi tetap tampil (nol). Urutan ringkasan: nilai
 * terbesar dulu, lalu simbol. Nama tim/aset tak dikenal memakai nama umum.
 */
export function buildTransactionsPage(
  txs: TxIn[],
  summary: SummaryIn[],
  teams: Record<string, string>,
  assets: AssetIn[],
  stockMidPct = 50,
  stockLowPct = 20,
): TransactionsPage {
  const byAsset = new Map(assets.map((a) => [a.id, a]));
  const sum = new Map(summary.map((s) => [s.assetId, s]));
  const rows = txs.flatMap((t): TxRow[] => {
    if (t.side !== "buy" && t.side !== "sell") return [];
    return [
      {
        id: t.id,
        at: t.createdAt,
        teamName: teams[t.teamId] ?? "Tim",
        symbol: byAsset.get(t.assetId)?.symbol ?? "—",
        side: t.side,
        qty: t.qty,
        price: t.unitPrice,
        total: t.total,
      },
    ];
  });
  const flows = assets
    .map((a): AssetFlow => {
      const s = sum.get(a.id);
      return {
        assetId: a.id,
        symbol: a.symbol,
        name: a.name,
        bought: s?.bought ?? 0,
        sold: s?.sold ?? 0,
        volume: s?.volume ?? 0,
        count: s?.n ?? 0,
        stock: a.stock,
        initStock: a.initStock,
        factorBps: a.factorBps,
        level: stockLevel(a.stock, a.initStock, stockMidPct, stockLowPct),
      };
    })
    .sort((x, y) => y.volume - x.volume || x.symbol.localeCompare(y.symbol));
  return {
    rows,
    flows,
    totals: {
      count: flows.reduce((n, f) => n + f.count, 0),
      volume: flows.reduce((n, f) => n + f.volume, 0),
      bought: flows.reduce((n, f) => n + f.bought, 0),
      sold: flows.reduce((n, f) => n + f.sold, 0),
    },
  };
}
