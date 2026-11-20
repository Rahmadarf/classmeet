import { dayKeyWib, formatDateWib } from "@/lib/money";

/** Satu transaksi beli/jual (`transactions`). `price` = harga satuan yang dibayar/diterima; `listPrice` = harga tayang saat itu. */
export type TradeIn = {
  id: number;
  assetId: string;
  side: "buy" | "sell";
  price: number;
  listPrice: number;
  qty: number;
  total: number;
  createdAt: string;
};

export type PayoutIn = {
  id: number;
  postId: string;
  amount: number;
  note: string | null;
  createdAt: string;
};

export type DividendIn = {
  id: number;
  assetId: string;
  qty: number;
  perUnit: number;
  amount: number;
  createdAt: string;
};

export type AssetName = { symbol: string; name: string };
export type PostInfo = { name: string; location: string };

export type TradeItem = {
  kind: "trade";
  key: string;
  at: string;
  side: "buy" | "sell";
  symbol: string;
  name: string;
  qty: number;
  /** Harga satuan yang dibayar (beli) atau diterima (jual). */
  price: number;
  /** Harga tayang saat transaksi (untuk jual: selisih dengan harga satuan adalah selisih jual). */
  listPrice: number;
  /** Pengaruh ke saldo: negatif untuk beli, positif untuk jual. */
  net: number;
};

export type PayoutItem = {
  kind: "payout";
  key: string;
  at: string;
  postName: string;
  location: string | null;
  /** Nomor pos dua digit ("03") untuk ubin; null bila nama pos tidak bernomor. */
  postNumber: string | null;
  note: string | null;
  net: number;
};

/** Dividen aset yang dipegang (event berita): uang masuk ke saldo. */
export type DividendItem = {
  kind: "dividend";
  key: string;
  at: string;
  symbol: string;
  name: string;
  qty: number;
  perUnit: number;
  net: number;
};

export type HistoryItem = TradeItem | PayoutItem | DividendItem;

/** "Pos 3 · Estafet Balon" → "03". */
export function postNumber(name: string): string | null {
  const m = /^Pos\s*(\d{1,3})\b/i.exec(name.trim());
  return m ? m[1].padStart(2, "0") : null;
}

/**
 * Gabungkan transaksi (`transactions`), hadiah pos (`payouts`), dan dividen milik tim menjadi satu lini masa, terbaru
 * di atas. RLS sudah membatasi baris ke milik tim ini. Baris yang aset/posnya tak dikenal tetap tampil dengan nama umum.
 */
export function buildHistory(
  trades: TradeIn[],
  payouts: PayoutIn[],
  assets: Record<string, AssetName>,
  posts: Record<string, PostInfo>,
  dividends: DividendIn[] = [],
): HistoryItem[] {
  const items: HistoryItem[] = [];
  for (const t of trades) {
    const a = assets[t.assetId];
    items.push({
      kind: "trade",
      key: `t${t.id}`,
      at: t.createdAt,
      side: t.side,
      symbol: a?.symbol ?? "—",
      name: a?.name ?? "Aset",
      qty: t.qty,
      price: t.price,
      listPrice: t.listPrice,
      net: t.side === "buy" ? -t.total : t.total,
    });
  }
  for (const p of payouts) {
    const post = posts[p.postId];
    items.push({
      kind: "payout",
      key: `p${p.id}`,
      at: p.createdAt,
      postName: post?.name ?? "Pos",
      location: post?.location ?? null,
      postNumber: post ? postNumber(post.name) : null,
      note: p.note,
      net: p.amount,
    });
  }
  for (const d of dividends) {
    const a = assets[d.assetId];
    items.push({
      kind: "dividend",
      key: `d${d.id}`,
      at: d.createdAt,
      symbol: a?.symbol ?? "—",
      name: a?.name ?? "Aset",
      qty: d.qty,
      perUnit: d.perUnit,
      net: d.amount,
    });
  }
  return items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || b.key.localeCompare(a.key));
}

export type DayGroup = { key: string; label: string; items: HistoryItem[] };

/** Kelompokkan per hari WIB: "Hari ini · 18 Nov", "Kemarin · 17 Nov", lainnya "16 Nov 2026". */
export function groupByDay(items: HistoryItem[], nowMs: number): DayGroup[] {
  const today = dayKeyWib(nowMs);
  const yesterday = dayKeyWib(nowMs - 24 * 60 * 60 * 1000);
  const groups: DayGroup[] = [];
  for (const item of items) {
    const key = dayKeyWib(item.at);
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      const short = formatDateWib(item.at).replace(/ \d{4}$/, "");
      const label =
        key === today
          ? `Hari ini · ${short}`
          : key === yesterday
            ? `Kemarin · ${short}`
            : formatDateWib(item.at);
      group = { key, label, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}
