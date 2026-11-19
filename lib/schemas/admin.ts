import { z } from "zod";
import { uuidSchema } from "./common";

/** Koreksi saldo (`admin_adjust_cash`): selisih bilangan bulat bukan nol (negatif = mengurangi) + alasan wajib. */
export const adjustCashSchema = z.object({
  teamId: uuidSchema,
  delta: z
    .number()
    .int()
    .safe()
    .refine((n) => n !== 0, { message: "Selisih tidak boleh nol." }),
  reason: z.string().trim().min(3).max(300),
});

export type AdjustCashInput = z.infer<typeof adjustCashSchema>;

/** Stok bandar (`admin_set_stock`): bilangan bulat ≥ 0 + alasan wajib. */
export const setStockSchema = z.object({
  assetId: uuidSchema,
  stock: z.number().int().min(0).max(1_000_000),
  reason: z.string().trim().min(3).max(300),
});

/** Tambah/ubah aset (`admin_upsert_asset`, hanya sebelum game dibuka). `assetId` null = aset baru. */
export const upsertAssetSchema = z
  .object({
    assetId: uuidSchema.nullable(),
    symbol: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{2,8}$/),
    name: z.string().trim().min(1).max(80),
    sector: z.string().trim().min(1).max(60),
    price: z.number().int().safe().positive(),
    minPrice: z.number().int().safe().positive(),
    maxPrice: z.number().int().safe().positive(),
    stock: z.number().int().min(0).max(1_000_000),
    active: z.boolean(),
  })
  .refine((v) => v.maxPrice >= v.minPrice && v.price >= v.minPrice && v.price <= v.maxPrice, {
    message: "Harga harus di antara rentang minimum dan maksimum.",
    path: ["price"],
  });

export const setPostOpenSchema = z.object({ postId: uuidSchema, open: z.boolean() });

/** Aset bangkrut pada berita draf (`admin_set_news_bankruptcy`). `assetId` null = lepas. Likuidasi 0–50 % dari harga acuan. */
export const setNewsBankruptcySchema = z.object({
  newsId: uuidSchema,
  assetId: uuidSchema.nullable(),
  liquidationPct: z.number().int().min(0).max(50),
});

/**
 * Event dividen/suspensi pada berita draf (`admin_set_news_event`). Dividen: 1-10 % harga acuan per unit (dikirim sebagai
 * bps 100-1000); suspensi: 1-30 menit. `amount` null = lepas event itu.
 */
export const setNewsEventSchema = z
  .object({
    newsId: uuidSchema,
    assetId: uuidSchema,
    kind: z.enum(["dividend", "suspend"]),
    amount: z.number().int().nullable(),
  })
  .refine(
    (v) =>
      v.amount === null ||
      (v.kind === "dividend" ? v.amount >= 1 && v.amount <= 10 : v.amount >= 1 && v.amount <= 30),
    { message: "Nilai di luar rentang." },
  );

/** Tim baru (akun tim dibuat di server): hanya nama; username, QR, dan kode cadangan dibuat otomatis. */
export const createTeamSchema = z.object({ name: z.string().trim().min(2).max(40) });

/** Hapus tim: id tim + pascode 6 digit. */
export const deleteTeamSchema = z.object({ teamId: uuidSchema, passcode: z.string().regex(/^\d{6}$/) });

/** Pos baru + akun penjaganya: nama game, lokasi, dan kata sandi awal penjaga (username dibuat otomatis, mis. guard7). */
export const createPostSchema = z.object({
  gameName: z.string().trim().min(2).max(60),
  location: z.string().trim().min(2).max(80),
  password: z.string().min(8).max(72),
});
