import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Tabel sungguhan (<table>) supaya terbaca pembaca layar; baris dibuat seperti kartu abu-biru Figma
 * (radius baris 14) dengan `border-spacing`. Digulir mendatar bila layar sempit.
 */
export function DataTable({
  caption,
  head,
  widths,
  minWidth = 900,
  align,
  children,
}: {
  caption: string;
  head: string[];
  /** Lebar kolom (px); sisa ruang dibagi rata bila kolomnya lebih sedikit dari kepala tabel. */
  widths: number[];
  /** Lebar minimum tabel (px) sebelum digulir mendatar. */
  minWidth?: number;
  /** Rata kolom per indeks (bawaan kiri); kepala mengikuti supaya sejajar dengan angka. */
  align?: ("left" | "right")[];
  children: React.ReactNode;
}) {
  return (
    <div
      className="-mx-1 overflow-x-auto px-1"
      style={{ "--table-min": `${minWidth}px` } as React.CSSProperties}
    >
      <table
        className={cn(
          "w-full min-w-[var(--table-min,900px)] table-fixed border-separate border-spacing-x-0 border-spacing-y-2 text-left text-sm",
          "[&_tbody_td]:bg-field [&_tbody_td]:text-ink [&_tbody_td]:px-3 [&_tbody_td]:py-3",
          "[&_tbody_td:first-child]:rounded-l-row [&_tbody_td:last-child]:rounded-r-row",
        )}
      >
        <caption className="sr-only">{caption}</caption>
        <colgroup>
          {head.map((_, i) => (
            <col key={i} style={widths[i] ? { width: widths[i] } : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th
                key={i}
                scope="col"
                className={cn(
                  "text-ink-muted px-3 py-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase",
                  align?.[i] === "right" && "text-right",
                )}
              >
                {h === "" ? <span className="sr-only">Aksi</span> : h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
