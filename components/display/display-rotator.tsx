"use client";

import { useEffect, useState } from "react";
import { LeaderboardScreen } from "@/components/display/leaderboard-screen";
import { MarketScreen } from "@/components/display/market-screen";
import { NewsScreen } from "@/components/display/news-screen";
import { PostsScreen } from "@/components/display/posts-screen";
import type { LeaderboardResult, MarketBoardData, NewsBoardData } from "@/lib/display/data";
import type { PostRow } from "@/lib/posts/view";
import { cn } from "@/lib/utils";

type ScreenKey = "leaderboard" | "market" | "news" | "posts";

/** Lama tiap layar tampil (detik). Peringkat dan pasar lebih lama karena isinya lebih banyak dibaca. */
const DURATION_S: Record<ScreenKey, number> = { leaderboard: 20, market: 20, news: 20, posts: 15 };
const ORDER: ScreenKey[] = ["leaderboard", "market", "news", "posts"];

/**
 * Layar ruang publik yang bergilir (docs/07 §2.4): 5 tim teratas → Display pasar → Display berita → Daftar Pos. Keempatnya tetap
 * terpasang (data dan grafik IHAI tidak hilang saat berganti); yang tidak tampil disembunyikan dan disembunyikan
 * juga dari teknologi bantu. Berhenti berputar bila `pin` diisi (mis. /display?screen=market untuk uji).
 */
export function DisplayRotator({
  leaderboard,
  market,
  news,
  posts,
  pin,
}: {
  leaderboard: LeaderboardResult | null;
  market: MarketBoardData | null;
  news: NewsBoardData | null;
  posts: PostRow[];
  pin?: ScreenKey;
}) {
  const [index, setIndex] = useState(0);
  const active: ScreenKey = pin ?? ORDER[index];

  useEffect(() => {
    if (pin) return;
    const id = window.setTimeout(
      () => setIndex((i) => (i + 1) % ORDER.length),
      DURATION_S[ORDER[index]] * 1000,
    );
    return () => window.clearTimeout(id);
  }, [index, pin]);

  const layer = (key: ScreenKey) =>
    cn(
      "absolute inset-0 transition-opacity duration-700",
      active === key ? "opacity-100" : "pointer-events-none opacity-0",
    );

  return (
    <div className="bg-page fixed inset-0 overflow-hidden">
      <div
        className={layer("leaderboard")}
        aria-hidden={active !== "leaderboard"}
        inert={active !== "leaderboard"}
      >
        <LeaderboardScreen initial={leaderboard} />
      </div>
      <div className={layer("market")} aria-hidden={active !== "market"} inert={active !== "market"}>
        <MarketScreen initial={market} />
      </div>
      <div className={layer("news")} aria-hidden={active !== "news"} inert={active !== "news"}>
        <NewsScreen initial={news} />
      </div>
      <div className={layer("posts")} aria-hidden={active !== "posts"} inert={active !== "posts"}>
        <PostsScreen initial={posts} />
      </div>
    </div>
  );
}
