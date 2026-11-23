import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/** Lebar logo relatif terhadap lebar seluruh gambar QR (termasuk zona tenang). Diuji terbaca sampai ±0,40; 0,28 memberi margin. */
export const QR_LOGO_RATIO = 0.28;
/** Bantalan putih di sekeliling logo (relatif terhadap lebar QR) supaya modul hitam tidak menempel pada tepi logo. */
const QR_LOGO_PAD = 0.022;

/** Lokasi logo ISSC (diturunkan dari assets/issc-logo.png, 800 px lebar). Dibaca dari akar proyek. */
export const LOGO_PATH = path.join(process.cwd(), "public/brand/issc-logo.png");

/**
 * Menempelkan logo BERWARNA di tengah QR (PNG hitam-putih). Modul QR tetap hitam; logo diberi bantalan putih bersudut bulat
 * sehingga tidak bertabrakan dengan modul. Pemakai WAJIB membuat QR dengan koreksi galat tingkat H (30 %): modul yang tertutup
 * logo dipulihkan oleh pemindai. Ukuran logo dibatasi `QR_LOGO_RATIO` dari lebar QR (± 4 % luas) dan jauh dari pola sudut.
 */
export async function addCenterLogo(
  qrPng: Uint8Array,
  opts: { ratio?: number; logoPath?: string } = {},
): Promise<Uint8Array> {
  const ratio = opts.ratio ?? QR_LOGO_RATIO;
  const base = sharp(Buffer.from(qrPng));
  const { width, height } = await base.metadata();
  if (!width || !height) throw new Error("Gambar QR tidak terbaca.");
  const logoW = Math.round(width * ratio);
  const logo = await sharp(await readFile(/* turbopackIgnore: true */ opts.logoPath ?? LOGO_PATH))
    .resize({ width: logoW })
    .png()
    .toBuffer();
  const logoMeta = await sharp(logo).metadata();
  const logoH = logoMeta.height ?? Math.round(logoW / 2);
  const pad = Math.round(width * QR_LOGO_PAD);
  const backW = logoW + pad * 2;
  const backH = logoH + pad * 2;
  const radius = Math.round(Math.min(backW, backH) * 0.28);
  const backing = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${backW}" height="${backH}"><rect width="${backW}" height="${backH}" rx="${radius}" ry="${radius}" fill="#ffffff"/></svg>`,
  );
  const left = Math.round((width - backW) / 2);
  const top = Math.round((height - backH) / 2);
  const out = await base
    .composite([
      { input: backing, left, top },
      { input: logo, left: left + pad, top: top + pad },
    ])
    .png()
    .toBuffer();
  return new Uint8Array(out);
}
