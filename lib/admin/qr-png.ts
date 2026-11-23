import { readFile } from "node:fs/promises";
import path from "node:path";
import { setZXingModuleOverrides, writeBarcode } from "zxing-wasm/writer";
import { addCenterLogo } from "@/lib/qr-logo";

// zxing-wasm mengunduh berkas .wasm dari CDN bila tidak diberi biner; jaringan acara bisa putus, jadi biner dibaca dari salinan lokal
// di node_modules (dan dikirim sebagai `wasmBinary`).
let configured: Promise<void> | null = null;
function configure(): Promise<void> {
  configured ??= readFile(
    path.join(process.cwd(), "node_modules/zxing-wasm/dist/writer/zxing_writer.wasm"),
  ).then((buf) => {
    setZXingModuleOverrides({
      wasmBinary: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
    });
  });
  return configured;
}

/** QR (PNG, koreksi galat H, logo ISSC berwarna di tengah, zona tenang) sebagai data URI. Token tidak pernah dikembalikan sebagai teks, hanya sebagai gambar. */
export async function qrDataUrl(payload: string): Promise<string | null> {
  try {
    await configure();
    const r = await writeBarcode(payload, {
      format: "QRCode",
      ecLevel: "H",
      scale: 12,
      withQuietZones: true,
    });
    if (r.error || !r.image) return null;
    const bytes = Buffer.from(await addCenterLogo(new Uint8Array(await r.image.arrayBuffer())));
    return `data:image/png;base64,${bytes.toString("base64")}`;
  } catch (e) {
    console.error("[qrDataUrl] gagal:", e instanceof Error ? e.message : e);
    return null;
  }
}
