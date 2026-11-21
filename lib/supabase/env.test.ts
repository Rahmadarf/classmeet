import { describe, expect, it } from "vitest";
import { authCookieName } from "./cookie-name";
import { displayCredentials, supabaseEnv } from "./env";

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

describe("authCookieName", () => {
  it("memakai host pertama alamat publik (aturan bawaan @supabase/ssr)", () => {
    expect(authCookieName("https://api.rahmadarifin.my.id")).toBe("sb-api-auth-token");
    expect(authCookieName("https://192.192.2.222")).toBe("sb-192-auth-token");
    expect(authCookieName("http://localhost:8000")).toBe("sb-localhost-auth-token");
  });
});

describe("supabaseEnv: alamat internal untuk server", () => {
  const keep = { ...process.env };
  const set = (o: Record<string, string | undefined>) => {
    process.env = { ...keep, ...o } as NodeJS.ProcessEnv;
  };
  const base = { NEXT_PUBLIC_SUPABASE_URL: "https://api.contoh.id", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" };

  it("tanpa SUPABASE_INTERNAL_URL: server memakai alamat publik", () => {
    set({ ...base, SUPABASE_INTERNAL_URL: undefined });
    expect(supabaseEnv()).toMatchObject({ url: "https://api.contoh.id", serverUrl: "https://api.contoh.id" });
    process.env = keep;
  });

  it("dengan SUPABASE_INTERNAL_URL: server memakai alamat internal, cookie tetap dari alamat publik", () => {
    set({ ...base, SUPABASE_INTERNAL_URL: " http://localhost:8000 " });
    const e = supabaseEnv();
    expect(e.serverUrl).toBe("http://localhost:8000");
    expect(e.url).toBe("https://api.contoh.id");
    expect(e.cookieName).toBe("sb-api-auth-token");
    process.env = keep;
  });

  it("nilai kosong dianggap tidak diisi", () => {
    set({ ...base, SUPABASE_INTERNAL_URL: "  " });
    expect(supabaseEnv().serverUrl).toBe("https://api.contoh.id");
    process.env = keep;
  });
});
