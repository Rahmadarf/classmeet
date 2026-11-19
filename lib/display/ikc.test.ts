import { describe, expect, it } from "vitest";
import { appendSample, chartGeometry, mergeSeries, parseSamples, todaySeries, type IkcSample } from "./ikc";

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

describe("chartGeometry", () => {
  it("sumbu mengikuti data: IKC di sekitar 1.087 tidak memaksa garis dasar 1.000 masuk", () => {
    const g = chartGeometry(
      [
        [0, 1077],
        [10_000, 1087],
      ],
      200,
      100,
    );
    expect(g.baselineY).toBeNull();
    const vals = g.yTicks.map((t) => t.value);
    expect(Math.min(...vals)).toBeGreaterThan(1050);
    expect(Math.max(...vals)).toBeLessThan(1120);
    // perubahan 10 poin menempati porsi besar tinggi grafik (bukan ±7 % seperti sumbu 950–1.100)
    const ys = [...g.line.matchAll(/ (\d+\.\d)/g)].map((m) => Number(m[1]));
    expect(Math.abs(ys[1] - ys[0])).toBeGreaterThan(40);
  });

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
