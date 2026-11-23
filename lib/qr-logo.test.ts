import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { readBarcodes, setZXingModuleOverrides } from "zxing-wasm/reader";
import { describe, expect, it } from "vitest";
import { QR_LOGO_RATIO } from "./qr-logo";
import { renderQrPng } from "../scripts/print-qr-lib";

setZXingModuleOverrides({
  wasmBinary: readFileSync(
    fileURLToPath(new URL("../node_modules/zxing-wasm/dist/reader/zxing_reader.wasm", import.meta.url)),
  ).buffer as ArrayBuffer,
});

const PAYLOAD = "CM1:tim1:3f2c1a9e-7b44-4d0a-9c55-1e2d3c4b5a69";

async function decode(buf: Buffer | Uint8Array): Promise<string | undefined> {
  const r = await readBarcodes(new Blob([buf as BlobPart], { type: "image/png" }), { formats: ["QRCode"] });
  return r[0]?.text;
}

describe("QR dengan logo ISSC di tengah", () => {
  it("tetap terbaca persis sama, juga saat diperkecil, dikaburkan, atau miring", async () => {
    const png = Buffer.from(await renderQrPng(PAYLOAD));
    expect(await decode(png)).toBe(PAYLOAD);
    for (const width of [400, 240, 160]) {
      const small = await sharp(png).resize({ width }).png().toBuffer();
      expect(await decode(small), `${width}px`).toBe(PAYLOAD);
    }
    const blurred = await sharp(png).resize({ width: 300 }).blur(1.2).png().toBuffer();
    expect(await decode(blurred), "buram").toBe(PAYLOAD);
    const rotated = await sharp(png).rotate(8, { background: "#fff" }).png().toBuffer();
    expect(await decode(rotated), "miring").toBe(PAYLOAD);
  });

  it("logo berwarna hanya di tengah; seluruh modul QR di luar logo tetap hitam dan putih murni", async () => {
    const png = Buffer.from(await renderQrPng(PAYLOAD));
    const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width, height } = info;
    const cx = width / 2;
    const cy = height / 2;
    // kotak logo + bantalan, dengan sedikit toleransi
    const halfW = (width * QR_LOGO_RATIO) / 2 + width * 0.03;
    const halfH = halfW * 0.62;
    let colored = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
        const insideLogo = Math.abs(x - cx) <= halfW && Math.abs(y - cy) <= halfH;
        const isBlue = b > r + 60 && b > g + 20;
        if (isBlue) {
          colored++;
          expect(insideLogo, `piksel berwarna di luar logo (${x},${y})`).toBe(true);
        } else if (!insideLogo) {
          const gray = r === g && g === b;
          expect(gray, `piksel bukan abu-abu di luar logo (${x},${y})`).toBe(true);
          expect(r < 30 || r > 225, `modul tidak hitam/putih murni (${x},${y}) = ${r}`).toBe(true);
        }
      }
    }
    expect(colored).toBeGreaterThan(5000); // logo benar-benar berwarna
  });

  it("logo kecil dibanding QR (luas < 8 %) dan tidak menutup pola sudut", async () => {
    const png = Buffer.from(await renderQrPng(PAYLOAD));
    const { width } = await sharp(png).metadata();
    const logoW = width! * QR_LOGO_RATIO;
    const logoArea = logoW * (logoW * (424 / 800));
    expect(logoArea / (width! * width!)).toBeLessThan(0.08);
    // pusat pola pencari kiri atas (modul 3,5 dari sudut dalam zona tenang) harus hitam
    const px = await sharp(png)
      .extract({ left: 4 * 12 + 3 * 12 + 6, top: 4 * 12 + 3 * 12 + 6, width: 1, height: 1 })
      .raw()
      .toBuffer();
    expect(px[0]).toBeLessThan(30);
  });
});
