import { describe, expect, it } from "vitest";
import { qk } from "@/lib/query/keys";
import { must, pollOptions, queryClientConfig, seed, seedMaybe } from "@/lib/query/options";
import { reconnectStep } from "@/lib/query/realtime-status";

describe("must", () => {
  it("mengembalikan nilai bila bukan null", async () => {
    await expect(must(Promise.resolve([1, 2]), "daftar")).resolves.toEqual([1, 2]);
    await expect(must(Promise.resolve(0), "angka")).resolves.toBe(0);
    await expect(must(Promise.resolve({}), "peta")).resolves.toEqual({});
  });
  it("melempar bila null, dengan nama sumbernya", async () => {
    await expect(must(Promise.resolve(null), "pasar")).rejects.toThrow("pasar: gagal dimuat");
  });
});

describe("pollOptions", () => {
  it("polling hanya saat tab terlihat dan data awal dianggap baru setengah interval", () => {
    expect(pollOptions(10_000)).toEqual({
      refetchInterval: 10_000,
      refetchIntervalInBackground: false,
      staleTime: 5_000,
    });
  });
});

describe("seed", () => {
  it("memakai data server sebagai initialData", () => {
    const s = seed({ a: 1 });
    expect(s.initialData).toEqual({ a: 1 });
    expect(typeof s.initialDataUpdatedAt()).toBe("number");
  });
  it("seedMaybe: null/undefined berarti tanpa data awal (Query mengambilnya di browser)", () => {
    expect(seedMaybe(null).initialData).toBeUndefined();
    expect(seedMaybe(undefined).initialData).toBeUndefined();
    expect(seedMaybe(0).initialData).toBe(0);
    expect(seedMaybe([]).initialData).toEqual([]);
  });
});

describe("queryClientConfig", () => {
  it("tanpa retry otomatis (galat aturan game tidak boleh diulang)", () => {
    expect(queryClientConfig.defaultOptions?.queries?.retry).toBe(false);
    expect(queryClientConfig.defaultOptions?.mutations?.retry).toBe(false);
  });
});

describe("qk", () => {
  it("kunci stabil dan terpisah menurut parameter", () => {
    expect(qk.marketSnapshot).toEqual(["market-snapshot"]);
    expect(qk.history("t1")).toEqual(["history", "t1"]);
    expect(qk.display.newsBoard(6)).toEqual(["display", "news-board", 6]);
    expect(qk.admin("teams")).toEqual(["admin", "teams"]);
  });
});

describe("reconnectStep", () => {
  it("tersambung pertama kali bukan sambung ulang", () => {
    expect(reconnectStep("SUBSCRIBED", false)).toEqual({ dropped: false, reconnected: false });
  });
  it("putus lalu tersambung = sambung ulang", () => {
    const down = reconnectStep("CHANNEL_ERROR", false);
    expect(down).toEqual({ dropped: true, reconnected: false });
    expect(reconnectStep("SUBSCRIBED", down.dropped)).toEqual({ dropped: false, reconnected: true });
  });
  it("TIMED_OUT dan CLOSED juga dianggap putus; status lain tidak mengubah apa pun", () => {
    expect(reconnectStep("TIMED_OUT", false).dropped).toBe(true);
    expect(reconnectStep("CLOSED", false).dropped).toBe(true);
    expect(reconnectStep("JOINING", true)).toEqual({ dropped: true, reconnected: false });
  });
});
