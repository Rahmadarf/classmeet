"use client";

import { Minus, Plus } from "lucide-react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { tradeAsset } from "@/app/team/market/actions";
import { Button } from "@/components/ui/button";
import type { Game, Holding, MarketAsset } from "@/lib/market/data";
import { formatBps, holdCap, maxBuyQty } from "@/lib/market/rules";
import { formatNumber, formatRupiah } from "@/lib/money";
import { cn } from "@/lib/utils";

type Side = "buy" | "sell";

/** Angka dari teks isian (hanya digit); kosong → null. */
function digits(text: string): number | null {
  const d = text.replace(/\D/g, "");
  if (d === "" || d.length > 6) return null;
  return Number(d);
}

const NOT_OPEN_LABEL: Record<Exclude<Game["state"], "open">, string> = {
  setup: "Pasar belum dibuka",
  paused: "Pasar dijeda",
  finished: "Pasar ditutup",
};

/**
 * Panel Beli/Jual (model toko, docs/17). Beli pada harga beli (harga tayang), jual pada harga jual (tayang dikurangi
 * selisih jual); eksekusi langsung dan atomik di server (`buy_asset` / `sell_asset`).
 *  - Isian jumlah TIDAK dibatasi di klien; database yang memutuskan dan alasannya muncul di panel.
 *  - Tiap niat punya `request_id` sendiri; percobaan ulang atas isian yang SAMA memakai id yang sama.
 * Komponen ini diberi `key={asset.id}` oleh pemanggil, jadi isiannya direset saat aset berganti.
 */
export function TradePanel({
  asset,
  initialSide = "buy",
  game,
  cash,
  holding,
  suspended = false,
  onChanged,
}: {
  asset: MarketAsset;
  initialSide?: Side;
  game: Game;
  /** Saldo; null bila belum termuat. */
  cash: number | null;
  holding: Holding | undefined;
  /** Aset sedang disuspensi: transaksi dinonaktifkan (database juga menolak). */
  suspended?: boolean;
  /** Dipanggil setelah transaksi sukses/ditolak/berubah supaya papan mengambil ulang data. */
  onChanged: () => void;
}) {
  const [side, setSide] = useState<Side>(initialSide);
  const [qtyText, setQtyText] = useState("1");
  const [qtyError, setQtyError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const intent = useRef<{ id: string; key: string } | null>(null);
  const uid = useId();

  const marketOpen = game.state === "open";
  const open = marketOpen && !suspended;
  const qty = digits(qtyText);
  const buy = side === "buy";
  const held = holding?.qty ?? 0;
  const cap = holdCap(asset.initStock, game.holdCapPct);
  const unit = buy ? asset.lastPrice : asset.sellPrice;
  const total = qty ? unit * qty : null;
  const maxBuy = maxBuyQty({ cash, price: asset.lastPrice, stock: asset.stock, held, cap });

  const touch = () => {
    setQtyError(null);
    setFormError(null);
    setResult(null);
  };
  const chooseSide = (next: Side) => {
    setSide(next);
    touch();
  };
  const stepQty = (dir: 1 | -1) => {
    setQtyText(String(Math.max((qty ?? 0) + dir, 1)));
    touch();
  };

  const submit = async () => {
    if (submitting || !open) return;
    touch();
    if (qty === null || qty < 1) {
      setQtyError("Isi jumlah minimal 1 unit.");
      return;
    }

    // Satu `request_id` per niat: dipakai ulang hanya bila isian persis sama (percobaan ulang).
    const key = `${asset.id}|${side}|${qty}`;
    if (!intent.current || intent.current.key !== key) intent.current = { id: crypto.randomUUID(), key };

    setSubmitting(true);
    try {
      const res = await tradeAsset({ requestId: intent.current.id, assetId: asset.id, side, qty });
      if (res.ok) {
        intent.current = null;
        const t = res.data;
        const text =
          t.side === "buy"
            ? `Berhasil membeli ${formatNumber(t.qty)} unit ${asset.symbol} @ ${formatRupiah(t.unitPrice)} (total ${formatRupiah(t.total)}).`
            : `Berhasil menjual ${formatNumber(t.qty)} unit ${asset.symbol} @ ${formatRupiah(t.unitPrice)} (diterima ${formatRupiah(t.total)}).`;
        setResult(text);
        toast.success(text);
        onChanged();
        return;
      }

      switch (res.code) {
        case "insufficient_cash":
          setQtyError(
            maxBuy > 0
              ? `Saldo tidak cukup untuk ${formatNumber(qty)} unit (maksimal ${formatNumber(maxBuy)}).`
              : "Saldo tidak cukup untuk membeli aset ini.",
          );
          break;
        case "insufficient_stock":
          setQtyError(`Stok pasar tinggal ${formatNumber(asset.stock)} unit.`);
          break;
        case "hold_cap_exceeded":
          setQtyError(
            `Batas pegang ${formatNumber(cap)} unit per aset (kamu punya ${formatNumber(held)}), jadi maksimal ${formatNumber(Math.max(cap - held, 0))} unit lagi.`,
          );
          break;
        case "insufficient_holdings":
          setQtyError(
            `Aset tidak cukup untuk dijual ${formatNumber(qty)} unit (dimiliki ${formatNumber(held)}).`,
          );
          break;
        default:
          setFormError(res.message);
      }
      // Status pasar/aset berubah atau data basi: segarkan banner, stok, dan tombol.
      if (
        res.code === "market_closed" ||
        res.code === "asset_suspended" ||
        res.code === "insufficient_stock" ||
        res.code === "asset_not_found"
      )
        onChanged();
    } catch {
      // Jaringan putus / respons tidak terbaca: isian tetap, `request_id` yang sama dipakai saat coba lagi.
      setFormError("Koneksi bermasalah. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  const buttonLabel = !marketOpen
    ? NOT_OPEN_LABEL[game.state as Exclude<Game["state"], "open">]
    : suspended
      ? "Aset disuspensi"
      : buy
        ? `Beli${qty ? ` ${formatNumber(qty)} unit` : ""}${total ? ` · ${formatRupiah(total)}` : ""}`
        : `Jual${qty ? ` ${formatNumber(qty)} unit` : ""}${total ? ` · ${formatRupiah(total)}` : ""}`;

  return (
    <section
      aria-label="Panel beli dan jual"
      className="rounded-panel border-line bg-card shadow-card flex flex-col gap-3.5 border p-5"
    >
      <div role="tablist" aria-label="Beli atau jual" className="rounded-tabs bg-field flex gap-1.5 p-1">
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

      <div className="flex items-center justify-between gap-3 text-[13px]">
        {buy ? (
          <>
            <span className="text-ink-muted">Saldo</span>
            <span className="money text-ink text-base font-bold">
              {cash === null ? "Rp –" : formatRupiah(cash)}
            </span>
          </>
        ) : (
          <>
            <span className="text-ink-muted">Dimiliki</span>
            <span className="tnum text-ink text-base font-bold">{formatNumber(held)} unit</span>
          </>
        )}
      </div>

      <fieldset
        disabled={!open || submitting}
        className={cn("flex min-w-0 flex-col gap-3.5", !open && "opacity-60")}
      >
        <Stepper
          id={`${uid}-qty`}
          label="Jumlah unit"
          value={qtyText}
          onChange={(t) => {
            setQtyText(t.replace(/\D/g, "").replace(/^0+(?=\d)/, ""));
            touch();
          }}
          onStep={stepQty}
          minusLabel="Kurangi satu unit"
          plusLabel="Tambah satu unit"
          error={qtyError ?? undefined}
          hint={
            buy
              ? maxBuy > 0
                ? `Bisa dibeli maksimal ${formatNumber(maxBuy)} unit (saldo, stok ${formatNumber(asset.stock)}, batas pegang ${formatNumber(cap)})`
                : asset.stock <= 0
                  ? "Stok pasar habis."
                  : held >= cap
                    ? `Batas pegang ${formatNumber(cap)} unit sudah tercapai.`
                    : "Saldo belum cukup untuk membeli 1 unit."
              : `Dimiliki ${formatNumber(held)} unit · dijual di harga jual`
          }
        />
      </fieldset>

      <dl className="rounded-row bg-field flex flex-col gap-1.5 px-3.5 py-3">
        <Row
          label={buy ? "Harga beli / unit" : `Harga jual / unit (−${formatBps(game.sellSpreadBps)})`}
          value={formatRupiah(unit)}
        />
        <Row label="Jumlah" value={qty ? `${formatNumber(qty)} unit` : "–"} />
        <div className="flex items-center justify-between gap-3">
          <dt className="text-ink text-[13px] font-semibold">{buy ? "Total dibayar" : "Total diterima"}</dt>
          <dd className="money text-ink text-sm font-bold">{total === null ? "–" : formatRupiah(total)}</dd>
        </div>
        {buy && cash !== null && total !== null ? (
          <Row label="Saldo sesudah" value={formatRupiah(cash - total)} />
        ) : null}
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

      <p
        role="status"
        className={cn("text-center text-xs", result ? "text-ink font-semibold" : "text-ink-muted")}
      >
        {result ??
          (open
            ? "Transaksi langsung terjadi pada harga di atas. Harga bisa bergeser karena berita dan tekanan stok."
            : suspended && marketOpen
              ? "Aset ini disuspensi sementara. Beli dan jual belum bisa dilakukan."
              : "Beli dan jual tidak bisa dilakukan sekarang.")}
      </p>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-muted text-[13px]">{label}</dt>
      <dd className="money text-ink text-sm font-bold">{value}</dd>
    </div>
  );
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
