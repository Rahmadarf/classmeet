import { notFound } from "next/navigation";
import { BookOpen, ClipboardList, Home, ListChecks, Store, Wallet } from "lucide-react";
import { AccountCard, AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { HeroBalanceCard } from "@/components/team/hero-balance-card";
import { NewsCard } from "@/components/team/news-card";
import { Button } from "@/components/ui/button";
import type { NewsItem } from "@/lib/team/data";

// Pratinjau visual Beranda dengan data contoh (hanya pengembangan; halaman nyata ada di /team).
const NOW = new Date("2026-11-17T03:45:00Z").getTime(); // 10:45 WIB
const NEWS: NewsItem[] = [
  {
    id: "1",
    title: "Pasokan pangan terganggu",
    body: "Sejumlah pabrik pengolahan melaporkan kekurangan bahan baku akibat gangguan distribusi.\n\nParagraf kedua: pengecoh yang tidak memuat petunjuk apa pun.",
    publishedAt: "2026-11-17T03:42:00Z",
  },
  {
    id: "2",
    title: "Layanan hiburan digital tumbuh",
    body: "Aktivitas masyarakat pada platform hiburan daring meningkat selama akhir pekan.",
    publishedAt: "2026-11-17T03:22:00Z",
  },
  {
    id: "3",
    title: "Harga energi bergerak naik",
    body: "Pelaku usaha menilai kenaikan biaya angkut akan terasa dalam beberapa hari ke depan, terutama untuk komoditas yang bergantung pada pengiriman jarak jauh antar pulau.",
    publishedAt: "2026-11-16T03:02:00Z",
  },
];

const NAV = [
  { href: "/dev/beranda", label: "Beranda", icon: <Home /> },
  { href: "/dev/posts", label: "Daftar Pos", icon: <ListChecks /> },
  { href: "/dev/market", label: "Pasar", icon: <Store /> },
  { href: "/dev/orders", label: "Order", icon: <ClipboardList />, badge: 2 },
  { href: "/dev/portfolio", label: "Portofolio", icon: <Wallet /> },
  { href: "/dev/history", label: "Riwayat", icon: <BookOpen /> },
];

export default async function BerandaPreview({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | undefined }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const q = await searchParams;
  const empty = q.empty === "1";
  return (
    <AppShell
      nav={NAV}
      account={
        <AccountCard name="Tim Elang" roleLabel="Tim">
          <Button variant="secondary" block>
            Selesai
          </Button>
        </AccountCard>
      }
    >
      <PageHeader eyebrow="Ringkasan" title="Halo, Tim Elang" subtitle="Cek saldo dan baca berita terbaru." />
      <div className="flex flex-col gap-6">
        <HeroBalanceCard
          summary={{
            cash: 1_200_000,
            holdingsValue: 4_325_000,
            netWorth: 5_525_000,
          }}
        />
        <NewsCard items={empty ? [] : NEWS} now={NOW} />
      </div>
    </AppShell>
  );
}
