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

/** Lihat kartu QR tim (server action `getTeamQr`). */
export const viewTeamQrSchema = z.object({ teamId: uuidSchema });

/** Stok pasar (`admin_set_stock`): bilangan bulat ≥ 0 + alasan wajib. */
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

/** Pos baru + akun penjaganya: nama game, lokasi, dan kata sandi awal penjaga (username dibuat otomatis, mis. guard7). */
export const createPostSchema = z.object({
  gameName: z.string().trim().min(2).max(60),
  location: z.string().trim().min(2).max(80),
  password: z.string().min(8).max(72),
});

/**
 * Pengaturan toko (`admin_set_trade_settings`, docs/17): selisih jual, tekanan stok per unit, batas tekanan (basis poin),
 * lama pemulihan (menit), dan batas pegang (% stok awal). Hanya pagar bentuk; database menegakkan rentang dan kunci
 * setelah game dimulai.
 */
export const tradeSettingsSchema = z
  .object({
    sellSpreadBps: z.number().int().min(0).max(2000),
    pressureBpsPerUnit: z.number().int().min(0).max(500),
    pressureCapBps: z.number().int().min(0).max(5000),
    pressureDecayMinutes: z.number().int().min(1).max(240),
    holdCapPct: z.number().int().min(1).max(100),
  })
  .refine((v) => v.sellSpreadBps > v.pressureBpsPerUnit, {
    message: "Selisih jual harus lebih besar dari tekanan per unit.",
    path: ["sellSpreadBps"],
  });

/**
 * Pengaturan Analisa Pasar (pay to win): harga (rupiah bulat, 0 = gratis) dan saklar. Boleh diubah kapan saja, termasuk saat
 * game berjalan (`admin_set_analysis_settings`); berlaku untuk pembelian berikutnya.
 */
export const analysisSettingsSchema = z.object({
  price: z.number().int().min(0).max(100_000_000),
  enabled: z.boolean(),
});
