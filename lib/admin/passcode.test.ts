import { describe, expect, it } from "vitest";
import { DEFAULT_DELETE_PASSCODE, expectedDeletePasscode, passcodeMatches } from "./passcode";

describe("pascode hapus tim", () => {
  it("bawaan 223332; nilai lingkungan hanya bila tepat 6 digit", () => {
    expect(DEFAULT_DELETE_PASSCODE).toBe("223332");
    expect(expectedDeletePasscode(undefined)).toBe("223332");
    expect(expectedDeletePasscode("12345")).toBe("223332");
    expect(expectedDeletePasscode("abcdef")).toBe("223332");
    expect(expectedDeletePasscode(" 654321 ")).toBe("654321");
  });
  it("cocok hanya bila sama persis", () => {
    expect(passcodeMatches("223332", "223332")).toBe(true);
    expect(passcodeMatches("223333", "223332")).toBe(false);
    expect(passcodeMatches("22333", "223332")).toBe(false);
  });
});
