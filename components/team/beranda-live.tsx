"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { HeroBalanceCard } from "@/components/team/hero-balance-card";
import { NewsCard } from "@/components/team/news-card";
import { formatRupiah } from "@/lib/money";
import { qk } from "@/lib/query/keys";
import { pollOptions, seedMaybe } from "@/lib/query/options";
import { newsQuery, summaryQuery } from "@/lib/query/queries";
import { useRealtime } from "@/lib/query/use-realtime";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import type { NewsItem, Summary } from "@/lib/team/data";

type PayoutRow = Database["public"]["Tables"]["payouts"]["Row"];
type NewsFeedRow = Database["public"]["Tables"]["news_feed"]["Row"];

const SUMMARY_POLL_MS = 10_000; // docs/02 §5: get_my_summary tiap ±10 detik
const NEWS_POLL_MS = 30_000; // cadangan bila Realtime terlewat
const CLOCK_MS = 30_000;

/**
 * Isi Beranda yang hidup. Data awal dari server; sesudahnya:
 *  - saldo: polling 10 dtk + segera setelah ada hadiah baru untuk tim ini (Realtime `payouts`);
 *  - berita: Realtime `news_feed` (INSERT) + polling cadangan 30 dtk;
 *  - saat tab aktif lagi / koneksi tersambung ulang / kanal Realtime tersambung ulang: ambil ulang semua.
 * Realtime hanya pemberitahuan; sumber kebenaran tetap `get_my_summary()` dan `news_feed`.
 */
export function BerandaLive({
  teamId,
  initialSummary,
  initialNews,
}: {
  teamId: string;
  initialSummary: Summary | null;
  initialNews: NewsItem[] | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  // Kunci `summary` dibagi dengan Pasar dan Portofolio; `news` (30) khusus Beranda.
  const summaryQ = useQuery({
    ...summaryQuery(supabase),
    ...pollOptions(SUMMARY_POLL_MS),
    ...seedMaybe(initialSummary),
  });
  const newsQ = useQuery({
    ...newsQuery(supabase, 30),
    ...pollOptions(NEWS_POLL_MS),
    ...seedMaybe(initialNews),
  });
  const summary: Summary | null = summaryQ.data ?? null;
  const summaryFailed = summaryQ.isError || summaryQ.data === undefined;
  const news: NewsItem[] = newsQ.data ?? [];
  // `null` sampai terpasang di browser: jam tidak boleh dihitung saat render (server/klien harus sama).
  const [now, setNow] = useState<number | null>(null);

  // Jam untuk lencana "Baru" dan label waktu.
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, CLOCK_MS);
    return () => window.clearInterval(id);
  }, []);

  // Realtime: pemberitahuan berita baru dan hadiah baru (RLS membatasi payouts ke tim ini).
  useRealtime(`beranda:${teamId}`, [
    {
      event: "INSERT",
      table: "news_feed",
      onEvent: (payload) => {
        const row = payload.new as NewsFeedRow;
        toast.info(`Berita baru: ${row.title}`);
        void queryClient.invalidateQueries({ queryKey: ["news"] });
      },
    },
    {
      event: "INSERT",
      table: "payouts",
      filter: `team_id=eq.${teamId}`,
      onEvent: async (payload) => {
        const row = payload.new as PayoutRow;
        void queryClient.invalidateQueries({ queryKey: qk.summary });
        void queryClient.invalidateQueries({ queryKey: qk.history(teamId) });
        const { data: post } = await supabase
          .from("posts")
          .select("name")
          .eq("id", row.post_id)
          .maybeSingle();
        toast.success(`Hadiah ${formatRupiah(row.amount)}${post ? ` dari ${post.name}` : ""} masuk`);
      },
    },
  ]);

  return (
    <div className="flex flex-col gap-6">
      <HeroBalanceCard summary={summary} unavailable={summaryFailed} />
      <NewsCard items={news} now={now} />
    </div>
  );
}
