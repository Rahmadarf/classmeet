/**
 * Lama gerak saldo di form hadiah (ms): singkat saja (maks. 0,5 dtk), cukup untuk terlihat bergerak sebagai bukti
 * hadiah masuk, tanpa membuat penjaga menunggu.
 */
export const COUNT_UP_MS = 500;

/** Kurva percepatan (cubic-bezier): mulai pelan, melaju di tengah, melambat di akhir. */
export const COUNT_UP_EASE: [number, number, number, number] = [0.45, 0, 0.2, 1];
