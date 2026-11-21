import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { DisplayGate } from "@/components/display/game-gate";
import { MarketScreen } from "@/components/display/market-screen";
import { fetchMarketBoard } from "@/lib/display/data";
import { fetchGame } from "@/lib/market/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Display pasar" };

export default function DisplayMarketPage() {
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
        <MarketScreen initial={await fetchMarketBoard(supabase)} />
      </div>
    </DisplayGate>
  );
}
