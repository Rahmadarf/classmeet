export type PayoutRaw = {
  id: number;
  teamId: string;
  postId: string;
  guardId: string;
  amount: number;
  note: string | null;
  createdAt: string;
};
export type NameMap = Record<string, string>;

export type PayoutRow = {
  id: number;
  at: string;
  teamId: string;
  teamName: string;
  postName: string;
  guardName: string;
  amount: number;
  /** Lebih dari 3× rata-rata hadiah pos itu (penanda visual saja; tidak menahan apa pun). */
  outlier: boolean;
};

export const OUTLIER_FACTOR = 3;
/** Rata-rata baru bermakna bila pos sudah memberi cukup hadiah; kurang dari ini tidak ada penanda. */
export const OUTLIER_MIN_SAMPLES = 3;

/**
 * Baris tampilan hadiah (docs/07 §3.5): nama tim, pos, penjaga, dan penanda hadiah > 3× rata-rata pos itu.
 * `posts` memuat nama pos; `guards` nama penjaga menurut id profil. Terbaru di atas.
 */
export function buildPayoutRows(
  payouts: PayoutRaw[],
  teams: NameMap,
  posts: NameMap,
  guards: NameMap,
): PayoutRow[] {
  const byPost = new Map<string, number[]>();
  for (const p of payouts) byPost.set(p.postId, [...(byPost.get(p.postId) ?? []), p.amount]);
  const avg = (postId: string) => {
    const list = byPost.get(postId) ?? [];
    return list.length >= OUTLIER_MIN_SAMPLES ? list.reduce((s, n) => s + n, 0) / list.length : null;
  };
  return [...payouts]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id - a.id)
    .map((p) => {
      const mean = avg(p.postId);
      return {
        id: p.id,
        at: p.createdAt,
        teamId: p.teamId,
        teamName: teams[p.teamId] ?? "Tim",
        postName: posts[p.postId] ?? "Pos",
        guardName: guards[p.guardId] ?? "Penjaga",
        amount: p.amount,
        outlier: mean !== null && p.amount > OUTLIER_FACTOR * mean,
      };
    });
}

/** Total per kunci (pos atau tim), terbesar dulu. */
export function totalsBy<T>(
  items: T[],
  key: (item: T) => string,
  amount: (item: T) => number,
): { key: string; total: number }[] {
  const map = new Map<string, number>();
  for (const it of items) map.set(key(it), (map.get(key(it)) ?? 0) + amount(it));
  return [...map.entries()]
    .map(([k, total]) => ({ key: k, total }))
    .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
}
