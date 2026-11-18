import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/admin/list-skeleton";
import { NewsBoard } from "@/components/admin/news-board";
import { PageHeader } from "@/components/shell/page-header";
import { fetchNewsPage } from "@/lib/admin/data";
import { fetchAdminGame } from "@/lib/admin/state";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Berita" };

export default function NewsPage() {
  return (
    <Suspense fallback={<ListSkeleton title="Berita" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await connection();
  const supabase = await createClient();
  const game = await fetchAdminGame(supabase);
  const locked = game ? game.startedAt !== null : true;
  const page = game ? await fetchNewsPage(supabase, locked) : null;
  return (
    <>
      <PageHeader
        eyebrow="Pantauan harga"
        title="Berita"
        subtitle={
          locked
            ? "Game sudah dimulai. Urutan dan waktu berita diatur sistem; tidak ada yang bisa mengubahnya."
            : "Persiapan: tandai berita yang masuk kumpulan sebelum game dibuka."
        }
      />
      {page ? (
        <NewsBoard initial={page} />
      ) : (
        <p role="alert" className="text-bad-text text-lg font-medium">
          Data berita belum bisa dimuat. Muat ulang halaman ini.
        </p>
      )}
    </>
  );
}
