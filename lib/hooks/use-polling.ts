"use client";

import { useEffect, useRef } from "react";

/**
 * Ambil ulang data secara berkala, DAN saat tab aktif lagi / jendela fokus / koneksi tersambung ulang
 * (docs/13 prompt: "Realtime hanyalah pemberitahuan"; data penting selalu bisa diambil ulang).
 * Tidak memanggil `refresh` saat pertama dipasang (data awal datang dari server).
 * Panggilan yang masih berjalan tidak ditumpuk.
 */
export function usePolling(refresh: () => Promise<void> | void, intervalMs: number) {
  const latest = useRef(refresh);
  useEffect(() => {
    latest.current = refresh;
  }, [refresh]);

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
