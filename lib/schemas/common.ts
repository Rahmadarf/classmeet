import { z } from "zod";

/** Idempotensi: dibuat per aksi di klien, dipakai ulang saat percobaan ulang. */
export const requestIdSchema = z.uuid();

export const uuidSchema = z.uuid();

/** Rupiah: bilangan bulat aman, > 0. */
export const rupiahSchema = z.number().int().safe().positive();

/** Lot: bilangan bulat 1..100000 (batas yang sama dengan place_order). */
export const lotSchema = z.number().int().min(1).max(100_000);

export const sideSchema = z.enum(["buy", "sell"]);
export const orderKindSchema = z.enum(["limit", "market"]);

/** Bentuk hasil server action: sukses atau galat ramah. */
export type ActionResult<T = undefined> =
  { ok: true; data: T } | { ok: false; message: string; code: string | null; retryable: boolean };
