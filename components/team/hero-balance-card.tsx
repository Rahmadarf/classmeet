"use client";

import { Eye, EyeOff, Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatRupiah } from "@/lib/money";
import type { Summary } from "@/lib/team/data";
import { cn } from "@/lib/utils";

const MASK = "Rp ••••••";

/**
 * Kartu hero Beranda (docs/07 §2.1; DESIGN.md §6 HeroBalanceCard; Figma `Tim — Beranda`, 1082:102).
 * TIGA angka: Total (= saldo + nilai aset, termasuk saldo tertahan di order), Saldo saat ini, Nilai aset.
 * Nilai aset memakai HARGA PERINGKAT (VWAP 10 menit), bukan harga terakhir di halaman Pasar; ikon info
 * membuka tooltip yang menjelaskan perbedaannya. Tombol mata menyembunyikan semua angka.
 * Tidak ada tombol lain (tanpa "Ke Pasar").
 */
export function HeroBalanceCard({
  summary,
  unavailable = false,
}: {
  summary: Summary | null;
  unavailable?: boolean;
}) {
  const [hidden, setHidden] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);
  const [tipOffset, setTipOffset] = useState(14);
  const assetColumn = useRef<HTMLDivElement>(null);
  const tipTrigger = useRef<HTMLButtonElement>(null);

  // Tooltip diletakkan di kanan KOLOM "Nilai aset" (bukan di kanan ikon), supaya tidak menutup angka
  // Saldo, Nilai aset, atau Total (DESIGN.md §6; Figma 1133:415).
  const changeTip = (open: boolean) => {
    if (open && assetColumn.current && tipTrigger.current) {
      const gap =
        assetColumn.current.getBoundingClientRect().right - tipTrigger.current.getBoundingClientRect().right;
      setTipOffset(Math.max(14, Math.round(gap) + 16));
    }
    setTipOpen(open);
  };

  // Dibuka lewat ketukan (layar sentuh tidak punya hover), jadi ketukan di mana pun di luar ikon menutupnya.
  useEffect(() => {
    if (!tipOpen) return;
    const close = (event: PointerEvent) => {
      if (!tipTrigger.current?.contains(event.target as Node)) setTipOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [tipOpen]);

  const show = (value: number | undefined) => (summary && value !== undefined ? formatRupiah(value) : "Rp –");
  const text = (value: number | undefined) => (hidden ? MASK : show(value));

  return (
    <TooltipProvider delayDuration={150}>
      <section
        aria-label="Ringkasan uang tim"
        className="rounded-panel text-on-primary shadow-hero flex flex-col gap-5 p-8"
        style={{ backgroundImage: "var(--hero)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-[0.12em] uppercase">Total</h2>
          <button
            type="button"
            onClick={() => setHidden((h) => !h)}
            aria-pressed={hidden}
            aria-label={hidden ? "Tampilkan angka" : "Sembunyikan angka"}
            className="rounded-control grid size-11 place-items-center bg-white/20 transition-colors hover:bg-white/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {hidden ? (
              <EyeOff className="size-[22px]" aria-hidden />
            ) : (
              <Eye className="size-[22px]" aria-hidden />
            )}
          </button>
        </div>

        <div>
          <p className="money text-[48px] leading-[1.1] font-bold">{text(summary?.netWorth)}</p>
          {!hidden && summary && summary.lockedCash > 0 ? (
            <p className="money mt-2 text-sm font-medium">
              Termasuk {formatRupiah(summary.lockedCash)} yang tertahan di order
            </p>
          ) : null}
          {unavailable ? (
            <p role="status" className="mt-2 text-sm font-medium">
              Data belum bisa dimuat, mencoba lagi…
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium tracking-[0.12em] uppercase">Saldo</p>
            <p className="money text-[22px] font-bold">{text(summary?.cash)}</p>
          </div>

          <div ref={assetColumn} className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium tracking-[0.12em] uppercase">Nilai aset</p>
              <Tooltip open={tipOpen} onOpenChange={changeTip}>
                <TooltipTrigger asChild>
                  <button
                    ref={tipTrigger}
                    type="button"
                    aria-label="Apa itu harga peringkat?"
                    onClick={() => changeTip(true)}
                    className={cn(
                      "relative grid size-6 place-items-center rounded-full transition-colors before:absolute before:-inset-2.5 before:content-[''] hover:bg-white/[.22]",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
                      tipOpen && "bg-white/[.22]",
                    )}
                  >
                    <Info className="size-3.5" aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" align="center" sideOffset={tipOffset} className="w-[344px]">
                  <p className="text-ink mb-1.5 text-[13px] font-semibold">Harga peringkat</p>
                  <p>
                    Nilai aset dihitung dari rata-rata harga transaksi 10 menit terakhir, bukan harga
                    terakhir. Peringkat memakai angka ini, jadi satu transaksi kecil tidak langsung menggeser
                    nilai.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <p className="money text-[22px] font-bold">{text(summary?.holdingsValue)}</p>
          </div>
        </div>
      </section>
    </TooltipProvider>
  );
}
