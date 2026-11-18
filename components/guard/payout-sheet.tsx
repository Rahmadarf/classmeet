"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { formatRupiah } from "@/lib/money";

export type SheetTeam = { requestId: string; teamId: string; name: string; cash: number };

/**
 * Lembar form nominal (Figma `Penjaga — Siap pindai (form nominal muncul)`, 1096:483; docs/07 §3.4) di atas layar pindai:
 * nama tim, SALDO TIM saat QR terbaca (tidak diperbarui selama form terbuka dan tidak membatasi nominal), kolom nominal,
 * tombol "Kirim Rp …" dan "Batal". Tidak ada tombol nominal cepat, dialog konfirmasi, atau catatan. Kirim menutup form
 * seketika; pengiriman berjalan di antrean latar belakang.
 */
export function PayoutSheet({
  team,
  onSend,
  onCancel,
}: {
  team: SheetTeam | null;
  onSend: (team: SheetTeam, amount: number) => void;
  onCancel: () => void;
}) {
  return (
    <Sheet open={team !== null} onOpenChange={(o) => !o && onCancel()}>
      <SheetContent side="bottom" aria-describedby={undefined}>
        {team ? <Form key={team.requestId} team={team} onSend={onSend} onCancel={onCancel} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function Form({
  team,
  onSend,
  onCancel,
}: {
  team: SheetTeam;
  onSend: (team: SheetTeam, amount: number) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const amount = text === "" ? null : Number(text);
  const valid = amount !== null && Number.isSafeInteger(amount) && amount >= 1;

  const submit = () => {
    if (valid) onSend(team, amount);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-4"
    >
      <div>
        <p className="text-brand-text text-[13px] font-semibold tracking-[0.12em] uppercase">Tim terbaca</p>
        <SheetTitle className="text-ink mt-1 text-[28px] leading-tight font-bold">{team.name}</SheetTitle>
        <SheetDescription className="sr-only">
          Isi nominal hadiah untuk {team.name}, lalu kirim.
        </SheetDescription>
      </div>

      <div className="rounded-panel bg-nav-active px-4 py-3">
        <p className="text-ink-muted text-[13px] font-medium">Saldo tim saat ini</p>
        <p className="money text-ink text-[28px] leading-tight font-bold">{formatRupiah(team.cash)}</p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="nominal-hadiah" className="text-ink-muted text-lg font-medium">
          Nominal
        </label>
        <input
          id="nominal-hadiah"
          autoFocus
          inputMode="numeric"
          enterKeyHint="send"
          autoComplete="off"
          value={text}
          onChange={(e) => setText(e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 12))}
          className="rounded-panel border-cyan-text bg-field text-ink tnum min-h-16 w-full border-2 px-5 text-[28px] font-bold"
        />
      </div>

      <div className="flex flex-col gap-3">
        <Button type="submit" size="lg" block disabled={!valid} className="min-h-14 text-[17px] font-bold">
          {valid ? `Kirim ${formatRupiah(amount)}` : "Kirim"}
        </Button>
        <Button type="button" variant="secondary" size="lg" block onClick={onCancel} className="min-h-14">
          Batal
        </Button>
      </div>
    </form>
  );
}
