import { z } from "zod";

/** Masuk staf (admin, penjaga, display). Nama akun sama dengan bagian depan email `nama@classmeet.local`. */
export const staffLoginSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,32}$/),
  // Tanpa aturan kerumitan: sandi dibuat panitia. Batas atas mencegah masukan sampah yang sangat besar.
  password: z.string().min(1).max(200),
});

export type StaffLoginInput = z.infer<typeof staffLoginSchema>;
