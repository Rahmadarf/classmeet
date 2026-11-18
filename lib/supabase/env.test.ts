import { describe, expect, it } from "vitest";
import { displayCredentials } from "./env";

describe("displayCredentials", () => {
  it("membentuk email akun dari nama pengguna", () => {
    expect(displayCredentials({ DISPLAY_USERNAME: " Display ", DISPLAY_PASSWORD: "x y" })).toEqual({
      email: "display@classmeet.local",
      password: "x y",
    });
  });

  it("null bila salah satu kosong (masuk otomatis mati)", () => {
    expect(displayCredentials({})).toBeNull();
    expect(displayCredentials({ DISPLAY_USERNAME: "display" })).toBeNull();
    expect(displayCredentials({ DISPLAY_PASSWORD: "x" })).toBeNull();
    expect(displayCredentials({ DISPLAY_USERNAME: "  ", DISPLAY_PASSWORD: "x" })).toBeNull();
  });
});
