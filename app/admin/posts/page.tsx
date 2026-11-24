import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/admin/list-skeleton";
import { PostsBoard } from "@/components/admin/posts-board";
import { PageHeader } from "@/components/shell/page-header";
import { fetchPostsPage } from "@/lib/admin/data";
import { fetchAdminGame } from "@/lib/admin/state";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pos" };

export default function PostsPage() {
  return (
    <Suspense fallback={<ListSkeleton title="Pos" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await connection();
  const supabase = await createClient();
  const [posts, game] = await Promise.all([fetchPostsPage(supabase), fetchAdminGame(supabase)]);
  if (!posts || !game) {
    return (
      <>
        <PageHeader eyebrow="Stasiun aktivitas" title="Pos" />
        <p role="alert" className="text-bad-text text-lg font-medium">
          Data pos belum bisa dimuat. Muat ulang halaman ini.
        </p>
      </>
    );
  }
  return <PostsBoard initial={posts} initialGame={game} />;
}
