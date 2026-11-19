import { z } from "zod";
import { uuidSchema } from "./common";

/** Token rahasia kartu tim (bagian `qr_token` dari isi QR). Hanya dipakai sekali untuk `resolve_team_qr`. */
export const resolveTeamSchema = z.object({ token: uuidSchema });

/**
 * Hadiah pos (`award_payout`): `requestId` dibuat saat form muncul dan dipakai ulang pada percobaan ulang.
 * Nominal bilangan bulat > 0, tanpa batas atas (diputuskan panitia; docs/04 §3.2). Catatan tidak dikirim dari UI.
 */
export const awardPayoutSchema = z.object({
  requestId: uuidSchema,
  teamId: uuidSchema,
  amount: z.number().int().safe().positive(),
});

/** PIN penjaga: 4–8 angka. */
export const verifyPinSchema = z.object({ pin: z.string().regex(/^\d{4,8}$/) });

export const setPostOpenSchema = z.object({ open: z.boolean() });
