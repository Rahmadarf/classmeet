"use client";

import { useState } from "react";
import { toast } from "sonner";
import { setTradeSettings } from "@/app/admin/assets/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { TradeSettings } from "@/lib/admin/data";

/** 200 → "2"; 20 → "0,2" (basis poin → persen, koma desimal, tanpa nol di belakang). */
const pct = (bps: number) => String(bps / 100).replace(".", ",");
/** "0,2" → 20; teks kosong atau bukan angka → null. */
const toBps = (text: string): number | null => {
  const n = Number(text.trim().replace(",", "."));
  return text.trim() !== "" && Number.isFinite(n) ? Math.round(n * 100) : null;
};
const toInt = (text: string): number | null => {
  const n = Number(text.trim());
  return text.trim() !== "" && Number.isInteger(n) ? n : null;
};

/**
 * Pengaturan toko (docs/17 §4): selisih jual, tekanan stok per unit, batas tekanan, lama pemulihan, dan batas pegang.
 * Bisa diubah SEBELUM game dibuka; sesudahnya terkunci oleh database dan kartu ini hanya menampilkan nilainya.
 */
export function TradeSettingsCard({ initial, locked }: { initial: TradeSettings; locked: boolean }) {
  const [spread, setSpread] = useState(pct(initial.sellSpreadBps));
  const [pressure, setPressure] = useState(pct(initial.pressureBpsPerUnit));
  const [cap, setCap] = useState(pct(initial.pressureCapBps));
  const [decay, setDecay] = useState(String(initial.pressureDecayMinutes));
  const [hold, setHold] = useState(String(initial.holdCapPct));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const field =
    "rounded-control border-line bg-field text-ink min-h-11 w-full border px-3 text-base focus:border-brand-text disabled:opacity-60";

  const save = async () => {
    setError(null);
    const input = {
      sellSpreadBps: toBps(spread),
      pressureBpsPerUnit: toBps(pressure),
      pressureCapBps: toBps(cap),
      pressureDecayMinutes: toInt(decay),
      holdCapPct: toInt(hold),
    };
    if (Object.values(input).some((v) => v === null)) {
      setError("Semua isian harus berupa angka.");
      return;
    }
    setSaving(true);
    try {
      const res = await setTradeSettings(input);
      if (res.ok) toast.success("Pengaturan toko disimpan.");
      else setError(res.message);
    } catch {
      setError("Koneksi bermasalah. Coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card aria-labelledby="toko-judul" className="flex flex-col gap-3">
      <div>
        <p className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase">
          Pengaturan toko
        </p>
        <h2 id="toko-judul" className="text-ink text-2xl font-bold">
          Selisih jual, tekanan stok, batas pegang
        </h2>
      </div>
      <fieldset disabled={locked || saving} className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Selisih jual (%)" hint="Harga jual = harga beli dikurangi ini">
          <input
            inputMode="decimal"
            value={spread}
            onChange={(e) => setSpread(e.target.value)}
            className={field}
          />
        </Field>
        <Field label="Tekanan per unit (%)" hint="Harga naik tiap unit dibeli">
          <input
            inputMode="decimal"
            value={pressure}
            onChange={(e) => setPressure(e.target.value)}
            className={field}
          />
        </Field>
        <Field label="Batas tekanan (%)" hint="Maksimal dari harga acuan">
          <input inputMode="decimal" value={cap} onChange={(e) => setCap(e.target.value)} className={field} />
        </Field>
        <Field label="Pulih penuh (menit)" hint="Tekanan kembali netral">
          <input
            inputMode="numeric"
            value={decay}
            onChange={(e) => setDecay(e.target.value)}
            className={field}
          />
        </Field>
        <Field label="Batas pegang (% stok awal)" hint="Per aset per tim, minimal 1 unit">
          <input
            inputMode="numeric"
            value={hold}
            onChange={(e) => setHold(e.target.value)}
            className={field}
          />
        </Field>
      </fieldset>
      {error ? (
        <p role="alert" className="text-bad-text text-sm font-medium">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" loading={saving} disabled={locked} onClick={() => void save()}>
          Simpan pengaturan
        </Button>
        <p className="text-ink-muted text-sm">
          {locked
            ? "Game sudah dimulai: pengaturan toko terkunci dan tidak bisa diubah."
            : "Bisa diubah sampai pasar pertama dibuka; sesudahnya terkunci."}
        </p>
      </div>
    </Card>
  );
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-ink-muted text-[13px] font-semibold">{label}</span>
      {children}
      <span className="text-ink-dim text-xs leading-snug">{hint}</span>
    </label>
  );
}
