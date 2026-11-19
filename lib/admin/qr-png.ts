import { writeBarcode } from "zxing-wasm/writer";

/** QR (PNG, koreksi galat M, zona tenang) sebagai data URI. Token tidak pernah dikembalikan sebagai teks, hanya sebagai gambar. */
export async function qrDataUrl(payload: string): Promise<string | null> {
  try {
    const r = await writeBarcode(payload, {
      format: "QRCode",
      ecLevel: "M",
      scale: 12,
      withQuietZones: true,
    });
    if (r.error || !r.image) return null;
    const bytes = Buffer.from(await r.image.arrayBuffer());
    return `data:image/png;base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}
