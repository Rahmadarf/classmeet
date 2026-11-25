import { describe, expect, it } from "vitest";
import { splitPostName } from "./data";

describe("splitPostName", () => {
  it("memecah nama pos rally", () => {
    expect(splitPostName("Pos 3 · Merakit Buta")).toEqual({
      number: "3",
      title: "Merakit Buta",
      label: "Pos 3",
    });
    expect(splitPostName("Pos 03 - Lempar")).toEqual({ number: "3", title: "Lempar", label: "Pos 3" });
  });
  it("memecah nama lomba", () => {
    expect(splitPostName("Lomba 2 · Futsal Antarkelas")).toEqual({
      number: "2",
      title: "Futsal Antarkelas",
      label: "Lomba 2",
    });
  });
  it("nama tanpa nomor: number dan label null", () => {
    expect(splitPostName("  Lompat Tali ")).toEqual({ number: null, title: "Lompat Tali", label: null });
  });
});
