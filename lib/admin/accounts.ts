import { randomInt } from "node:crypto";

/** Nomor berikutnya dari nama bernomor, mis. ["tim1","tim7","tim3"] dengan awalan "tim" → 8. */
export function nextNumber(prefix: string, names: readonly string[]): number {
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(\\d+)$`, "i");
  let max = 0;
  for (const n of names) {
    const m = re.exec(n.trim());
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

/** Jenis pos: `rally` (dijaga guard) atau `lomba` (dijaga PIC lomba). Sama dengan `posts.kind`. */
export type PostKind = "rally" | "lomba";

const KIND_PREFIX: Record<PostKind, string> = { rally: "Pos", lomba: "Lomba" };

/** Nomor terbesar + 1 dari nama "Pos 3 · Estafet Balon" (rally) atau "Lomba 2 · Futsal" (lomba); tiap jenis dinomori sendiri. */
export function nextPostNumber(postNames: readonly string[], kind: PostKind = "rally"): number {
  const re = new RegExp(`^\\s*${KIND_PREFIX[kind]}\\s*(\\d{1,3})\\b`, "i");
  let max = 0;
  for (const n of postNames) {
    const m = re.exec(n);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

export const postDisplayName = (number: number, gameName: string, kind: PostKind = "rally") =>
  `${KIND_PREFIX[kind]} ${number} · ${gameName.trim()}`;

/** Kode cadangan 6 karakter tanpa 0/O/1/I (docs/03 §3.2); unik terhadap `taken`. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function makeShortCode(taken: ReadonlySet<string>, pick: (n: number) => number = randomInt): string {
  for (let i = 0; i < 1000; i++) {
    let code = "";
    for (let j = 0; j < 6; j++) code += ALPHABET[pick(ALPHABET.length)];
    if (!taken.has(code)) return code;
  }
  throw new Error("Gagal membuat kode cadangan unik");
}
