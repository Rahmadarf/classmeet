/**
 * Logika untuk print-qr.ts: validasi tim, render QR (PNG) dan lembar cetak HTML.
 * Dipisah dari CLI supaya bisa diuji vitest. Isi QR SELALU dibuat oleh `formatTeamQr` (lib/qr.ts) agar
 * cocok dengan pembaca di /kiosk.
 *
 * Keamanan: nilai QR adalah kredensial. Berkas HTML hanya memuat QR sebagai gambar (data URI PNG): token
 * tidak pernah muncul sebagai teks di halaman, dan kode cadangan (`short_code`) sengaja tidak dicetak
 * (docs/08 §2 langkah 6).
 */
import { writeBarcode } from "zxing-wasm/writer";
import { addCenterLogo } from "../lib/qr-logo";
import { formatTeamQr, parseTeamQr } from "../lib/qr";

export type TeamInput = { name: string; username: string; qr_token: string };
export type Card = { name: string; username: string; payload: string };

/** Mengubah daftar tim jadi kartu; berhenti (throw) bila ada data yang tidak bisa jadi QR valid. */
export function buildCards(teams: TeamInput[]): Card[] {
  if (teams.length === 0) throw new Error("Tidak ada tim di berkas masukan.");
  const seen = new Set<string>();
  return teams.map((t) => {
    const parsed = parseTeamQr(`CM1:${t.username}:${t.qr_token}`);
    if (!parsed) throw new Error(`Tim "${t.name}": username atau qr_token tidak valid.`);
    if (seen.has(parsed.username)) throw new Error(`Username ganda: ${parsed.username}`);
    seen.add(parsed.username);
    if (!t.name.trim()) throw new Error(`Tim ${parsed.username}: nama kosong.`);
    return { name: t.name.trim(), username: parsed.username, payload: formatTeamQr(parsed) };
  });
}

/**
 * QR dalam bentuk PNG. Koreksi galat H (30 %) karena logo ISSC berwarna ditempel di tengahnya (`addCenterLogo`); modul QR tetap
 * hitam di atas putih. Zona tenang disertakan, tiap modul 12 px (jelas saat dicetak).
 */
export async function renderQrPng(payload: string): Promise<Uint8Array> {
  const result = await writeBarcode(payload, {
    format: "QRCode",
    ecLevel: "H",
    scale: 12,
    withQuietZones: true,
  });
  if (result.error || !result.image) throw new Error(`Gagal membuat QR: ${result.error || "tanpa gambar"}`);
  return addCenterLogo(new Uint8Array(await result.image.arrayBuffer()));
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type PngCard = { name: string; png: Uint8Array };

/**
 * Lembar cetak: satu kartu per halaman A4 portrait, `copies` salinan per tim (docs/08: dua set, satu untuk
 * tim dan satu cadangan panitia). Hanya nama tim dan QR besar. Latar putih, tinta gelap untuk QR (pemindai
 * membutuhkan kontras maksimum).
 */
export function renderSheetHtml(cards: PngCard[], copies: number): string {
  const pages: string[] = [];
  for (let copy = 1; copy <= copies; copy++) {
    for (const card of cards) {
      const src = `data:image/png;base64,${Buffer.from(card.png).toString("base64")}`;
      pages.push(`<section class="card">
  <p class="eyebrow">Classmeet Market</p>
  <h1>${escapeHtml(card.name)}</h1>
  <img src="${src}" alt="Kartu masuk ${escapeHtml(card.name)}" width="520" height="520">
  <p class="hint">Pindai kartu ini di laptop trading untuk masuk.<br>Jangan difoto atau dibagikan.</p>
  ${copies > 1 ? `<p class="set">Set ${copy} dari ${copies}</p>` : ""}
</section>`);
    }
  }
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>Kartu tim Classmeet Market</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #fff; color: #0b1b4d; font-family: Inter, -apple-system, "SF Pro Text", "Segoe UI", sans-serif; }
  .card { width: 210mm; height: 297mm; padding: 28mm 20mm; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12mm; text-align: center; break-after: page; }
  .eyebrow { margin: 0; font-size: 14pt; letter-spacing: .18em; text-transform: uppercase; font-weight: 600; color: #1b3fd8; }
  h1 { margin: 0; font-size: 44pt; line-height: 1.1; font-weight: 700; text-wrap: balance; }
  img { width: 130mm; height: 130mm; image-rendering: pixelated; }
  .hint { margin: 0; font-size: 15pt; line-height: 1.5; }
  .set { margin: 0; font-size: 11pt; color: #55618a; }
  @media screen { body { background: #f3f6ff; } .card { margin: 16px auto; background: #fff; box-shadow: 0 2px 12px rgba(27,63,216,.12); } }
</style>
</head>
<body>
${pages.join("\n")}
</body>
</html>
`;
}
