import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { HistoryBoard } from "@/components/history/history-board";
import { PageHeader } from "@/components/shell/page-header";
import { Skeleton, SkeletonRows } from "@/components/states";
import { Card } from "@/components/ui/card";
import { fetchHistory } from "@/lib/history/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Riwayat" };

const SUBTITLE = "Semua pembelian, penjualan, dan hadiah pos timmu.";

export default function HistoryPage() {
  // Membaca sesi memakai cookies() → di dalam <Suspense> (cacheComponents).
  return (
    <Suspense fallback={<HistorySkeleton />}>
      <HistoryContent />
    </Suspense>
  );
}

async function HistoryContent() {
  await connection(); // klien Supabase memakai waktu (JWT): render saat permintaan
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const teamId = claims?.claims.sub;
  const items = teamId ? await fetchHistory(supabase, teamId) : null;

  return (
    <>
      <PageHeader eyebrow="Aktivitas" title="Riwayat Transaksi" subtitle={SUBTITLE} />
      {teamId && items ? (
        <HistoryBoard teamId={teamId} initial={items} />
      ) : (
        <p role="alert" className="text-bad-text text-lg font-medium">
          Riwayat belum bisa dimuat. Muat ulang halaman ini.
        </p>
      )}
    </>
  );
}

function HistorySkeleton() {
  return (
    <div role="status" aria-label="Memuat riwayat">
      <div className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <Card>
        <SkeletonRows rows={6} />
      </Card>
      <span className="sr-only">Memuat…</span>
    </div>
  );
}
