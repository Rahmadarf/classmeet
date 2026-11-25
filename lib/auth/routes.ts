import type { Enums } from "@/lib/supabase/database.types";

export type AppRole = Enums<"app_role">;

/** Beranda tiap peran (docs/07-ui-ux.md §1). */
export const ROLE_HOME: Record<AppRole, string> = {
  team: "/team",
  guard: "/guard/scan",
  pic: "/pic/scan",
  admin: "/admin/state",
  display: "/display",
};

/** Awalan rute yang dimiliki tiap peran. */
export const ROLE_PREFIX: Record<AppRole, string> = {
  team: "/team",
  guard: "/guard",
  pic: "/pic",
  admin: "/admin",
  display: "/display",
};

/** Rute tanpa sesi: layar masuk laptop (selalu mulai dari keadaan keluar), login, cek kesehatan. */
export const PUBLIC_PATHS = [
  "/kiosk",
  "/login",
  "/api/health",
  // Galeri komponen hanya ada saat pengembangan (app/dev/page.tsx memanggil notFound() di produksi).
  ...(process.env.NODE_ENV !== "production" ? ["/dev"] : []),
];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Peran pemilik rute, atau null bila rute bukan milik peran mana pun. */
export function ownerRole(pathname: string): AppRole | null {
  for (const role of Object.keys(ROLE_PREFIX) as AppRole[]) {
    if (matchesPrefix(pathname, ROLE_PREFIX[role])) return role;
  }
  return null;
}

/** Tujuan bila belum masuk: tim ke layar pindai laptop, peran lain ke login. */
export function signedOutDestination(pathname: string): string {
  return matchesPrefix(pathname, "/team") ? "/kiosk" : "/login";
}

export function isAppRole(value: unknown): value is AppRole {
  return value === "team" || value === "guard" || value === "pic" || value === "admin" || value === "display";
}
