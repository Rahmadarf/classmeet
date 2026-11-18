import { describe, expect, it } from "vitest";
import { authEmail, formatTeamQr, parseTeamQr } from "./qr";

const TOKEN = "3f2b8c1e-5a7d-4e0b-9c64-1d2e3f4a5b6c";

describe("QR kartu tim", () => {
  it("mengurai format CM1:<akun>:<token>", () => {
    expect(parseTeamQr(`CM1:tim1:${TOKEN}`)).toEqual({ username: "tim1", token: TOKEN });
  });

  it("menormalkan huruf besar dan spasi tepi", () => {
    expect(parseTeamQr(`  CM1:TIM_2:${TOKEN.toUpperCase()}\n`)).toEqual({ username: "tim_2", token: TOKEN });
  });

  it("round-trip dengan formatTeamQr", () => {
    const qr = { username: "tim3", token: TOKEN };
    expect(parseTeamQr(formatTeamQr(qr))).toEqual(qr);
  });

  it("menolak isi yang bukan kartu tim", () => {
    for (const bad of [
      "",
      "https://contoh.com",
      TOKEN, // token saja (bukan kartu masuk)
      `CM2:tim1:${TOKEN}`,
      `CM1:ab:${TOKEN}`, // akun terlalu pendek
      `CM1:tim 1:${TOKEN}`,
      `CM1:tim1:${TOKEN}:extra`,
      `CM1:tim1:not-a-uuid`,
    ]) {
      expect(parseTeamQr(bad)).toBeNull();
    }
  });

  it("email Auth dari nama akun", () => {
    expect(authEmail("tim1")).toBe("tim1@classmeet.local");
  });
});
