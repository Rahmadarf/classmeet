import { formatRupiah } from "@/lib/money";

/**
 * Antrean hadiah penjaga (docs/07 §3.4; docs/04 §6). Hadiah ditulis ke antrean lokal SEBELUM form ditutup dan dikirim
 * di latar belakang dengan `request_id` yang sama pada setiap percobaan, jadi percobaan ulang tidak menggandakan hadiah.
 * Berisi id tim (UUID), nama tim, dan nominal; TIDAK berisi rahasia kartu.
 */
export type PayoutJob = {
  requestId: string;
  teamId: string;
  teamName: string;
  amount: number;
  status: "sending" | "failed";
  /** Percobaan otomatis yang sudah terpakai (jaringan putus). */
  attempts: number;
  /** Teks alasan gagal (bila `failed`). */
  reason: string | null;
};

/** Percobaan otomatis ke-1..5 menunggu 2, 4, 8, 15, 30 dtk; sesudahnya gagal dan menunggu "Kirim ulang". */
const BACKOFF_MS = [2_000, 4_000, 8_000, 15_000, 30_000];
export const MAX_AUTO_ATTEMPTS = BACKOFF_MS.length;

export function backoffMs(attempt: number): number {
  return BACKOFF_MS[Math.min(Math.max(attempt, 0), BACKOFF_MS.length - 1)];
}

const REASONS: Record<string, string> = {
  post_closed: "pos ditutup",
  game_not_active: "permainan belum dimulai atau sudah selesai",
  invalid_amount: "nominal tidak valid",
  team_not_found: "tim tidak ditemukan",
  forbidden: "akses ditolak",
  request_id_conflict: "permintaan bentrok",
  invalid_input: "isian tidak valid",
};

/** Alasan singkat (huruf kecil) untuk kalimat "Gagal: …". Kode tak dikenal memakai pesan ramah yang sudah dipetakan. */
export function failureReason(code: string | null, message: string): string {
  if (code && REASONS[code]) return REASONS[code];
  const m = message.trim().split(".")[0].trim();
  return m ? m.charAt(0).toLowerCase() + m.slice(1) : "terjadi kesalahan";
}

export function successText(job: Pick<PayoutJob, "amount" | "teamName">): string {
  return `${formatRupiah(job.amount)} terkirim ke ${job.teamName}`;
}

export function failureText(job: Pick<PayoutJob, "amount" | "teamName" | "reason">): string {
  return `Gagal: ${job.reason ?? "terjadi kesalahan"}. Hadiah ${formatRupiah(job.amount)} untuk ${job.teamName} belum terkirim.`;
}

export const STORAGE_KEY = "classmeet.guard.payouts";

/** Antrean yang disimpan di peramban supaya muat ulang halaman tidak menghilangkan hadiah yang belum terkirim. */
export function serializeJobs(jobs: PayoutJob[]): string {
  return JSON.stringify(jobs);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Baca antrean tersimpan dengan pemeriksaan ketat; entri rusak dibuang. Yang `sending` dilanjutkan dari percobaan 0. */
export function parseJobs(text: string | null): PayoutJob[] {
  if (!text) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: PayoutJob[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const j = item as Record<string, unknown>;
    if (
      typeof j.requestId !== "string" ||
      !UUID.test(j.requestId) ||
      typeof j.teamId !== "string" ||
      !UUID.test(j.teamId) ||
      typeof j.teamName !== "string" ||
      typeof j.amount !== "number" ||
      !Number.isSafeInteger(j.amount) ||
      j.amount < 1 ||
      seen.has(j.requestId)
    )
      continue;
    seen.add(j.requestId);
    out.push({
      requestId: j.requestId,
      teamId: j.teamId,
      teamName: j.teamName.slice(0, 80),
      amount: j.amount,
      status: j.status === "failed" ? "failed" : "sending",
      attempts: 0,
      reason: j.status === "failed" && typeof j.reason === "string" ? j.reason : null,
    });
  }
  return out;
}
