/**
 * Membuat kartu QR tim (PNG per tim + lembar cetak HTML). Dijalankan LOKAL.
 *
 *   npm run print-qr                       # membaca scripts/.seed-output.local.json
 *   npm run print-qr -- --input tim.json   # berkas lain (bentuk: {"teams":[{name,username,qr_token}]})
 *   npm run print-qr -- --copies 2         # dua set: satu untuk tim, satu cadangan panitia
 *
 * Keluaran: scripts/.qr-output.local/ (di-gitignore): <username>.png dan kartu-tim.html.
 * Buka kartu-tim.html di peramban lalu cetak (A4, skala 100 %, tanpa header/footer).
 *
 * Aturan keras (docs/06):
 *  - Isi QR adalah kredensial. Skrip ini tidak pernah mencetak token ke terminal.
 *  - Berkas keluaran memuat kredensial: jangan di-commit, hapus setelah kartu dicetak.
 *  - Tidak butuh service_role. (docs/08 menyebut membaca `teams.qr_token` lewat service role; untuk acara
 *    sungguhan gunakan skrip pembuat akun yang menulis berkas masukan yang sama.)
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCards, renderQrPng, renderSheetHtml, type TeamInput } from "./print-qr-lib";

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_INPUT = join(here, ".seed-output.local.json");
const OUT_DIR = join(here, ".qr-output.local");

function die(message: string): never {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function parseArgs(argv: string[]) {
  let input = DEFAULT_INPUT;
  let copies = 1;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--input") input = resolve(argv[++i] ?? die("--input butuh path berkas."));
    else if (arg === "--copies") {
      copies = Number(argv[++i]);
      if (!Number.isInteger(copies) || copies < 1 || copies > 5) die("--copies harus bilangan bulat 1–5.");
    } else die(`Argumen tidak dikenal: ${arg}`);
  }
  return { input, copies };
}

function loadTeams(path: string): TeamInput[] {
  if (!existsSync(path)) die(`Berkas masukan tidak ada: ${path}. Jalankan "npm run seed" dulu.`);
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    die("Berkas masukan bukan JSON yang valid.");
  }
  const teams = (json as { teams?: unknown })?.teams;
  if (!Array.isArray(teams)) die('Berkas masukan harus memuat larik "teams".');
  return teams.map((t) => {
    const { name, username, qr_token } = (t ?? {}) as Record<string, unknown>;
    if (typeof name !== "string" || typeof username !== "string" || typeof qr_token !== "string")
      die("Tiap tim harus punya name, username, dan qr_token bertipe teks.");
    return { name, username, qr_token };
  });
}

async function main() {
  const { input, copies } = parseArgs(process.argv.slice(2));
  const cards = (() => {
    try {
      return buildCards(loadTeams(input));
    } catch (error) {
      return die(error instanceof Error ? error.message : "Data tim tidak valid.");
    }
  })();

  mkdirSync(OUT_DIR, { recursive: true, mode: 0o700 });
  chmodSync(OUT_DIR, 0o700);

  const pngCards = [];
  for (const card of cards) {
    const png = await renderQrPng(card.payload);
    writeFileSync(join(OUT_DIR, `${card.username}.png`), png, { mode: 0o600 });
    pngCards.push({ name: card.name, png });
  }
  const sheet = join(OUT_DIR, "kartu-tim.html");
  writeFileSync(sheet, renderSheetHtml(pngCards, copies), { mode: 0o600 });

  console.log(`✔ ${cards.length} kartu tim (${copies} set) ditulis ke ${OUT_DIR}`);
  console.log(`  Cetak: buka ${sheet} di peramban (A4, skala 100 %).`);
  console.log("  Berkas ini memuat kredensial. Jangan di-commit; hapus setelah dicetak.");
}

main().catch((error) => die(error instanceof Error ? error.message : "Gagal membuat kartu."));
