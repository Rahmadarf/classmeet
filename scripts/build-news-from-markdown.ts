/**
 * Membangun kumpulan berita dari berita TULIS TANGAN di `docs/berita-650/berita-*.md` (docs/21), menggantikan pembuat otomatis.
 *   npm run build-news                       -> scripts/data/news-pool.json (dibaca `npm run seed`)
 *   npm run build-news -- --check            -> hanya memeriksa, tidak menulis apa pun
 *   npm run build-news -- --sql /tmp/p.sql [--replace]   (juga tulis SQL; --replace mengganti berita ready/draft)
 *   opsi: --dir docs/berita-650  --out scripts/data/news-pool.json  --scale 1 (pengali efek >= 1 %, maks 15 %)
 * Tidak menyentuh database. Galat validasi menghentikan proses; peringatan petunjuk hanya dicetak.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assetsFile from "./data/assets.example.json";
import { handHintWarnings, parseHandMarkdown, scaleEffects, toPoolNews } from "./news-hand-lib";
import { DEFAULT_CONFIG, poolToSql, validatePool, type PoolAsset } from "./news-pool-lib";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const dir = resolve(here, "..", opt("dir") ?? "docs/berita-650");
const outPath = resolve(here, "..", opt("out") ?? "scripts/data/news-pool.json");
const scale = Number(opt("scale") ?? 1);
const cfg = DEFAULT_CONFIG;
const assets = (assetsFile.assets as { symbol: string; name: string; sector: string }[]).map(
  (a): PoolAsset => ({ symbol: a.symbol, name: a.name, sector: a.sector }),
);

const files = readdirSync(dir)
  .filter((f) => /^berita-\d+\.md$/.test(f))
  .sort();
if (files.length === 0) {
  console.error(`Tidak ada berkas berita-*.md di ${dir}`);
  process.exit(1);
}
const parsedErrors: string[] = [];
const parsed = files.flatMap((f) => {
  const { news, errors } = parseHandMarkdown(readFileSync(resolve(dir, f), "utf8"), f);
  parsedErrors.push(...errors);
  return news;
});
const ids = new Set<string>();
for (const n of parsed) {
  if (ids.has(n.id)) parsedErrors.push(`${n.id}: ID ganda`);
  ids.add(n.id);
}

const scaled = scaleEffects(parsed, scale, cfg.capBps);
const pool = toPoolNews(scaled);
const problems = [...parsedErrors, ...validatePool(pool, assets, cfg, { hand: true })];
if (problems.length) {
  console.error(`Kumpulan tidak valid (${problems.length}):\n  - ${problems.slice(0, 40).join("\n  - ")}`);
  process.exit(1);
}
const warnings = handHintWarnings(scaled);
if (warnings.length) {
  console.warn(`Peringatan petunjuk (${warnings.length}, ditinjau manusia):`);
  for (const w of warnings.slice(0, 15)) console.warn(`  - ${w}`);
  if (warnings.length > 15) console.warn(`  ... dan ${warnings.length - 15} lainnya`);
}

const count = (k: string) => pool.filter((n) => n.kind === k).length;
const summary = `${pool.length} berita: ${count("price")} harga, ${count("bankrupt")} bangkrut, ${count("suspend")} suspensi, ${count("dividend")} dividen`;
if (args.includes("--check")) {
  console.log(`✔ ${summary} (hanya diperiksa)`);
  process.exit(0);
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(
  outPath,
  JSON.stringify(
    {
      _catatan: `Dibangun oleh scripts/build-news-from-markdown.ts dari docs/berita-650/*.md (berita tulis tangan, docs/21)${scale === 1 ? "" : `, efek ×${scale}`}. Jangan disunting tangan; ubah markdown lalu bangun ulang.`,
      news: pool,
    },
    null,
    1,
  ) + "\n",
);
const sqlPath = opt("sql");
if (sqlPath) writeFileSync(sqlPath, poolToSql(pool, { replace: args.includes("--replace") }) + "\n");
console.log(`✔ ${summary}`);
console.log(`  ${outPath}${sqlPath ? `\n  ${sqlPath}` : ""}`);
