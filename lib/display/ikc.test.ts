import { describe, expect, it } from "vitest";
import { appendSample, chartGeometry, parseSamples, type IkcSample } from "./ikc";

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

describe("chartGeometry", () => {
  it("kosong bila tak ada cuplikan; garis kosong bila hanya satu titik", () => {
    expect(chartGeometry([], 100, 50).line).toBe("");
    const one = chartGeometry([[1000, 1005]], 100, 50);
    expect(one.line).toBe("");
    expect(one.yTicks.length).toBeGreaterThan(1);
  });

  it("memetakan nilai tinggi ke y kecil (atas) dan menyertakan garis dasar 1.000", () => {
    const g = chartGeometry(
      [
        [0, 1000],
        [10_000, 1040],
      ],
      200,
      100,
    );
    expect(g.line.startsWith("M0.0 ")).toBe(true);
    const ys = [...g.line.matchAll(/ (\d+\.\d)/g)].map((m) => Number(m[1]));
    expect(ys[1]).toBeLessThan(ys[0]);
    expect(g.baselineY).not.toBeNull();
    expect(g.xTicks).toHaveLength(5);
    expect(g.xTicks[0].x).toBe(0);
    expect(g.xTicks[4].x).toBe(200);
  });

  it("tick sumbu Y turun dari nilai terbesar dan berjarak sama", () => {
    const g = chartGeometry(
      [
        [0, 990],
        [1, 1060],
      ],
      100,
      100,
    );
    const vals = g.yTicks.map((t) => t.value);
    expect(vals).toEqual([...vals].sort((a, b) => b - a));
    const diffs = vals.slice(1).map((v, i) => vals[i] - v);
    expect(new Set(diffs.map((d) => Math.round(d * 100))).size).toBe(1);
  });
});
