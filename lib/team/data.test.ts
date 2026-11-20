import { describe, expect, it } from "vitest";
import { fetchNews, fetchSummary } from "./data";

// Klien palsu minimal: hanya bentuk yang dipakai fetchSummary/fetchNews.
const rpcClient = (result: { data: unknown; error: unknown }) =>
  ({ rpc: async () => result }) as unknown as Parameters<typeof fetchSummary>[0];

const newsClient = (result: { data: unknown; error: unknown }) =>
  ({
    from: () => ({ select: () => ({ order: () => ({ limit: async () => result }) }) }),
  }) as unknown as Parameters<typeof fetchNews>[0];

describe("fetchSummary", () => {
  it("memetakan get_my_summary ke camelCase", async () => {
    const s = await fetchSummary(
      rpcClient({
        data: { cash: 1_200_000, holdings_value: 4_325_000, net_worth: 5_525_000 },
        error: null,
      }),
    );
    expect(s).toEqual({
      cash: 1_200_000,
      holdingsValue: 4_325_000,
      netWorth: 5_525_000,
    });
  });

  it("null bila galat, kosong, atau ada kolom null/bukan bilangan bulat", async () => {
    expect(await fetchSummary(rpcClient({ data: null, error: { message: "forbidden" } }))).toBeNull();
    expect(await fetchSummary(rpcClient({ data: null, error: null }))).toBeNull();
    expect(
      await fetchSummary(rpcClient({ data: { cash: null, holdings_value: 0, net_worth: 0 }, error: null })),
    ).toBeNull();
    expect(
      await fetchSummary(rpcClient({ data: { cash: 1.5, holdings_value: 0, net_worth: 0 }, error: null })),
    ).toBeNull();
  });
});

describe("fetchNews", () => {
  it("memetakan baris news_feed dan tidak membawa kolom efek", async () => {
    const rows = [{ news_id: "n1", title: "T", body: "B", published_at: "2026-11-17T03:42:00Z" }];
    const items = await fetchNews(newsClient({ data: rows, error: null }));
    expect(items).toEqual([{ id: "n1", title: "T", body: "B", publishedAt: "2026-11-17T03:42:00Z" }]);
  });

  it("null bila galat", async () => {
    expect(await fetchNews(newsClient({ data: null, error: { message: "x" } }))).toBeNull();
  });
});
