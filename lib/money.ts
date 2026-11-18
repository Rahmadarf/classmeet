/**
 * Uang dan waktu.
 *
 * KEPUTUSAN TIPE: uang di aplikasi adalah `number` bilangan bulat (Rupiah), bukan `bigint`.
 * Di DB kolomnya bigint, tetapi PostgREST mengirimnya sebagai angka JSON, dan total uang beredar
 * permainan ini ≈ Rp 150 juta, jauh di bawah Number.MAX_SAFE_INTEGER (≈ 9 × 10^15).
 * `assertMoney` menolak nilai yang bukan bilangan bulat aman, sehingga kesalahan pembulatan
 * tidak diam-diam masuk ke tampilan atau ke RPC. Server (RPC) tetap satu-satunya penghitung uang;
 * fungsi di sini hanya untuk tampilan dan pratinjau form.
 */

const MINUS = "−"; // tanda minus tipografis, bukan tanda hubung

export function isMoney(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

export function assertMoney(value: unknown, label = "uang"): number {
  if (!isMoney(value)) {
    throw new RangeError(`Nilai ${label} bukan bilangan bulat aman: ${String(value)}`);
  }
  return value;
}

/** 1250000 → "1.250.000" (pemisah ribuan titik, tanpa ICU supaya sama di semua runtime). */
export function groupThousands(n: number): string {
  const sign = n < 0 ? "-" : "";
  const digits = Math.abs(n).toString();
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** 1250000 → "Rp 1.250.000". Negatif → "-Rp 1.250.000". */
export function formatRupiah(value: number | null | undefined): string {
  if (value === null || value === undefined) return "Rp –";
  assertMoney(value);
  return value < 0 ? `-Rp ${groupThousands(-value)}` : `Rp ${groupThousands(value)}`;
}

/** Tanpa awalan, untuk kolom tabel: 1250000 → "1.250.000". */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "–";
  assertMoney(value);
  return groupThousands(value);
}

/** Bertanda untuk perubahan/riwayat: +Rp 300.000 / −Rp 300.000 (nol tanpa tanda). */
export function formatSignedRupiah(value: number): string {
  assertMoney(value);
  if (value === 0) return "Rp 0";
  return value > 0 ? `+Rp ${groupThousands(value)}` : `${MINUS}Rp ${groupThousands(-value)}`;
}

/** Persen bertanda dari dua harga: (now − ref) / ref. Mengembalikan null bila ref tidak valid. */
export function percentChange(now: number, ref: number): number | null {
  if (!(ref > 0)) return null;
  return ((now - ref) / ref) * 100;
}

/** 3.04 → "+3,0 %" ; −5 → "−5,0 %" (koma desimal Indonesia). */
export function formatPercent(pct: number | null, digits = 1): string {
  if (pct === null || Number.isNaN(pct)) return "–";
  const abs = Math.abs(pct).toFixed(digits).replace(".", ",");
  if (pct === 0 || Number(abs.replace(",", ".")) === 0) return `${abs} %`;
  return `${pct > 0 ? "+" : MINUS}${abs} %`;
}

/** Ketikan pengguna → bilangan bulat Rupiah. "Rp 1.250.000" → 1250000. Kosong/tak valid → null. */
export function parseRupiah(input: string): number | null {
  const digits = input.replace(/\D/g, "");
  if (digits === "") return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : null;
}

/* ---------- Pratinjau yang meniru DB (doc 04 §3.1); DB tetap penentu ---------- */

/** Fraksi harga (tick_for): Rp 500 di bawah 200.000; Rp 1.000 sampai di bawah 500.000; Rp 2.500 mulai 500.000. */
export function tickFor(price: number): number {
  return price < 200_000 ? 500 : price < 500_000 ? 1_000 : 2_500;
}

/** Biaya per sisi, dibulatkan ke atas (ob_fee): ceil(harga × lot × bps / 10000). */
export function orderFee(price: number, qty: number, bps: number): number {
  return Math.ceil((price * qty * bps) / 10_000);
}

/* ---------- Waktu WIB (Asia/Jakarta), 24 jam ---------- */

const WIB = "Asia/Jakarta";

function partsWib(date: Date, options: Intl.DateTimeFormatOptions) {
  const parts = new Intl.DateTimeFormat("id-ID", { timeZone: WIB, ...options }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return get;
}

function toDate(input: string | number | Date): Date {
  return input instanceof Date ? input : new Date(input);
}

/** "14:07" */
export function formatTimeWib(input: string | number | Date): string {
  const get = partsWib(toDate(input), { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return `${get("hour")}:${get("minute")}`;
}

/** "14:07:09" */
export function formatTimeSecondsWib(input: string | number | Date): string {
  const get = partsWib(toDate(input), {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  return `${get("hour")}:${get("minute")}:${get("second")}`;
}

/** "17 Nov 2026" */
export function formatDateWib(input: string | number | Date): string {
  const get = partsWib(toDate(input), { day: "numeric", month: "short", year: "numeric" });
  return `${get("day")} ${get("month")} ${get("year")}`;
}

/** Kunci pengelompokan per hari WIB: "2026-11-17". */
export function dayKeyWib(input: string | number | Date): string {
  const get = partsWib(toDate(input), { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${get("year")}-${get("month")}-${get("day")}`;
}
