import { describe, expect, it } from "vitest";
import { AREA_H, AREA_W, cardOffset, colsFor, GAP, zoneLayout } from "./posts-layout";

describe("zoneLayout", () => {
  it("jumlah kolom menurut kepadatan", () => {
    expect([0, 1, 5, 6, 16, 17, 30, 31, 60].map(colsFor)).toEqual([1, 1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it("semua kartu muat di area untuk 0 sampai 60 pos (tanpa gulir)", () => {
    for (let n = 0; n <= 60; n++) {
      const l = zoneLayout(n);
      const last = cardOffset(l, Math.max(0, n - 1));
      expect(last.y + l.cardH).toBeLessThanOrEqual(AREA_H);
      expect(last.x + l.cardW).toBeLessThanOrEqual(AREA_W);
      expect(l.cardH).toBeGreaterThan(0);
    }
  });

  it("kartu tidak saling menimpa: posisi unik dan berjarak minimal GAP", () => {
    const n = 18;
    const l = zoneLayout(n);
    const seen = new Set<string>();
    for (let i = 0; i < n; i++) {
      const { x, y } = cardOffset(l, i);
      seen.add(`${x},${y}`);
    }
    expect(seen.size).toBe(n);
    expect(cardOffset(l, 1).x - cardOffset(l, 0).x).toBeGreaterThanOrEqual(l.cardW + GAP);
  });

  it("sedikit pos: kartu besar satu kolom; banyak pos: kartu kecil", () => {
    expect(zoneLayout(3)).toMatchObject({ cols: 1, cardH: 112 });
    expect(zoneLayout(12).cols).toBe(2);
    expect(zoneLayout(16)).toMatchObject({ cols: 2, cardH: 70 });
    expect(zoneLayout(30).cardH).toBeLessThan(zoneLayout(6).cardH);
  });

  it("lokasi disembunyikan hanya bila kartu terlalu pendek", () => {
    expect(zoneLayout(6).showPlace).toBe(true);
    expect(zoneLayout(60).showPlace).toBe(false);
  });
});
