import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readBarcodes, setZXingModuleOverrides } from "zxing-wasm/reader";
import { describe, expect, it } from "vitest";
import { parseTeamQr } from "../lib/qr";
import { buildCards, escapeHtml, renderQrPng, renderSheetHtml } from "./print-qr-lib";

// Tes tidak boleh bergantung pada jaringan: pembaca memakai berkas WASM lokal, bukan CDN.
setZXingModuleOverrides({
  wasmBinary: readFileSync(
    fileURLToPath(new URL("../node_modules/zxing-wasm/dist/reader/zxing_reader.wasm", import.meta.url)),
  ).buffer as ArrayBuffer,
});

const TOKEN = "3f2c1a9e-7b44-4d0a-9c55-1e2d3c4b5a69";
const team = { name: "Tim Nusantara", username: "tim1", qr_token: TOKEN };

describe("buildCards", () => {
  it("memakai format QR yang sama dengan pembaca /kiosk", () => {
    const [card] = buildCards([team]);
    expect(card.payload).toBe(`CM1:tim1:${TOKEN}`);
    expect(parseTeamQr(card.payload)).toEqual({ username: "tim1", token: TOKEN });
  });

  it("menolak token atau username yang tidak valid", () => {
    expect(() => buildCards([{ ...team, qr_token: "bukan-uuid" }])).toThrow();
    expect(() => buildCards([{ ...team, username: "Tim 1!" }])).toThrow();
  });

  it("menolak daftar kosong, username ganda, dan nama kosong", () => {
    expect(() => buildCards([])).toThrow();
    expect(() => buildCards([team, team])).toThrow(/ganda/);
    expect(() => buildCards([{ ...team, name: "  " }])).toThrow(/nama/);
  });
});

describe("renderQrPng + renderSheetHtml", () => {
  it("QR yang dibuat terbaca kembali persis sama oleh pembaca zxing", async () => {
    const [card] = buildCards([team]);
    const png = await renderQrPng(card.payload);
    expect(Array.from(png.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]); // tanda tangan PNG
    const decoded = await readBarcodes(new Blob([png as BlobPart], { type: "image/png" }), {
      formats: ["QRCode"],
    });
    expect(decoded[0]?.text).toBe(card.payload);
  });

  it("lembar cetak tidak memuat token sebagai teks, dan melipat sesuai jumlah salinan", async () => {
    const [card] = buildCards([team]);
    const png = await renderQrPng(card.payload);
    const html = renderSheetHtml([{ name: card.name, png }], 2);
    expect(html).not.toContain(TOKEN);
    expect(html.match(/<section class="card">/g)).toHaveLength(2);
    expect(html).toContain("Set 2 dari 2");
    expect(html).toContain("Tim Nusantara");
  });

  it("nama tim di-escape (tidak ada HTML liar)", () => {
    expect(escapeHtml(`<img src=x onerror="a">&'`)).toBe("&lt;img src=x onerror=&quot;a&quot;&gt;&amp;&#39;");
    const html = renderSheetHtml([{ name: "<b>X</b>", png: new Uint8Array([1]) }], 1);
    expect(html).not.toContain("<b>X</b>");
  });
});
