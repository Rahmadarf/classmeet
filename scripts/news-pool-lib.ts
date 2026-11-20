/**
 * Pembuat kumpulan berita (logika murni, tanpa jaringan; dipakai generate-news-pool.ts dan diuji vitest).
 * Menyusun berita HARGA (tema sektor, 2 arah x 2 varian) dan berita EVENT (bangkrut, suspensi, dividen per aset).
 * Urutan berita saat permainan TIDAK ditentukan di sini: yang dibuat hanyalah kumpulannya; yang terbit dipilih
 * mesin saat permainan berjalan (pick_next_news) menurut kondisi pasar.
 */
import { ASSET_TRAITS } from "./data/asset-traits";
import { NOISE_BY_SECTOR, NOISE_GENERIC } from "./data/news-noise";
import {
  BANKRUPT_CAUSES,
  DIVIDEND_CAUSES,
  SECTOR_CONTEXT,
  SECTOR_NAMES,
  SUSPEND_CAUSES,
  THEMES as BASE_THEMES,
  type Cause,
  type SectorKey,
} from "./data/news-themes";
import { THEMES_2 } from "./data/news-themes-2";
import { THEMES_3 } from "./data/news-themes-3";

const THEMES = [...BASE_THEMES, ...THEMES_2, ...THEMES_3];

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

/** Hash sederhana (deterministik) untuk memilih templat kalimat tanpa memakai RNG utama (urutan undian efek tidak boleh bergeser). */
function hashOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Gabung daftar dengan koma dan "serta" sebelum butir terakhir (frasa sifat sering memuat "dan"). */
const listSerta = (xs: string[]) =>
  xs.length <= 1
    ? (xs[0] ?? "")
    : xs.length === 2
      ? `${xs[0]} serta ${xs[1]}`
      : `${xs.slice(0, -1).join(", ")}, serta ${xs[xs.length - 1]}`;

/** Frasa sifat satu aset untuk satu berita (deterministik menurut judul + simbol; tidak memakai RNG utama). */
export function traitPhrase(symbol: string, title: string): string | null {
  const t = ASSET_TRAITS[symbol];
  return t ? t.phrases[hashOf(`${title}|${symbol}`) % t.phrases.length] : null;
}

/**
 * Kalimat petunjuk dampak: tanpa menyebut nama perusahaan, hanya ciri aset yang bergerak paling besar (maks. 2 naik, 2
 * turun, masing-masing dari aset berbeda; hanya efek berarti >= HINT_MIN_BPS). Aset di `exclude` (subjek berita event,
 * yang sudah disebut namanya) dilewati. Deterministik menurut judul. Aset pengisi berefek kecil tidak disebut.
 */
export function hintSentence(title: string, effects: PoolEffect[], exclude: string[] = []): string {
  const byMag = (a: PoolEffect, b: PoolEffect) => Math.abs(b.pct_bps) - Math.abs(a.pct_bps);
  const pool = effects.filter(
    (e) => !exclude.includes(e.symbol) && ASSET_TRAITS[e.symbol] && Math.abs(e.pct_bps) >= HINT_MIN_BPS,
  );
  const phrases = (xs: PoolEffect[]) =>
    xs
      .sort(byMag)
      .slice(0, HINT_PER_SIDE)
      .map((e) => traitPhrase(e.symbol, title)!)
      .filter(Boolean);
  const up = phrases(pool.filter((e) => e.pct_bps > 0));
  const down = phrases(pool.filter((e) => e.pct_bps < 0));
  const h = hashOf(title);
  const A = listSerta(up);
  const B = listSerta(down);
  if (up.length && down.length) {
    const t = [
      `Perusahaan yang ${A} diperkirakan mendapat keuntungan dari situasi ini, sedangkan perusahaan yang ${B} berisiko tertekan.`,
      `Pelaku pasar menilai perusahaan yang ${A} berpeluang menguat. Sebaliknya, perusahaan yang ${B} diperkirakan melemah.`,
      `Perusahaan yang ${A} dinilai paling siap memanfaatkan perubahan ini. Adapun perusahaan yang ${B} cenderung terdampak negatif.`,
      `Analis menyebut perusahaan yang ${A} berada di posisi menguntungkan, sementara perusahaan yang ${B} menghadapi tekanan.`,
    ];
    return t[h % t.length];
  }
  if (up.length) {
    const t = [
      `Perusahaan yang ${A} diperkirakan mendapat keuntungan dari situasi ini.`,
      `Pelaku pasar menilai perusahaan yang ${A} berpeluang menguat setelah kabar ini.`,
    ];
    return t[h % t.length];
  }
  if (down.length) {
    const t = [
      `Perusahaan yang ${B} diperkirakan menghadapi tekanan akibat situasi ini.`,
      `Pelaku pasar menilai perusahaan yang ${B} berpotensi melemah setelah kabar ini.`,
    ];
    return t[h % t.length];
  }
  return "Dampak pada perusahaan lain diperkirakan terbatas.";
}

/** Sektor dengan bobot terbesar pada efek (untuk memilih pengecoh yang berdekatan topiknya). */
function leadSectorOf(effects: PoolEffect[], sectorOf: Map<string, SectorKey>): SectorKey | undefined {
  const top = [...effects].sort((a, b) => Math.abs(b.pct_bps) - Math.abs(a.pct_bps))[0];
  return top ? sectorOf.get(top.symbol) : undefined;
}

/**
 * Paragraf kedua: kalimat petunjuk + dua kalimat pengecoh ("Di sisi lain, ..." dan "Selain itu, ..."): satu pengecoh
 * berdekatan topiknya dengan sektor utama berita, satu umum. Memakai RNG utama untuk memilih pengecoh.
 */
function secondParagraph(
  rng: Rng,
  title: string,
  effects: PoolEffect[],
  sectorOf: Map<string, SectorKey>,
  exclude: string[] = [],
): string {
  const lead = leadSectorOf(
    effects.filter((e) => !exclude.includes(e.symbol)),
    sectorOf,
  );
  const adjacent = lead ? rng.pick(NOISE_BY_SECTOR[lead]) : rng.pick(NOISE_GENERIC);
  let generic = rng.pick(NOISE_GENERIC);
  while (generic === adjacent) generic = rng.pick(NOISE_GENERIC);
  const link = ["Selain itu", "Sementara itu", "Pada waktu yang sama"][hashOf(title) % 3];
  return `${hintSentence(title, effects, exclude)} Di sisi lain, ${adjacent}. ${link}, ${generic}.`;
}

/** Efek berarti (tematis) bermagnitudo >= ini dan layak jadi petunjuk; efek pengisi selalu di bawahnya (<= 90 bps). */
export const HINT_MIN_BPS = 100;
const HINT_PER_SIDE = 2;

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
    chosen.set(a.symbol, clampBps((rng.next() < 0.5 ? -1 : 1) * rng.int(40, 90), cap));
  }
}

function sectorMap(assets: PoolAsset[]): Map<string, SectorKey> {
  const m = new Map<string, SectorKey>();
  for (const a of assets) {
    const k = SECTOR_KEY_BY_NAME[a.sector];
    if (k) m.set(a.symbol, k);
  }
  return m;
}

/** Bobot tema untuk satu aset: bobot per simbol (`a`) menimpa bobot sektor (`w`). */
const weightOf = (theme: (typeof THEMES)[number], symbol: string, sector?: SectorKey) =>
  theme.a?.[symbol] ?? (sector ? (theme.w[sector] ?? 0) : 0);

function priceNews(assets: PoolAsset[], cfg: PoolConfig, rng: Rng): PoolNews[] {
  const out: PoolNews[] = [];
  const sectorOf = sectorMap(assets);
  for (const theme of THEMES) {
    for (const dir of ["pos", "neg"] as const) {
      const dirSign = dir === "pos" ? 1 : -1;
      for (const variant of [0, 1] as const) {
        const target = rng.int(cfg.minAssets, cfg.maxAssets);
        const chosen = new Map<string, number>();
        // calon: aset berbobot; yang bobotnya terbesar didahulukan, urutan di antara bobot sama diacak
        const ranked = rng
          .shuffle(assets)
          .map((a) => ({ a, w: weightOf(theme, a.symbol, sectorOf.get(a.symbol)) }))
          .filter((x) => x.w !== 0)
          .sort((x, y) => Math.abs(y.w) - Math.abs(x.w));
        for (const { a, w } of ranked) {
          if (chosen.size >= target) break;
          if (rng.next() < (Math.abs(w) >= 2 ? 0.97 : 0.85)) {
            const mag = Math.abs(w) * rng.int(130, 330) * (0.75 + rng.next() * 0.5);
            chosen.set(a.symbol, clampBps(Math.sign(w) * dirSign * mag, cfg.capBps));
          }
        }
        fillEffects(rng, chosen, assets, Math.max(target, cfg.minAssets), cfg.capBps);
        const lead = ranked[0] ? sectorOf.get(ranked[0].a.symbol) : undefined;
        const base = theme[dir].b;
        const second = variant === 1 && lead ? ` ${SECTOR_CONTEXT[lead]}` : "";
        const title = theme[dir].t[variant];
        const effects = [...chosen].map(([symbol, pct_bps]) => ({ symbol, pct_bps }));
        out.push({
          kind: "price",
          title,
          body: `${base}${second}\n\n${secondParagraph(rng, title, effects, sectorOf)}`,
          effects,
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
  const sectorOf = sectorMap(assets);
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
              chosen.set(p.symbol, clampBps((kind === "dividend" ? 1 : -1) * rng.int(100, 180), cfg.capBps)),
            );
        }
        const universe = kind === "bankrupt" ? assets.filter((a) => a.symbol !== asset.symbol) : assets;
        fillEffects(rng, chosen, universe, target, cfg.capBps);
        const effects = [...chosen].map(([symbol, pct_bps]) => ({ symbol, pct_bps }));
        out.push({
          kind,
          title,
          body: `${body}\n\n${secondParagraph(rng, title, effects, sectorOf, [asset.symbol])}`,
          effects,
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
  const nameRe = new Map(
    assets.map((a) => [
      a.symbol,
      new RegExp(`(?<![\\p{L}])${a.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "u"),
    ]),
  );
  const titles = new Set<string>();
  const cover = new Map<string, Record<string, number>>();
  for (const a of assets) cover.set(a.symbol, { bankrupt: 0, suspend: 0, dividend: 0 });
  for (const n of pool) {
    const tag = `"${n.title}"`;
    if (!n.title.trim() || !n.body.trim()) problems.push(`${tag}: judul/isi kosong`);
    const paragraphs = n.body.split(/\n{2,}/).filter((p) => p.trim());
    if (paragraphs.length < 2) problems.push(`${tag}: isi kurang dari 2 paragraf`);
    // nama perusahaan: berita harga tidak menyebut satu pun; berita event hanya menyebut subjeknya
    for (const a of assets) {
      const mentioned = nameRe.get(a.symbol)!.test(n.body) || nameRe.get(a.symbol)!.test(n.title);
      if (mentioned && a.symbol !== n.event?.symbol) problems.push(`${tag}: menyebut nama ${a.name}`);
    }
    if (n.event && !nameRe.get(n.event.symbol)!.test(n.body))
      problems.push(`${tag}: paragraf event tidak menyebut perusahaan subjek`);
    // petunjuk: aset naik dan turun terbesar (selain subjek) harus punya frasa sifatnya di paragraf kedua
    {
      const second = paragraphs[1] ?? "";
      const rest = n.effects.filter(
        (e) => e.symbol !== n.event?.symbol && Math.abs(e.pct_bps) >= HINT_MIN_BPS,
      );
      for (const sign of [1, -1]) {
        const top = rest
          .filter((e) => Math.sign(e.pct_bps) === sign)
          .sort((x, y) => Math.abs(y.pct_bps) - Math.abs(x.pct_bps))[0];
        if (top) {
          const phrase = traitPhrase(top.symbol, n.title);
          if (phrase && !second.includes(phrase))
            problems.push(`${tag}: petunjuk ${top.symbol} tidak ada di paragraf kedua`);
        }
      }
    }
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
export function poolToSql(pool: PoolNews[], opts: { replace?: boolean } = {}): string {
  const lines: string[] = [
    "do $pool$",
    "declare v uuid; v_admin uuid := (select id from profiles where role = 'admin' limit 1);",
    "begin",
  ];
  // replace: ganti seluruh berita yang belum dipakai (ready/draft; efek, event, dan bangkrut ikut terhapus lewat cascade),
  // supaya isi baru dan efeknya tetap cocok. Yang sudah punya riwayat (mis. dikembalikan ke `ready` oleh "Mulai ulang
  // berita") tidak bisa dihapus: dibatalkan dan diberi judul arsip supaya tidak menghalangi berita baru berjudul sama.
  // Berita yang sudah terbit/diterapkan tidak disentuh.
  if (opts.replace)
    lines.push(
      "update news n set status = 'cancelled', title = n.title || ' [arsip ' || left(n.id::text, 4) || ']' where n.status in ('ready', 'draft') and (exists (select 1 from price_history x where x.news_id = n.id) or exists (select 1 from news_feed x where x.news_id = n.id) or exists (select 1 from dividends x where x.news_id = n.id) or exists (select 1 from market_event_log x where x.news_id = n.id));",
      // satu aset hanya boleh punya satu pemetaan bangkrut: lepaskan yang milik berita batal agar berita baru bisa dimuat
      "delete from news_bankruptcies where news_id in (select id from news where status = 'cancelled');",
      "delete from news where status in ('ready', 'draft');",
    );
  for (const n of pool) {
    // idempoten: berita dengan judul yang sama tidak dimuat dua kali; isi berita `ready` yang sudah ada diperbarui
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
    lines.push(
      `else update news set body = ${q(n.body)} where title = ${q(n.title)} and status in ('ready', 'draft') and body <> ${q(n.body)};`,
    );
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
    "Dibuat otomatis dari `scripts/data/news-themes*.ts`, `news-noise.ts`, dan kamus sifat `asset-traits.ts` (docs/16); teks fiksi.",
    "Berita harga tidak menyebut nama perusahaan: aset yang terdampak ditebak dari ciri yang disebut di paragraf kedua. Berita event menyebut perusahaan subjeknya.",
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
      out.push(
        ...n.body
          .split(/\n{2,}/)
          .flatMap((p) => [`  ${p}`, ""])
          .slice(0, -1),
      );
      out.push(`  _${n.effects.length} aset:_ ${fx}`, "");
    }
  }
  return out.join("\n");
}
