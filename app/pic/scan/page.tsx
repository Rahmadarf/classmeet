import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ScanBoard } from "@/components/guard/scan-board";
import { Skeleton } from "@/components/states";
import { fetchMyPost } from "@/lib/guard/data";
import { fetchGame } from "@/lib/market/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pindai Hadiah Lomba" };

export default function PicScanPage() {
  return (
    <Suspense fallback={<ScanSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await connection();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const picId = claims?.claims.sub;
  const [post, game] = await Promise.all([
    picId ? fetchMyPost(supabase, picId) : Promise.resolve(null),
    fetchGame(supabase),
  ]);

  if (!picId || !post || !game) {
    return (
      <>
        <h1 className="text-ink text-[32px] leading-[1.15] font-bold tracking-tight">Pindai Hadiah</h1>
        <p role="alert" className="text-bad-text mt-4 text-lg font-medium">
          {picId && !post && game
            ? "Akunmu belum terhubung ke lomba mana pun. Hubungi panitia."
            : "Data lomba belum bisa dimuat. Muat ulang halaman ini."}
        </p>
      </>
    );
  }
  return <ScanBoard guardId={picId} initialPost={post} initialState={game.state} variant="pic" />;
}

function ScanSkeleton() {
  return (
    <div role="status" aria-label="Memuat">
      <div className="mb-5 flex flex-col gap-2">
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-9 w-56" />
      </div>
      <Skeleton className="mb-5 h-11 w-full" />
      <Skeleton className="aspect-square w-full" />
      <span className="sr-only">Memuat…</span>
    </div>
  );
}
