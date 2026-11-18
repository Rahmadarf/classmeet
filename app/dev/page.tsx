import { notFound } from "next/navigation";
import { BookOpen, Home, ListChecks, LogOut, Store, Wallet } from "lucide-react";
import { AccountCard, AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState, SkeletonRows } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Chip, PriceChangeChip, StatusPill } from "@/components/ui/chip";
import { formatNumber, formatRupiah, formatSignedRupiah } from "@/lib/money";

// Galeri komponen untuk pemeriksaan visual saat pengembangan. Tidak ada di produksi.
const NAV = [
  { href: "/dev", label: "Beranda", icon: <Home /> },
  { href: "/dev/posts", label: "Daftar Pos", icon: <ListChecks /> },
  { href: "/dev/market", label: "Pasar", icon: <Store /> },
  { href: "/dev/portfolio", label: "Portofolio", icon: <Wallet /> },
  { href: "/dev/history", label: "Riwayat", icon: <BookOpen /> },
];

const ROWS = [
  { sym: "AP", price: 800_000, pct: 3.04 },
  { sym: "MI", price: 750_000, pct: -1.2 },
  { sym: "IN", price: 120_000, pct: 0 },
  { sym: "BC", price: 1_111_000, pct: 12.5 },
  { sym: "SM", price: 111_111, pct: -14.9 },
];

export default function DevGallery() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <AppShell
      nav={NAV}
      account={
        <AccountCard name="Tim Elang" roleLabel="Tim">
          <Button variant="secondary" block>
            <LogOut className="size-5" aria-hidden /> Selesai
          </Button>
        </AccountCard>
      }
    >
      <PageHeader
        eyebrow="Galeri komponen"
        title="Token dan komponen"
        subtitle="Pemeriksaan visual Tahap 0. Tidak ada di produksi."
        actions={
          <>
            <StatusPill tone="ok">3 Tersedia</StatusPill>
            <StatusPill tone="bad">9 Tidak tersedia</StatusPill>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader eyebrow="Tombol" title="Aksi" />
          <div className="flex flex-wrap gap-3">
            <Button>Pasang order beli</Button>
            <Button variant="secondary">Batal</Button>
            <Button variant="soft">Filter</Button>
            <Button variant="danger">Akhiri game</Button>
            <Button loading>Kirim</Button>
            <Button disabled>Nonaktif</Button>
          </div>
        </Card>

        <Card>
          <CardHeader eyebrow="Chip" title="Perubahan dan status" />
          <div className="flex flex-wrap gap-3">
            <PriceChangeChip pct={3.04} />
            <PriceChangeChip pct={-5} />
            <PriceChangeChip pct={0} />
            <PriceChangeChip pct={null} />
            <Chip tone="accent">Baru</Chip>
            <Chip>Netral</Chip>
          </div>
        </Card>

        <Card>
          <CardHeader eyebrow="Angka" title="Kolom harga (tabular-nums, Inter)" />
          <table className="w-full text-lg">
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.sym} className="border-line border-b last:border-0">
                  <td className="text-brand-text py-2 font-semibold">{r.sym}</td>
                  <td className="money py-2 text-right font-semibold">{formatRupiah(r.price)}</td>
                  <td className="money py-2 text-right">{formatNumber(r.price)}</td>
                  <td className="money text-cyan-text py-2 text-right">
                    {formatSignedRupiah(r.price - 100_000)}
                  </td>
                  <td className="py-2 text-right">
                    <PriceChangeChip pct={r.pct} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-ink-muted mt-3 text-sm">
            Tanpa tabular-nums: <span className="font-semibold">111.111 · 100.000 · 888.888</span> — Dengan:{" "}
            <span className="money font-semibold">111.111 · 100.000 · 888.888</span>
          </p>
        </Card>

        <Card>
          <CardHeader eyebrow="Status" title="Memuat dan kosong" />
          <SkeletonRows rows={2} />
          <EmptyState title="Kamu belum punya aset" description="Buka Pasar untuk mulai." />
        </Card>
      </div>
    </AppShell>
  );
}
