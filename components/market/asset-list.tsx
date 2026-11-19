"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { PriceChangeChip } from "@/components/ui/chip";
import { formatRupiah, percentChange } from "@/lib/money";
import { isSuspended, type MarketAsset } from "@/lib/market/data";
import { cn } from "@/lib/utils";

/**
 * `overflow-hidden` pada kartu WAJIB: tanpanya daftar yang bisa digulir di dalam kartu `sticky` ikut menambah tinggi
 * dokumen (±850 px ruang kosong di bawah halaman Pasar, sehingga halaman bisa digulir jauh melewati isinya).
 *
 * Kolom kiri Pasar: pencarian + daftar aset (Figma `Daftar aset`, 1121:709).
 * Harga = harga transaksi terakhir; chip = perubahan terhadap harga OPEN hari ini (▲/▼ + teks, bukan hanya warna).
 */
export function AssetList({
  assets,
  selectedId,
  onSelect,
  now,
}: {
  assets: MarketAsset[];
  selectedId: string;
  onSelect: (id: string) => void;
  /** Jam sekarang (ms) untuk menandai aset yang disuspensi. */
  now: number;
}) {
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("");
  const sectorList = useMemo(
    () => [...new Set(assets.map((a) => a.sector))].sort((a, b) => a.localeCompare(b)),
    [assets],
  );
  const sectors = sectorList.length;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const bySector = sector ? assets.filter((a) => a.sector === sector) : assets;
    return q
      ? bySector.filter(
          (a) =>
            a.symbol.toLowerCase().includes(q) ||
            a.name.toLowerCase().includes(q) ||
            a.sector.toLowerCase().includes(q),
        )
      : bySector;
  }, [assets, query, sector]);

  return (
    <section
      aria-label="Daftar aset"
      className="rounded-panel border-line bg-card shadow-card flex flex-col gap-3 overflow-hidden border p-4 xl:sticky xl:top-4 xl:max-h-[calc(100dvh-2rem)]"
    >
      <label className="relative block">
        <span className="sr-only">Cari aset</span>
        <Search
          className="text-ink-dim pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari aset…"
          autoComplete="off"
          className="rounded-panel border-line bg-field text-ink placeholder:text-ink-dim min-h-11 w-full border py-2.5 pr-3.5 pl-10 text-base"
        />
      </label>
      <label className="block">
        <span className="sr-only">Filter sektor</span>
        <select
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          className="rounded-panel border-line bg-field text-ink min-h-11 w-full border px-3.5 text-base"
        >
          <option value="">Semua sektor ({assets.length})</option>
          {sectorList.map((s) => (
            <option key={s} value={s}>
              {s} ({assets.filter((a) => a.sector === s).length})
            </option>
          ))}
        </select>
      </label>
      <p className="text-ink-muted text-[11px] font-semibold tracking-[0.1em] uppercase">
        {sector || query
          ? `${shown.length} dari ${assets.length} aset`
          : `${assets.length} aset · ${sectors} sektor`}
      </p>

      <ul className="-mx-1 flex min-h-0 flex-col overflow-y-auto px-1 pb-1">
        {shown.length === 0 ? (
          <li className="text-ink-muted px-2 py-6 text-center text-sm">Tidak ada aset yang cocok.</li>
        ) : (
          shown.map((asset) => {
            const selected = asset.id === selectedId;
            return (
              <li key={asset.id}>
                <button
                  type="button"
                  onClick={() => onSelect(asset.id)}
                  aria-current={selected || undefined}
                  className={cn(
                    "rounded-row flex min-h-14 w-full items-center gap-2.5 p-2.5 text-left transition-colors",
                    selected ? "bg-nav-active" : "hover:bg-soft",
                  )}
                >
                  <span
                    aria-hidden
                    className="rounded-control bg-primary text-on-primary grid h-8 w-9 shrink-0 place-items-center text-xs font-bold"
                  >
                    {asset.symbol}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-ink block truncate text-sm font-semibold">{asset.name}</span>
                    <span className="tnum text-ink-muted block text-xs">{formatRupiah(asset.lastPrice)}</span>
                  </span>
                  {isSuspended(asset, now) ? (
                    <span className="border-accent bg-accent/12 text-accent-text rounded-full border px-2 py-1 text-xs font-bold">
                      Suspensi
                    </span>
                  ) : (
                    <PriceChangeChip
                      pct={percentChange(asset.lastPrice, asset.dayOpen)}
                      className="px-2 py-1 text-xs"
                    />
                  )}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
