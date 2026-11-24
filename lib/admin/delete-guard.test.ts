import { describe, expect, it } from "vitest";
import { canDeleteInState, deleteBlockedReason } from "./delete-guard";
import type { GameState } from "./state";

describe("canDeleteInState", () => {
  it("hanya setup yang boleh", () => {
    expect(canDeleteInState("setup")).toBe(true);
    for (const s of ["open", "paused", "finished"] as GameState[]) expect(canDeleteInState(s)).toBe(false);
  });
});

describe("deleteBlockedReason", () => {
  it("null saat setup", () => {
    expect(deleteBlockedReason("setup", "tim")).toBeNull();
    expect(deleteBlockedReason("setup", "pos")).toBeNull();
  });
  it("menjelaskan alasan dan status sekarang saat bukan setup", () => {
    expect(deleteBlockedReason("open", "tim")).toContain("Hapus tim hanya bisa saat status game Setup");
    expect(deleteBlockedReason("paused", "pos")).toContain("Status sekarang: Paused");
    expect(deleteBlockedReason("finished", "pos")).toContain("Status sekarang: Finished");
    expect(deleteBlockedReason("open", "tim")).toContain("Reset game");
  });
});
