/**
 * Lama hitung naik saldo di form hadiah (ms): 1,6 dtk untuk nominal kecil, naik pelan menurut jumlah digit
 * nominal, maksimal 2,6 dtk, supaya nominal besar tetap terbaca naik dan penjaga tidak menunggu lama.
 */
export function countUpDurationMs(amount: number): number {
  const digits = Math.max(1, String(Math.max(0, Math.trunc(amount))).length);
  return Math.min(2_600, 1_600 + (digits - 1) * 150);
}

/** Kurva percepatan (cubic-bezier) yang landai: mulai pelan, melaju di tengah, melambat di akhir. */
export const COUNT_UP_EASE: [number, number, number, number] = [0.45, 0, 0.2, 1];
