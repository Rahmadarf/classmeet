import { describe, expect, it } from "vitest";
import { eventText } from "./news-effects";

describe("eventText", () => {
  it("dividen dalam persen harga acuan, suspensi dalam menit, bangkrut dalam persen likuidasi", () => {
    expect(eventText({ kind: "dividend", symbol: "DA", name: "Danone", value: 150 })).toBe(
      "Dividen DA (Danone) · 1,50 % harga acuan per unit",
    );
    expect(eventText({ kind: "suspend", symbol: "XI", name: "Xiaomi", value: 9 })).toBe(
      "Suspensi XI (Xiaomi) · 9 menit",
    );
    expect(eventText({ kind: "bankrupt", symbol: "LO", name: "L'Oréal", value: 1900 })).toBe(
      "Bangkrut LO (L'Oréal) · unit diganti 19 % harga acuan",
    );
  });
});
