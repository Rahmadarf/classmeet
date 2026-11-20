"use client";

import { StockBadge } from "@/components/market/stock-badge";
import { PriceChangeChip } from "@/components/ui/chip";
import { useChangeFlash } from "@/lib/hooks/use-change-flash";
import type { Game, Holding, MarketAsset } from "@/lib/market/data";
import { formatBps, holdCap, stockLevel } from "@/lib/market/rules";
import { formatNumber, formatRupiah, formatSignedRupiah, percentChange } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Detail aset terpilih (model toko, docs/17). Harga besar = HARGA BELI (harga tayang: acuan berita x tekanan stok).
 * Chip perubahan dan "Open" memakai harga open HARI INI (harga acuan saat hari WIB itu dimulai; `get_day_open_prices`).
 * "Acuan berita" = harga sebelum tekanan stok. Harga jual = harga beli dikurangi selisih jual.
 */
export function AssetDetail({
  asset,
  game,
  holding,
}: {
  asset: MarketAsset;
  game: Game;
  holding: Holding | undefined;
}) {
  const flash = useChangeFlash(asset.lastPrice);
  const diff = asset.lastPrice - asset.dayOpen;
  const level = stockLevel(asset.stock, asset.initStock, game.stockMidPct, game.stockLowPct);
  const cap = holdCap(asset.initStock, game.holdCapPct);
  const held = holding?.qty ?? 0;
  const pnl = holding && held > 0 ? held * asset.sellPrice - holding.costBasis : null;

  return (
    <section
      aria-label={`Detail ${asset.name}`}
      className="rounded-panel border-line bg-card shadow-card flex flex-col gap-4 border p-5"
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
            <span className="sr-only">Harga beli </span>
            {formatRupiah(asset.lastPrice)}
          </p>
          <PriceChangeChip
            pct={percentChange(asset.lastPrice, asset.dayOpen)}
            suffix={diff === 0 ? undefined : formatSignedRupiah(diff).replace(/^([+−-])Rp /, "$1")}
            className="px-2 py-1 text-xs"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StockBadge level={level} />
        <span className="tnum text-ink-muted text-[13px]">
          Sisa {formatNumber(asset.stock)} dari {formatNumber(asset.initStock)} unit
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="Harga beli" value={formatRupiah(asset.lastPrice)} />
        <Stat
          label={`Harga jual (−${formatBps(game.sellSpreadBps)})`}
          value={formatRupiah(asset.sellPrice)}
        />
        <Stat label="Open hari ini" value={formatRupiah(asset.dayOpen)} />
        <Stat label="Acuan berita" value={formatRupiah(asset.refPrice)} />
        <Stat
          label="Tekanan stok"
          value={
            asset.factorBps === 0
              ? "Netral"
              : `${asset.factorBps > 0 ? "+" : "−"}${formatBps(Math.abs(asset.factorBps))}`
          }
        />
        <Stat label="Batas pegang" value={`${formatNumber(held)} / ${formatNumber(cap)} unit`} />
      </dl>

      <div className="bg-field rounded-row flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3.5 py-3">
        <p className="text-ink-muted text-[13px] font-semibold">Dimiliki</p>
        {holding && held > 0 ? (
          <p className="tnum text-ink text-sm font-bold">
            {formatNumber(held)} unit · rata-rata {formatRupiah(holding.avgCost)}
            {pnl === null ? null : (
              <span
                className={cn(
                  "ml-2",
                  pnl > 0 ? "text-cyan-text" : pnl < 0 ? "text-bad-text" : "text-ink-muted",
                )}
              >
                {pnl > 0 ? "▲ " : pnl < 0 ? "▼ " : ""}
                {formatSignedRupiah(pnl)} bila dijual
              </span>
            )}
          </p>
        ) : (
          <p className="text-ink-muted text-sm">Belum punya aset ini.</p>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-field rounded-control flex min-w-0 flex-col gap-0.5 px-2.5 py-2">
      <dt className="text-ink-muted text-[11px] font-semibold tracking-[0.06em]">{label}</dt>
      <dd className="tnum text-ink truncate text-sm font-bold">{value}</dd>
    </div>
  );
}
