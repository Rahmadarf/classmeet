"use client";

import { PriceChangeChip } from "@/components/ui/chip";
import { useChangeFlash } from "@/lib/hooks/use-change-flash";
import type { Band, MarketAsset } from "@/lib/market/data";
import { formatCompactRupiah } from "@/lib/market/rules";
import { formatNumber, formatRupiah, formatSignedRupiah, percentChange } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Detail aset terpilih (Figma `Detail aset`, 1121:778). Harga besar = harga TRANSAKSI TERAKHIR.
 * "Acuan" menggantikan "Prev" di Figma: skema tidak punya penutupan hari sebelumnya; harga acuan
 * (digeser berita) adalah dasar ARA/ARB dan pembanding persen di layar (log 13-log-implementasi).
 */
export function AssetDetail({ asset, band }: { asset: MarketAsset; band: Band | null }) {
  const flash = useChangeFlash(asset.lastPrice);
  const diff = asset.lastPrice - asset.refPrice;
  const stat = (v: number | null) => (v === null ? "–" : formatNumber(v));

  return (
    <section
      aria-label={`Detail ${asset.name}`}
      className="rounded-panel border-line bg-card flex flex-col gap-4 border p-5"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="rounded-control bg-primary text-on-primary grid h-11 w-12 shrink-0 place-items-center text-base font-bold"
        >
          {asset.symbol}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-ink truncate text-xl leading-tight font-bold">{asset.name}</h2>
          <p className="text-ink-muted text-[13px]">
            {asset.symbol} · {asset.sector}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <p
            key={flash}
            className={cn(
              "money text-ink px-1 text-[28px] leading-tight font-bold",
              flash > 0 && "price-flash",
            )}
          >
            <span className="sr-only">Harga terakhir </span>
            {formatRupiah(asset.lastPrice)}
          </p>
          <PriceChangeChip
            pct={percentChange(asset.lastPrice, asset.refPrice)}
            suffix={diff === 0 ? undefined : formatSignedRupiah(diff).replace(/^([+−-])Rp /, "$1")}
            className="px-2 py-1 text-xs"
          />
        </div>
      </div>

      <dl className="grid grid-cols-5 gap-2">
        <Stat label="Open" value={stat(asset.open)} />
        <Stat label="High" value={stat(asset.high)} />
        <Stat label="Low" value={stat(asset.low)} />
        <Stat label="Acuan" value={formatNumber(asset.refPrice)} />
        <Stat label="Avg" value={stat(asset.avg)} />
        <Stat label="ARA" value={band ? formatNumber(band.hi) : "–"} tone="ok" />
        <Stat label="ARB" value={band ? formatNumber(band.lo) : "–"} tone="bad" />
        <Stat label="Lot" value={formatNumber(asset.lot)} />
        <Stat label="Val" value={asset.val > 0 ? formatCompactRupiah(asset.val) : "0"} />
        <Stat label="Freq" value={formatNumber(asset.freq)} />
      </dl>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "bad" }) {
  return (
    <div className="bg-field rounded-control flex min-w-0 flex-col gap-0.5 px-2.5 py-2">
      <dt className="text-ink-muted text-[11px] font-semibold tracking-[0.06em]">{label}</dt>
      <dd
        className={cn(
          "tnum truncate text-sm font-bold",
          tone === "ok" ? "text-ok-text" : tone === "bad" ? "text-bad-text" : "text-ink",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
