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

/** Nomor pos terbesar + 1 dari nama "Pos 3 · Estafet Balon". */
export function nextPostNumber(postNames: readonly string[]): number {
  let max = 0;
  for (const n of postNames) {
    const m = /^\s*Pos\s*(\d{1,3})\b/i.exec(n);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

export const postDisplayName = (number: number, gameName: string) => `Pos ${number} · ${gameName.trim()}`;

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
