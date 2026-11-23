import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { MarketBoard } from "@/components/market/market-board";
import { PageHeader } from "@/components/shell/page-header";
import { Skeleton } from "@/components/states";
import { fetchAnalysisOffer } from "@/lib/analysis/data";
import { fetchBankruptAssets, fetchGame, fetchHoldings, fetchMarket } from "@/lib/market/data";
import { createClient } from "@/lib/supabase/server";
import { fetchNews, fetchSummary } from "@/lib/team/data";

/** Jam server untuk hitung mundur suspensi; di luar komponen karena jam tidak boleh dibaca di render. */
function nowMs() {
  return Date.now();
}

export const metadata: Metadata = { title: "Pasar" };

const SUBTITLE =
  "Pilih aset, lalu beli atau jual langsung. Harga beli dan harga jual tampil di panel; harga bergerak karena berita dan stok.";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function MarketPage({ searchParams }: { searchParams: SearchParams }) {
  // Membaca sesi dan searchParams → di dalam <Suspense> (cacheComponents).
  return (
    <Suspense fallback={<MarketSkeleton />}>
      <MarketContent searchParams={searchParams} />
    </Suspense>
  );
}

const first = <T,>(v: T | T[] | undefined): T | undefined => (Array.isArray(v) ? v[0] : v);

async function MarketContent({ searchParams }: { searchParams: SearchParams }) {
  await connection(); // klien Supabase memakai waktu (JWT): render saat permintaan, bukan saat prerender
  const supabase = await createClient();

  const game = await fetchGame(supabase);
  const [market, summary, holdings, news, bankrupt, analysis] = await Promise.all([
    fetchMarket(supabase, game?.sellSpreadBps),
    fetchSummary(supabase),
    fetchHoldings(supabase),
    fetchNews(supabase, 1),
    fetchBankruptAssets(supabase),
    fetchAnalysisOffer(supabase),
  ]);

  if (!market || market.length === 0 || !game) {
    return (
      <>
        <PageHeader eyebrow="Lantai perdagangan" title="Pasar Langsung" subtitle={SUBTITLE} />
        <p role="alert" className="text-bad-text text-lg font-medium">
          Data pasar belum bisa dimuat. Muat ulang halaman ini.
        </p>
      </>
    );
  }

  // Tautan dari Portofolio: /team/market?asset=<SIMBOL>&side=sell membuka aset itu dengan tab Jual.
  const params = await searchParams;
  const wanted = first(params.asset)?.toUpperCase();
  const selected = market.find((a) => a.symbol === wanted) ?? market[0];
  const initialSide = first(params.side) === "sell" ? "sell" : "buy";

  return (
    <>
      <PageHeader eyebrow="Lantai perdagangan" title="Pasar Langsung" subtitle={SUBTITLE} />
      <MarketBoard
        initial={{
          market,
          game,
          summary,
          holdings: holdings ?? {},
          latestNews: news?.[0] ?? null,
          selectedId: selected.id,
          initialSide,
          bankrupt: bankrupt ?? [],
          analysis,
          nowMs: nowMs(),
        }}
      />
    </>
  );
}

function MarketSkeleton() {
  return (
    <div role="status" aria-label="Memuat pasar">
      <div className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-3.5 w-36" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-5 w-[34rem] max-w-full" />
      </div>
      <Skeleton className="mb-6 h-14 w-full" />
      <div className="grid gap-4 xl:grid-cols-[272px_minmax(0,1fr)_312px]">
        <Skeleton className="h-[520px]" />
        <Skeleton className="h-80" />
        <Skeleton className="h-[420px]" />
      </div>
      <span className="sr-only">Memuat…</span>
    </div>
  );
}
