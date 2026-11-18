"use client";

import { useState } from "react";

/**
 * Penghitung yang naik setiap kali `value` berubah (bukan saat pertama kali tampil). Pakai sebagai `key`
 * + kelas `.price-flash` supaya animasi sorot terputar ulang tiap harga berubah (docs/07 §4).
 * Memakai pola "simpan nilai sebelumnya di state" agar tidak perlu efek.
 */
export function useChangeFlash(value: unknown): number {
  const [seen, setSeen] = useState(value);
  const [count, setCount] = useState(0);
  if (seen !== value) {
    setSeen(value);
    setCount((c) => c + 1);
  }
  return count;
}
