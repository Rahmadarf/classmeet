"use client";

import { useEffect, useRef } from "react";

/**
 * Ambil ulang data secara berkala, DAN saat tab aktif lagi / jendela fokus / koneksi tersambung ulang
 * (docs/13 prompt: "Realtime hanyalah pemberitahuan"; data penting selalu bisa diambil ulang).
 * Tidak memanggil `refresh` saat PERTAMA dipasang (data awal datang dari server). Tetapi saat halaman MUNCUL KEMBALI,
 * `refresh` langsung dipanggil: dengan Cache Components, Next menyimpan halaman yang ditinggalkan (`<Activity>`
 * tersembunyi) beserta `useState`-nya, sehingga data lama tampil sampai ketukan polling berikutnya. Efek dijalankan
 * ulang saat halaman muncul lagi, dan itulah saatnya mengambil data baru (di mode dev, StrictMode menjalankan efek
 * dua kali sehingga satu panggilan ekstra muncul; tidak terjadi di produksi).
 * Panggilan yang masih berjalan tidak ditumpuk.
 */
export function usePolling(refresh: () => Promise<void> | void, intervalMs: number) {
  const latest = useRef(refresh);
  useEffect(() => {
    latest.current = refresh;
  }, [refresh]);

  const mountedBefore = useRef(false);

  useEffect(() => {
    let running = false;
    const run = async () => {
      if (running) return;
      running = true;
      try {
        await latest.current();
      } finally {
        running = false;
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void run();
    };
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void run();
    }, intervalMs);
    // Efek dijalankan ulang = halaman muncul kembali (state lama dipulihkan): ambil data baru sekarang.
    if (mountedBefore.current) void run();
    mountedBefore.current = true;
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", run);
    window.addEventListener("online", run);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", run);
      window.removeEventListener("online", run);
    };
  }, [intervalMs]);
}
