/**
 * Isi QR kartu tim: nama akun + rahasia (docs/02-architecture.md §3.5).
 *
 *   CM1:<username>:<qr_token>
 *
 * - `username` = nama akun Supabase Auth tim (email = username@classmeet.local).
 * - `qr_token` = UUID rahasia; sekaligus KATA SANDI akun tim.
 *
 * PERINGATAN KEAMANAN: nilai ini adalah kredensial. JANGAN tampilkan, catat di log, simpan di state
 * yang bertahan, atau taruh di URL. Parse, pakai sekali, buang. `scripts/print-qr.ts` memakai
 * `formatTeamQr` agar format selalu sama. Penjaga hanya memakai bagian `token` untuk resolve_team_qr.
 */
export const QR_VERSION = "CM1";
export const AUTH_EMAIL_DOMAIN = "classmeet.local";

const QR_RE = /^CM1:([a-z0-9_]{3,32}):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export type TeamQr = { username: string; token: string };

export function parseTeamQr(raw: string): TeamQr | null {
  const match = QR_RE.exec(raw.trim());
  if (!match) return null;
  return { username: match[1].toLowerCase(), token: match[2].toLowerCase() };
}

export function formatTeamQr({ username, token }: TeamQr): string {
  return `${QR_VERSION}:${username}:${token}`;
}

export function authEmail(username: string): string {
  return `${username}@${AUTH_EMAIL_DOMAIN}`;
}
