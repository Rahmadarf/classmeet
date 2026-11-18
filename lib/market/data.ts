import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { isMoney } from "@/lib/money";
import type { BookLevel } from "./rules";

type Db = SupabaseClient<Database>;

/** Aset di halaman Pasar. `lastPrice` = harga transaksi terakhir (BUKAN harga peringkat). */
export type MarketAsset = {
  id: string;
  symbol: string;
  name: string;
  sector: string;
  /** Harga acuan (hanya digeser berita). Dasar batas ARA/ARB dan pembanding perubahan di layar. */
  refPrice: number;
  lastPrice: number;
  /** Suspensi sementara (event berita) sampai waktu ini; null bila tidak disuspensi. Bandingkan dengan jam sekarang. */
  suspendedUntil: string | null;
  /** Statistik dari tabel `trades`; null bila belum ada transaksi. */
  open: number | null;
  high: number | null;
  low: number | null;
  avg: number | null;
  lot: number;
  val: number;
  freq: number;
};

type AssetRow = Pick<
  Database["public"]["Tables"]["assets"]["Row"],
  "id" | "symbol" | "name" | "sector" | "price" | "last_price"
> & { suspended_until?: string | null };
type SummaryRow = Database["public"]["Functions"]["get_market_summary"]["Returns"][number];

const orNull = (v: number | null | undefined) => (isMoney(v) ? v : null);

/** Gabungkan daftar aset (nama, sektor) dengan `get_market_summary()` (harga dan statistik). */
export function mergeMarket(assets: AssetRow[], summary: SummaryRow[]): MarketAsset[] {
  const stats = new Map(summary.map((s) => [s.asset_id, s]));
  return assets
    .map((a): MarketAsset | null => {
      const s = stats.get(a.id);
      const lastPrice = s?.last_price ?? a.last_price ?? a.price;
      const refPrice = s?.ref_price ?? a.price;
      if (!isMoney(lastPrice) || !isMoney(refPrice)) return null;
      return {
        id: a.id,
        symbol: a.symbol,
        name: a.name,
        sector: a.sector,
        refPrice,
        lastPrice,
        suspendedUntil: a.suspended_until ?? null,
        open: orNull(s?.open_price),
        high: orNull(s?.high_price),
        low: orNull(s?.low_price),
        avg: orNull(s?.avg_price),
        lot: isMoney(s?.lot) ? s.lot : 0,
        val: isMoney(s?.val) ? s.val : 0,
        freq: isMoney(s?.freq) ? s.freq : 0,
      };
    })
    .filter((a): a is MarketAsset => a !== null)
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export async function fetchMarket(supabase: Db): Promise<MarketAsset[] | null> {
  const [assets, summary] = await Promise.all([
    supabase
      .from("assets")
      .select("id,symbol,name,sector,price,last_price,suspended_until")
      .eq("is_active", true),
    supabase.rpc("get_market_summary"),
  ]);
  if (assets.error || !assets.data || summary.error || !summary.data) return null;
  return mergeMarket(assets.data, summary.data);
}

/** Order book 5 level per sisi, level 1 = terbaik di kedua sisi (bid tertinggi / offer terendah). */
export type OrderBook = { bids: BookLevel[]; offers: BookLevel[] };

type BookRow = Database["public"]["Functions"]["get_order_book"]["Returns"][number];

export function mapOrderBook(rows: BookRow[]): OrderBook {
  const level = (r: BookRow): BookLevel => ({ price: r.price, lots: r.lots, freq: r.freq, mine: r.mine });
  return {
    bids: rows
      .filter((r) => r.side === "buy")
      .map(level)
      .sort((a, b) => b.price - a.price),
    offers: rows
      .filter((r) => r.side === "sell")
      .map(level)
      .sort((a, b) => a.price - b.price),
  };
}

export async function fetchOrderBook(supabase: Db, assetId: string): Promise<OrderBook | null> {
  const { data, error } = await supabase.rpc("get_order_book", { p_asset_id: assetId });
  if (error || !data) return null;
  return mapOrderBook(data);
}

/** Batas ARB (lo) dan ARA (hi) menurut server (`order_band`): satu sumber kebenaran, tidak dihitung ulang di klien. */
export type Band = { lo: number; hi: number };

export async function fetchBand(supabase: Db, assetId: string): Promise<Band | null> {
  const { data, error } = await supabase.rpc("order_band", { p_asset: assetId });
  const row = data?.[0];
  if (error || !row || !isMoney(row.lo) || !isMoney(row.hi)) return null;
  return { lo: row.lo, hi: row.hi };
}

export type GameState = Database["public"]["Enums"]["game_state"];
export type Game = { state: GameState; feeBps: number; sweepLevels: number };

export async function fetchGame(supabase: Db): Promise<Game | null> {
  const { data, error } = await supabase
    .from("game_settings")
    .select("state,fee_bps,sweep_levels")
    .maybeSingle();
  if (error || !data) return null;
  return { state: data.state, feeBps: data.fee_bps, sweepLevels: data.sweep_levels };
}

/** Kepemilikan tim (RLS: hanya baris milik sendiri). `available` = qty − terkunci di order jual. */
export type Holding = { qty: number; locked: number; available: number };

export async function fetchHoldings(supabase: Db): Promise<Record<string, Holding> | null> {
  const { data, error } = await supabase.from("holdings").select("asset_id,qty,locked_qty");
  if (error || !data) return null;
  return Object.fromEntries(
    data.map((h) => [
      h.asset_id,
      { qty: h.qty, locked: h.locked_qty, available: Math.max(h.qty - h.locked_qty, 0) },
    ]),
  );
}

export type OpenOrder = {
  id: number;
  assetId: string;
  side: "buy" | "sell";
  kind: "limit" | "market";
  price: number | null;
  qty: number;
  remaining: number;
  /** Kunci per lot untuk order beli limit (harga + biaya); 0 untuk order jual. */
  lockPerLot: number;
  status: "open" | "partial";
  createdAt: string;
};

/** Order antre milik tim (status open/partial; RLS membatasi ke baris sendiri). Terbaru di atas. */
export async function fetchOpenOrders(supabase: Db): Promise<OpenOrder[] | null> {
  const { data, error } = await supabase
    .from("orders")
    .select("id,asset_id,side,kind,price,qty,remaining,lock_per_lot,status,created_at")
    .in("status", ["open", "partial"])
    .eq("is_house", false)
    .order("id", { ascending: false });
  if (error || !data) return null;
  return data.flatMap((o) =>
    (o.side === "buy" || o.side === "sell") &&
    (o.kind === "limit" || o.kind === "market") &&
    (o.status === "open" || o.status === "partial")
      ? [
          {
            id: o.id,
            assetId: o.asset_id,
            side: o.side,
            kind: o.kind,
            price: o.price,
            qty: o.qty,
            remaining: o.remaining,
            lockPerLot: o.lock_per_lot,
            status: o.status,
            createdAt: o.created_at,
          },
        ]
      : [],
  );
}

/** Jumlah order antre milik tim (untuk lencana sidebar). */
export async function fetchOpenOrderCount(supabase: Db): Promise<number | null> {
  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .in("status", ["open", "partial"])
    .eq("is_house", false);
  return error || count === null ? null : count;
}

/** Order yang sudah selesai (terisi penuh atau dibatalkan), milik tim, terbaru di atas. */
export type ClosedOrder = {
  id: number;
  assetId: string;
  side: "buy" | "sell";
  kind: "limit" | "market";
  price: number | null;
  qty: number;
  remaining: number;
  status: "filled" | "cancelled";
  createdAt: string;
  /** Harga rata-rata terisi (dari `trades` milik sendiri); null bila belum ada yang terisi. */
  avgFillPrice: number | null;
};

const HISTORY_LIMIT = 100;

export async function fetchClosedOrders(supabase: Db): Promise<ClosedOrder[] | null> {
  const [orders, trades] = await Promise.all([
    supabase
      .from("orders")
      .select("id,asset_id,side,kind,price,qty,remaining,status,created_at")
      .in("status", ["filled", "cancelled"])
      .eq("is_house", false)
      .order("id", { ascending: false })
      .limit(HISTORY_LIMIT),
    supabase
      .from("trades")
      .select("buy_order_id,sell_order_id,price,qty")
      .order("id", { ascending: false })
      .limit(500),
  ]);
  if (orders.error || !orders.data || trades.error || !trades.data) return null;

  // Rata-rata tertimbang per order (trades hanya memuat transaksi tim ini lewat RLS).
  const fills = new Map<number, { qty: number; value: number }>();
  for (const t of trades.data) {
    for (const id of [t.buy_order_id, t.sell_order_id]) {
      const f = fills.get(id) ?? { qty: 0, value: 0 };
      f.qty += t.qty;
      f.value += t.price * t.qty;
      fills.set(id, f);
    }
  }
  return orders.data.flatMap((o) => {
    if ((o.side !== "buy" && o.side !== "sell") || (o.kind !== "limit" && o.kind !== "market")) return [];
    if (o.status !== "filled" && o.status !== "cancelled") return [];
    const f = fills.get(o.id);
    return [
      {
        id: o.id,
        assetId: o.asset_id,
        side: o.side,
        kind: o.kind,
        price: o.price,
        qty: o.qty,
        remaining: o.remaining,
        status: o.status,
        createdAt: o.created_at,
        avgFillPrice: f && f.qty > 0 ? Math.round(f.value / f.qty) : null,
      },
    ];
  });
}

/** Nama aset untuk menamai baris order (aktif maupun tidak). */
export async function fetchAssetNames(
  supabase: Db,
): Promise<Record<string, { symbol: string; name: string }> | null> {
  const { data, error } = await supabase.from("assets").select("id,symbol,name");
  if (error || !data) return null;
  return Object.fromEntries(data.map((a) => [a.id, { symbol: a.symbol, name: a.name }]));
}

/** Aset yang sudah bangkrut (event berita): tidak bisa diorder lagi; unit tim sudah dilikuidasi ke uang. */
export type BankruptAsset = {
  id: string;
  symbol: string;
  name: string;
  /** Uang per unit saat likuidasi; null bila unit tidak diganti (0 %). */
  liquidationPrice: number | null;
  bankruptAt: string;
};

export async function fetchBankruptAssets(supabase: Db): Promise<BankruptAsset[] | null> {
  const { data, error } = await supabase
    .from("assets")
    .select("id,symbol,name,liquidation_price,bankrupt_at")
    .not("bankrupt_at", "is", null)
    .order("bankrupt_at", { ascending: false });
  if (error || !data) return null;
  return data.flatMap((a) =>
    a.bankrupt_at
      ? [
          {
            id: a.id,
            symbol: a.symbol,
            name: a.name,
            liquidationPrice: a.liquidation_price,
            bankruptAt: a.bankrupt_at,
          },
        ]
      : [],
  );
}

/** Aset sedang disuspensi pada saat `nowMs` (`suspended_until` di masa depan). */
export function isSuspended(asset: { suspendedUntil: string | null }, nowMs: number): boolean {
  return asset.suspendedUntil !== null && Date.parse(asset.suspendedUntil) > nowMs;
}
