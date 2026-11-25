import { describe, expect, it } from "vitest";
import { isAppRole, ownerRole, ROLE_HOME, ROLE_PREFIX } from "./routes";

describe("peran pic", () => {
  it("dikenali sebagai peran aplikasi", () => {
    expect(isAppRole("pic")).toBe(true);
    expect(isAppRole("lain")).toBe(false);
  });
  it("punya beranda dan awalan rute sendiri, terpisah dari penjaga", () => {
    expect(ROLE_HOME.pic).toBe("/pic/scan");
    expect(ROLE_PREFIX.pic).toBe("/pic");
    expect(ownerRole("/pic/scan")).toBe("pic");
    expect(ownerRole("/guard/scan")).toBe("guard");
  });
});
