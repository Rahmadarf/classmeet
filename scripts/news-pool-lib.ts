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
  SECTOR_NAMES,
  SUSPEND_CAUSES,
  THEMES as BASE_THEMES,
  type Cause,
  type SectorKey,
} from "./data/news-themes";
import { THEMES_2 } from "./data/news-themes-2";
import { THEMES_3 } from "./data/news-themes-3";
import { THEMES_4 } from "./data/news-themes-4";
import { CITIES, ORGANIZATIONS, PEOPLE, QUOTES, SCENES, SOURCES } from "./data/news-voices";

const THEMES = [...BASE_THEMES, ...THEMES_2, ...THEMES_3, ...THEMES_4];

export type PoolKind = "price" | "bankrupt" | "suspend" | "dividend";
export type PoolEffect = { symbol: string; pct_bps: number };
export type PoolNews = {
  kind: PoolKind;
  title: string;
  body: string;
  effects: PoolEffect[];
  /** Event yang dibawa (kecuali berita harga). `amount`: bangkrut = bps likuidasi, suspensi = menit, dividen = bps. */
  event: { symbol: string; amount: number } | null;
  /**
   * Laporan Analisa Pasar (pay to win, docs/18): 4 paragraf yang dijual ke tim selama berita tayang. Paragraf 1 memuat
   * `{waktu}` yang diganti `buy_analysis` dengan perkiraan sisa waktu. Isinya benar menurut `effects`; tanpa nama aset.
   */
  analysis: string[];
};
export type PoolAsset = { symbol: string; name: string; sector: string };
export type PoolConfig = {
  seed: string;
  minAssets: number;
  maxAssets: number;
  capBps: number;
  /**
   * Pengali besar efek bertema dan efek event (bukan efek pengisi <= 0,9 %). Dikalibrasi dengan `scripts/sim-strategy.ts`
   * (docs/19): pada 1,0 efek rata-rata terlalu kecil dibanding selisih jual 2 %, sehingga pembaca berita nyaris tidak untung.
   */
  effectScale: number;
  perAsset: { bankrupt: number; suspend: number; dividend: number };
};

export const DEFAULT_CONFIG: PoolConfig = {
  seed: "classmeet-2026",
  minAssets: 10,
  maxAssets: 15,
  capBps: 1500,
  effectScale: 2,
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
  // pengacak akhir (murmur3): bit rendah FNV lemah (paritas karakter), sehingga `% 2` dan `% 12` dari teks mirip saling berkorelasi
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
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

/** Hanya satu ciri per arah yang dibocorkan berita (tingkat sulit); sisanya hanya diketahui pembeli analisa. */
const HINT_PER_SIDE_HARD = 1;

/** Petunjuk tanpa arah: separuh petunjuk hanya menyebut ciri yang "terdampak", arahnya harus ditebak dari topik berita. */
const isNeutralHint = (title: string, symbol: string) => hashOf(`netral|${title}|${symbol}`) % 2 === 0;

/** Pilihan deterministik menurut judul + garam (tanpa RNG utama, jadi efek dan judul tidak bergeser). */
const pickBy = <T>(xs: readonly T[], title: string, salt: string): T =>
  xs[hashOf(`${salt}|${title}`) % xs.length];

/** Seperti `pickBy`, tetapi melewati rumusan yang sudah dipakai di paragraf yang sama (`used`), supaya tidak ada kalimat berpola sama dua kali. */
function pickDistinct<T>(xs: readonly T[], title: string, salt: string, used: Set<T>): T {
  let i = hashOf(`${salt}|${title}`) % xs.length;
  for (let k = 0; k < xs.length && used.has(xs[i]); k++) i = (i + 1) % xs.length;
  used.add(xs[i]);
  return xs[i];
}

const upperFirst = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);
const lowerFirst = (t: string) => (t ? t[0].toLowerCase() + t.slice(1) : t);

/**
 * Pustaka rumusan kalimat (`{x}` = ciri perusahaan, diawali kata kerja). PETUNJUK TANPA ARAH dan PENGECOH SIFAT memakai
 * pustaka NETRAL yang SAMA, sehingga bentuk kalimat tidak membedakan keduanya (dulu pengecoh punya 3 rumusan tetap yang
 * mudah dibuang). Kalimat berarah (naik/turun) hanya dipakai petunjuk yang benar.
 */
export const HINT_UP = [
  "Perusahaan {x} diperkirakan mendapat keuntungan dari situasi ini.",
  "Pelaku pasar menilai perusahaan {x} berpeluang menguat.",
  "Perusahaan {x} dinilai berada di posisi menguntungkan.",
  "Perusahaan {x} disebut sebagai pihak yang paling diuntungkan.",
  "Analis memperkirakan perusahaan {x} ikut terdorong naik.",
  "Bagi perusahaan {x}, kabar ini terbaca sebagai angin segar.",
  "Perusahaan {x} kemungkinan menikmati dampak positifnya.",
] as const;
export const HINT_DOWN = [
  "Perusahaan {x} berisiko tertekan.",
  "Perusahaan {x} diperkirakan melemah.",
  "Perusahaan {x} cenderung terdampak negatif.",
  "Bagi perusahaan {x}, kabar ini terbaca kurang menguntungkan.",
  "Perusahaan {x} disebut sebagai pihak yang paling terpukul.",
  "Analis memperkirakan perusahaan {x} ikut tertekan.",
  "Perusahaan {x} menghadapi tekanan baru.",
] as const;
export const NEUTRAL_TEMPLATES = [
  "Perusahaan {x} disebut akan merasakan dampak langsungnya.",
  "Pelaku pasar mencermati perusahaan {x} secara saksama.",
  "Perusahaan {x} dinilai paling peka terhadap perkembangan ini.",
  "Pembahasan hari ini banyak menyinggung perusahaan {x}.",
  "Sejumlah analis menyebut perusahaan {x} patut dipantau.",
  "Perusahaan {x} menjadi salah satu yang ditanyakan investor.",
  "Di kalangan pelaku pasar, perusahaan {x} ramai dibicarakan.",
  "Sumber di pasar menyebut perusahaan {x} ikut dipantau.",
  "Perhatian tertuju pada perusahaan {x}.",
  "Perusahaan {x} belum memberi tanggapan.",
  "Beberapa pihak menyinggung perusahaan {x} tanpa merinci alasannya.",
  "Tak sedikit investor menanyakan nasib perusahaan {x}.",
] as const;
const fillX = (template: string, phrase: string) => template.replace("{x}", `yang ${phrase}`);

/** Penyambung antarkalimat; separuhnya kosong, dan dipakai sama untuk semua jenis kalimat (tidak menandai pengecoh). */
const CONNECTORS = [
  "Di sisi lain, ",
  "Selain itu, ",
  "Sementara itu, ",
  "Pada waktu yang sama, ",
  "Terpisah dari itu, ",
  "Dalam kabar lain, ",
  "",
  "",
  "",
  "",
] as const;

/**
 * Kalimat petunjuk dampak (TINGKAT SULIT): tanpa menyebut nama perusahaan, hanya SATU ciri aset yang naik terbesar dan
 * SATU yang turun terbesar (efek berarti >= HINT_MIN_BPS; subjek berita event di `exclude` dilewati). Separuh petunjuk
 * tidak menyebut arah (rumusan netral yang sama dengan pengecoh), jadi arahnya harus disimpulkan dari topik berita.
 * Deterministik menurut judul. Aset pengisi berefek kecil tidak disebut.
 */
export function hintClauses(
  title: string,
  effects: PoolEffect[],
  exclude: string[] = [],
  used: Set<string> = new Set(),
): string[] {
  const byMag = (a: PoolEffect, b: PoolEffect) => Math.abs(b.pct_bps) - Math.abs(a.pct_bps);
  const pool = effects.filter(
    (e) => !exclude.includes(e.symbol) && ASSET_TRAITS[e.symbol] && Math.abs(e.pct_bps) >= HINT_MIN_BPS,
  );
  const top = (sign: number) =>
    pool
      .filter((e) => Math.sign(e.pct_bps) === sign)
      .sort(byMag)
      .slice(0, HINT_PER_SIDE_HARD);
  return [...top(1), ...top(-1)].map((e) => {
    const x = traitPhrase(e.symbol, title)!;
    const list = isNeutralHint(title, e.symbol) ? NEUTRAL_TEMPLATES : e.pct_bps > 0 ? HINT_UP : HINT_DOWN;
    return fillX(pickDistinct<string>(list, title, `petunjuk|${e.symbol}`, used), x);
  });
}

/** Semua kalimat petunjuk digabung (untuk tes dan kompatibilitas). */
export function hintSentence(title: string, effects: PoolEffect[], exclude: string[] = []): string {
  const parts = hintClauses(title, effects, exclude);
  return parts.length ? parts.join(" ") : "Dampak pada perusahaan lain diperkirakan terbatas.";
}

/**
 * Pengecoh SIFAT: 0 sampai 2 kalimat yang menyebut ciri aset yang sebenarnya TIDAK terdampak (efek < HINT_MIN_BPS atau tidak
 * ada), memakai rumusan NETRAL yang sama dengan petunjuk tanpa arah. Deterministik menurut judul; subjek event dilewati.
 * Laporan analisa menyebutnya sebagai pengecoh (paragraf 4).
 */
export function decoysOf(
  title: string,
  effects: PoolEffect[],
  exclude: string[] = [],
  used: Set<string> = new Set(),
): { symbol: string; phrase: string; sentence: string }[] {
  const meaningful = new Set(effects.filter((e) => Math.abs(e.pct_bps) >= HINT_MIN_BPS).map((e) => e.symbol));
  const candidates = Object.keys(ASSET_TRAITS)
    .filter((sym) => !meaningful.has(sym) && !exclude.includes(sym))
    .sort();
  const count = Math.min([0, 1, 1, 1, 1, 2][hashOf(`jumlah-pengecoh|${title}`) % 6], candidates.length);
  const out: { symbol: string; phrase: string; sentence: string }[] = [];
  for (let i = 0; i < count; i++) {
    let symbol = candidates[hashOf(`pengecoh${i}|${title}`) % candidates.length];
    while (out.some((d) => d.symbol === symbol))
      symbol = candidates[(candidates.indexOf(symbol) + 1) % candidates.length];
    const phrase = traitPhrase(symbol, title)!;
    out.push({
      symbol,
      phrase,
      sentence: fillX(pickDistinct<string>(NEUTRAL_TEMPLATES, title, `kalimat-pengecoh${i}`, used), phrase),
    });
  }
  return out;
}

/** Sektor dengan bobot terbesar pada efek. */
function leadSectorOf(effects: PoolEffect[], sectorOf: Map<string, SectorKey>): SectorKey | undefined {
  const top = [...effects].sort((a, b) => Math.abs(b.pct_bps) - Math.abs(a.pct_bps))[0];
  return top ? sectorOf.get(top.symbol) : undefined;
}

/**
 * Paragraf kedua (TINGKAT SULIT, struktur tanpa ciri khas): kalimat petunjuk (satu naik dan satu turun terbesar), 0-2
 * pengecoh sifat, dan 1-2 pengecoh topik (berdekatan dengan sektor LAIN atau umum). Semua kalimat diacak urutannya, dan
 * penyambungnya (termasuk "tanpa penyambung") dipilih tanpa melihat jenis kalimat, sehingga tidak ada pola yang
 * membedakan petunjuk, pengecoh sifat, dan pengecoh topik. Tanpa RNG utama (hash judul), jadi efek tidak bergeser.
 */
function secondParagraph(
  title: string,
  effects: PoolEffect[],
  sectorOf: Map<string, SectorKey>,
  exclude: string[] = [],
): string {
  const lead = leadSectorOf(
    effects.filter((e) => !exclude.includes(e.symbol)),
    sectorOf,
  );
  const others = (Object.keys(NOISE_BY_SECTOR) as SectorKey[]).filter((k) => k !== lead);
  // kalimat berhuruf besar (petunjuk dan pengecoh sifat) dan anak kalimat huruf kecil (pengecoh topik)
  const usedTemplates = new Set<string>(); // rumusan netral/arah yang sudah dipakai di paragraf ini
  const slots: { text: string; clause: boolean }[] = [
    ...hintClauses(title, effects, exclude, usedTemplates).map((text) => ({ text, clause: false })),
    ...decoysOf(title, effects, exclude, usedTemplates).map((d) => ({ text: d.sentence, clause: false })),
  ];
  // genre "singkat" (berita kawat): hanya satu pengecoh topik
  const noiseCount =
    genreOf(title) === "singkat" ? 1 : 1 + (hashOf(`jumlah-noise|${title}`) % 3 === 0 ? 1 : 0);
  const usedNoise = new Set<string>();
  for (let i = 0; i < noiseCount; i++) {
    const bank =
      hashOf(`bank${i}|${title}`) % 2 === 0
        ? NOISE_GENERIC
        : NOISE_BY_SECTOR[pickBy(others, title, `sektor-lain${i}`)];
    let item = pickBy(bank, title, `noise${i}`);
    for (let k = 1; usedNoise.has(item) && k < bank.length; k++)
      item = bank[(bank.indexOf(item) + 1) % bank.length];
    usedNoise.add(item);
    slots.push({ text: item, clause: true });
  }
  const ordered = slots
    .map((slot, i) => ({ slot, key: hashOf(`urutan|${title}|${i}`) }))
    .sort((a, b) => a.key - b.key)
    .map((x) => x.slot);
  let previousConnector = "";
  return ordered
    .map(({ text, clause }, i) => {
      let connector = i === 0 ? "" : pickBy(CONNECTORS, title, `sambung${i}`);
      // penyambung yang sama tidak dipakai dua kali berturut-turut
      for (let k = 0; connector && connector === previousConnector && k < CONNECTORS.length; k++)
        connector = CONNECTORS[(CONNECTORS.indexOf(connector) + 1) % CONNECTORS.length];
      if (connector) previousConnector = connector;
      if (clause) return connector ? `${connector}${text}.` : `${upperFirst(text)}.`;
      return connector ? `${connector}${lowerFirst(text)}` : text;
    })
    .join(" ");
}

/**
 * Kekuatan efek untuk laporan analisa (kalibrasi 23 Nov, `effectScale` 2: efek berarti umumnya 1-15 %, sepertiga terbawah
 * di bawah 4 %, sepertiga tengah 4-6 %, sisanya lebih besar). Batas tampil memakai persen bulat supaya mudah dibaca pemain.
 */
export const STRENGTH_BANDS = [
  { min: 800, label: "kuat", range: "di atas 8 %" },
  { min: 400, label: "sedang", range: "4 sampai 8 %" },
  { min: 100, label: "ringan", range: "1 sampai 4 %" },
] as const;
const strengthOf = (bps: number) => STRENGTH_BANDS.find((b) => Math.abs(bps) >= b.min);

/** Frasa sifat ALTERNATIF untuk laporan: aset yang sama, tetapi bukan frasa yang dipakai berita (jika aset punya >1 frasa). */
export function traitPhraseAlt(symbol: string, title: string): string | null {
  const t = ASSET_TRAITS[symbol];
  if (!t) return null;
  return t.phrases[(hashOf(`${title}|${symbol}`) + 1) % t.phrases.length];
}

/**
 * Laporan 4 paragraf untuk satu berita, DIBUAT DARI efek yang sebenarnya (tidak memakai RNG utama; deterministik menurut
 * judul, jadi tidak menggeser efek atau judul yang sudah ada). Tanpa nama atau kode aset: hanya frasa sifat (kamus docs/16).
 *  1. ringkasan arah + perkiraan waktu (`{waktu}` diisi saat dibeli); 2. ciri yang naik; 3. ciri yang turun; 4. catatan.
 */
export function analysisParagraphs(
  title: string,
  kind: PoolKind,
  effects: PoolEffect[],
  event: { symbol: string; amount: number } | null,
): string[] {
  const h = hashOf(`analisa|${title}`);
  const meaningful = effects.filter((e) => Math.abs(e.pct_bps) >= HINT_MIN_BPS);
  const ups = meaningful.filter((e) => e.pct_bps > 0).sort((a, b) => b.pct_bps - a.pct_bps);
  const downs = meaningful.filter((e) => e.pct_bps < 0).sort((a, b) => a.pct_bps - b.pct_bps);
  const sum = (xs: PoolEffect[]) => xs.reduce((n, e) => n + Math.abs(e.pct_bps), 0);
  const mood =
    sum(ups) > sum(downs) * 1.5 ? "condong naik" : sum(downs) > sum(ups) * 1.5 ? "condong turun" : "campuran";

  const p1 =
    meaningful.length === 0
      ? `Analisa untuk berita "${title}": dampaknya pada harga kecil dan tersebar. Harga mulai bergerak dalam {waktu} ke depan.`
      : [
          `Analisa untuk berita "${title}": pasar diperkirakan ${mood}, dengan ${ups.length} ciri perusahaan yang naik dan ${downs.length} yang turun secara berarti. Harga mulai bergerak dalam {waktu} ke depan.`,
          `Ringkasan analisa untuk berita "${title}": arah pasar ${mood}; ${ups.length} ciri perusahaan naik dan ${downs.length} turun cukup berarti. Perubahan harga diperkirakan mulai terlihat dalam {waktu} ke depan.`,
          `Hasil analisa berita "${title}": tekanan pasar ${mood}, dengan ${ups.length} ciri perusahaan menguat dan ${downs.length} melemah secara berarti. Harga mulai bergerak dalam {waktu} ke depan.`,
        ][h % 3];

  const item = (e: PoolEffect): string => {
    const band = strengthOf(e.pct_bps)!;
    const who =
      event && e.symbol === event.symbol
        ? "perusahaan yang disebut di berita"
        : `perusahaan yang ${traitPhraseAlt(e.symbol, title) ?? "tidak dikenali"}`;
    return `${who} (${band.label}, ${band.range})`;
  };
  const side = (xs: PoolEffect[], dir: "naik" | "turun", salt: number): string => {
    if (!xs.length)
      return `Tidak ada ciri perusahaan yang diperkirakan ${dir} secara berarti pada berita ini.`;
    const top = xs.slice(0, 3);
    const rest = xs.length - top.length;
    const more = rest > 0 ? ` Masih ada ${rest} ciri lain yang ${dir} di atas 1 %, tetapi lebih kecil.` : "";
    const list = listSerta(top.map(item));
    return [
      `Ciri yang diperkirakan ${dir}, urut dari yang terbesar: ${list}.${more}`,
      `Yang berpeluang ${dir} paling besar adalah ${list}; urutannya dari yang terbesar.${more}`,
      `Perkiraan ${dir}, dari yang terbesar: ${list}.${more}`,
    ][(h + salt) % 3];
  };

  const tiny = effects.length - meaningful.length;
  const parts: string[] = [];
  if (tiny > 0)
    parts.push(
      `Sebanyak ${tiny} perusahaan lain hanya bergerak tipis (di bawah 1 %), jadi tidak layak dikejar.`,
    );
  const decoys = decoysOf(title, effects, event ? [event.symbol] : []);
  if (decoys.length)
    parts.push(
      `Ciri ${listSerta(decoys.map((d) => `perusahaan yang ${d.phrase}`))}, yang sempat disebut di berita, hanyalah pengecoh: tidak ada efek harga yang berarti.`,
    );
  parts.push("Kalimat pengecoh lain di berita tidak memengaruhi harga sama sekali.");
  if (kind === "bankrupt")
    parts.push(
      "Berita ini membawa kebangkrutan: perusahaan yang disebut dilikuidasi dan tidak bisa diperdagangkan lagi, jadi tidak ada efek harga untuknya.",
    );
  else if (kind === "suspend")
    parts.push(
      "Berita ini membawa penghentian sementara pada perusahaan yang disebut: selama itu ia tidak bisa dibeli atau dijual.",
    );
  else if (kind === "dividend")
    parts.push("Berita ini membawa pembagian dividen kepada pemegang perusahaan yang disebut.");
  parts.push(
    "Perhitungkan juga selisih harga jual (efek ringan sering habis olehnya), tekanan stok dari pembelian tim lain, dan batas kepemilikan per tim sebelum bertindak.",
  );

  return [p1, side(ups, "naik", 1), side(downs, "turun", 2), parts.join(" ")];
}

/** Efek berarti (tematis) bermagnitudo >= ini dan layak jadi petunjuk; efek pengisi selalu di bawahnya (<= 90 bps). */
export const HINT_MIN_BPS = 100;

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

/**
 * Genre berita (23 Nov, tahap 2 perbaikan teks): cara peristiwa DITUTURKAN berbeda-beda supaya tidak semua berita berbentuk
 * "satu kalimat peristiwa + paragraf ciri". Dipilih deterministik menurut judul (hash). Hanya paragraf 1 yang berubah (awalan
 * atau tambahan di sekitar kalimat peristiwa; tidak pernah mengubah isi peristiwa), dan tambahannya netral (tanpa arah/sektor).
 */
export type Genre = "lurus" | "singkat" | "kutipan" | "sumber" | "rilis" | "lapangan";
const GENRES: readonly Genre[] = [
  "lurus",
  "lurus",
  "lurus",
  "singkat",
  "kutipan",
  "sumber",
  "rilis",
  "lapangan",
];
export const genreOf = (title: string): Genre => GENRES[hashOf(`genre|${title}`) % GENRES.length];

/** Bungkus paragraf peristiwa menurut genre (fiktif; nama dari `news-voices.ts`). */
export function decorateEvent(title: string, event: string): string {
  switch (genreOf(title)) {
    case "singkat":
      return `${pickBy(CITIES, title, "kota").toUpperCase()} — ${event}`;
    case "kutipan": {
      const [nama, jabatan, lembaga] = pickBy(PEOPLE, title, "tokoh");
      return `${event} "${pickBy(QUOTES, title, "kutipan")}," kata ${nama}, ${jabatan} ${lembaga}.`;
    }
    case "sumber":
      return `${event} Informasi itu dihimpun dari ${pickBy(SOURCES, title, "sumber")}.`;
    case "rilis":
      return `${event} Hal itu disampaikan ${pickBy(ORGANIZATIONS, title, "lembaga")} dalam keterangan tertulis.`;
    case "lapangan":
      return `${event} ${pickBy(SCENES, title, "adegan")}`;
    default:
      return event;
  }
}

/** Kalimat pertama sebuah paragraf (peristiwa); sisanya (akibat per sektor) dibuang pada tingkat sulit. */
export function firstSentence(text: string): string {
  const m = /^[\s\S]*?[.!?](?=\s|$)/.exec(text.trim());
  return m ? m[0] : text.trim();
}

/** Komentar netral pengganti kalimat konteks sektor: tidak menyebut sektor atau arah. */
const NEUTRAL_COMMENTARY = [
  "Para pelaku pasar masih menimbang dampaknya.",
  "Sebagian pihak menilai dampaknya akan terasa bertahap.",
  "Belum ada pernyataan resmi mengenai langkah lanjutan.",
  "Sejumlah pihak menyebut situasinya masih bisa berubah.",
  "Pengamat meminta publik tidak terburu-buru menarik kesimpulan.",
  "Rincian pelaksanaannya masih dibahas.",
  "Angka resmi dijadwalkan keluar pekan depan.",
  "Sejumlah pelaku usaha mengaku baru mengetahui kabar ini hari ini.",
  "Belum jelas kapan kebijakan atau perubahan itu mulai terasa.",
  "Pihak terkait enggan memberi keterangan lebih jauh.",
  "Sebagian pihak masih menunggu data pendukung.",
  "Reaksi awal di lapangan terlihat beragam.",
];

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
            const mag = Math.abs(w) * rng.int(130, 330) * (0.75 + rng.next() * 0.5) * cfg.effectScale;
            chosen.set(a.symbol, clampBps(Math.sign(w) * dirSign * mag, cfg.capBps));
          }
        }
        fillEffects(rng, chosen, assets, Math.max(target, cfg.minAssets), cfg.capBps);
        // tingkat sulit: paragraf 1 hanya kalimat peristiwa (kalimat akibat per sektor dibuang); varian 1 memakai komentar netral
        const base = firstSentence(theme[dir].b);
        const second =
          variant === 1 ? ` ${NEUTRAL_COMMENTARY[hashOf(theme[dir].t[1]) % NEUTRAL_COMMENTARY.length]}` : "";
        const title = theme[dir].t[variant];
        const effects = [...chosen].map(([symbol, pct_bps]) => ({ symbol, pct_bps }));
        out.push({
          kind: "price",
          title,
          body: `${decorateEvent(title, base)}${genreOf(title) === "singkat" ? "" : second}\n\n${secondParagraph(title, effects, sectorOf)}`,
          effects,
          event: null,
          analysis: analysisParagraphs(title, "price", effects, null),
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
            .forEach((p) => chosen.set(p.symbol, clampBps(-rng.int(150, 400) * cfg.effectScale, cfg.capBps)));
          if (shufPeers[3])
            chosen.set(shufPeers[3].symbol, clampBps(rng.int(100, 250) * cfg.effectScale, cfg.capBps));
        } else {
          const own = (kind === "dividend" ? rng.int(100, 300) : -rng.int(100, 300)) * cfg.effectScale;
          chosen.set(asset.symbol, clampBps(own, cfg.capBps));
          shufPeers
            .slice(0, 2)
            .forEach((p) =>
              chosen.set(
                p.symbol,
                clampBps((kind === "dividend" ? 1 : -1) * rng.int(100, 180) * cfg.effectScale, cfg.capBps),
              ),
            );
        }
        const universe = kind === "bankrupt" ? assets.filter((a) => a.symbol !== asset.symbol) : assets;
        fillEffects(rng, chosen, universe, target, cfg.capBps);
        const effects = [...chosen].map(([symbol, pct_bps]) => ({ symbol, pct_bps }));
        out.push({
          kind,
          title,
          body: `${decorateEvent(title, body)}\n\n${secondParagraph(title, effects, sectorOf, [asset.symbol])}`,
          effects,
          event: { symbol: asset.symbol, amount },
          analysis: analysisParagraphs(title, kind, effects, { symbol: asset.symbol, amount }),
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
    // laporan analisa: 4 paragraf, {waktu} sekali di paragraf 1, tanpa nama perusahaan, dan arahnya benar menurut efek
    {
      const an = n.analysis ?? [];
      if (an.length !== 4) problems.push(`${tag}: laporan analisa harus 4 paragraf (ada ${an.length})`);
      else {
        if ((an[0].match(/\{waktu\}/g) ?? []).length !== 1)
          problems.push(`${tag}: paragraf 1 analisa harus memuat {waktu} tepat sekali`);
        if (an.slice(1).some((p) => p.includes("{waktu}")))
          problems.push(`${tag}: {waktu} hanya boleh di paragraf 1 analisa`);
        if (an.some((p) => !p.trim())) problems.push(`${tag}: paragraf analisa kosong`);
        // seperti berita: hanya subjek event yang boleh disebut (lewat judul di paragraf 1)
        for (const a of assets)
          if (a.symbol !== n.event?.symbol && an.some((p) => nameRe.get(a.symbol)!.test(p)))
            problems.push(`${tag}: analisa menyebut nama ${a.name}`);
        for (const [idx, sign] of [
          [1, 1],
          [2, -1],
        ] as const) {
          for (const [sym, tr] of Object.entries(ASSET_TRAITS)) {
            for (const ph of tr.phrases) {
              if (!an[idx].includes(`perusahaan yang ${ph} (`)) continue;
              const e = n.effects.find((x) => x.symbol === sym);
              if (!e || Math.sign(e.pct_bps) !== sign || Math.abs(e.pct_bps) < HINT_MIN_BPS)
                problems.push(
                  `${tag}: analisa paragraf ${idx + 1} menyebut ${sym} tetapi efeknya ${e ? e.pct_bps : "tidak ada"}`,
                );
            }
          }
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
    const arr = `array[${n.analysis.map(q).join(", ")}]::text[]`;
    lines.push(`insert into news_analysis (news_id, paragraphs) values (v, ${arr});`);
    lines.push(
      `else update news set body = ${q(n.body)} where title = ${q(n.title)} and status in ('ready', 'draft') and body <> ${q(n.body)};`,
    );
    // berita yang sudah ada (belum dipakai): laporan diperbarui/dilengkapi tanpa mengubah efeknya
    lines.push(
      `insert into news_analysis (news_id, paragraphs) select id, ${arr} from news where title = ${q(n.title)} and status in ('ready', 'draft') on conflict (news_id) do update set paragraphs = excluded.paragraphs;`,
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
