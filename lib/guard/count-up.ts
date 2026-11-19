/** Jumlah langkah hitung naik saldo di form hadiah (≈ 2,2 detik; lihat `COUNT_UP_STEP_MS`). */
export const COUNT_UP_STEPS = 24;
export const COUNT_UP_STEP_MS = 90;

/**
 * Nilai saldo pada langkah ke-`step` (0..`steps`) saat naik dari `from` sebesar `amount`. Naik bertahap dengan
 * percepatan awal lalu melambat (ease-out kuadrat, lebih landai daripada kubik supaya terasa "perlahan"), selalu naik atau tetap, dimulai tepat di `from` dan berakhir tepat di
 * `from + amount` (angka akhir tidak pernah meleset akibat pembulatan).
 */
export function countUpValue(from: number, amount: number, step: number, steps = COUNT_UP_STEPS): number {
  if (step <= 0) return from;
  if (step >= steps) return from + amount;
  const t = step / steps;
  const eased = t * (2 - t);
  return from + Math.round(amount * eased);
}
