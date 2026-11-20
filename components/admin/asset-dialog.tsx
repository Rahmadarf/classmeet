"use client";

import { useEffect, useId, useState } from "react";
import { setStock, upsertAsset } from "@/app/admin/assets/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { AdminAsset } from "@/lib/admin/data";
import { formatNumber, groupThousands } from "@/lib/money";
import type { ActionResult } from "@/lib/schemas/common";
import { cn } from "@/lib/utils";

const digits = (text: string): number | null => {
  const d = text.replace(/\D/g, "");
  return d === "" || d.length > 12 ? null : Number(d);
};
const group = (text: string) => (text.replace(/\D/g, "") === "" ? "" : groupThousands(digits(text) ?? 0));

type Form = {
  symbol: string;
  name: string;
  sector: string;
  price: string;
  min: string;
  max: string;
  stock: string;
  active: boolean;
  reason: string;
};

const empty: Form = {
  symbol: "",
  name: "",
  sector: "",
  price: "",
  min: "",
  max: "",
  stock: "",
  active: true,
  reason: "",
};
const fromAsset = (a: AdminAsset): Form => ({
  symbol: a.symbol,
  name: a.name,
  sector: a.sector,
  price: groupThousands(a.price),
  min: groupThousands(a.min),
  max: groupThousands(a.max),
  stock: String(a.stock),
  active: a.active,
  reason: "",
});

/**
 * Tambah / ubah aset (docs/04 §3.9).
 *  - SEBELUM game dibuka: semua isian (kode, nama, sektor, harga acuan, rentang, stok, aktif) lewat `admin_upsert_asset`.
 *  - SESUDAH game dibuka: hanya STOK (dengan alasan wajib) lewat `admin_set_stock`; harga, rentang, dan status
 *    terkunci (database menolak, jadi isiannya tidak ditawarkan).
 * `asset` null = aset baru (hanya mungkin sebelum game dibuka). Validasi klien hanya untuk kemudahan; database tetap memutuskan.
 */
export function AssetDialog({
  open,
  onOpenChange,
  asset,
  locked,
  sectors,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: AdminAsset | null;
  locked: boolean;
  sectors: string[];
  onDone: (message: string) => void;
}) {
  const uid = useId();
  const [f, setF] = useState<Form>(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      setF(asset ? fromAsset(asset) : empty);
      setError(null);
    }, 0);
    return () => window.clearTimeout(id);
  }, [open, asset]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setF((prev) => ({ ...prev, [key]: value }));
    setError(null);
  };

  const submit = async () => {
    if (busy) return;
    const stock = digits(f.stock);
    if (stock === null) return setError("Isi stok (angka, boleh 0).");
    setBusy(true);
    let res: ActionResult;
    try {
      if (locked) {
        if (!asset) return setError("Aset baru tidak bisa ditambah setelah game dibuka.");
        if (f.reason.trim().length < 3) return setError("Alasan wajib diisi (minimal 3 huruf).");
        res = await setStock({ assetId: asset.id, stock, reason: f.reason });
      } else {
        const price = digits(f.price);
        const min = digits(f.min);
        const max = digits(f.max);
        if (!/^[A-Za-z0-9]{2,8}$/.test(f.symbol.trim())) return setError("Kode 2–8 huruf atau angka.");
        if (!f.name.trim() || !f.sector.trim()) return setError("Nama dan sektor wajib diisi.");
        if (price === null || min === null || max === null || price <= 0 || min <= 0)
          return setError("Isi harga acuan dan rentang harga.");
        if (max < min || price < min || price > max)
          return setError("Harga acuan harus di antara minimum dan maksimum.");
        res = await upsertAsset({
          assetId: asset?.id ?? null,
          symbol: f.symbol,
          name: f.name,
          sector: f.sector,
          price,
          minPrice: min,
          maxPrice: max,
          stock,
          active: f.active,
        });
      }
    } catch {
      res = { ok: false, message: "Koneksi bermasalah. Coba lagi.", code: null, retryable: true };
    } finally {
      setBusy(false);
    }
    if (res.ok) {
      onOpenChange(false);
      onDone(locked ? "Stok disimpan." : asset ? "Aset diperbarui." : "Aset ditambahkan.");
    } else setError(res.message);
  };

  const field =
    "rounded-control border-line bg-field text-ink min-h-12 w-full border px-4 text-lg focus:border-brand-text disabled:opacity-60";
  const label = "text-ink text-[15px] font-semibold";

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="w-[min(560px,92vw)]">
        <p className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase">
          {asset ? (locked ? "Ubah stok" : "Ubah aset") : "Tambah aset"}
        </p>
        <DialogTitle className="text-ink mt-1 pr-12 text-2xl leading-tight font-semibold">
          {asset ? `${asset.name} (${asset.symbol})` : "Aset baru"}
        </DialogTitle>
        <DialogDescription className="sr-only">Formulir aset. Perubahan tercatat di audit.</DialogDescription>

        <div className="mt-4 flex flex-col gap-4">
          {locked ? (
            <>
              <p className="text-ink-muted rounded-row bg-field px-4 py-3 text-base">
                Game sudah dimulai: harga acuan ({asset ? formatNumber(asset.price) : "–"}), rentang, dan
                status aktif terkunci. Hanya stok pasar yang bisa diubah.
              </p>
              <Field id={`${uid}-stock`} label="Stok pasar" className={label}>
                <input
                  id={`${uid}-stock`}
                  inputMode="numeric"
                  autoComplete="off"
                  value={f.stock}
                  onChange={(e) => set("stock", e.target.value.replace(/\D/g, ""))}
                  className={cn(field, "tnum")}
                />
              </Field>
              <Field id={`${uid}-reason`} label="Alasan (wajib)" className={label}>
                <input
                  id={`${uid}-reason`}
                  value={f.reason}
                  maxLength={300}
                  onChange={(e) => set("reason", e.target.value)}
                  className={field}
                />
              </Field>
            </>
          ) : (
            <>
              <div className="grid grid-cols-[130px_1fr] gap-3">
                <Field id={`${uid}-sym`} label="Kode" className={label}>
                  <input
                    id={`${uid}-sym`}
                    value={f.symbol}
                    maxLength={8}
                    autoCapitalize="characters"
                    autoComplete="off"
                    onChange={(e) => set("symbol", e.target.value.toUpperCase())}
                    className={field}
                  />
                </Field>
                <Field id={`${uid}-name`} label="Nama" className={label}>
                  <input
                    id={`${uid}-name`}
                    value={f.name}
                    maxLength={80}
                    autoComplete="off"
                    onChange={(e) => set("name", e.target.value)}
                    className={field}
                  />
                </Field>
              </div>
              <Field id={`${uid}-sector`} label="Sektor" className={label}>
                <input
                  id={`${uid}-sector`}
                  list={`${uid}-sectors`}
                  value={f.sector}
                  maxLength={60}
                  autoComplete="off"
                  onChange={(e) => set("sector", e.target.value)}
                  className={field}
                />
                <datalist id={`${uid}-sectors`}>
                  {sectors.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field id={`${uid}-price`} label="Harga acuan" className={label}>
                  <input
                    id={`${uid}-price`}
                    inputMode="numeric"
                    autoComplete="off"
                    value={f.price}
                    onChange={(e) => set("price", group(e.target.value))}
                    className={cn(field, "tnum px-3")}
                  />
                </Field>
                <Field id={`${uid}-min`} label="Harga min" className={label}>
                  <input
                    id={`${uid}-min`}
                    inputMode="numeric"
                    autoComplete="off"
                    value={f.min}
                    onChange={(e) => set("min", group(e.target.value))}
                    className={cn(field, "tnum px-3")}
                  />
                </Field>
                <Field id={`${uid}-max`} label="Harga maks" className={label}>
                  <input
                    id={`${uid}-max`}
                    inputMode="numeric"
                    autoComplete="off"
                    value={f.max}
                    onChange={(e) => set("max", group(e.target.value))}
                    className={cn(field, "tnum px-3")}
                  />
                </Field>
              </div>
              <Field id={`${uid}-stock`} label="Stok pasar" className={label}>
                <input
                  id={`${uid}-stock`}
                  inputMode="numeric"
                  autoComplete="off"
                  value={f.stock}
                  onChange={(e) => set("stock", e.target.value.replace(/\D/g, ""))}
                  className={cn(field, "tnum")}
                />
              </Field>
              <label className="flex min-h-11 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={f.active}
                  onChange={(e) => set("active", e.target.checked)}
                  className="size-5"
                />
                <span className="text-ink text-lg">Aset aktif (bisa diperdagangkan)</span>
              </label>
            </>
          )}

          {error ? (
            <p role="alert" className="text-bad-text text-base font-semibold">
              {error}
            </p>
          ) : null}
          <p className="text-ink-muted text-sm">Tercatat di Audit dengan nama admin.</p>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Batal
          </Button>
          <Button onClick={() => void submit()} loading={busy} loadingText="Menyimpan…">
            Simpan
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  className,
  children,
}: {
  id: string;
  label: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className={className}>
        {label}
      </label>
      {children}
    </div>
  );
}
