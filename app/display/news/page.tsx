import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { NewsScreen } from "@/components/display/news-screen";
import { fetchNewsBoard } from "@/lib/display/data";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Display berita" };

export default function DisplayNewsPage() {
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
    <div className="fixed inset-0">
      <NewsScreen initial={await fetchNewsBoard(supabase)} />
    </div>
  );
}
