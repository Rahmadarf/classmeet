/**
 * Lambang + nama acara (Figma `Kiosk — Scan QR`, node 1084:321): lingkaran oranye 40 px berisi "C"
 * (oranye = lambang, DESIGN.md §2.3) + "CLASSMEET" tebal dan "MARKET" kapital berjarak.
 * Logo resmi belum diputuskan (DESIGN.md §11); ini pengganti sementara yang mengikuti Figma.
 */
export function Brand({ subtitle = "Market" }: { subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className="bg-accent text-ink-on-accent grid size-10 shrink-0 place-items-center rounded-full text-[22px] leading-none font-bold"
      >
        C
      </span>
      <span className="text-ink flex flex-col leading-tight">
        <span className="text-[17px] font-bold">CLASSMEET</span>
        <span className="text-[11px] font-semibold tracking-[0.2em] uppercase">{subtitle}</span>
      </span>
    </div>
  );
}
