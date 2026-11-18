"use client";

import { useEffect, useId, useState } from "react";
import { setNewsBankruptcy, setNewsEvent } from "@/app/admin/news/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { NewsAssetOption, NewsDraft } from "@/lib/admin/data";
import type { ActionResult } from "@/lib/schemas/common";
import { cn } from "@/lib/utils";

type Kind = "bankrupt" | "dividend" | "suspend";

/** Teks dan batas isian tiap jenis event (scripts/sql/event-bankruptcy.sql dan event-dividend-suspend.sql). */
const KINDS: Record<
  Kind,
  { label: string; field: string; unit: string; min: number; max: number; initial: string; help: string }
> = {
  bankrupt: {
    label: "Bangkrut",
    field: "Penggantian unit (% dari harga acuan)",
    unit: "%",
    min: 0,
    max: 50,
    initial: "10",
    help: "Order antre dibatalkan, unit yang dipegang tim diganti uang, aset hilang dari Pasar. 0 % membuat unit tidak bernilai. Hanya satu aset bangkrut per berita.",
  },
  dividend: {
    label: "Dividen",
    field: "Dividen per unit (% dari harga acuan)",
    unit: "%",
    min: 1,
    max: 10,
    initial: "2",
    help: "Tiap tim yang memegang aset itu menerima uang sebesar jumlah unit × dividen per unit. Harga tidak dipotong.",
  },
  suspend: {
    label: "Suspensi",
    field: "Lama suspensi (menit)",
    unit: "menit",
    min: 1,
    max: 30,
    initial: "5",
    help: "Aset tidak bisa diorder selama itu dan bandar menarik kuotasinya. Order antre masih bisa dibatalkan.",
  },
};

/** Satu baris event yang sudah terpasang pada berita ini. */
type Item = { key: string; kind: Kind; assetId: string; text: string };

function itemsOf(news: NewsDraft | null): Item[] {
  if (!news) return [];
  const out: Item[] = [];
  if (news.bankruptcy)
    out.push({
      key: `b-${news.bankruptcy.assetId}`,
      kind: "bankrupt",
      assetId: news.bankruptcy.assetId,
      text: `Bangkrut: ${news.bankruptcy.symbol} · unit diganti ${news.bankruptcy.pct} % harga acuan`,
    });
  for (const e of news.events)
    out.push({
      key: `${e.kind}-${e.assetId}`,
      kind: e.kind,
      assetId: e.assetId,
      text:
        e.kind === "dividend"
          ? `Dividen: ${e.symbol} · ${e.amount} % harga acuan per unit`
          : `Suspensi: ${e.symbol} · ${e.amount} menit`,
    });
  return out;
}

/**
 * Event aset pada satu berita draf: bangkrut, dividen, atau suspensi. Berlaku saat efek berita itu berlaku (sistem yang
 * menjalankan). Hanya SEBELUM game dibuka; database yang memutuskan. Satu berita boleh membawa beberapa event; satu aset
 * tidak boleh bangkrut sekaligus menerima event lain di berita yang sama.
 */
export function NewsEventDialog({
  open,
  onOpenChange,
  news,
  assets,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  news: NewsDraft | null;
  assets: NewsAssetOption[];
  /** `other` = jumlah berita lain yang masih menyebut aset bangkrut itu (berita itu gagal terbit). */
  onDone: (message: string, other: number) => void;
}) {
  const uid = useId();
  const [kind, setKind] = useState<Kind>("dividend");
  const [assetId, setAssetId] = useState("");
  const [value, setValue] = useState(KINDS.dividend.initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      setKind("dividend");
      setAssetId("");
      setValue(KINDS.dividend.initial);
      setError(null);
    }, 0);
    return () => window.clearTimeout(id);
  }, [open, news?.id]);

  const spec = KINDS[kind];
  const items = itemsOf(news);

  const chooseKind = (next: Kind) => {
    setKind(next);
    setValue(KINDS[next].initial);
    setError(null);
  };

  const finish = (res: ActionResult<number> | ActionResult, message: string) => {
    if (res.ok) {
      onOpenChange(false);
      onDone(message, typeof res.data === "number" ? res.data : 0);
    } else setError(res.message);
  };

  const add = async () => {
    if (busy || !news) return;
    const n = Number(value);
    if (!assetId) return setError("Pilih aset.");
    if (value.trim() === "" || !Number.isInteger(n) || n < spec.min || n > spec.max)
      return setError(`${spec.field}: isi ${spec.min}–${spec.max}.`);
    setBusy(true);
    try {
      const res =
        kind === "bankrupt"
          ? await setNewsBankruptcy({ newsId: news.id, assetId, liquidationPct: n })
          : await setNewsEvent({ newsId: news.id, assetId, kind, amount: n });
      finish(res, `Event ${spec.label.toLowerCase()} dipasang pada berita.`);
    } catch {
      setError("Koneksi bermasalah. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item: Item) => {
    if (busy || !news) return;
    setBusy(true);
    try {
      const res =
        item.kind === "bankrupt"
          ? await setNewsBankruptcy({ newsId: news.id, assetId: null, liquidationPct: 10 })
          : await setNewsEvent({ newsId: news.id, assetId: item.assetId, kind: item.kind, amount: null });
      finish(res, "Event dilepas dari berita.");
    } catch {
      setError("Koneksi bermasalah. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  const field =
    "rounded-control border-line bg-field text-ink min-h-12 w-full border px-4 text-lg focus:border-brand-text disabled:opacity-60";

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="w-[min(580px,92vw)]">
        <p className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase">Event aset</p>
        <DialogTitle className="text-ink mt-1 pr-12 text-2xl leading-tight font-semibold">
          {news?.title ?? "Berita"}
        </DialogTitle>
        <DialogDescription className="text-ink-muted mt-2 text-base">
          Event berjalan saat berita ini berlaku. Berita tetap perlu 4–7 aset berefek harga; aset yang
          bangkrut tidak boleh ada di antaranya.
        </DialogDescription>

        {items.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2" aria-label="Event terpasang">
            {items.map((item) => (
              <li
                key={item.key}
                className="bg-field rounded-row flex items-center justify-between gap-3 px-4 py-2.5"
              >
                <span
                  className={cn(
                    "text-base font-semibold",
                    item.kind === "bankrupt" ? "text-bad-text" : "text-ink",
                  )}
                >
                  {item.text}
                </span>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={busy}
                  aria-label={`Lepas ${item.text}`}
                  onClick={() => void remove(item)}
                >
                  Lepas
                </Button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-4 flex flex-col gap-4">
          <div role="group" aria-label="Jenis event" className="flex gap-2">
            {(Object.keys(KINDS) as Kind[]).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => chooseKind(k)}
                className={cn(
                  "min-h-10 rounded-full border px-4 py-2 text-[15px] font-semibold transition-colors",
                  kind === k
                    ? "border-primary bg-nav-active text-brand-text"
                    : "border-line text-ink-muted hover:bg-soft",
                )}
              >
                {KINDS[k].label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${uid}-asset`} className="text-ink text-[15px] font-semibold">
              Aset
            </label>
            <select
              id={`${uid}-asset`}
              value={assetId}
              onChange={(e) => (setAssetId(e.target.value), setError(null))}
              className={field}
            >
              <option value="">Pilih aset…</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.symbol} · {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${uid}-val`} className="text-ink text-[15px] font-semibold">
              {spec.field}
            </label>
            <input
              id={`${uid}-val`}
              inputMode="numeric"
              autoComplete="off"
              value={value}
              onChange={(e) => (setValue(e.target.value.replace(/\D/g, "").slice(0, 2)), setError(null))}
              className={cn(field, "tnum w-32")}
            />
            <p className="text-ink-muted text-sm">{spec.help}</p>
          </div>

          {error ? (
            <p role="alert" className="text-bad-text text-base font-semibold">
              {error}
            </p>
          ) : null}
          <p className="text-ink-muted text-sm">
            Tercatat di Audit dengan nama admin. Terkunci setelah game dibuka.
          </p>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Batal
          </Button>
          <Button onClick={() => void add()} loading={busy} loadingText="Menyimpan…">
            Pasang event
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
