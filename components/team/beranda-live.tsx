"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { HeroBalanceCard } from "@/components/team/hero-balance-card";
import { NewsCard } from "@/components/team/news-card";
import { usePolling } from "@/lib/hooks/use-polling";
import { formatRupiah } from "@/lib/money";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { fetchNews, fetchSummary, type NewsItem, type Summary } from "@/lib/team/data";

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
  const [summary, setSummary] = useState<Summary | null>(initialSummary);
  const [news, setNews] = useState<NewsItem[]>(initialNews ?? []);
  const [summaryFailed, setSummaryFailed] = useState(initialSummary === null);
  // `null` sampai terpasang di browser: jam tidak boleh dihitung saat render (server/klien harus sama).
  const [now, setNow] = useState<number | null>(null);

  const refreshSummary = useCallback(async () => {
    const next = await fetchSummary(supabase);
    if (next) {
      setSummary(next);
      setSummaryFailed(false);
    } else {
      setSummaryFailed(true);
    }
  }, [supabase]);

  const refreshNews = useCallback(async () => {
    const next = await fetchNews(supabase);
    if (next) setNews(next);
  }, [supabase]);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshSummary(), refreshNews()]);
  }, [refreshSummary, refreshNews]);

  usePolling(refreshSummary, SUMMARY_POLL_MS);
  usePolling(refreshNews, NEWS_POLL_MS);

  // Jam untuk lencana "Baru" dan label waktu.
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, CLOCK_MS);
    return () => window.clearInterval(id);
  }, []);

  // Realtime: pemberitahuan berita baru dan hadiah baru (RLS membatasi payouts ke tim ini).
  const dropped = useRef(false);
  useEffect(() => {
    const channel = supabase
      .channel(`beranda:${teamId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "news_feed" }, (payload) => {
        const row = payload.new as NewsFeedRow;
        toast.info(`Berita baru: ${row.title}`);
        void refreshNews();
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "payouts", filter: `team_id=eq.${teamId}` },
        async (payload) => {
          const row = payload.new as PayoutRow;
          void refreshSummary();
          const { data: post } = await supabase
            .from("posts")
            .select("name")
            .eq("id", row.post_id)
            .maybeSingle();
          toast.success(`Hadiah ${formatRupiah(row.amount)}${post ? ` dari ${post.name}` : ""} masuk`);
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          if (dropped.current) {
            dropped.current = false;
            void refreshAll(); // tersambung ulang: jangan percaya Realtime tidak terlewat
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          dropped.current = true;
        }
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, teamId, refreshNews, refreshSummary, refreshAll]);

  return (
    <div className="flex flex-col gap-6">
      <HeroBalanceCard summary={summary} unavailable={summaryFailed} />
      <NewsCard items={news} now={now} />
    </div>
  );
}
