import { describe, expect, it } from "vitest";
import { GENERIC_ERROR, mapRpcError } from "./errors";
import { deletePostSchema, deleteTeamSchema } from "./schemas/admin";

describe("mapRpcError: hapus tim dan pos", () => {
  it.each([
    ["game_not_setup", "Setup"],
    ["team_has_activity", "Reset game"],
    ["post_has_payouts", "Reset game"],
    ["team_not_found", "Tim tidak ditemukan"],
    ["post_not_found", "Pos tidak ditemukan"],
    ["forbidden", "akses"],
  ])("%s dipetakan ke pesan Indonesia, bukan teks SQL mentah", (code, fragment) => {
    const m = mapRpcError({ message: code });
    expect(m.code).toBe(code);
    expect(m.message).toContain(fragment);
    expect(m.message).not.toBe(GENERIC_ERROR);
    expect(m.retryable).toBe(false);
  });
  it("kode tak dikenal jadi pesan umum", () => {
    expect(mapRpcError({ message: "violates foreign key constraint" })).toMatchObject({
      code: null,
      message: GENERIC_ERROR,
    });
  });
});

describe("skema hapus tim/pos", () => {
  const id = "00000000-0000-4000-8000-0000000000a1";
  it("menerima uuid", () => {
    expect(deleteTeamSchema.safeParse({ teamId: id }).success).toBe(true);
    expect(deletePostSchema.safeParse({ postId: id }).success).toBe(true);
  });
  it("menolak bukan uuid atau kolom kosong", () => {
    expect(deleteTeamSchema.safeParse({ teamId: "tim1" }).success).toBe(false);
    expect(deleteTeamSchema.safeParse({}).success).toBe(false);
    expect(deletePostSchema.safeParse({ postId: 5 }).success).toBe(false);
  });
});
