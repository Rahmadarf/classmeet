import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { isMoney } from "@/lib/money";
import { sellPriceOf } from "./rules";

type Db = SupabaseClient<Database>;

/** Aset di halaman Pasar (model toko, docs/17). `lastPrice` = HARGA TAYANG (harga beli); `sellPrice` = harga jual. */
export type MarketAsset = {
  id: string;
  symbol: string;
  name: string;
  sector: string;
  /** Harga acuan (hanya digeser berita). Harga tayang = acuan x faktor tekanan stok. */
  refPrice: number;
  /** Harga open hari ini (harga acuan saat hari WIB itu dimulai); pembanding persen perubahan di layar. Cadangan: harga acuan. */
  dayOpen: number;
  lastPrice: number;
  /** Harga jual = harga tayang dikurangi selisih jual. */
  sellPrice: number;
  /** Sisa stok di pasar dan stok awal. */
  stock: number;
  initStock: number;
  /** Tekanan stok dalam basis poin (+ setelah dibeli, − setelah dijual; kembali ke 0 sendiri). */
  factorBps: number;
  /** Suspensi sementara (event berita) sampai waktu ini; null bila tidak disuspensi. Bandingkan dengan jam sekarang. */
  suspendedUntil: string | null;
  /** Statistik dari tabel `transactions`; null bila belum ada transaksi. */
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
> & {
  suspended_until?: string | null;
  stock?: number;
  init_stock?: number | null;
  price_factor_bps?: number;
};
type SummaryRow = Database["public"]["Functions"]["get_market_summary"]["Returns"][number];
type DayOpenRow = Database["public"]["Functions"]["get_day_open_prices"]["Returns"][number];

const orNull = (v: number | null | undefined) => (isMoney(v) ? v : null);

/** Gabungkan daftar aset (nama, sektor) dengan `get_market_summary()` (harga, stok, dan statistik). */
export function mergeMarket(
  assets: AssetRow[],
  summary: SummaryRow[],
  dayOpen: DayOpenRow[] = [],
  spreadBps = 200,
): MarketAsset[] {
  const stats = new Map(summary.map((s) => [s.asset_id, s]));
  const opens = new Map(dayOpen.map((o) => [o.asset_id, o.open_price]));
  return assets
    .map((a): MarketAsset | null => {
      const s = stats.get(a.id);
      const lastPrice = s?.last_price ?? a.last_price ?? a.price;
      const refPrice = s?.ref_price ?? a.price;
      if (!isMoney(lastPrice) || !isMoney(refPrice)) return null;
      const stock = s?.stock ?? a.stock ?? 0;
      return {
        id: a.id,
        symbol: a.symbol,
        name: a.name,
        sector: a.sector,
        refPrice,
        dayOpen: orNull(opens.get(a.id)) ?? refPrice,
        lastPrice,
        sellPrice: isMoney(s?.sell_price) ? s.sell_price : sellPriceOf(lastPrice, spreadBps),
        stock,
        initStock: s?.init_stock ?? a.init_stock ?? stock,
        factorBps: s?.price_factor_bps ?? a.price_factor_bps ?? 0,
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

export async function fetchMarket(supabase: Db, spreadBps = 200): Promise<MarketAsset[] | null> {
  const [assets, summary, dayOpen] = await Promise.all([
    supabase
      .from("assets")
      .select("id,symbol,name,sector,price,last_price,suspended_until,stock,init_stock,price_factor_bps")
      .eq("is_active", true),
    supabase.rpc("get_market_summary"),
    supabase.rpc("get_day_open_prices"),
  ]);
  if (assets.error || !assets.data || summary.error || !summary.data) return null;
  // Harga open gagal dimuat: persen memakai harga acuan (seperti sebelumnya), bukan mengosongkan daftar.
  return mergeMarket(assets.data, summary.data, dayOpen.data ?? [], spreadBps);
}

export type GameState = Database["public"]["Enums"]["game_state"];
/** Status pasar dan parameter toko (selisih jual, batas pegang, batas label stok). */
export type Game = {
  state: GameState;
  sellSpreadBps: number;
  holdCapPct: number;
  stockMidPct: number;
  stockLowPct: number;
};

export async function fetchGame(supabase: Db): Promise<Game | null> {
  const { data, error } = await supabase
    .from("game_settings")
    .select("state,sell_spread_bps,hold_cap_pct,stock_mid_pct,stock_low_pct")
    .maybeSingle();
  if (error || !data) return null;
  return {
    state: data.state,
    sellSpreadBps: data.sell_spread_bps,
    holdCapPct: data.hold_cap_pct,
    stockMidPct: data.stock_mid_pct,
    stockLowPct: data.stock_low_pct,
  };
}

/** Kepemilikan tim (RLS: hanya baris milik sendiri). `avgCost` = harga beli rata-rata per unit. */
export type Holding = { qty: number; costBasis: number; avgCost: number };

export async function fetchHoldings(supabase: Db): Promise<Record<string, Holding> | null> {
  const { data, error } = await supabase.from("holdings").select("asset_id,qty,cost_basis").gt("qty", 0);
  if (error || !data) return null;
  return Object.fromEntries(
    data.map((h) => [
      h.asset_id,
      { qty: h.qty, costBasis: h.cost_basis, avgCost: h.qty > 0 ? Math.round(h.cost_basis / h.qty) : 0 },
    ]),
  );
}

/** Nama aset untuk menamai baris transaksi (aktif maupun tidak). */
export async function fetchAssetNames(
  supabase: Db,
): Promise<Record<string, { symbol: string; name: string }> | null> {
  const { data, error } = await supabase.from("assets").select("id,symbol,name");
  if (error || !data) return null;
  return Object.fromEntries(data.map((a) => [a.id, { symbol: a.symbol, name: a.name }]));
}

/** Notif aset bangkrut (event berita): aset tidak bisa dibeli/dijual lagi, unit tim sudah dilikuidasi ke uang. Notif hilang setelah efek berita berikutnya diterapkan. */
export type BankruptAsset = {
  id: string;
  symbol: string;
  name: string;
  /** Uang per unit saat likuidasi; null bila unit tidak diganti (0 %). */
  liquidationPrice: number | null;
  bankruptAt: string;
};

export async function fetchBankruptAssets(supabase: Db): Promise<BankruptAsset[] | null> {
  // RPC, bukan tabel `assets`: notif hanya tampil sampai efek berita berikutnya diterapkan (scripts/sql/bankrupt-notice.sql).
  const { data, error } = await supabase.rpc("get_bankrupt_notices");
  if (error || !data) return null;
  return data.map((a) => ({
    id: a.asset_id,
    symbol: a.symbol,
    name: a.name,
    liquidationPrice: a.liquidation_price,
    bankruptAt: a.bankrupt_at,
  }));
}

/** Aset sedang disuspensi pada saat `nowMs` (`suspended_until` di masa depan). */
export function isSuspended(asset: { suspendedUntil: string | null }, nowMs: number): boolean {
  return asset.suspendedUntil !== null && Date.parse(asset.suspendedUntil) > nowMs;
}
