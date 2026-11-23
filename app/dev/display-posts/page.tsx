import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PostsScreen } from "@/components/display/posts-screen";
import { QueryProvider } from "@/lib/query/provider";
import { buildPostRows } from "@/lib/posts/view";

// Pratinjau layar Daftar Pos untuk display dengan data contoh (hanya pengembangan): /dev/display-posts?n=12
// Opsi: &open=none (semua Tidak tersedia), &open=all (semua Tersedia); bawaan: pos 3, 5, 9 tersedia.
const SAMPLE = [
  ["Merakit Buta", "Lapangan A"],
  ["Lempar Cincin", "Aula Lantai 1"],
  ["Estafet Kardus", "Kantin Barat"],
  ["Tebak Kata", "Ruang 12"],
  ["Balap Karung", "Lapangan B"],
  ["Lompat Tali", "Koridor Timur"],
  ["Memindah Air", "Taman Depan"],
  ["Pikul Bola", "Lapangan C"],
  ["Susun Menara", "Aula Lantai 2"],
  ["Tangkap Botol", "Gerbang Samping"],
  ["Congklak", "Perpustakaan"],
  ["Titian Papan", "Lapangan D"],
  ["Tarik Tambang", "Lapangan E"],
  ["Egrang", "Lapangan F"],
  ["Bakiak", "Lapangan G"],
  ["Sumpit", "Kantin Timur"],
];

export default function DevDisplayPosts({
  searchParams,
}: {
  searchParams: Promise<{ n?: string; open?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense>
      <Preview searchParams={searchParams} />
    </Suspense>
  );
}

async function Preview({ searchParams }: { searchParams: Promise<{ n?: string; open?: string }> }) {
  const q = await searchParams;
  const n = Math.min(Math.max(Number(q.n) || 12, 1), SAMPLE.length);
  const posts = SAMPLE.slice(0, n).map(([name, location], i) => ({
    id: String(i),
    name: `Pos ${i + 1} · ${name}`,
    location,
    isOpen: q.open === "all" ? true : q.open === "none" ? false : [2, 4, 8].includes(i),
  }));
  return (
    <div className="fixed inset-0">
      <QueryProvider>
        <PostsScreen initial={buildPostRows(posts)} live={false} />
      </QueryProvider>
    </div>
  );
}
