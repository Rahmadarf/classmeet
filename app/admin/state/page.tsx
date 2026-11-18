import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { StateBoard } from "@/components/admin/state-board";
import { PageHeader } from "@/components/shell/page-header";
import { Skeleton } from "@/components/states";
import { fetchAdminGame, fetchNewsPool } from "@/lib/admin/state";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Status game" };

const SUBTITLE = "Hanya yang perlu ditekan atau dipantau setiap hari.";

export default function StatePage() {
  return (
    <Suspense fallback={<StateSkeleton />}>
      <StateContent />
    </Suspense>
  );
}

async function StateContent() {
  await connection(); // klien Supabase memakai waktu (JWT): render saat permintaan
  const supabase = await createClient();
  const [game, pool] = await Promise.all([fetchAdminGame(supabase), fetchNewsPool(supabase)]);
  return (
    <>
      <PageHeader eyebrow="Pusat kendali" title="Status Game" subtitle={SUBTITLE} />
      {game ? (
        <StateBoard initial={{ game, pool }} />
      ) : (
        <p role="alert" className="text-bad-text text-lg font-medium">
          Status game belum bisa dimuat. Muat ulang halaman ini.
        </p>
      )}
    </>
  );
}

function StateSkeleton() {
  return (
    <div role="status" aria-label="Memuat status game">
      <div className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-52" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-60" />
      </div>
      <span className="sr-only">Memuat…</span>
    </div>
  );
}
