import { describe, expect, it } from "vitest";
import type { ClosedOrder, OpenOrder } from "@/lib/market/data";
import { closedStatusText, isTodayWib, summarizeOrders } from "./view";

const open = (o: Partial<OpenOrder>): OpenOrder => ({
  id: 1,
  assetId: "a",
  side: "buy",
  kind: "limit",
  price: 795_000,
  qty: 1,
  remaining: 1,
  lockPerLot: 796_988,
  status: "open",
  createdAt: "2026-11-17T07:20:00Z",
  ...o,
});

const closed = (o: Partial<ClosedOrder>): ClosedOrder => ({
  id: 9,
  assetId: "a",
  side: "buy",
  kind: "limit",
  price: 120_000,
  qty: 3,
  remaining: 0,
  status: "filled",
  createdAt: "2026-11-17T06:58:00Z",
  avgFillPrice: 120_000,
  ...o,
});

describe("summarizeOrders", () => {
  it("menghitung beli/jual dan unit terkunci per aset", () => {
    const s = summarizeOrders([open({}), open({ id: 2, side: "sell", lockPerLot: 0 })], {
      a: { qty: 3, locked: 1, available: 2 },
      b: { qty: 2, locked: 0, available: 2 },
    });
    expect(s).toMatchObject({ open: 2, buys: 1, sells: 1, lockedUnits: 1 });
    expect(s.lockedByAsset).toEqual([{ assetId: "a", units: 1 }]);
  });
});

describe("closedStatusText", () => {
  it("terisi penuh", () => expect(closedStatusText(closed({}), "open")).toBe("Terisi 3 / 3"));
  it("terisi sebagian lalu sisa dibatalkan", () =>
    expect(closedStatusText(closed({ status: "cancelled", qty: 2, remaining: 1 }), "open")).toBe(
      "Terisi 1 / 2 · sisa dibatalkan",
    ));
  it("dibatalkan tim vs saat pasar ditutup", () => {
    const o = closed({ status: "cancelled", qty: 1, remaining: 1 });
    expect(closedStatusText(o, "open")).toBe("Dibatalkan oleh tim");
    expect(closedStatusText(o, "finished")).toBe("Dibatalkan saat pasar ditutup");
  });
  it("market tanpa lawan", () =>
    expect(
      closedStatusText(
        closed({ kind: "market", status: "cancelled", qty: 2, remaining: 2, price: null }),
        "open",
      ),
    ).toBe("Tidak terisi · tidak ada lawan"));
});

describe("isTodayWib", () => {
  it("memakai hari WIB, bukan UTC", () => {
    // 17 Nov 23:30 UTC = 18 Nov 06:30 WIB
    const now = Date.parse("2026-11-17T23:30:00Z");
    const out = isTodayWib(
      [{ createdAt: "2026-11-17T22:00:00Z" }, { createdAt: "2026-11-17T10:00:00Z" }],
      now,
    );
    expect(out).toEqual([{ createdAt: "2026-11-17T22:00:00Z" }]);
  });
});
