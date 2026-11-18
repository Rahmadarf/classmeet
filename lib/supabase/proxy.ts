import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  isAppRole,
  isPublicPath,
  matchesPrefix,
  ownerRole,
  ROLE_HOME,
  ROLE_PREFIX,
  signedOutDestination,
} from "@/lib/auth/routes";
import type { Database } from "./database.types";
import { displayCredentials, supabaseEnv } from "./env";

/**
 * Lapis 1 dari tiga lapis penegakan peran (docs/06-security.md §1): menyegarkan sesi dan
 * mengarahkan pengguna ke halaman perannya. INI HANYA UX. Penegakan sebenarnya ada di RLS + RPC.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = supabaseEnv();

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getClaims memvalidasi JWT dan menyegarkan token bila perlu. Jangan taruh kode di antara
  // createServerClient dan getClaims.
  const { data } = await supabase.auth.getClaims();
  let userId = data?.claims?.sub ?? null;
  const { pathname } = request.nextUrl;

  // Layar publik tanpa login: bila `/display` dibuka tanpa sesi dan akun layar publik dikonfigurasi di server
  // (DISPLAY_USERNAME/DISPLAY_PASSWORD), masuk otomatis sebagai peran `display` (hanya baca). Kata sandi tidak pernah
  // sampai ke peramban; yang diterima peramban hanya cookie sesi, seperti login biasa. Gagal → alur login biasa.
  if (!userId && request.method === "GET" && matchesPrefix(pathname, ROLE_PREFIX.display)) {
    const creds = displayCredentials();
    if (creds) {
      const { data: signedIn, error } = await supabase.auth.signInWithPassword(creds);
      if (!error && signedIn.user) userId = signedIn.user.id;
    }
  }

  const redirectTo = (path: string) => {
    const target = request.nextUrl.clone();
    target.pathname = path;
    target.search = "";
    const redirect = NextResponse.redirect(target);
    // Pertahankan cookie sesi yang baru disegarkan.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  if (!userId) {
    if (isPublicPath(pathname)) return response;
    return redirectTo(pathname === "/" ? "/login" : signedOutDestination(pathname));
  }

  // /kiosk selalu dibuka dalam keadaan keluar oleh halamannya sendiri (signOut global); jangan dialihkan.
  if (isPublicPath(pathname)) return response;

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  const role = isAppRole(profile?.role) ? profile.role : null;

  if (!role) {
    // Sesi valid tetapi tanpa profil: perlakukan sebagai tidak masuk.
    return redirectTo(signedOutDestination(pathname));
  }

  if (pathname === "/") return redirectTo(ROLE_HOME[role]);

  const owner = ownerRole(pathname);
  if (owner && owner !== role) return redirectTo(ROLE_HOME[role]);

  return response;
}
