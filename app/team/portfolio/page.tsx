import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PortfolioBoard } from "@/components/portfolio/portfolio-board";
import { PageHeader } from "@/components/shell/page-header";
import { Skeleton, SkeletonRows } from "@/components/states";
import { Card } from "@/components/ui/card";
import { fetchPortfolio } from "@/lib/portfolio/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Portofolio" };

const SUBTITLE = "Aset yang kamu pegang dan nilainya menurut harga tayang.";

export default function PortfolioPage() {
  // Membaca sesi memakai cookies() → di dalam <Suspense> (cacheComponents).
  return (
    <Suspense fallback={<PortfolioSkeleton />}>
      <PortfolioContent />
    </Suspense>
  );
}

async function PortfolioContent() {
  await connection(); // klien Supabase memakai waktu (JWT): render saat permintaan
  const supabase = await createClient();
  const portfolio = await fetchPortfolio(supabase);

  return (
    <>
      <PageHeader eyebrow="Keuanganku" title="Portofolio" subtitle={SUBTITLE} />
      {portfolio ? (
        <PortfolioBoard initial={portfolio} />
      ) : (
        <p role="alert" className="text-bad-text text-lg font-medium">
          Data portofolio belum bisa dimuat. Muat ulang halaman ini.
        </p>
      )}
    </>
  );
}

function PortfolioSkeleton() {
  return (
    <div role="status" aria-label="Memuat portofolio">
      <div className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <div className="flex flex-col gap-6">
        <Skeleton className="h-40 w-full" />
        <Card>
          <SkeletonRows rows={4} />
        </Card>
      </div>
      <span className="sr-only">Memuat…</span>
    </div>
  );
}
