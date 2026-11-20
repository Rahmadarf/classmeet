import { BookOpen, Home, Store, Wallet } from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";
import { AccountCard, AppShell } from "@/components/shell/app-shell";
import { SessionBanner } from "@/components/session/session-banner";
import { FinishButton } from "@/components/session/finish-button";
import { OfflineBanner } from "@/components/states";
import { NewsReaderHost } from "@/components/team/news-reader";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { createClient } from "@/lib/supabase/server";

// Menu tim: Beranda, Pasar, Portofolio, Riwayat (halaman Order dihapus bersama order book, docs/17). Daftar Pos TIDAK ada di akun tim: dipindah ke layar akun display
// (keputusan pengguna 18 Nov; app/display/posts).
const NAV = [
  { href: "/team", label: "Beranda", icon: <Home /> },
  { href: "/team/market", label: "Pasar", icon: <Store /> },
  { href: "/team/portfolio", label: "Portofolio", icon: <Wallet /> },
  { href: "/team/history", label: "Riwayat", icon: <BookOpen /> },
];

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  // Membaca sesi memakai cookies() → harus di dalam <Suspense> (cacheComponents).
  return (
    <Suspense fallback={<div className="bg-page min-h-dvh" />}>
      <TeamShell>{children}</TeamShell>
    </Suspense>
  );
}

async function TeamShell({ children }: { children: React.ReactNode }) {
  // Data milik pengguna dan klien Supabase memakai waktu (cek kedaluwarsa JWT): minta render saat permintaan
  // supaya Next tidak mencoba melakukannya saat prerender (galat "unstable value Date.now()").
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const { data: team } = userId
    ? await supabase.from("teams").select("name").eq("id", userId).maybeSingle()
    : { data: null };

  return (
    <AppShell
      navigation={<SidebarNav items={NAV} />}
      banner={
        <>
          <SessionBanner />
          <OfflineBanner />
        </>
      }
      account={
        <AccountCard name={team?.name ?? "Tim"} roleLabel="Tim">
          <FinishButton />
        </AccountCard>
      }
    >
      <NewsReaderHost>{children}</NewsReaderHost>
    </AppShell>
  );
}
