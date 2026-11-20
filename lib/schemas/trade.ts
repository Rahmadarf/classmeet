import { z } from "zod";
import { lotSchema, requestIdSchema, sideSchema, uuidSchema } from "./common";

/**
 * Masukan `buy_asset` / `sell_asset` (docs/17). Hanya pagar bentuk data; aturan bisnis (saldo, stok, batas pegang,
 * status pasar, suspensi) ditegakkan database dan dilaporkan lewat kode error.
 */
export const tradeSchema = z.object({
  requestId: requestIdSchema,
  assetId: uuidSchema,
  side: sideSchema,
  qty: lotSchema,
});

export type TradeInput = z.infer<typeof tradeSchema>;

/** Ringkasan hasil transaksi yang dikembalikan ke klien (bukan seluruh baris `transactions`). */
export type TradeResult = {
  transactionId: number;
  side: "buy" | "sell";
  qty: number;
  /** Harga satuan yang dibayar (beli) atau diterima (jual). */
  unitPrice: number;
  /** Harga tayang saat transaksi. */
  listPrice: number;
  total: number;
};
