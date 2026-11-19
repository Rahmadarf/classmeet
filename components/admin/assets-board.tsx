"use client";

import { Pencil, Plus, Search } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { AssetDialog } from "@/components/admin/asset-dialog";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/chip";
import { fetchAssetsPage, type AdminAsset } from "@/lib/admin/data";
import { usePolling } from "@/lib/hooks/use-polling";
import { formatNumber } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";

const POLL_MS = 15_000;
type AssetsInitial = AdminAsset[];

/**
 * Aset (Figma `Admin — Aset`, 1104:378): tabel aset dengan pencarian dan filter sektor, "Tambah aset" dan "Ubah" per baris
 * (docs/04 §3.9). Sebelum game dibuka: semua isian lewat `admin_upsert_asset`. Sesudahnya: hanya stok lewat
 * `admin_set_stock` (harga, rentang, status terkunci oleh database); "Tambah aset" disembunyikan.
 */
export function AssetsBoard({ initial, locked }: { initial: AssetsInitial; locked: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [assets, setAssets] = useState(initial);
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; asset: AdminAsset | null }>({
    open: false,
    asset: null,
  });

  const refresh = useCallback(async () => {
    const next = await fetchAssetsPage(supabase);
    if (next) setAssets(next);
  }, [supabase]);
  usePolling(refresh, POLL_MS);

  const sectors = useMemo(() => [...new Set(assets.map((a) => a.sector))].sort(), [assets]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter(
      (a) =>
        (!sector || a.sector === sector) &&
        (!q || a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)),
    );
  }, [assets, query, sector]);

  const field =
    "rounded-control border-line bg-field text-ink min-h-11 border px-3 text-base focus:border-brand-text";

  return (
    <>
      <PageHeader
        eyebrow="Pasar"
        title="Aset"
        subtitle="Harga, rentang harga, dan stok bandar tiap aset."
        actions={
          locked ? null : (
            <Button size="lg" onClick={() => setDialog({ open: true, asset: null })}>
              <Plus className="size-5" aria-hidden /> Tambah aset
            </Button>
          )
        }
      />
      <Card aria-labelledby="aset-judul" className="flex flex-col gap-2">
        <p className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase">Daftar aset</p>
        <h2 id="aset-judul" className="text-ink text-2xl font-bold">
          {shown.length === assets.length
            ? `${assets.length} aset`
            : `${shown.length} dari ${assets.length} aset`}
        </h2>
        <div className="mt-1 flex gap-3">
          <label className="relative block flex-1">
            <span className="sr-only">Cari kode atau nama</span>
            <Search
              className="text-ink-dim pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari kode atau nama…"
              autoComplete="off"
              className={`${field} w-full pl-10`}
            />
          </label>
          <label>
            <span className="sr-only">Filter sektor</span>
            <select value={sector} onChange={(e) => setSector(e.target.value)} className={field}>
              <option value="">Semua sektor</option>
              {sectors.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        <DataTable
          caption="Daftar aset"
          head={["Kode", "Nama", "Sektor", "Acuan", "Terakhir", "Rentang harga", "Stok", "Status", ""]}
          widths={[60, 150, 150, 110, 100, 175, 56, 108]}
          minWidth={1010}
          align={["left", "left", "left", "right", "right", "right", "right"]}
        >
          {shown.map((a) => (
            <tr key={a.id}>
              <td className="text-brand-text text-base font-bold">{a.symbol}</td>
              <td className="text-ink">{a.name}</td>
              <td>{a.sector}</td>
              <td className="money text-ink text-right font-bold">{formatNumber(a.price)}</td>
              <td className="money text-right">{a.lastPrice === null ? "–" : formatNumber(a.lastPrice)}</td>
              <td className="tnum text-right">
                {formatNumber(a.min)} – {formatNumber(a.max)}
              </td>
              <td className="tnum text-right">{formatNumber(a.stock)}</td>
              <td>
                <StatusPill tone={a.active ? "ok" : "bad"}>{a.active ? "Aktif" : "Nonaktif"}</StatusPill>
              </td>
              <td className="text-right">
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={`Ubah ${a.name}`}
                  onClick={() => setDialog({ open: true, asset: a })}
                >
                  <Pencil className="size-4" aria-hidden /> Ubah
                </Button>
              </td>
            </tr>
          ))}
        </DataTable>
        {shown.length === 0 ? (
          <p className="text-ink-muted py-4 text-center text-base">Tidak ada aset yang cocok.</p>
        ) : null}
        <p className="text-ink-muted text-sm">
          Harga acuan hanya berubah lewat berita yang terbit; rentang harga membatasi efek berita (min dan
          maks). Stok adalah persediaan bandar.{" "}
          {locked
            ? "Game sudah dimulai: harga acuan, rentang, dan status terkunci. Hanya stok yang bisa diubah, dengan alasan."
            : "Sebelum game dimulai, semua isian aset bisa diubah. Setelah game dimulai hanya stok."}
        </p>
      </Card>
      <AssetDialog
        open={dialog.open}
        onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))}
        asset={dialog.asset}
        locked={locked}
        sectors={sectors}
        onDone={(m) => {
          toast.success(m);
          void refresh();
        }}
      />
    </>
  );
}
