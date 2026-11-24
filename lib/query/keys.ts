/**
 * Kunci query bersama. Satu kunci = satu sumber data, dipakai ulang antar komponen dan halaman (mis. `summary` dan
 * `holdings` dipakai Pasar, Portofolio, dan Beranda), sehingga panggilan RPC yang sama digabung menjadi satu.
 * Ubah kunci hanya di sini.
 */
export const qk = {
  game: ["game"] as const,
  /** Papan Pasar tim: game, aset, kepemilikan, bangkrut, dan tawaran analisa dalam satu pengambilan (get_market_snapshot). */
  marketSnapshot: ["market-snapshot"] as const,
  summary: ["summary"] as const,
  news: (limit: number) => ["news", limit] as const,
  portfolio: ["portfolio"] as const,
  history: (teamId: string) => ["history", teamId] as const,
  display: {
    leaderboard: ["display", "leaderboard"] as const,
    indexHistory: ["display", "index-history"] as const,
    marketBoard: ["display", "market-board"] as const,
    newsBoard: (limit: number) => ["display", "news-board", limit] as const,
    posts: ["display", "posts"] as const,
  },
  guardPost: (guardId: string) => ["guard", "post", guardId] as const,
  admin: (name: string, ...rest: readonly (string | number | boolean)[]) => ["admin", name, ...rest] as const,
} as const;
