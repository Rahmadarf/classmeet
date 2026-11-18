import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16: konvensi `middleware` diganti `proxy` (lihat docs/13-log-implementasi.md).
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Lewati berkas statis, gambar, dan WASM pembaca QR (/vendor, dipakai /kiosk sebelum ada sesi).
    "/((?!_next/static|_next/image|favicon.ico|vendor/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|wasm)$).*)",
  ],
};
