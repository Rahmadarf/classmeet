import { z } from "zod";
import { lotSchema, orderKindSchema, requestIdSchema, rupiahSchema, sideSchema, uuidSchema } from "./common";

/**
 * Masukan `place_order` (docs/04 §3.1). Ini hanya pagar bentuk data; aturan bisnis (saldo, kepemilikan,
 * fraksi, batas ARA/ARB, status pasar) ditegakkan database dan dilaporkan lewat kode error.
 */
export const placeOrderSchema = z
  .object({
    requestId: requestIdSchema,
    assetId: uuidSchema,
    side: sideSchema,
    kind: orderKindSchema,
    price: rupiahSchema.optional(),
    qty: lotSchema,
  })
  .refine((v) => (v.kind === "limit" ? v.price !== undefined : v.price === undefined), {
    message: "Order limit butuh harga; order market tidak boleh membawa harga.",
    path: ["price"],
  });

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;

export const cancelOrderSchema = z.object({
  orderId: z.number().int().positive().safe(),
});

/** Ringkasan hasil order yang dikembalikan ke klien (bukan seluruh baris `orders`). */
export type PlacedOrder = {
  orderId: number;
  kind: "limit" | "market";
  side: "buy" | "sell";
  status: string;
  qty: number;
  remaining: number;
  price: number | null;
};
