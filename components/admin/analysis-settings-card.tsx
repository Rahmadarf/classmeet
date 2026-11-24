"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { setAnalysisSettings } from "@/app/admin/assets/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { AnalysisSettings } from "@/lib/admin/data";
import { formatRupiah } from "@/lib/money";
import { cn } from "@/lib/utils";

/** "200.000" / "200000" / "Rp 200.000" → 200000; kosong atau bukan angka → null. */
const toRupiah = (text: string): number | null => {
  const digits = text.replace(/[^\d]/g, "");
  return digits === "" ? null : Number(digits);
};

/**
 * Analisa Pasar (pay to win): harga laporan dan saklar. TIDAK terkunci seperti pengaturan toko: boleh diubah kapan saja,
 * termasuk saat game berjalan; berlaku untuk pembelian berikutnya (yang sudah membeli tidak terpengaruh). Admin tidak
 * melihat isi laporan; log pembelian ada di halaman Transaksi.
 */
export function AnalysisSettingsCard({ initial }: { initial: AnalysisSettings }) {
  const [price, setPrice] = useState(String(initial.price));
  const [enabled, setEnabled] = useState(initial.enabled);
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = toRupiah(price);
  const dirty = parsed !== saved.price || enabled !== saved.enabled;

  const save = async () => {
    setError(null);
    if (parsed === null) {
      setError("Harga harus berupa angka.");
      return;
    }
    setSaving(true);
    try {
      const res = await setAnalysisSettings({ price: parsed, enabled });
      if (res.ok) {
        setSaved({ price: parsed, enabled });
        setPrice(String(parsed));
        toast.success(`Analisa Pasar ${enabled ? "aktif" : "dimatikan"}, harga ${formatRupiah(parsed)}.`);
      } else setError(res.message);
    } catch {
      setError("Koneksi bermasalah. Coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card aria-labelledby="analisa-pengaturan-judul" className="mt-6 flex flex-col gap-3">
      <div>
        <p className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase">
          Analisa Pasar (pay to win)
        </p>
        <h2 id="analisa-pengaturan-judul" className="text-ink text-2xl font-bold">
          Harga dan saklar laporan analisa
        </h2>
      </div>
      <p className="text-ink-muted text-base">
        Tim membeli laporan 4 paragraf tentang berita yang sedang tayang (ciri perusahaan yang akan naik dan
        turun, kekuatan, dan perkiraan waktu). Sekali beli per berita per tim. Uangnya keluar dari saldo tim.
      </p>
      <fieldset disabled={saving} className="flex flex-wrap items-end gap-4">
        <label className="flex w-full max-w-[16rem] min-w-0 flex-col gap-1.5">
          <span className="text-ink-muted text-[13px] font-semibold">Harga (Rp)</span>
          <input
            inputMode="numeric"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            aria-describedby="analisa-harga-bantuan"
            className="rounded-control border-line bg-field text-ink focus:border-brand-text min-h-11 w-full border px-3 text-base disabled:opacity-60"
          />
          <span id="analisa-harga-bantuan" className="text-ink-dim text-xs leading-snug">
            0 = gratis. Sebagai patokan, hadiah pos sekitar Rp 300.000 per kunjungan.
          </span>
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 pb-6">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span
            aria-hidden
            className={cn(
              "rounded-control grid size-7 shrink-0 place-items-center border-2 transition-colors",
              enabled ? "border-primary bg-primary text-on-primary" : "border-line-strong bg-card",
            )}
          >
            {enabled ? <Check className="size-[18px]" /> : null}
          </span>
          <span className="text-ink text-base font-medium">Analisa aktif (tim bisa membeli)</span>
        </label>
      </fieldset>
      {error ? (
        <p role="alert" className="text-bad-text text-sm font-medium">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" loading={saving} disabled={!dirty} onClick={() => void save()}>
          Simpan
        </Button>
        <p className="text-ink-muted text-sm">
          Boleh diubah kapan saja, termasuk saat game berjalan. Berlaku untuk pembelian berikutnya.
        </p>
      </div>
    </Card>
  );
}
