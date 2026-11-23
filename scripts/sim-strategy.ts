/**
 * Simulator strategi untuk MENGALIBRASI ekonomi (23 Nov, setelah koreksi: efek berita kecil dan terlalu sensitif).
 * Satu "tim" memperdagangkan kumpulan berita sungguhan (buildPool) dengan rumus beli/jual sungguhan (lib/market/rules.ts:
 * tekanan di dalam transaksi, selisih jual, batas pegang, stok) selama beberapa hari permainan, lalu hasilnya dibandingkan
 * antar strategi dan antar parameter. Tidak menyentuh database.
 *
 *   npx tsx scripts/sim-strategy.ts                      # satu skenario bawaan, 3 hari, 20 benih
 *   npx tsx scripts/sim-strategy.ts --scale 1.5 --spread 200     # kalikan efek kumpulan bawaan di simulator
 *   npx tsx scripts/sim-strategy.ts --gen 2.5 --analysis 75000    # bangun kumpulan dengan config.effectScale tertentu
 *   npx tsx scripts/sim-strategy.ts --grid               # kisi skala efek x selisih jual
 *   opsi: --days 3 --seeds 20 --cash 5000000 --income 300000 --share 0.2 --hold 30 --pressure 20
 *         --analysis 200000 --deploy 6000000 --dir 0.7 --events 0.15
 *
 * Strategi (semuanya membeli selama jeda berita lalu menjual begitu efek berlaku):
 *   hint      pembaca petunjuk: mengenali aset yang disebut berita (satu naik, satu turun). Petunjuk tanpa arah ditebak benar
 *             dengan peluang --dir (bawaan 0,7); membeli yang dikira naik.
 *   analisa   pembeli analisa: membayar --analysis per berita HANYA bila perkiraan laba (modal terkerahkan x laba bersih rata-rata
 *             yang dialaminya) melebihi harga; tahu 3 aset naik terbesar dengan pasti, membagi uang rata.
 *   acak      membeli satu aset acak tiap berita.
 * Asumsi: uang tim ditambah --income tiap 20 menit (hadiah pos); hanya --share dari stok yang bisa dijangkau satu tim
 * (rebutan dengan tim lain); berita dipilih seragam dari kumpulan (mesin sungguhan memilih menurut kondisi pasar);
 * 15 % giliran membawa event (efek harganya dipakai; dividen/suspensi/bangkrut diabaikan); jeda efek 3-15 menit.
 */
import assetsFile from "./data/assets.example.json";
import { buildPool, DEFAULT_CONFIG, type PoolNews } from "./news-pool-lib";
import { stockForPrice } from "./seed-lib";
import { buyTotal, holdCap, sellTotal, type PriceModel } from "../lib/market/rules";

const args = process.argv.slice(2);
const opt = (n: string, d: number) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? Number(args[i + 1]) : d;
};
const flag = (n: string) => args.includes(`--${n}`);

type Params = {
  scale: number;
  spread: number;
  pressure: number;
  cap: number;
  hold: number;
  days: number;
  seeds: number;
  cash: number;
  income: number;
  share: number;
  analysis: number;
  dir: number;
  events: number;
  /** Pembeli analisa hanya membeli bila saldo >= analysis x akmin (laba kira-kira 4 % per berita harus melampaui harganya). */
  akmin: number;
  /** Modal yang realistis bisa dikerahkan satu tim per berita (stok dan batas pegang membatasi); dasar perkiraan laba analisa. */
  deploy: number;
};
const P0: Params = {
  scale: opt("scale", 1),
  spread: opt("spread", 200),
  pressure: opt("pressure", 20),
  cap: opt("cap", 1500),
  hold: opt("hold", 30),
  days: opt("days", 3),
  seeds: opt("seeds", 20),
  cash: opt("cash", 5_000_000),
  income: opt("income", 300_000),
  share: opt("share", 0.2),
  analysis: opt("analysis", 200_000),
  dir: opt("dir", 0.7),
  events: opt("events", 0.15),
  akmin: opt("akmin", 25),
  deploy: opt("deploy", 6_000_000),
};

const assetsRaw = (
  assetsFile.assets as { symbol: string; name: string; sector: string; price: number }[]
).map((a) => ({
  symbol: a.symbol,
  name: a.name,
  sector: a.sector,
  price: a.price,
  min: Math.round(a.price * 0.3),
  max: Math.round(a.price * 3),
  initStock: stockForPrice(a.price),
}));
// --gen: pengali efek DI GENERATOR (config.effectScale), berbeda dari --scale yang mengalikan efek jadi di simulator
const basePool = buildPool(
  assetsRaw.map((a) => ({ symbol: a.symbol, name: a.name, sector: a.sector })),
  {
    ...DEFAULT_CONFIG,
    effectScale: opt("gen", DEFAULT_CONFIG.effectScale),
  },
);

function rngOf(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const scaled = (bps: number, scale: number, cap: number) => {
  const v = Math.round((bps * scale) / 10) * 10;
  return Math.max(-cap, Math.min(cap, v === 0 ? Math.sign(bps) * 10 : v));
};

type AssetState = {
  sym: string;
  ref: number;
  factor: number;
  stock: number;
  init: number;
  min: number;
  max: number;
  held: number;
};
type Result = { profitPct: number; trades: number; wins: number; edgeSum: number; analysisSpent: number };

function simulate(p: Params, seed: number, strategy: "hint" | "analisa" | "acak"): Result {
  const rnd = rngOf(seed * 7919 + (strategy === "hint" ? 1 : strategy === "analisa" ? 2 : 3));
  const pickNews = (): PoolNews => {
    const wantEvent = rnd() < p.events;
    const pool = basePool.filter((n) => (n.kind === "price") !== wantEvent);
    return pool[Math.floor(rnd() * pool.length)];
  };
  const assets = new Map<string, AssetState>();
  for (const a of assetsRaw)
    assets.set(a.symbol, {
      sym: a.symbol,
      ref: a.price,
      factor: 0,
      stock: Math.max(1, Math.round(a.initStock * p.share)),
      init: a.initStock,
      min: a.min,
      max: a.max,
      held: 0,
    });
  const model = (s: AssetState): PriceModel => ({
    refPrice: s.ref,
    minPrice: s.min,
    maxPrice: s.max,
    factorBps: s.factor,
    step: 100,
    pressureBps: p.pressure,
    capBps: p.cap,
    spreadBps: p.spread,
  });
  const decay = (minutes: number) => {
    const per = (p.cap * minutes) / 10; // pulih penuh dalam 10 menit
    for (const s of assets.values())
      s.factor = s.factor > 0 ? Math.max(0, s.factor - per) : Math.min(0, s.factor + per);
  };

  let cash = p.cash;
  let income = p.cash;
  let t = 0;
  let nextIncomeAt = 20;
  const end = p.days * 11 * 60; // jam pasar efektif (11 jam per hari)
  let trades = 0,
    wins = 0,
    edgeSum = 0,
    analysisSpent = 0;
  let edgeN = 0,
    edgeMean = 0; // laba bersih rata-rata per berita pembeli analisa (untuk keputusan membeli)

  const buy = (sym: string, budget: number, expectBps?: number): { qty: number; paid: number } => {
    const s = assets.get(sym)!;
    const capQty = Math.max(0, Math.min(holdCap(s.init, p.hold) - s.held, s.stock));
    let n = 0;
    if (expectBps === undefined) {
      // naif: sebanyak mungkin (strategi acak)
      while (n < capQty && buyTotal(model(s), n + 1) <= budget) n++;
    } else {
      // pengukuran cerdas: pilih jumlah yang memaksimalkan laba bersih yang DIHARAPKAN (tekanan harga sendiri dihitung)
      let best = 0,
        bestProfit = 0;
      for (let k = 1; k <= capQty; k++) {
        const cost = buyTotal(model(s), k);
        if (cost > budget) break;
        const after = {
          ...model(s),
          refPrice: Math.round((s.ref * (10_000 + expectBps)) / 10_000 / 100) * 100,
          factorBps: Math.min(p.cap, s.factor + k * p.pressure),
        };
        const profit = sellTotal(after, k) - cost;
        if (profit > bestProfit) {
          best = k;
          bestProfit = profit;
        }
      }
      n = best;
    }
    if (n === 0) return { qty: 0, paid: 0 };
    const paid = buyTotal(model(s), n);
    s.stock -= n;
    s.held += n;
    s.factor = Math.min(p.cap, s.factor + n * p.pressure);
    return { qty: n, paid };
  };
  const sellAll = (sym: string): number => {
    const s = assets.get(sym)!;
    if (s.held === 0) return 0;
    const got = sellTotal(model(s), s.held);
    s.stock += s.held;
    s.factor = Math.max(-p.cap, s.factor - s.held * p.pressure);
    s.held = 0;
    return got;
  };

  while (t < end) {
    const news = pickNews();
    const eff = news.effects.map((e) => ({ symbol: e.symbol, bps: scaled(e.pct_bps, p.scale, p.cap) }));
    const delay = 3 + rnd() * 12; // menit
    // --- keputusan saat terbit ---
    const picks: string[] = [];
    const expect = new Map<string, number>(); // perkiraan efek (bps) tiap aset yang akan dibeli
    if (strategy === "hint") {
      // aset yang disebut: satu naik terbesar dan satu turun terbesar (urutan hintSentence: naik dulu)
      const up = eff.filter((e) => e.bps >= 100).sort((a, b) => b.bps - a.bps)[0];
      const down = eff.filter((e) => e.bps <= -100).sort((a, b) => a.bps - b.bps)[0];
      const neutral = (sym: string) => hashN(`netral|${news.title}|${sym}`) % 2 === 0;
      for (const [h, trueUp] of [
        [up, true],
        [down, false],
      ] as const) {
        if (!h) continue;
        const believedUp = neutral(h.symbol) ? (rnd() < p.dir ? trueUp : !trueUp) : trueUp;
        if (believedUp) {
          picks.push(h.symbol);
          expect.set(h.symbol, 500);
        } // petunjuk tidak memberi besar efek: dugaan 5 %
      }
    } else if (strategy === "analisa") {
      // beli bila perkiraan laba (modal yang bisa dikerahkan x rata-rata laba bersih per berita yang dialami sendiri) > harga
      const edgeEst = (edgeN * edgeMean + 5 * 0.03) / (edgeN + 5);
      if (Math.min(cash, p.deploy) * edgeEst > p.analysis) {
        cash -= p.analysis;
        analysisSpent += p.analysis;
        for (const e of eff
          .filter((e) => e.bps >= 100)
          .sort((a, b) => b.bps - a.bps)
          .slice(0, 3))
          picks.push(e.symbol);
      }
    } else {
      picks.push(assetsRaw[Math.floor(rnd() * assetsRaw.length)].symbol);
    }
    const budgetEach = picks.length ? cash / picks.length : 0;
    const bought = new Map<string, { qty: number; paid: number }>();
    for (const sym of picks) {
      const b = buy(sym, budgetEach, expect.get(sym));
      if (b.qty > 0) {
        bought.set(sym, b);
        cash -= b.paid;
      }
    }
    // --- waktu berjalan sampai efek berlaku ---
    t += delay;
    decay(delay);
    while (nextIncomeAt <= t) {
      cash += p.income;
      income += p.income;
      nextIncomeAt += 20;
    }
    // efek berlaku pada harga acuan
    for (const e of eff) {
      const s = assets.get(e.symbol)!;
      s.ref = Math.max(s.min, Math.min(s.max, Math.round((s.ref * (10_000 + e.bps)) / 10_000 / 100) * 100));
    }
    // --- jual semua yang dibeli ---
    let tradePaid = 0,
      tradeGot = 0;
    for (const [sym, b] of bought) {
      const got = sellAll(sym);
      cash += got;
      trades++;
      if (got > b.paid) wins++;
      edgeSum += (got - b.paid) / b.paid;
      tradePaid += b.paid;
      tradeGot += got;
    }
    if (strategy === "analisa" && tradePaid > 0) {
      edgeMean = (edgeMean * edgeN + (tradeGot - tradePaid) / tradePaid) / (edgeN + 1);
      edgeN++;
    }
    // jeda 0 menit: berita berikutnya langsung terbit
  }
  return { profitPct: ((cash - income) / income) * 100, trades, wins, edgeSum, analysisSpent };
}

function hashN(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function summarize(p: Params, strategy: "hint" | "analisa" | "acak") {
  const rs = Array.from({ length: p.seeds }, (_, i) => simulate(p, i + 1, strategy));
  const prof = rs.map((r) => r.profitPct).sort((a, b) => a - b);
  const mean = prof.reduce((a, b) => a + b, 0) / prof.length;
  const trades = rs.reduce((s, r) => s + r.trades, 0);
  return {
    mean,
    p10: prof[Math.floor(prof.length * 0.1)],
    p90: prof[Math.floor(prof.length * 0.9)],
    win: (100 * rs.reduce((s, r) => s + r.wins, 0)) / Math.max(1, trades),
    edge: (100 * rs.reduce((s, r) => s + r.edgeSum, 0)) / Math.max(1, trades),
    trades: trades / p.seeds,
  };
}

const fmt = (n: number) => n.toFixed(1).padStart(7);
function line(label: string, p: Params) {
  const h = summarize(p, "hint");
  const a = summarize(p, "analisa");
  const r = summarize(p, "acak");
  console.log(
    `${label.padEnd(26)} | hint ${fmt(h.mean)}% (p10 ${fmt(h.p10)} p90 ${fmt(h.p90)}) menang ${fmt(h.win)}% edge ${fmt(h.edge)}%/trade | analisa ${fmt(a.mean)}% | acak ${fmt(r.mean)}%`,
  );
}

if (flag("grid")) {
  console.log(
    `grid: ${P0.days} hari, ${P0.seeds} benih, modal ${P0.cash}, hadiah ${P0.income}/20 mnt, stok dijangkau ${P0.share}, batas pegang ${P0.hold}%`,
  );
  const gen = opt("gen", DEFAULT_CONFIG.effectScale);
  console.log(`kumpulan dibangun dengan effectScale ${gen}`);
  for (const spread of [150, 200, 300])
    for (const scale of [1, 1.5]) line(`selisih ${spread / 100}% x${scale}`, { ...P0, spread, scale });
} else {
  line(`selisih ${P0.spread / 100}% x${P0.scale}`, P0);
}
