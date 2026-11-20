import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  // Akses dev lewat IP LAN (mis. https://192.192.2.246:3443) diblokir Next secara bawaan: tanpa entri ini JS halaman
  // tidak termuat (403), sehingga kiosk tidak aktif. Hanya berlaku di `next dev`. Pola `*` = satu bagian alamat IP, jadi
  // IP laptop yang berubah (DHCP) di subnet ini tetap diizinkan; tambahkan subnet lain bila perlu.
  // CLASSMEET_PUBLIC_HOSTS = nama host publik (dipisah koma), mis. app.contoh.com untuk Cloudflare Tunnel.
  allowedDevOrigins: [
    "192.192.2.*",
    "192.168.*.*",
    ...(process.env.CLASSMEET_PUBLIC_HOSTS ?? "")
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean),
  ],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    // Ada package-lock.json di folder home; kunci root ke proyek ini.
    root: path.resolve(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
