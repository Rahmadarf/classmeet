import { describe, expect, it } from "vitest";
import { appendSample, mergeSeries, parseSamples, todaySeries, valueDomain, type IkcSample } from "./ikc";

describe("appendSample", () => {
  it("mengabaikan cuplikan yang terlalu rapat dan menambah yang cukup jauh", () => {
    let s: IkcSample[] = [];
    s = appendSample(s, 1_000_000, 1000);
    s = appendSample(s, 1_005_000, 1001); // < 15 dtk → diabaikan
    s = appendSample(s, 1_016_000, 1002);
    expect(s).toEqual([
      [1_000_000, 1000],
      [1_016_000, 1002],
    ]);
  });

  it("membuang cuplikan yang lebih tua dari batas usia dan membatasi jumlah titik", () => {
    const old: IkcSample[] = [[0, 990]];
    expect(appendSample(old, 10_000, 1000, { maxAgeMs: 5_000 })).toEqual([[10_000, 1000]]);
    const many: IkcSample[] = [
      [1, 1],
      [2, 2],
      [3, 3],
    ];
    expect(appendSample(many, 10, 4, { gapMs: 0, maxPoints: 3 }).map((p) => p[1])).toEqual([2, 3, 4]);
  });

  it("mengabaikan nilai bukan angka", () => {
    expect(appendSample([[1, 1]], 100_000, Number.NaN)).toEqual([[1, 1]]);
  });
});

describe("parseSamples", () => {
  it("tahan data rusak dan mengurutkan menurut waktu", () => {
    expect(parseSamples(null)).toEqual([]);
    expect(parseSamples("bukan json")).toEqual([]);
    expect(parseSamples('{"a":1}')).toEqual([]);
    expect(parseSamples('[[2,1002],[1,1001],["x",3],[3]]')).toEqual([
      [1, 1001],
      [2, 1002],
    ]);
  });
});

describe("todaySeries", () => {
  const d = (s: string) => Date.parse(s);
  const series: IkcSample[] = [
    [d("2026-11-18T05:00:00Z"), 1050],
    [d("2026-11-19T03:00:00Z"), 1080],
    [d("2026-11-19T04:00:00Z"), 1090],
  ];
  it("hanya titik pada hari WIB yang sama; kurang dari 2 titik hari ini → seluruh seri", () => {
    expect(todaySeries(series, d("2026-11-19T05:00:00Z"))).toEqual(series.slice(1));
    expect(todaySeries(series, d("2026-11-20T05:00:00Z"))).toEqual(series);
  });
  it("batas hari memakai WIB (UTC+7): 17.30 UTC sudah hari berikutnya", () => {
    const s: IkcSample[] = [
      [d("2026-11-19T16:00:00Z"), 1],
      [d("2026-11-19T18:00:00Z"), 2],
      [d("2026-11-19T19:00:00Z"), 3],
    ];
    expect(todaySeries(s, d("2026-11-19T20:00:00Z")).map((p) => p[1])).toEqual([2, 3]);
  });
});

describe("mergeSeries", () => {
  it("riwayat server lebih dulu, lalu hanya cuplikan lokal yang lebih baru; tanpa server → lokal", () => {
    const server: IkcSample[] = [
      [1_000_000, 1000],
      [1_060_000, 1010],
    ];
    const local: IkcSample[] = [
      [1_030_000, 1005], // lebih lama dari catatan terakhir server → dibuang
      [1_065_000, 1011], // terlalu dekat (< 15 dtk) → dibuang
      [1_100_000, 1012],
    ];
    expect(mergeSeries(server, local)).toEqual([...server, [1_100_000, 1012]]);
    expect(mergeSeries([], local)).toEqual(local);
  });
});

describe("valueDomain", () => {
  it("sumbu mengikuti data: IHAI di sekitar 1.087 tidak memaksa garis dasar 1.000 masuk", () => {
    const d = valueDomain([1077, 1087]);
    expect(d.baselineInside).toBe(false);
    expect(d.lo).toBeGreaterThan(1050);
    expect(d.hi).toBeLessThan(1120);
    expect(d.ticks[0]).toBe(d.lo);
    expect(d.ticks[d.ticks.length - 1]).toBe(d.hi);
  });

  it("garis dasar ikut bila data mengelilinginya; rentang minimum 4 poin untuk data rata", () => {
    expect(valueDomain([990, 1040]).baselineInside).toBe(true);
    const flat = valueDomain([1087, 1087]);
    expect(flat.hi - flat.lo).toBeGreaterThanOrEqual(4);
    expect(flat.lo).toBeLessThan(1087);
    expect(flat.hi).toBeGreaterThan(1087);
  });

  it("tick naik dengan jarak sama; tanpa data tetap menghasilkan rentang di sekitar dasar", () => {
    const d = valueDomain([1000, 1100]);
    const gaps = d.ticks.slice(1).map((t, i) => Math.round((t - d.ticks[i]) * 100) / 100);
    expect(new Set(gaps).size).toBe(1);
    expect(valueDomain([]).baselineInside).toBe(true);
  });
});
