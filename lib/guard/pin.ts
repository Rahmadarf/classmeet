import { timingSafeEqual } from "node:crypto";

/** PIN sementara penjaga (diminta panitia 19 Nov). Diganti lewat variabel lingkungan `GUARD_PIN` di server. */
export const DEFAULT_GUARD_PIN = "12345";

export function expectedPin(env: string | undefined = process.env.GUARD_PIN): string {
  const pin = env?.trim();
  return pin && /^\d{4,8}$/.test(pin) ? pin : DEFAULT_GUARD_PIN;
}

/** PIN sementara PIC lomba, sengaja BERBEDA dari PIN penjaga. Diganti lewat variabel lingkungan `PIC_PIN` di server. */
export const DEFAULT_PIC_PIN = "54321";

export function expectedPicPin(env: string | undefined = process.env.PIC_PIN): string {
  const pin = env?.trim();
  return pin && /^\d{4,8}$/.test(pin) ? pin : DEFAULT_PIC_PIN;
}

/** Banding waktu-tetap supaya panjang awalan yang cocok tidak bocor lewat waktu respons. */
export function pinMatches(input: string, expected: string): boolean {
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const MAX_PIN_FAILURES = 5;
export const PIN_LOCK_MS = 60_000;

type Entry = { fails: number; lockedUntil: number };

/**
 * Pembatas percobaan PIN per akun penjaga (di memori proses server): 5 salah berturut-turut mengunci akun itu 60 dtk.
 * Cukup untuk satu server Next; bukan pengaman utama (penjaga sudah login), hanya menghambat tebak-tebakan.
 */
export class PinLimiter {
  private entries = new Map<string, Entry>();

  /** Detik tersisa bila terkunci, selain itu 0. */
  lockedFor(key: string, now: number): number {
    const e = this.entries.get(key);
    return e && e.lockedUntil > now ? Math.ceil((e.lockedUntil - now) / 1000) : 0;
  }

  fail(key: string, now: number): void {
    const prev = this.entries.get(key);
    const fails = prev && prev.lockedUntil <= now && prev.fails < MAX_PIN_FAILURES ? prev.fails + 1 : 1;
    this.entries.set(key, {
      fails,
      lockedUntil: fails >= MAX_PIN_FAILURES ? now + PIN_LOCK_MS : 0,
    });
  }

  succeed(key: string): void {
    this.entries.delete(key);
  }
}
