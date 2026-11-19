import { describe, expect, it } from "vitest";
import { fetchNewsPage } from "./data";

type Res = { data: unknown; error: unknown };
const ok = (data: unknown): Res => ({ data, error: null });

/** Klien palsu: `.from(tabel)` rantai apa pun lalu await mengembalikan data tabel; `.rpc(nama)` memakai tabel rpc. */
function fakeClient(tables: Record<string, Res>, rpcs: Record<string, Res>) {
  const chain = (res: Res): unknown =>
    new Proxy(() => undefined, {
      get: (_t, prop) =>
        prop === "then" ? (f: (r: Res) => unknown) => Promise.resolve(res).then(f) : () => chain(res),
    });
  return {
    from: (name: string) => chain(tables[name] ?? ok([])),
    rpc: (name: string) => Promise.resolve(rpcs[name] ?? ok([])),
  } as unknown as Parameters<typeof fetchNewsPage>[0];
}

const pool = ok([{ draft_count: 0, ready_count: 4, eligible_count: 4, live_count: 0, applied_count: 0 }]);
const kinds = ok([
  { kind: "price", ready_count: 252 },
  { kind: "bankrupt", ready_count: 30 },
  { kind: "suspend", ready_count: 60 },
  { kind: "dividend", ready_count: 150 },
  { kind: "aneh", ready_count: 1 },
]);

describe("fetchNewsPage: efek berita terkini", () => {
  const rpcs = {
    get_news_pool_status: pool,
    get_news_pool_kinds: kinds,
    admin_current_news_effects: ok([
      { news_id: "n", status: "live", kind: "effect", symbol: "MA", name: "Mayora", value: 530 },
      { news_id: "n", status: "live", kind: "effect", symbol: "AI", name: "Airbus", value: -110 },
      { news_id: "n", status: "live", kind: "dividend", symbol: "DA", name: "Danone", value: 150 },
      { news_id: "n", status: "live", kind: "aneh", symbol: "XX", name: "X", value: 1 },
    ]),
  };

  it("memetakan persen (bps / 100), event, dan status berlaku", async () => {
    const page = await fetchNewsPage(fakeClient({ news_feed: ok([]) }, rpcs), true);
    expect(page?.currentEffects).toEqual({
      status: "live",
      effects: [
        { symbol: "MA", name: "Mayora", pct: 5.3 },
        { symbol: "AI", name: "Airbus", pct: -1.1 },
      ],
      events: [{ kind: "dividend", symbol: "DA", name: "Danone", value: 150 }],
    });
  });

  it("tanpa berita tayang → null", async () => {
    const page = await fetchNewsPage(
      fakeClient({ news_feed: ok([]) }, { ...rpcs, admin_current_news_effects: ok([]) }),
      true,
    );
    expect(page?.currentEffects).toBeNull();
  });
});

describe("fetchNewsPage (kumpulan v2)", () => {
  it("memuat jumlah per jenis (jenis tak dikenal dibuang) dan tidak memuat cakupan saat game terkunci", async () => {
    const page = await fetchNewsPage(
      fakeClient({ news_feed: ok([]) }, { get_news_pool_status: pool, get_news_pool_kinds: kinds }),
      true,
    );
    expect(page?.kinds).toEqual([
      { kind: "price", ready: 252 },
      { kind: "bankrupt", ready: 30 },
      { kind: "suspend", ready: 60 },
      { kind: "dividend", ready: 150 },
    ]);
    expect(page?.coverage).toBeNull();
  });

  it("sebelum game dibuka: cakupan per aset dipetakan dan jumlah efek diambil dari agregat tertanam", async () => {
    const page = await fetchNewsPage(
      fakeClient(
        {
          news_feed: ok([]),
          news: ok([{ id: "n1", title: "T", status: "ready", news_effects: [{ count: 12 }] }]),
          assets: ok([{ id: "a1", symbol: "AP", name: "Apple", is_active: true }]),
        },
        {
          get_news_pool_status: pool,
          get_news_pool_kinds: kinds,
          news_pool_coverage: ok([{ asset_id: "a1", symbol: "AP", bankrupt: 1, suspend: 0, dividend: 5 }]),
        },
      ),
      false,
    );
    expect(page?.coverage).toEqual([{ symbol: "AP", bankrupt: 1, suspend: 0, dividend: 5 }]);
    expect(page?.drafts[0]).toMatchObject({ id: "n1", assets: 12 });
  });

  it("jenis berita gagal dimuat → kinds null, halaman tetap jalan", async () => {
    const page = await fetchNewsPage(
      fakeClient(
        { news_feed: ok([]) },
        { get_news_pool_status: pool, get_news_pool_kinds: { data: null, error: { message: "x" } } },
      ),
      true,
    );
    expect(page?.kinds).toBeNull();
    expect(page).not.toBeNull();
  });
});
