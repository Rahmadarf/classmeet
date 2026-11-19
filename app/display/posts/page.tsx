import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PostsScreen } from "@/components/display/posts-screen";
import { Skeleton } from "@/components/states";
import { fetchPosts } from "@/lib/posts/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Daftar Pos" };

export default function DisplayPostsPage() {
  // Membaca sesi memakai cookies() → di dalam <Suspense> (cacheComponents).
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <PostsContent />
    </Suspense>
  );
}

async function PostsContent() {
  await connection(); // klien Supabase memakai waktu (JWT): render saat permintaan
  const supabase = await createClient();
  const posts = await fetchPosts(supabase);
  if (!posts) {
    return (
      <main className="bg-page grid min-h-dvh place-items-center px-8">
        <p role="alert" className="text-bad-text text-3xl font-semibold">
          Daftar pos belum bisa dimuat. Muat ulang halaman ini.
        </p>
      </main>
    );
  }
  return (
    <div className="fixed inset-0">
      <PostsScreen initial={posts} />
    </div>
  );
}

function ScreenSkeleton() {
  return (
    <main
      role="status"
      aria-label="Memuat daftar pos"
      className="bg-page flex min-h-dvh flex-col gap-8 px-12 py-10"
    >
      <Skeleton className="h-24 w-96" />
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[118px]" />
        ))}
      </div>
      <span className="sr-only">Memuat…</span>
    </main>
  );
}
