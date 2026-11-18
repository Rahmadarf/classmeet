"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { endSession } from "@/lib/session/end-session";

/** Tombol Selesai di kartu akun sidebar tim: keluar seketika dan kembali ke /kiosk untuk tim berikutnya. */
export function FinishButton() {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      block
      loading={busy}
      loadingText="Keluar…"
      onClick={() => {
        setBusy(true);
        void endSession("logout");
      }}
    >
      <LogOut className="size-5" aria-hidden />
      Selesai
    </Button>
  );
}
