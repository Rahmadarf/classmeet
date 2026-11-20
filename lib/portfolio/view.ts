import { percentChange } from "@/lib/money";

/** Satu aset yang dipegang tim. `valuePrice` = harga tayang (harga beli) saat ini. */
export type PortfolioRow = {
  assetId: string;
  symbol: string;
  name: string;
  qty: number;
  /** Harga beli rata-rata per unit (cost_basis ÷ qty), dibulatkan. */
  avgCost: number;
  costBasis: number;
  valuePrice: number;
  value: number;
  pnl: number;
  pnlPct: number | null;
};

export type Portfolio = {
  rows: PortfolioRow[];
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  totalPnlPct: number | null;
};

type HoldingIn = { assetId: string; qty: number; costBasis: number };
type AssetIn = { id: string; symbol: string; name: string; rankPrice: number | null; price: number };

/**
 * Susun portofolio dari kepemilikan dan harga aset. Rumus nilai sama dengan `get_my_summary` (docs/03 §4):
 * qty × coalesce(rank_price, price); rank_price = harga tayang (docs/17). Untung/rugi = nilai − cost_basis (harga beli
 * total; saat menjual, cost_basis berkurang menurut rata-rata). Baris diurutkan dari nilai terbesar.
 */
export function buildPortfolio(holdings: HoldingIn[], assets: AssetIn[]): Portfolio {
  const byId = new Map(assets.map((a) => [a.id, a]));
  const rows = holdings
    .filter((h) => h.qty > 0)
    .flatMap((h): PortfolioRow[] => {
      const a = byId.get(h.assetId);
      if (!a) return [];
      const valuePrice = a.rankPrice ?? a.price;
      const value = h.qty * valuePrice;
      const pnl = value - h.costBasis;
      return [
        {
          assetId: a.id,
          symbol: a.symbol,
          name: a.name,
          qty: h.qty,
          avgCost: Math.round(h.costBasis / h.qty),
          costBasis: h.costBasis,
          valuePrice,
          value,
          pnl,
          pnlPct: percentChange(value, h.costBasis),
        },
      ];
    })
    .sort((x, y) => y.value - x.value || x.symbol.localeCompare(y.symbol));

  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const totalCost = rows.reduce((s, r) => s + r.costBasis, 0);
  return {
    rows,
    totalValue,
    totalCost,
    totalPnl: totalValue - totalCost,
    totalPnlPct: percentChange(totalValue, totalCost),
  };
}
