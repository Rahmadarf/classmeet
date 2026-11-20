import {
  ArrowLeftRight,
  Box,
  Download,
  Gift,
  ListChecks,
  MapPin,
  Newspaper,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminSignOut } from "@/components/admin/admin-sign-out";
import { ConnectionStatus } from "@/components/admin/connection-status";
import { AccountCard, AppShell } from "@/components/shell/app-shell";
import { OfflineBanner } from "@/components/states";
import { createClient } from "@/lib/supabase/server";

// Menu admin: docs/07 §2.3 (urutan Figma `Admin — Status game`).
const NAV = [
  { href: "/admin/payouts", label: "Hadiah", icon: <Gift /> },
  { href: "/admin/state", label: "Status", icon: <SlidersHorizontal /> },
  { href: "/admin/assets", label: "Aset", icon: <Box /> },
  { href: "/admin/transactions", label: "Transaksi", icon: <ArrowLeftRight /> },
  { href: "/admin/news", label: "Berita", icon: <Newspaper /> },
  { href: "/admin/teams", label: "Tim", icon: <Users /> },
  { href: "/admin/posts", label: "Pos", icon: <MapPin /> },
  { href: "/admin/audit", label: "Audit", icon: <ListChecks /> },
  { href: "/admin/export", label: "Ekspor", icon: <Download /> },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // Membaca sesi memakai cookies() → di dalam <Suspense> (cacheComponents).
  return (
    <Suspense fallback={<div className="bg-page min-h-dvh" />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}

async function AdminShell({ children }: { children: React.ReactNode }) {
  await connection(); // klien Supabase memakai waktu (JWT): render saat permintaan
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  const { data: profile } = userId
    ? await supabase.from("profiles").select("display_name,username").eq("id", userId).maybeSingle()
    : { data: null };

  return (
    <AppShell
      nav={NAV}
      brandSubtitle="Admin"
      banner={<OfflineBanner />}
      account={
        <AccountCard
          name={profile?.display_name || profile?.username || "Admin"}
          roleLabel="Panitia"
          status={<ConnectionStatus />}
        >
          <AdminSignOut />
        </AccountCard>
      }
    >
      {children}
    </AppShell>
  );
}
