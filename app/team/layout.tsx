import { BookOpen, ClipboardList, Home, Store, Wallet } from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";
import { AccountCard, AppShell } from "@/components/shell/app-shell";
import { SessionBanner } from "@/components/session/session-banner";
import { FinishButton } from "@/components/session/finish-button";
import { OfflineBanner } from "@/components/states";
import { OpenOrdersCountProvider, TeamNav } from "@/components/team/open-orders-count";
import { fetchOpenOrderCount } from "@/lib/market/data";
import { createClient } from "@/lib/supabase/server";

// Menu tim: Beranda, Pasar, Order, Portofolio, Riwayat. Daftar Pos TIDAK ada di akun tim: dipindah ke layar akun display
// (keputusan pengguna 18 Nov; app/display/posts).
const NAV = [
  { href: "/team", label: "Beranda", icon: <Home /> },
  { href: "/team/market", label: "Pasar", icon: <Store /> },
  { href: "/team/orders", label: "Order", icon: <ClipboardList /> },
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
  const [{ data: team }, openOrders] = await Promise.all([
    userId
      ? supabase.from("teams").select("name").eq("id", userId).maybeSingle()
      : Promise.resolve({ data: null }),
    fetchOpenOrderCount(supabase),
  ]);

  return (
    <OpenOrdersCountProvider initial={openOrders ?? 0}>
      <AppShell
        navigation={<TeamNav items={NAV} />}
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
        {children}
      </AppShell>
    </OpenOrdersCountProvider>
  );
}
