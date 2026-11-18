"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

/** Keluar (admin): cabut sesi lalu ke /login dengan muat ulang penuh supaya tidak ada data admin yang tersisa. */
export function AdminSignOut() {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      block
      loading={busy}
      loadingText="Keluar…"
      onClick={async () => {
        setBusy(true);
        const supabase = createClient();
        try {
          const { error } = await supabase.auth.signOut({ scope: "global" });
          if (error) await supabase.auth.signOut({ scope: "local" });
        } catch {
          try {
            await supabase.auth.signOut({ scope: "local" });
          } catch {
            // jaringan putus: cookie lokal dihapus saat /login dibuka
          }
        }
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/login";
      }}
    >
      <LogOut className="size-4" aria-hidden />
      Keluar
    </Button>
  );
}
