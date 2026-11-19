import { describe, expect, it } from "vitest";
import { firstParagraph, paragraphsOf } from "./news-text";

describe("paragraphsOf", () => {
  it("memecah menurut baris kosong dan merapikan spasi", () => {
    expect(paragraphsOf("Satu  dua.\n\n  Tiga\nempat.\n\n\n\nLima.")).toEqual([
      "Satu dua.",
      "Tiga empat.",
      "Lima.",
    ]);
  });
  it("satu paragraf dan teks kosong", () => {
    expect(paragraphsOf("Hanya satu.")).toEqual(["Hanya satu."]);
    expect(paragraphsOf("  \n\n ")).toEqual([]);
    expect(firstParagraph("A.\n\nB.")).toBe("A.");
    expect(firstParagraph("")).toBe("");
  });
});
