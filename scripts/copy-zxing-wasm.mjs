// Menyalin pembaca QR (zxing WASM) ke public/vendor supaya /kiosk tidak mengunduhnya dari CDN pihak ketiga
// (jaringan sekolah bisa lambat/terblokir, dan tiap laptop harus bisa memindai walau internet putus-putus).
// Dijalankan otomatis sebelum `dev` dan `build` (lihat package.json).
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules/zxing-wasm/dist/reader/zxing_reader.wasm");
const destDir = join(root, "public/vendor");

if (!existsSync(src)) {
  console.warn("[copy-zxing-wasm] zxing_reader.wasm tidak ditemukan; jalankan `npm install` dulu.");
  process.exit(0);
}
mkdirSync(destDir, { recursive: true });
copyFileSync(src, join(destDir, "zxing_reader.wasm"));
console.log("[copy-zxing-wasm] public/vendor/zxing_reader.wasm");
