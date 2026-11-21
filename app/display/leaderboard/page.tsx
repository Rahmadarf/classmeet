import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { DisplayGate } from "@/components/display/game-gate";
import { LeaderboardScreen } from "@/components/display/leaderboard-screen";
import { fetchLeaderboard } from "@/lib/display/data";
import { fetchGame } from "@/lib/market/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "5 tim teratas" };

export default function DisplayLeaderboardPage() {
  return (
    <Suspense fallback={<div className="bg-page fixed inset-0" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await connection();
  const supabase = await createClient();
  return (
    <DisplayGate initialState={(await fetchGame(supabase))?.state ?? null}>
      <div className="fixed inset-0">
        <LeaderboardScreen initial={await fetchLeaderboard(supabase)} />
      </div>
    </DisplayGate>
  );
}
