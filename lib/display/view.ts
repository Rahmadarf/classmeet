import { percentChange } from "@/lib/money";

export type LeaderRow = {
  teamId: string;
  name: string;
  rank: number;
  total: number;
  cash: number;
  holdings: number;
};

type RawLeader = {
  rank: number | null;
  team_id: string | null;
  team_name: string | null;
  cash: number | null;
  holdings_value: number | null;
  net_worth: number | null;
};

/**
 * `get_leaderboard()` → lima tim teratas. Layar publik mengambil seluruh hasil lalu memotong di klien
 * (docs/04 §3.3). Baris tak lengkap dibuang; urutan mengikuti `rank` lalu nama (stabil saat seri).
 */
export function topFive(rows: RawLeader[]): LeaderRow[] {
  return rows
    .flatMap((r): LeaderRow[] =>
      r.team_id && r.team_name && r.rank !== null && r.net_worth !== null
        ? [
            {
              teamId: r.team_id,
              name: r.team_name,
              rank: r.rank,
              total: r.net_worth,
              cash: r.cash ?? 0,
              holdings: r.holdings_value ?? 0,
            },
          ]
        : [],
    )
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
    .slice(0, 5);
}

export type Sector = { name: string; value: number; pct: number };
export type IndexSnapshot = { ikc: number | null; sectors: Sector[] };

/** `get_market_index()` → IKC dan indeks sektor. Persen terhadap basis 1.000. */
export function parseIndex(rows: { scope: string; value: number }[]): IndexSnapshot {
  const toNumber = (v: unknown) => (typeof v === "number" ? v : Number(v));
  const ikc = rows.find((r) => r.scope === "IKC");
  return {
    ikc: ikc ? toNumber(ikc.value) : null,
    sectors: rows
      .filter((r) => r.scope.startsWith("sektor:"))
      .map((r) => {
        const value = toNumber(r.value);
        return { name: r.scope.slice("sektor:".length), value, pct: (value - 1000) / 10 };
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export type Mover = { symbol: string; name: string; price: number; pct: number };

/**
 * Terbaik dan terlemah: perubahan harga terakhir terhadap harga OPEN hari ini (sama dengan chip di halaman Pasar tim).
 * Hanya aset yang benar-benar bergerak yang ikut (naik > 0 untuk terbaik, turun < 0 untuk terlemah).
 */
export function movers(
  assets: { symbol: string; name: string; openPrice: number; lastPrice: number }[],
  count = 4,
): { best: Mover[]; worst: Mover[] } {
  const all = assets
    .map((a) => ({
      symbol: a.symbol,
      name: a.name,
      price: a.lastPrice,
      pct: percentChange(a.lastPrice, a.openPrice) ?? 0,
    }))
    .sort((a, b) => b.pct - a.pct || a.symbol.localeCompare(b.symbol));
  return {
    best: all.filter((m) => m.pct > 0).slice(0, count),
    worst: all
      .filter((m) => m.pct < 0)
      .reverse()
      .slice(0, count),
  };
}

export type LastTrade = { symbol: string; price: number; at: string };

/** Transaksi terakhir per aset (dari `assets.last_trade_at`): akun display tidak bisa membaca `trades`. */
export function lastTrades(
  assets: { symbol: string; lastPrice: number; lastTradeAt: string | null }[],
  count = 3,
): LastTrade[] {
  return assets
    .flatMap((a) => (a.lastTradeAt ? [{ symbol: a.symbol, price: a.lastPrice, at: a.lastTradeAt }] : []))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, count);
}
