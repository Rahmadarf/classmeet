"use client";

import { Minus, Plus } from "lucide-react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { placeOrder } from "@/app/team/market/actions";
import type { Band, Game, Holding, MarketAsset, OrderBook } from "@/lib/market/data";
import { estimateSweep, formatBps, maxAffordableLots, stepDown, stepUp } from "@/lib/market/rules";
import { formatNumber, formatRupiah, groupThousands, orderFee, tickFor } from "@/lib/money";
import { cn } from "@/lib/utils";

type Side = "buy" | "sell";
type Kind = "limit" | "market";
type FieldErrors = { price?: string; qty?: string };

/** Angka dari teks isian (hanya digit); kosong → null. */
function digits(text: string): number | null {
  const d = text.replace(/\D/g, "");
  if (d === "" || d.length > 12) return null;
  return Number(d);
}

const NOT_OPEN_LABEL: Record<Exclude<Game["state"], "open">, string> = {
  setup: "Pasar belum dibuka",
  paused: "Pasar dijeda",
  finished: "Pasar ditutup",
};

/**
 * Form order (Figma `Form order`, 1121:890; frame Jual·Market 1129:1249; error isian 1129:935).
 * Aturan (docs/07 §3.2; docs/04 §3.1):
 *  - Limit: harga (−/+ satu fraksi) + lot. Market: hanya lot (menyapu maks N level, sisa dibatalkan).
 *  - Isian awal harga = harga transaksi terakhir. Isian TIDAK diganti diam-diam bila harga berubah.
 *  - Input tidak dibatasi saldo/kepemilikan di klien; database yang memutuskan, alasan muncul di form.
 *  - Tiap niat pengguna punya `request_id` sendiri; percobaan ulang atas isian yang SAMA memakai id yang sama.
 * Komponen ini diberi `key={asset.id}` oleh pemanggil, jadi isiannya direset saat aset berganti.
 */
export function OrderForm({
  asset,
  initialSide = "buy",
  band,
  game,
  cash,
  holding,
  book,
  suspended = false,
  onChanged,
}: {
  asset: MarketAsset;
  initialSide?: Side;
  band: Band | null;
  game: Game;
  /** Saldo bebas; null bila belum termuat. */
  cash: number | null;
  holding: Holding | undefined;
  book: OrderBook | null;
  /** Aset sedang disuspensi: order baru dinonaktifkan (database juga menolak). */
  suspended?: boolean;
  /** Dipanggil setelah order sukses/ditolak/berubah supaya papan mengambil ulang data. */
  onChanged: () => void;
}) {
  const [side, setSide] = useState<Side>(initialSide);
  const [kind, setKind] = useState<Kind>("limit");
  const [priceText, setPriceText] = useState(() => groupThousands(asset.lastPrice));
  const [qtyText, setQtyText] = useState("1");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const intent = useRef<{ id: string; key: string } | null>(null);
  const uid = useId();

  const marketOpen = game.state === "open";
  const open = marketOpen && !suspended;
  const price = digits(priceText);
  const qty = digits(qtyText);
  const limit = kind === "limit";
  const tick = price ? tickFor(price) : tickFor(asset.lastPrice);
  const available = holding?.available ?? 0;

  const touch = () => {
    setErrors({});
    setFormError(null);
    setResult(null);
  };
  const chooseSide = (next: Side) => {
    setSide(next);
    touch();
  };
  const chooseKind = (next: Kind) => {
    setKind(next);
    touch();
  };

  // --- ringkasan ---
  const buy = side === "buy";
  let summary: { rows: [string, string][]; totalLabel: string; total: string };
  if (limit) {
    const amount = price && qty ? price * qty : null;
    const fee =
      price && qty ? (buy ? qty * orderFee(price, 1, game.feeBps) : orderFee(price, qty, game.feeBps)) : null;
    summary = {
      rows: [
        ["Jumlah", amount === null ? "–" : formatRupiah(amount)],
        [`Biaya ${formatBps(game.feeBps)}`, fee === null ? "–" : formatRupiah(fee)],
      ],
      totalLabel: buy ? "Total dikunci" : "Estimasi diterima",
      total:
        amount === null || fee === null ? "–" : formatRupiah(buy ? amount + fee : Math.max(amount - fee, 0)),
    };
  } else {
    const levels = (buy ? book?.offers : book?.bids) ?? [];
    const e = qty ? estimateSweep(levels, qty, game.sweepLevels, game.feeBps) : null;
    const has = e !== null && e.filled > 0;
    summary = {
      rows: [
        ["Estimasi jumlah", has ? formatRupiah(e.gross) : "–"],
        [`Biaya ${formatBps(game.feeBps)}`, has ? formatRupiah(e.fee) : "–"],
      ],
      totalLabel: buy ? "Estimasi dibayar" : "Estimasi diterima",
      total: has ? formatRupiah(buy ? e.gross + e.fee : Math.max(e.gross - e.fee, 0)) : "–",
    };
  }

  const stepPrice = (dir: 1 | -1) => {
    const base = price ?? asset.lastPrice;
    setPriceText(groupThousands(dir === 1 ? stepUp(base) : stepDown(base)));
    touch();
  };
  const stepQty = (dir: 1 | -1) => {
    setQtyText(String(Math.max((qty ?? 0) + dir, 1)));
    touch();
  };

  const submit = async () => {
    if (submitting || !open) return;
    touch();

    const local: FieldErrors = {};
    if (limit && (price === null || price < 1)) local.price = "Isi harga yang valid.";
    if (qty === null || qty < 1) local.qty = "Isi jumlah lot minimal 1.";
    if (local.price || local.qty) {
      setErrors(local);
      return;
    }

    // Satu `request_id` per niat: dipakai ulang hanya bila isian persis sama (percobaan ulang).
    const key = `${asset.id}|${side}|${kind}|${limit ? price : ""}|${qty}`;
    if (!intent.current || intent.current.key !== key) intent.current = { id: crypto.randomUUID(), key };

    setSubmitting(true);
    try {
      const res = await placeOrder({
        requestId: intent.current.id,
        assetId: asset.id,
        side,
        kind,
        price: limit ? (price ?? undefined) : undefined,
        qty,
      });

      if (res.ok) {
        intent.current = null;
        const o = res.data;
        const filled = o.qty - o.remaining;
        const text = describeResult(
          { kind, qty: o.qty, remaining: o.remaining, filled, status: o.status, price: o.price },
          game.sweepLevels,
        );
        setResult(text);
        if (filled > 0) toast.success(text);
        else toast(text);
        onChanged();
        return;
      }

      const next: FieldErrors = {};
      switch (res.code) {
        case "price_out_of_range":
          next.price = band
            ? price !== null && price > band.hi
              ? `Di atas batas ARA ${formatNumber(band.hi)}. Turunkan harga.`
              : `Di bawah batas ARB ${formatNumber(band.lo)}. Naikkan harga.`
            : res.message;
          break;
        case "invalid_tick":
          next.price = `Harga harus kelipatan Rp ${formatNumber(tick)}.`;
          break;
        case "insufficient_cash":
          if (buy && limit && price !== null && cash !== null) {
            const max = maxAffordableLots(cash, price, game.feeBps);
            next.qty = `Saldo tidak cukup untuk ${qty} lot (maksimal ${max} lot).`;
          } else {
            next.qty = res.message;
          }
          break;
        case "insufficient_holdings":
          next.qty = `Aset tidak cukup untuk dijual ${qty} lot (tersedia ${available} lot).`;
          break;
        default:
          setFormError(res.message);
      }
      if (next.price || next.qty) setErrors(next);
      if (res.code === "market_closed" || res.code === "asset_suspended") onChanged(); // status pasar berubah: segarkan banner dan tombol
    } catch {
      // Jaringan putus / respons tidak terbaca: isian tetap, `request_id` yang sama dipakai saat coba lagi.
      setFormError("Koneksi bermasalah. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  const errorCount = (errors.price ? 1 : 0) + (errors.qty ? 1 : 0);
  const buttonLabel = !marketOpen
    ? NOT_OPEN_LABEL[game.state as Exclude<Game["state"], "open">]
    : suspended
      ? "Aset disuspensi"
      : limit
        ? buy
          ? "Pasang order beli"
          : "Pasang order jual"
        : buy
          ? "Beli sekarang (market)"
          : "Jual sekarang (market)";

  return (
    <section
      aria-label="Form order"
      className="rounded-panel border-line bg-card shadow-card flex flex-col gap-3.5 border p-5"
    >
      <div role="tablist" aria-label="Sisi order" className="rounded-tabs bg-field flex gap-1.5 p-1">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            role="tab"
            type="button"
            aria-selected={side === s}
            onClick={() => chooseSide(s)}
            className={cn(
              "rounded-tab min-h-11 flex-1 py-2.5 text-base transition-colors",
              side === s
                ? "bg-primary text-on-primary font-bold"
                : "text-ink-muted hover:bg-soft font-semibold",
            )}
          >
            {s === "buy" ? "Beli" : "Jual"}
          </button>
        ))}
      </div>

      <div role="group" aria-label="Jenis order" className="flex gap-2">
        {(["limit", "market"] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => chooseKind(k)}
            className={cn(
              "min-h-9 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors",
              kind === k
                ? "border-primary bg-nav-active text-brand-text"
                : "border-line text-ink-muted hover:bg-soft",
            )}
          >
            {k === "limit" ? "Limit" : "Market"}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 text-[13px]">
        {buy ? (
          <>
            <span className="text-ink-muted">Trading Balance</span>
            <span className="money text-ink text-base font-bold">
              {cash === null ? "Rp –" : formatRupiah(cash)}
            </span>
          </>
        ) : (
          <>
            <span className="text-ink-muted">Dimiliki (tersedia)</span>
            <span className="tnum text-ink text-base font-bold">{formatNumber(available)} lot</span>
          </>
        )}
      </div>

      <fieldset
        disabled={!open || submitting}
        className={cn("flex min-w-0 flex-col gap-3.5", !open && "opacity-60")}
      >
        {limit ? (
          <Stepper
            id={`${uid}-price`}
            label="Harga (Rp)"
            value={priceText}
            onChange={(t) => {
              setPriceText(t.replace(/\D/g, "") === "" ? "" : groupThousands(digits(t) ?? 0));
              touch();
            }}
            onStep={stepPrice}
            minusLabel="Turunkan harga satu fraksi"
            plusLabel="Naikkan harga satu fraksi"
            error={errors.price}
            hint={`Naik/turun 1 fraksi = ${formatRupiah(tick)}${band ? ` · batas ARA ${formatNumber(band.hi)} / ARB ${formatNumber(band.lo)}` : ""}`}
          />
        ) : (
          <div className="flex flex-col gap-1.5">
            <span className="text-ink-muted text-[13px] font-semibold">Harga</span>
            <div className="rounded-control border-line bg-soft text-ink-muted grid min-h-12 place-items-center border text-xl font-bold">
              Harga pasar
            </div>
            <p className="text-ink-dim text-xs leading-snug">
              {buy
                ? `Terjual ke tawaran jual terbaik, menyapu maksimal ${game.sweepLevels} level. Sisa yang tidak terisi dibatalkan.`
                : `Terjual ke tawaran beli terbaik, menyapu maksimal ${game.sweepLevels} level. Sisa yang tidak terisi dibatalkan.`}
            </p>
          </div>
        )}

        <Stepper
          id={`${uid}-qty`}
          label="Jumlah lot"
          value={qtyText}
          onChange={(t) => {
            setQtyText(t.replace(/\D/g, "").replace(/^0+(?=\d)/, ""));
            touch();
          }}
          onStep={stepQty}
          minusLabel="Kurangi satu lot"
          plusLabel="Tambah satu lot"
          error={errors.qty}
          hint={
            buy
              ? `1 lot = 1 unit${limit && price && cash !== null ? ` · saldo cukup untuk maks ${maxAffordableLots(cash, price, game.feeBps)} lot` : ""}`
              : `1 lot = 1 unit · dimiliki ${formatNumber(holding?.qty ?? 0)} lot, ${formatNumber(holding?.locked ?? 0)} terkunci`
          }
        />
      </fieldset>

      <dl className="rounded-row bg-field flex flex-col gap-1.5 px-3.5 py-3">
        {summary.rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3">
            <dt className="text-ink-muted text-[13px]">{label}</dt>
            <dd className="money text-ink text-sm font-bold">{value}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3">
          <dt className="text-ink text-[13px] font-semibold">{summary.totalLabel}</dt>
          <dd className="money text-ink text-sm font-bold">{summary.total}</dd>
        </div>
      </dl>

      {formError ? (
        <p role="alert" className="text-bad-text text-sm font-medium">
          {formError}
        </p>
      ) : null}

      <Button
        size="lg"
        block
        loading={submitting}
        disabled={!open}
        onClick={() => void submit()}
        className="text-[17px] font-bold"
      >
        {buttonLabel}
      </Button>

      {errorCount > 0 ? (
        <p role="alert" className="text-bad-text text-center text-xs font-medium">
          Perbaiki {errorCount} isian di atas, lalu coba lagi.
        </p>
      ) : null}
      <p
        role="status"
        className={cn("text-center text-xs", result ? "text-ink font-semibold" : "text-ink-muted")}
      >
        {result ??
          (open
            ? limit
              ? "Order antre sampai terisi, dibatalkan, atau pasar ditutup."
              : "Order market langsung dieksekusi. Harga akhir bisa berbeda dari estimasi."
            : suspended && marketOpen
              ? "Aset ini disuspensi sementara. Order baru belum bisa dipasang; order antre masih bisa dibatalkan."
              : "Pemasangan dan pembatalan order tidak bisa dilakukan sekarang. Order terbuka tetap antre.")}
      </p>
    </section>
  );
}

function describeResult(
  o: { kind: Kind; qty: number; remaining: number; filled: number; status: string; price: number | null },
  sweepLevels: number,
): string {
  if (o.remaining === 0) return `Order terisi penuh: ${o.qty} lot.`;
  if (o.kind === "market") {
    return o.filled === 0
      ? `Tidak ada lawan dalam ${sweepLevels} level. Order dibatalkan.`
      : `Terisi ${o.filled} dari ${o.qty} lot; sisa dibatalkan.`;
  }
  return o.filled === 0
    ? `Order antre: ${o.qty} lot @ ${formatNumber(o.price ?? 0)}.`
    : `Terisi ${o.filled} dari ${o.qty} lot; sisa ${o.remaining} lot antre.`;
}

function Stepper({
  id,
  label,
  value,
  onChange,
  onStep,
  minusLabel,
  plusLabel,
  error,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (text: string) => void;
  onStep: (dir: 1 | -1) => void;
  minusLabel: string;
  plusLabel: string;
  error?: string;
  hint: string;
}) {
  const describedBy = `${id}-msg`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-ink-muted text-[13px] font-semibold">
        {label}
      </label>
      <div
        className={cn(
          "rounded-control bg-field flex items-center border",
          error ? "border-bad-text" : "border-line focus-within:border-brand-text",
        )}
      >
        <button
          type="button"
          onClick={() => onStep(-1)}
          aria-label={minusLabel}
          className="text-brand-text hover:bg-soft grid size-12 shrink-0 place-items-center rounded-l-[7px]"
        >
          <Minus className="size-5" aria-hidden />
        </button>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "tnum min-w-0 flex-1 bg-transparent text-center text-xl font-bold outline-none",
            error ? "text-bad-text" : "text-ink",
          )}
        />
        <button
          type="button"
          onClick={() => onStep(1)}
          aria-label={plusLabel}
          className="text-brand-text hover:bg-soft grid size-12 shrink-0 place-items-center rounded-r-[7px]"
        >
          <Plus className="size-5" aria-hidden />
        </button>
      </div>
      <p
        id={describedBy}
        role={error ? "alert" : undefined}
        className={cn("text-xs leading-snug", error ? "text-bad-text font-medium" : "text-ink-dim")}
      >
        {error ?? hint}
      </p>
    </div>
  );
}
