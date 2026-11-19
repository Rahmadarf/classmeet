import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { DisplayRotator } from "@/components/display/display-rotator";
import { fetchLeaderboard, fetchMarketBoard, fetchNewsBoard } from "@/lib/display/data";
import { fetchPosts } from "@/lib/posts/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Layar publik" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function DisplayHome({ searchParams }: { searchParams: SearchParams }) {
  // Membaca sesi dan searchParams → di dalam <Suspense> (cacheComponents).
  return (
    <Suspense fallback={<div className="bg-page fixed inset-0" />}>
      <DisplayContent searchParams={searchParams} />
    </Suspense>
  );
}

const SCREENS = ["leaderboard", "market", "news", "posts"] as const;

/**
 * Layar ruang publik bergilir: 5 tim teratas, Display pasar, Display berita, Daftar Pos. `?screen=leaderboard|market|news|posts`
 * menahan satu layar (untuk uji dan pemasangan). Tiap layar memuat ulang datanya sendiri di browser.
 */
async function DisplayContent({ searchParams }: { searchParams: SearchParams }) {
  await connection(); // klien Supabase memakai waktu (JWT): render saat permintaan
  const supabase = await createClient();
  const params = await searchParams;
  const raw = Array.isArray(params.screen) ? params.screen[0] : params.screen;
  const pin = SCREENS.find((s) => s === raw);

  const [leaderboard, market, news, posts] = await Promise.all([
    fetchLeaderboard(supabase),
    fetchMarketBoard(supabase),
    fetchNewsBoard(supabase),
    fetchPosts(supabase),
  ]);
  return (
    <DisplayRotator leaderboard={leaderboard} market={market} news={news} posts={posts ?? []} pin={pin} />
  );
}
