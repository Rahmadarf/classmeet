import { ArrowDown, ArrowUp, ClipboardList, Info } from "lucide-react";
import { ANALYSIS_SECTIONS, type AnalysisReport } from "@/lib/analysis/view";
import { formatDateWib, formatRupiah, formatTimeSecondsWib } from "@/lib/money";
import { cn } from "@/lib/utils";

const ICONS = {
  summary: { Icon: ClipboardList, tone: "text-brand-text" },
  up: { Icon: ArrowUp, tone: "text-ok-text" },
  down: { Icon: ArrowDown, tone: "text-bad-text" },
  notes: { Icon: Info, tone: "text-ink-muted" },
} as const;

/**
 * Isi laporan Analisa Pasar: tepat 4 bagian (ringkasan, ciri naik, ciri turun, catatan), dipakai di dialog Pasar dan di
 * rincian Riwayat. Tanda panah dan judul bagian, bukan hanya warna. Teks laporan SELALU teks biasa.
 */
export function AnalysisReportBody({ report }: { report: AnalysisReport }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="tnum text-ink-dim text-sm">
        Dibeli {formatDateWib(report.createdAt)} · {formatTimeSecondsWib(report.createdAt)} WIB ·{" "}
        {formatRupiah(report.price)}
      </p>
      {ANALYSIS_SECTIONS.map((section, i) => {
        const { Icon, tone } = ICONS[section.key];
        const text = report.paragraphs[i];
        if (!text) return null;
        return (
          <section key={section.key} aria-label={section.title} className="flex flex-col gap-1.5">
            <h3 className={cn("flex items-center gap-2 text-base font-bold", tone)}>
              <Icon className="size-[18px]" aria-hidden />
              {section.title}
            </h3>
            <p className="text-ink text-base leading-relaxed">{text}</p>
          </section>
        );
      })}
      <p className="text-ink-muted text-sm">
        Laporan ini hanya untuk timmu. Perkiraan waktu dihitung saat laporan dibeli. Ciri perusahaan dapat
        dicocokkan dengan kamus sifat aset.
      </p>
    </div>
  );
}
