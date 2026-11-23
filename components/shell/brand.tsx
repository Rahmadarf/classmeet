/**
 * Lambang + nama acara: logo ISSC berwarna (`BrandMark`, menggantikan lingkaran oranye "C" sementara, 23 Nov) + "CLASSMEET"
 * tebal dan "MARKET" kapital berjarak.
 */
import { BrandMark } from "./brand-mark";

export function Brand({ subtitle = "Market" }: { subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <BrandMark />
      <span className="text-ink flex flex-col leading-tight">
        <span className="text-[17px] font-bold">CLASSMEET</span>
        <span className="text-[11px] font-semibold tracking-[0.2em] uppercase">{subtitle}</span>
      </span>
    </div>
  );
}
