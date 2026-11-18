import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { Skeleton, SkeletonRows } from "@/components/states";
import { BerandaLive } from "@/components/team/beranda-live";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { fetchNews, fetchSummary } from "@/lib/team/data";

export const metadata: Metadata = { title: "Beranda" };

export default function BerandaPage() {
  // Membaca sesi memakai cookies() → di dalam <Suspense> (cacheComponents).
  return (
    <Suspense fallback={<BerandaSkeleton />}>
      <BerandaContent />
    </Suspense>
  );
}

async function BerandaContent() {
  await connection(); // lihat catatan di app/team/layout.tsx
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const teamId = claims?.claims.sub;
  if (!teamId) return <BerandaSkeleton />; // proxy sudah mengalihkan; jaga-jaga

  const [{ data: team }, summary, news] = await Promise.all([
    supabase.from("teams").select("name").eq("id", teamId).maybeSingle(),
    fetchSummary(supabase),
    fetchNews(supabase),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Ringkasan"
        title={`Halo, ${team?.name ?? "Tim"}`}
        subtitle="Cek saldo dan baca berita terbaru."
      />
      <BerandaLive teamId={teamId} initialSummary={summary} initialNews={news} />
    </>
  );
}

function BerandaSkeleton() {
  return (
    <div role="status" aria-label="Memuat beranda">
      <div className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-5 w-64" />
      </div>
      <div className="flex flex-col gap-6">
        <Skeleton className="h-[220px] w-full" />
        <Card>
          <SkeletonRows rows={3} />
        </Card>
      </div>
      <span className="sr-only">Memuat…</span>
    </div>
  );
}
