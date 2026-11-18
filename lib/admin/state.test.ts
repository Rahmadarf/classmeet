import { describe, expect, it } from "vitest";
import { gameDay, poolWarning } from "./state";

const pool = (eligible: number) => ({ draft: 0, ready: 40, eligible, live: 0, applied: 12 });

describe("gameDay", () => {
  it("belum dibuka → null", () => expect(gameDay(null, Date.now())).toBeNull());
  it("menghitung hari kalender WIB sejak dibuka", () => {
    const started = "2026-11-17T01:00:00Z"; // 17 Nov 08:00 WIB
    expect(gameDay(started, Date.parse("2026-11-17T07:00:00Z"))).toBe(1);
    expect(gameDay(started, Date.parse("2026-11-18T07:00:00Z"))).toBe(2);
    expect(gameDay(started, Date.parse("2026-11-19T05:00:00Z"))).toBe(3);
  });
  it("memakai hari WIB, bukan UTC (lewat tengah malam WIB = hari berikutnya)", () => {
    const started = "2026-11-17T01:00:00Z";
    // 17 Nov 18:00 UTC = 18 Nov 01:00 WIB
    expect(gameDay(started, Date.parse("2026-11-17T18:00:00Z"))).toBe(2);
  });
});

describe("poolWarning", () => {
  it("tidak ada peringatan sebelum dibuka atau sesudah selesai, atau bila masih banyak", () => {
    expect(poolWarning("setup", pool(0))).toBeNull();
    expect(poolWarning("finished", pool(0))).toBeNull();
    expect(poolWarning("open", pool(31))).toBeNull();
    expect(poolWarning("open", pool(7))).toBeNull();
  });
  it("kuning bila ≤ 6, merah bila 0 saat pasar buka", () => {
    expect(poolWarning("open", pool(5))).toMatchObject({ level: "warn" });
    expect(poolWarning("open", pool(6))?.text).toContain("tinggal 6");
    expect(poolWarning("open", pool(0))).toMatchObject({ level: "bad" });
    expect(poolWarning("paused", pool(0))).toMatchObject({ level: "warn" });
  });
});
