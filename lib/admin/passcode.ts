import { pinMatches, PinLimiter } from "@/lib/guard/pin";

/** Pascode 6 digit untuk aksi admin yang tak bisa dibatalkan (hapus tim). Bawaan 223332; ganti lewat `ADMIN_DELETE_PASSCODE` di server. */
export const DEFAULT_DELETE_PASSCODE = "223332";

export function expectedDeletePasscode(env: string | undefined = process.env.ADMIN_DELETE_PASSCODE): string {
  const v = env?.trim();
  return v && /^\d{6}$/.test(v) ? v : DEFAULT_DELETE_PASSCODE;
}

export const deleteLimiter = new PinLimiter();

export const passcodeMatches = (input: string, expected = expectedDeletePasscode()) =>
  pinMatches(input, expected);
