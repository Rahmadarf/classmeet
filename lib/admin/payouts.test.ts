import { describe, expect, it } from "vitest";
import { buildPayoutRows, totalsBy } from "./payouts";

const raw = (id: number, postId: string, amount: number, at: string, teamId = "t1") => ({
  id,
  teamId,
  postId,
  guardId: "g1",
  amount,
  note: null,
  createdAt: at,
});
const names = {
  teams: { t1: "Tim Elang", t2: "Tim Harimau" },
  posts: { p1: "Pos 1 · Lempar" },
  guards: { g1: "Alya" },
};

describe("buildPayoutRows", () => {
  it("terbaru di atas dan memakai nama", () => {
    const rows = buildPayoutRows(
      [raw(1, "p1", 100, "2026-11-18T01:00:00Z"), raw(2, "p1", 100, "2026-11-18T02:00:00Z", "t2")],
      names.teams,
      names.posts,
      names.guards,
    );
    expect(rows.map((r) => r.id)).toEqual([2, 1]);
    expect(rows[0]).toMatchObject({ teamName: "Tim Harimau", postName: "Pos 1 · Lempar", guardName: "Alya" });
  });

  it("menandai hadiah > 3× rata-rata pos yang sama (butuh ≥ 3 hadiah di pos itu)", () => {
    const list = [
      raw(1, "p1", 100, "2026-11-18T01:00:00Z"),
      raw(2, "p1", 100, "2026-11-18T02:00:00Z"),
      raw(3, "p1", 100, "2026-11-18T03:00:00Z"),
      raw(4, "p1", 1000, "2026-11-18T04:00:00Z"),
    ];
    const rows = buildPayoutRows(list, names.teams, names.posts, names.guards);
    expect(rows.find((r) => r.id === 4)?.outlier).toBe(true); // 1000 > 3 × 325
    expect(rows.find((r) => r.id === 1)?.outlier).toBe(false);
  });

  it("pos dengan terlalu sedikit hadiah tidak pernah ditandai", () => {
    const rows = buildPayoutRows(
      [raw(1, "p1", 1, "2026-11-18T01:00:00Z"), raw(2, "p1", 999_999, "2026-11-18T02:00:00Z")],
      names.teams,
      names.posts,
      names.guards,
    );
    expect(rows.every((r) => !r.outlier)).toBe(true);
  });

  it("nama tak dikenal memakai nama umum", () => {
    const [r] = buildPayoutRows(
      [{ ...raw(1, "px", 5, "2026-11-18T01:00:00Z"), teamId: "tx", guardId: "gx" }],
      {},
      {},
      {},
    );
    expect(r).toMatchObject({ teamName: "Tim", postName: "Pos", guardName: "Penjaga" });
  });
});

describe("totalsBy", () => {
  it("menjumlah per kunci, terbesar dulu", () => {
    const out = totalsBy(
      [
        { k: "a", n: 1 },
        { k: "b", n: 5 },
        { k: "a", n: 2 },
      ],
      (x) => x.k,
      (x) => x.n,
    );
    expect(out).toEqual([
      { key: "b", total: 5 },
      { key: "a", total: 3 },
    ]);
  });
});
