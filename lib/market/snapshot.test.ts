import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { mergeMarket } from "./data";
import {
  fetchMarketSnapshot,
  parseMarketSnapshot,
  resetSnapshotFallbackForTests,
  type MarketSnapshot,
} from "./snapshot";

type Db = SupabaseClient<Database>;

const game = {
  state: "open",
  sell_spread_bps: 200,
  hold_cap_pct: 30,
  stock_mid_pct: 50,
  stock_low_pct: 20,
  price_step: 100,
  pressure_bps_per_unit: 50,
  pressure_cap_bps: 1500,
};
const assets = [
  {
    id: "b",
    symbol: "BB",
    name: "Bata",
    sector: "Properti",
    price: 300_000,
    last_price: 300_000,
    min_price: 90_000,
    max_price: 900_000,
    suspended_until: null,
    stock: 24,
    init_stock: 24,
    price_factor_bps: 0,
  },
  {
    id: "a",
    symbol: "AA",
    name: "Apel",
    sector: "Teknologi",
    price: 800_000,
    last_price: 800_000,
    min_price: 240_000,
    max_price: 2_400_000,
    suspended_until: "2026-11-24T10:00:00+00:00",
    stock: 7,
    init_stock: 10,
    price_factor_bps: 130,
  },
];
const summary = [
  {
    asset_id: "a",
    symbol: "AA",
    ref_price: 780_000,
    last_price: 790_400,
    sell_price: 774_500,
    stock: 7,
    init_stock: 10,
    price_factor_bps: 130,
    open_price: 780_000,
    high_price: 792_000,
    low_price: 780_000,
    lot: 5,
    val: 3_900_000,
    avg_price: 783_000,
    freq: 3,
  },
];
const dayOpen = [{ asset_id: "a", open_price: 760_000 }];
const bankrupt = [
  {
    asset_id: "x",
    symbol: "XX",
    name: "Xenon",
    liquidation_price: 12_000,
    bankrupt_at: "2026-11-24T09:00:00+00:00",
  },
];
const holdings = [{ asset_id: "a", qty: 4, cost_basis: 3_000_001 }];
const analysis = { price: 100_000, can_buy: true, reason: "ok", owned: false, news_title: "Berita X" };
const json = { game, assets, summary, day_open: dayOpen, bankrupt, holdings, analysis };

describe("parseMarketSnapshot", () => {
  it("market = mergeMarket atas bagian yang sama (jalur lama dan baru satu pemeta)", () => {
    const s = parseMarketSnapshot(json)!;
    expect(s.market).toEqual(mergeMarket(assets, summary, dayOpen, 200));
    expect(s.market.map((a) => a.symbol)).toEqual(["AA", "BB"]);
    expect(s.market[0]).toMatchObject({ lastPrice: 790_400, sellPrice: 774_500, dayOpen: 760_000, stock: 7 });
    expect(s.market[0].suspendedUntil).toBe("2026-11-24T10:00:00+00:00");
  });

  it("game, kepemilikan, bangkrut, dan tawaran analisa dipetakan seperti jalur lama", () => {
    const s = parseMarketSnapshot(json)!;
    expect(s.game).toEqual({
      state: "open",
      sellSpreadBps: 200,
      holdCapPct: 30,
      stockMidPct: 50,
      stockLowPct: 20,
      priceStep: 100,
      pressureBpsPerUnit: 50,
      pressureCapBps: 1500,
    });
    expect(s.holdings).toEqual({ a: { qty: 4, costBasis: 3_000_001, avgCost: 750_000 } });
    expect(s.bankrupt).toEqual([
      {
        id: "x",
        symbol: "XX",
        name: "Xenon",
        liquidationPrice: 12_000,
        bankruptAt: "2026-11-24T09:00:00+00:00",
      },
    ]);
    expect(s.analysis).toEqual({
      price: 100_000,
      canBuy: true,
      reason: "ok",
      owned: false,
      newsTitle: "Berita X",
    });
  });

  it("tanpa baris analisa: analysis null; alasan tak dikenal jatuh ke no_live_news", () => {
    expect(parseMarketSnapshot({ ...json, analysis: null })!.analysis).toBeNull();
    expect(
      parseMarketSnapshot({ ...json, analysis: { ...analysis, reason: "aneh" } })!.analysis?.reason,
    ).toBe("no_live_news");
  });

  it("kolom opsional boleh hilang/null (aset tanpa ringkasan dan tanpa kepemilikan)", () => {
    const s = parseMarketSnapshot({ ...json, summary: [], day_open: [], holdings: [], bankrupt: [] })!;
    expect(s.holdings).toEqual({});
    expect(s.bankrupt).toEqual([]);
    expect(s.market.find((a) => a.symbol === "BB")).toMatchObject({ sellPrice: 294_000, dayOpen: 300_000 });
  });

  it("bentuk tidak sesuai → null", () => {
    expect(parseMarketSnapshot(null)).toBeNull();
    expect(parseMarketSnapshot({})).toBeNull();
    expect(parseMarketSnapshot({ ...json, game: null })).toBeNull();
    expect(parseMarketSnapshot({ ...json, assets: [] })).toBeNull();
    expect(parseMarketSnapshot({ ...json, holdings: "x" })).toBeNull();
    expect(parseMarketSnapshot({ ...json, game: { ...game, state: "aneh" } })).toBeNull();
  });
});

describe("fetchMarketSnapshot", () => {
  const legacySnapshot: MarketSnapshot = parseMarketSnapshot(json)!;
  const rpc = vi.fn();
  const db = { rpc } as unknown as Db;
  const legacy = vi.fn(async () => legacySnapshot);

  beforeEach(() => {
    resetSnapshotFallbackForTests();
    rpc.mockReset();
    legacy.mockClear();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("sukses: satu panggilan RPC, jalur lama tidak disentuh", async () => {
    rpc.mockResolvedValue({ data: json, error: null });
    expect((await fetchMarketSnapshot(db, legacy))?.market).toHaveLength(2);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("get_market_snapshot");
    expect(legacy).not.toHaveBeenCalled();
  });

  it("fungsi belum ada (PGRST202) di browser: jalur lama, dan RPC tidak dicoba lagi", async () => {
    vi.stubGlobal("window", {}); // kunci jalur lama hanya berlaku di browser
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "tidak ada" } });
    expect(await fetchMarketSnapshot(db, legacy)).toBe(legacySnapshot);
    expect(await fetchMarketSnapshot(db, legacy)).toBe(legacySnapshot);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(legacy).toHaveBeenCalledTimes(2);
  });

  it("di server jalur lama TIDAK dikunci (proses bersama banyak pengguna)", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "tidak ada" } });
    await fetchMarketSnapshot(db, legacy);
    await fetchMarketSnapshot(db, legacy);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("bentuk data salah di browser: jalur lama dan ingat untuk ketukan berikutnya", async () => {
    vi.stubGlobal("window", {});
    rpc.mockResolvedValue({ data: { game: null }, error: null });
    expect(await fetchMarketSnapshot(db, legacy)).toBe(legacySnapshot);
    await fetchMarketSnapshot(db, legacy);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("galat sementara (mis. jaringan/forbidden): null tanpa melipatgandakan panggilan", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "57014", message: "timeout" } });
    expect(await fetchMarketSnapshot(db, legacy)).toBeNull();
    expect(legacy).not.toHaveBeenCalled();
    // RPC tetap dicoba lagi di ketukan berikutnya.
    rpc.mockResolvedValue({ data: json, error: null });
    expect(await fetchMarketSnapshot(db, legacy)).not.toBeNull();
  });
});
