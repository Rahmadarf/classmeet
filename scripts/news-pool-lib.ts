/**
 * Pembuat kumpulan berita (logika murni, tanpa jaringan; dipakai generate-news-pool.ts dan diuji vitest).
 * Menyusun berita HARGA (tema sektor, 2 arah x 2 varian) dan berita EVENT (bangkrut, suspensi, dividen per aset).
 * Urutan berita saat permainan TIDAK ditentukan di sini: yang dibuat hanyalah kumpulannya; yang terbit dipilih
 * mesin saat permainan berjalan (pick_next_news) menurut kondisi pasar.
 */
import {
  BANKRUPT_CAUSES,
  DIVIDEND_CAUSES,
  NOISE,
  SECTOR_CONTEXT,
  SECTOR_NAMES,
  SUSPEND_CAUSES,
  THEMES as BASE_THEMES,
  type Cause,
  type SectorKey,
} from "./data/news-themes";
import { THEMES_2 } from "./data/news-themes-2";

const THEMES = [...BASE_THEMES, ...THEMES_2];

export type PoolKind = "price" | "bankrupt" | "suspend" | "dividend";
export type PoolEffect = { symbol: string; pct_bps: number };
export type PoolNews = {
  kind: PoolKind;
  title: string;
  body: string;
  effects: PoolEffect[];
  /** Event yang dibawa (kecuali berita harga). `amount`: bangkrut = bps likuidasi, suspensi = menit, dividen = bps. */
  event: { symbol: string; amount: number } | null;
};
export type PoolAsset = { symbol: string; name: string; sector: string };
export type PoolConfig = {
  seed: string;
  minAssets: number;
  maxAssets: number;
  capBps: number;
  perAsset: { bankrupt: number; suspend: number; dividend: number };
};

export const DEFAULT_CONFIG: PoolConfig = {
  seed: "classmeet-2026",
  minAssets: 10,
  maxAssets: 15,
  capBps: 1500,
  perAsset: { bankrupt: 1, suspend: 5, dividend: 10 },
};

const SECTOR_KEY_BY_NAME = Object.fromEntries(
  (Object.entries(SECTOR_NAMES) as [SectorKey, string][]).map(([k, v]) => [v, k]),
) as Record<string, SectorKey>;

/** PRNG kecil berbenih (mulberry32) supaya hasil bisa diulang. */
export function makeRng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: <T>(xs: T[]): T => xs[Math.floor(next() * xs.length)],
    shuffle: <T>(xs: T[]): T[] => {
      const out = [...xs];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}
type Rng = ReturnType<typeof makeRng>;

const clampBps = (bps: number, cap: number) => {
  const v = Math.max(-cap, Math.min(cap, Math.round(bps / 10) * 10));
  return v === 0 ? 10 : v;
};

/** Efek pengisi (aset di luar topik): kecil dan arahnya acak, supaya jumlah aset terpenuhi tanpa efek besar. */
function fillEffects(
  rng: Rng,
  chosen: Map<string, number>,
  assets: PoolAsset[],
  target: number,
  cap: number,
) {
  const rest = rng.shuffle(assets.filter((a) => !chosen.has(a.symbol)));
  for (const a of rest) {
    if (chosen.size >= target) break;
    chosen.set(a.symbol, clampBps((rng.next() < 0.5 ? -1 : 1) * rng.int(40, 140), cap));
  }
}

function priceNews(assets: PoolAsset[], cfg: PoolConfig, rng: Rng): PoolNews[] {
  const out: PoolNews[] = [];
  const bySector = new Map<SectorKey, PoolAsset[]>();
  for (const a of assets) {
    const k = SECTOR_KEY_BY_NAME[a.sector];
    if (k) bySector.set(k, [...(bySector.get(k) ?? []), a]);
  }
  for (const theme of THEMES) {
    for (const dir of ["pos", "neg"] as const) {
      const dirSign = dir === "pos" ? 1 : -1;
      for (const variant of [0, 1] as const) {
        const target = rng.int(cfg.minAssets, cfg.maxAssets);
        const chosen = new Map<string, number>();
        const ranked = (Object.entries(theme.w) as [SectorKey, number][]).sort(
          (x, y) => Math.abs(y[1]) - Math.abs(x[1]),
        );
        for (const [sector, w] of ranked) {
          for (const a of rng.shuffle(bySector.get(sector) ?? [])) {
            if (chosen.size >= target) break;
            if (rng.next() < 0.85) {
              const mag = Math.abs(w) * rng.int(130, 330) * (0.75 + rng.next() * 0.5);
              chosen.set(a.symbol, clampBps(Math.sign(w) * dirSign * mag, cfg.capBps));
            }
          }
        }
        fillEffects(rng, chosen, assets, Math.max(target, cfg.minAssets), cfg.capBps);
        const lead = ranked[0]?.[0];
        const base = theme[dir].b;
        const second = variant === 1 && lead ? ` ${SECTOR_CONTEXT[lead]}` : "";
        out.push({
          kind: "price",
          title: theme[dir].t[variant],
          body: `${base}${second} ${rng.pick(NOISE)}`,
          effects: [...chosen].map(([symbol, pct_bps]) => ({ symbol, pct_bps })),
          event: null,
        });
      }
    }
  }
  return out;
}

const fmt = (c: Cause, name: string, x: string): { title: string; body: string } => ({
  title: c.title.replaceAll("{n}", name),
  body: c.body.replaceAll("{n}", name).replaceAll("{x}", x),
});
const idPct = (bps: number) => (bps / 100).toLocaleString("id-ID", { maximumFractionDigits: 2 });

function eventNews(assets: PoolAsset[], cfg: PoolConfig, rng: Rng): PoolNews[] {
  const out: PoolNews[] = [];
  const kinds: { kind: Exclude<PoolKind, "price">; causes: Cause[]; count: number }[] = [
    { kind: "bankrupt", causes: BANKRUPT_CAUSES, count: cfg.perAsset.bankrupt },
    { kind: "suspend", causes: SUSPEND_CAUSES, count: cfg.perAsset.suspend },
    { kind: "dividend", causes: DIVIDEND_CAUSES, count: cfg.perAsset.dividend },
  ];
  assets.forEach((asset, ai) => {
    const peers = assets.filter((a) => a.sector === asset.sector && a.symbol !== asset.symbol);
    for (const { kind, causes, count } of kinds) {
      for (let k = 0; k < count; k++) {
        // sebab berurutan dari titik awal yang bergeser per aset: sebab tidak berulang selama jumlah berita ≤ jumlah sebab
        const cause = causes[(ai * 3 + k + (kind === "dividend" ? 1 : 0)) % causes.length];
        const amount =
          kind === "bankrupt"
            ? rng.int(8, 25) * 100
            : kind === "suspend"
              ? rng.int(5, 20)
              : rng.int(2, 12) * 25;
        const x =
          kind === "bankrupt" ? String(amount / 100) : kind === "suspend" ? String(amount) : idPct(amount);
        const { title, body } = fmt(cause, asset.name, x);
        const target = rng.int(cfg.minAssets, cfg.maxAssets);
        const chosen = new Map<string, number>();
        const shufPeers = rng.shuffle(peers);
        if (kind === "bankrupt") {
          // pesaing sejenis ikut tertekan, satu pesaing diuntungkan; aset yang bangkrut TIDAK boleh punya efek harga.
          shufPeers
            .slice(0, 3)
            .forEach((p) => chosen.set(p.symbol, clampBps(-rng.int(150, 400), cfg.capBps)));
          if (shufPeers[3]) chosen.set(shufPeers[3].symbol, clampBps(rng.int(100, 250), cfg.capBps));
        } else {
          const own = kind === "dividend" ? rng.int(100, 300) : -rng.int(100, 300);
          chosen.set(asset.symbol, clampBps(own, cfg.capBps));
          shufPeers
            .slice(0, 2)
            .forEach((p) =>
              chosen.set(p.symbol, clampBps((kind === "dividend" ? 1 : -1) * rng.int(50, 150), cfg.capBps)),
            );
        }
        const universe = kind === "bankrupt" ? assets.filter((a) => a.symbol !== asset.symbol) : assets;
        fillEffects(rng, chosen, universe, target, cfg.capBps);
        out.push({
          kind,
          title,
          body: `${body} ${rng.pick(NOISE)}`,
          effects: [...chosen].map(([symbol, pct_bps]) => ({ symbol, pct_bps })),
          event: { symbol: asset.symbol, amount },
        });
      }
    }
  });
  return out;
}

export function buildPool(assets: PoolAsset[], cfg: PoolConfig = DEFAULT_CONFIG): PoolNews[] {
  const rng = makeRng(cfg.seed);
  return [...priceNews(assets, cfg, rng), ...eventNews(assets, cfg, rng)];
}

export function validatePool(
  pool: PoolNews[],
  assets: PoolAsset[],
  cfg: PoolConfig = DEFAULT_CONFIG,
): string[] {
  const problems: string[] = [];
  const symbols = new Set(assets.map((a) => a.symbol));
  const titles = new Set<string>();
  const cover = new Map<string, Record<string, number>>();
  for (const a of assets) cover.set(a.symbol, { bankrupt: 0, suspend: 0, dividend: 0 });
  for (const n of pool) {
    const tag = `"${n.title}"`;
    if (!n.title.trim() || !n.body.trim()) problems.push(`${tag}: judul/isi kosong`);
    if (titles.has(n.title)) problems.push(`${tag}: judul ganda`);
    titles.add(n.title);
    if (n.effects.length < cfg.minAssets || n.effects.length > cfg.maxAssets)
      problems.push(`${tag}: ${n.effects.length} aset, harus ${cfg.minAssets}-${cfg.maxAssets}`);
    const seen = new Set<string>();
    for (const e of n.effects) {
      if (!symbols.has(e.symbol)) problems.push(`${tag}: simbol ${e.symbol} tidak ada`);
      if (seen.has(e.symbol)) problems.push(`${tag}: aset ganda ${e.symbol}`);
      seen.add(e.symbol);
      if (!Number.isInteger(e.pct_bps) || e.pct_bps === 0 || Math.abs(e.pct_bps) > cfg.capBps)
        problems.push(`${tag}: efek ${e.symbol} ${e.pct_bps} tidak valid`);
    }
    if (n.kind === "price" && n.event) problems.push(`${tag}: berita harga tidak boleh membawa event`);
    if (n.kind !== "price") {
      if (!n.event) problems.push(`${tag}: berita ${n.kind} tanpa event`);
      else {
        if (!symbols.has(n.event.symbol)) problems.push(`${tag}: simbol event tidak ada`);
        if (n.kind === "bankrupt" && seen.has(n.event.symbol))
          problems.push(`${tag}: aset bangkrut punya efek harga`);
        const c = cover.get(n.event.symbol);
        if (c) c[n.kind] += 1;
      }
    }
  }
  for (const [sym, c] of cover) {
    for (const k of ["bankrupt", "suspend", "dividend"] as const)
      if (c[k] < 1) problems.push(`${sym}: tidak ada berita ${k}`);
    if (c.bankrupt > 1) problems.push(`${sym}: ${c.bankrupt} berita bangkrut (maks. 1 per aset)`);
  }
  return problems;
}

const q = (s: string) => `'${s.replaceAll("'", "''")}'`;

/**
 * SQL untuk memuat kumpulan langsung ke database (uji/simulasi atau penyiapan tanpa RPC admin): berita berstatus `ready`.
 * Harus dijalankan SEBELUM game dibuka, atau dengan `classmeet.system = on` (simulasi).
 */
export function poolToSql(pool: PoolNews[]): string {
  const lines: string[] = [
    "do $pool$",
    "declare v uuid; v_admin uuid := (select id from profiles where role = 'admin' limit 1);",
    "begin",
  ];
  for (const n of pool) {
    // idempoten: berita dengan judul yang sama tidak dimuat dua kali
    lines.push(`if not exists (select 1 from news where title = ${q(n.title)}) then`);
    lines.push(
      `insert into news (title, body, status, created_by) values (${q(n.title)}, ${q(n.body)}, 'ready', v_admin) returning id into v;`,
    );
    const vals = n.effects.map((e) => `(${q(e.symbol)}, ${e.pct_bps})`).join(", ");
    lines.push(
      `insert into news_effects (news_id, asset_id, pct_bps) select v, a.id, x.p from assets a join (values ${vals}) as x(s, p) on a.symbol = x.s;`,
    );
    if (n.event) {
      if (n.kind === "bankrupt")
        lines.push(
          `insert into news_bankruptcies (news_id, asset_id, liquidation_bps) select v, id, ${n.event.amount} from assets where symbol = ${q(n.event.symbol)};`,
        );
      else
        lines.push(
          `insert into news_events (news_id, asset_id, kind, amount) select v, id, ${q(n.kind)}, ${n.event.amount} from assets where symbol = ${q(n.event.symbol)};`,
        );
    }
    lines.push("end if;");
  }
  lines.push("end", "$pool$;");
  return lines.join("\n");
}

/** Ringkasan untuk ditinjau panitia (Markdown). */
export function poolToMarkdown(pool: PoolNews[], assets: PoolAsset[]): string {
  const name = new Map(assets.map((a) => [a.symbol, a.name]));
  const byKind = (k: PoolKind) => pool.filter((n) => n.kind === k);
  const label: Record<PoolKind, string> = {
    price: "Berita harga (tanpa event)",
    bankrupt: "Berita BANGKRUT",
    suspend: "Berita SUSPENSI",
    dividend: "Berita DIVIDEN",
  };
  const unit = (n: PoolNews) =>
    !n.event
      ? ""
      : n.kind === "bankrupt"
        ? `likuidasi ${n.event.amount / 100} %`
        : n.kind === "suspend"
          ? `${n.event.amount} menit`
          : `dividen ${n.event.amount / 100} %`;
  const out: string[] = [
    "# Kumpulan berita (hasil `npm run generate-news`)",
    "",
    "Dibuat otomatis dari `scripts/data/news-themes.ts`; teks fiksi. Tinjau, ubah temanya di berkas itu, lalu bangkitkan ulang.",
    "Urutan terbit TIDAK ditentukan di sini: mesin memilih saat permainan berjalan menurut kondisi pasar.",
    "",
    `Jumlah: ${pool.length} berita (${(["price", "bankrupt", "suspend", "dividend"] as PoolKind[]).map((k) => `${byKind(k).length} ${k}`).join(", ")}).`,
    "",
  ];
  for (const k of ["price", "bankrupt", "suspend", "dividend"] as PoolKind[]) {
    out.push(`## ${label[k]} (${byKind(k).length})`, "");
    for (const n of byKind(k)) {
      const fx = n.effects
        .map((e) => `${e.symbol} ${e.pct_bps > 0 ? "+" : "−"}${Math.abs(e.pct_bps) / 100}%`)
        .join(", ");
      out.push(
        `- **${n.title}**${n.event ? ` [${n.event.symbol} · ${name.get(n.event.symbol) ?? ""} · ${unit(n)}]` : ""}`,
      );
      out.push(`  ${n.body}`);
      out.push(`  _${n.effects.length} aset:_ ${fx}`, "");
    }
  }
  return out.join("\n");
}
