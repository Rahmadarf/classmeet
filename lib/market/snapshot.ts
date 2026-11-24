import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { fetchAnalysisOffer, toAnalysisOffer } from "@/lib/analysis/data";
import type { AnalysisOffer } from "@/lib/analysis/view";
import type { Database } from "@/lib/supabase/database.types";
import {
  fetchBankruptAssets,
  fetchGame,
  fetchHoldings,
  fetchMarket,
  mergeMarket,
  toBankruptAssets,
  toGame,
  toHoldings,
  type BankruptAsset,
  type Game,
  type GameRow,
  type Holding,
  type MarketAsset,
} from "./data";

type Db = SupabaseClient<Database>;

/** Semua yang dibaca papan Pasar tim dalam satu pengambilan (`get_market_snapshot`, scripts/sql/market-snapshot.sql). */
export type MarketSnapshot = {
  game: Game;
  market: MarketAsset[];
  holdings: Record<string, Holding>;
  bankrupt: BankruptAsset[];
  /** Tawaran Analisa Pasar; null bila tidak ada baris. */
  analysis: AnalysisOffer | null;
};

// Bentuk JSON dari SQL (kolom snake_case persis seperti fungsi/tabel aslinya). Hanya memeriksa kolom yang dipakai;
// pengecekan nilai uang tetap dilakukan `mergeMarket` (isMoney). Bentuk tak sesuai → null → jalur cadangan.
const num = z.number();
const numOpt = z.number().nullish();

const gameSchema = z.object({
  state: z.enum(["setup", "open", "paused", "finished"]),
  sell_spread_bps: num,
  hold_cap_pct: num,
  stock_mid_pct: num,
  stock_low_pct: num,
  price_step: num,
  pressure_bps_per_unit: num,
  pressure_cap_bps: num,
});
const assetSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  sector: z.string(),
  price: num,
  last_price: numOpt,
  min_price: numOpt,
  max_price: numOpt,
  suspended_until: z.string().nullish(),
  stock: numOpt,
  init_stock: numOpt,
  price_factor_bps: numOpt,
});
const summarySchema = z.object({
  asset_id: z.string(),
  symbol: z.string(),
  ref_price: numOpt,
  last_price: numOpt,
  sell_price: numOpt,
  stock: numOpt,
  init_stock: numOpt,
  price_factor_bps: numOpt,
  open_price: numOpt,
  high_price: numOpt,
  low_price: numOpt,
  lot: numOpt,
  val: numOpt,
  avg_price: numOpt,
  freq: numOpt,
});
const dayOpenSchema = z.object({ asset_id: z.string(), open_price: numOpt });
const bankruptSchema = z.object({
  asset_id: z.string(),
  symbol: z.string(),
  name: z.string(),
  liquidation_price: numOpt,
  bankrupt_at: z.string(),
});
const holdingSchema = z.object({ asset_id: z.string(), qty: num, cost_basis: num });
const analysisSchema = z.object({
  price: num,
  can_buy: z.boolean(),
  reason: z.string(),
  owned: z.boolean(),
  news_title: z.string().nullable(),
});
const snapshotSchema = z.object({
  game: gameSchema,
  assets: z.array(assetSchema).min(1),
  summary: z.array(summarySchema),
  day_open: z.array(dayOpenSchema),
  bankrupt: z.array(bankruptSchema),
  holdings: z.array(holdingSchema),
  analysis: analysisSchema.nullable(),
});

/** JSON `get_market_snapshot` → `MarketSnapshot`; null bila bentuknya tidak sesuai. Memakai ulang pemeta yang sama dengan jalur lama. */
export function parseMarketSnapshot(json: unknown): MarketSnapshot | null {
  const parsed = snapshotSchema.safeParse(json);
  if (!parsed.success) return null;
  const d = parsed.data;
  const market = mergeMarket(
    d.assets as unknown as Parameters<typeof mergeMarket>[0],
    d.summary as unknown as Parameters<typeof mergeMarket>[1],
    d.day_open as unknown as Parameters<typeof mergeMarket>[2],
    d.game.sell_spread_bps,
  );
  if (market.length === 0) return null;
  return {
    game: toGame(d.game as GameRow),
    market,
    holdings: toHoldings(d.holdings),
    bankrupt: toBankruptAssets(d.bankrupt as unknown as Parameters<typeof toBankruptAssets>[0]),
    analysis: d.analysis
      ? toAnalysisOffer(d.analysis as unknown as Parameters<typeof toAnalysisOffer>[0])
      : null,
  };
}

/**
 * Jalur lama: 7 panggilan terpisah (game, aset, ringkasan, harga open, kepemilikan, bangkrut, tawaran analisa).
 * Dipakai hanya sebagai cadangan bila fungsi SQL belum dimuat di database. Semua-atau-tidak-sama-sekali, seperti
 * jalur utama: bagian yang gagal membuat seluruh pengambilan gagal (data lama tetap tampil di layar).
 */
export async function fetchMarketSnapshotLegacy(db: Db): Promise<MarketSnapshot | null> {
  const game = await fetchGame(db);
  if (!game) return null;
  const [market, holdings, bankrupt, analysis] = await Promise.all([
    fetchMarket(db, game.sellSpreadBps),
    fetchHoldings(db),
    fetchBankruptAssets(db),
    fetchAnalysisOffer(db),
  ]);
  if (!market || market.length === 0 || !holdings || !bankrupt) return null;
  return { game, market, holdings, bankrupt, analysis };
}

/** Kode PostgREST bila fungsi tidak ada di database (PGRST202) atau di skema yang belum dimuat ulang. */
const isMissingFunction = (error: { code?: string; message?: string } | null) =>
  error?.code === "PGRST202" || error?.code === "42883";

/**
 * Fungsi hilang atau bentuk datanya tak sesuai: pakai jalur lama selama halaman terbuka. Hanya di browser; di server
 * (proses bersama banyak pengguna) tidak dikunci, supaya database yang diperbarui langsung terpakai tanpa restart.
 */
let rpcUnusable = false;
const latch = () => {
  if (typeof window !== "undefined") rpcUnusable = true;
};

/**
 * Satu RPC `get_market_snapshot()` (1 panggilan, 1 snapshot database). Jatuh ke jalur lama bila fungsinya belum ada
 * atau bila hasilnya tidak berbentuk benar (dan tidak mencobanya lagi selama halaman terbuka, supaya tidak 8
 * panggilan per ketukan). Galat sementara (jaringan) TIDAK memicu jalur lama: sama-sama akan gagal, dan lebih baik
 * gagal cepat daripada melipatgandakan panggilan.
 */
export async function fetchMarketSnapshot(
  db: Db,
  legacy: (db: Db) => Promise<MarketSnapshot | null> = fetchMarketSnapshotLegacy,
): Promise<MarketSnapshot | null> {
  if (!rpcUnusable) {
    const { data, error } = await db.rpc("get_market_snapshot");
    if (!error && data) {
      const snapshot = parseMarketSnapshot(data);
      if (snapshot) return snapshot;
      latch();
      console.warn("[pasar] get_market_snapshot: bentuk data tidak sesuai, memakai jalur lama");
    } else if (isMissingFunction(error)) {
      latch();
      console.warn("[pasar] get_market_snapshot belum ada di database, memakai jalur lama (7 panggilan)");
    } else {
      return null;
    }
  }
  return legacy(db);
}

/** Hanya untuk tes: ulangi pengecekan fungsi yang hilang. */
export function resetSnapshotFallbackForTests() {
  rpcUnusable = false;
}
