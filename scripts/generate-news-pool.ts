/**
 * [LAMA] Membangkitkan kumpulan berita OTOMATIS (harga + event) dari `scripts/data/news-themes.ts`.
 * Sejak 25 Nov kumpulan yang dipakai adalah berita TULIS TANGAN (`npm run build-news`, docs/21); pembuat ini tetap ada untuk
 * perbandingan dan menulis ke `news-pool.auto.json` supaya tidak menimpa `news-pool.json`.
 *   npm run generate-news            -> scripts/data/news-pool.auto.json + docs/14-kumpulan-berita.md
 *   npm run generate-news -- --sql /tmp/pool.sql [--replace]   (juga tulis SQL; --replace mengganti berita ready/draft)
 *   opsi: --seed teks  --min 10  --max 15  --cap 1500  --scale 1 (pengali besar efek, docs/19)
 * Tidak menyentuh database.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assetsFile from "./data/assets.example.json";
import {
  buildPool,
  DEFAULT_CONFIG,
  poolToMarkdown,
  poolToSql,
  validatePool,
  type PoolAsset,
} from "./news-pool-lib";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const cfg = {
  ...DEFAULT_CONFIG,
  seed: opt("seed") ?? DEFAULT_CONFIG.seed,
  minAssets: Number(opt("min") ?? DEFAULT_CONFIG.minAssets),
  maxAssets: Number(opt("max") ?? DEFAULT_CONFIG.maxAssets),
  capBps: Number(opt("cap") ?? DEFAULT_CONFIG.capBps),
  effectScale: Number(opt("scale") ?? DEFAULT_CONFIG.effectScale),
};
const assets = (assetsFile.assets as { symbol: string; name: string; sector: string }[]).map(
  (a): PoolAsset => ({ symbol: a.symbol, name: a.name, sector: a.sector }),
);

const pool = buildPool(assets, cfg);
const problems = validatePool(pool, assets, cfg);
if (problems.length) {
  console.error(`Kumpulan tidak valid:\n  - ${problems.slice(0, 30).join("\n  - ")}`);
  process.exit(1);
}

const jsonPath = resolve(here, "data/news-pool.auto.json");
const mdPath = resolve(here, "../docs/14-kumpulan-berita.md");
mkdirSync(dirname(jsonPath), { recursive: true });
writeFileSync(
  jsonPath,
  JSON.stringify(
    {
      _catatan: `Dibangkitkan oleh scripts/generate-news-pool.ts (seed "${cfg.seed}", ${cfg.minAssets}-${cfg.maxAssets} aset per berita). Kumpulan LAMA (otomatis); yang dipakai seed adalah news-pool.json dari build-news.`,
      news: pool,
    },
    null,
    1,
  ) + "\n",
);
writeFileSync(mdPath, poolToMarkdown(pool, assets) + "\n");
const sqlPath = opt("sql");
if (sqlPath) writeFileSync(sqlPath, poolToSql(pool, { replace: args.includes("--replace") }) + "\n");
const count = (k: string) => pool.filter((n) => n.kind === k).length;
console.log(
  `✔ ${pool.length} berita: ${count("price")} harga, ${count("bankrupt")} bangkrut, ${count("suspend")} suspensi, ${count("dividend")} dividen`,
);
console.log(`  ${jsonPath}\n  ${mdPath}${sqlPath ? `\n  ${sqlPath}` : ""}`);
