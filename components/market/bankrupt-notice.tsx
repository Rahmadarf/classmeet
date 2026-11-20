import { TrendingDown } from "lucide-react";
import type { BankruptAsset } from "@/lib/market/data";
import { formatRupiah } from "@/lib/money";

/**
 * Pemberitahuan aset bangkrut di atas papan Pasar. Aset itu sudah hilang dari daftar dan tidak bisa dibeli atau dijual;
 * unit yang dipegang tim dilikuidasi ke saldo (event berita, scripts/sql/event-bankruptcy.sql).
 */
export function BankruptNotice({ assets }: { assets: BankruptAsset[] }) {
  if (assets.length === 0) return null;
  return (
    <ul aria-label="Aset bangkrut" className="flex flex-col gap-2">
      {assets.map((a) => (
        <li
          key={a.id}
          role="status"
          className="rounded-panel border-bad-text bg-card shadow-card text-ink flex min-h-14 items-center gap-3.5 border px-5 py-3.5"
        >
          <TrendingDown className="text-bad-text size-[22px] shrink-0" aria-hidden />
          <p className="min-w-0 flex-1 text-lg font-semibold">
            <span className="text-bad-text mr-3 text-xs font-bold tracking-[0.12em] uppercase">Bangkrut</span>
            {a.name} ({a.symbol}) tidak bisa diperdagangkan lagi.{" "}
            <span className="text-ink-muted font-medium">
              {a.liquidationPrice === null
                ? "Unit yang dipegang tidak diganti. "
                : `Unit yang dipegang diganti ${formatRupiah(a.liquidationPrice)} per unit ke saldo.`}
            </span>
          </p>
        </li>
      ))}
    </ul>
  );
}
