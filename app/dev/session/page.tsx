import { notFound } from "next/navigation";
import { Home } from "lucide-react";
import { SessionBanner } from "@/components/session/session-banner";
import { AccountCard, AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";

// Uji cepat timer sesi: keluar otomatis setelah 20 dtk diam (banner di 10 dtk terakhir).
// Hanya pengembangan; mengarahkan ke /kiosk saat habis (memanggil endSession seperti produksi).
export default function SessionTimerDemo() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <AppShell
      nav={[{ href: "/dev/session", label: "Beranda", icon: <Home /> }]}
      banner={<SessionBanner idleMs={20_000} warnMs={10_000} />}
      account={<AccountCard name="Tim Elang" roleLabel="Tim" />}
    >
      <PageHeader
        eyebrow="Uji timer"
        title="Sesi 20 detik"
        subtitle="Diamkan 10 detik: banner muncul. Gerakkan kursor atau tekan tombol: banner menutup."
      />
      <Card>Konten halaman.</Card>
    </AppShell>
  );
}
