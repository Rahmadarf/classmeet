import { PauseCircle } from "lucide-react";
import { isSuspended, type MarketAsset } from "@/lib/market/data";
import { formatTimeWib } from "@/lib/money";

/** "5:12" dari sisa milidetik (menit:detik). */
function remaining(ms: number): string {
  const total = Math.max(Math.ceil(ms / 1000), 0);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Pemberitahuan aset yang sedang disuspensi (event berita, scripts/sql/event-dividend-suspend.sql): beli dan jual ditolak
 * sampai waktunya habis. `now` berjalan tiap detik dari papan.
 */
export function SuspendNotice({ assets, now }: { assets: MarketAsset[]; now: number }) {
  const list = assets.filter((a) => isSuspended(a, now));
  if (list.length === 0) return null;
  return (
    <ul aria-label="Aset disuspensi" className="flex flex-col gap-2">
      {list.map((a) => (
        <li
          key={a.id}
          role="status"
          className="rounded-panel border-accent bg-accent/12 text-ink flex min-h-14 items-center gap-3.5 border px-5 py-3.5"
        >
          <PauseCircle className="text-accent-text size-[22px] shrink-0" aria-hidden />
          <p className="min-w-0 flex-1 text-lg font-semibold">
            <span className="text-accent-text mr-3 text-xs font-bold tracking-[0.12em] uppercase">
              Suspensi
            </span>
            {a.name} ({a.symbol}) dihentikan sementara.{" "}
            <span className="text-ink-muted font-medium">
              Beli dan jual belum bisa dilakukan sampai {formatTimeWib(a.suspendedUntil as string)} WIB (
              <span className="tnum">{remaining(Date.parse(a.suspendedUntil as string) - now)}</span> lagi).
            </span>
          </p>
        </li>
      ))}
    </ul>
  );
}
