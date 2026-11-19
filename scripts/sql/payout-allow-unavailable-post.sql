-- Hadiah boleh dikirim saat pos "Tidak tersedia" (19 Nov).
--
-- Arti status pos berubah: Tersedia = pos masih kurang tim / belum ada tim untuk memulai permainan; Tidak tersedia =
-- pos penuh atau permainan sedang dimulai. Hadiah justru diberikan sesudah permainan, jadi `award_payout` TIDAK
-- lagi menolak dengan `post_closed` bila pos tidak tersedia. Satu-satunya perubahan dari fungsi sebelumnya: baris
-- `if not v_post.is_open then raise exception 'post_closed'; end if;` dihapus. Penjaga, tim, nominal, status game
-- (`open`/`paused`), dan idempotensi `request_id` tetap diperiksa seperti semula.
--
-- Cara pakai: jalankan sekali di SQL Editor (cloud) atau `docker exec -i supabase-db psql -U postgres -d postgres < file`.
-- Aman dijalankan ulang (CREATE OR REPLACE; tanda tangan fungsi sama, jadi hak akses tidak berubah).

CREATE OR REPLACE FUNCTION public.award_payout(p_request_id uuid, p_team_id uuid, p_amount bigint, p_note text DEFAULT NULL::text)
 RETURNS payouts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid      uuid := auth.uid();
  v_post     public.posts;
  v_state    game_state;
  v_existing public.payouts;
  v_row      public.payouts;
begin
  if app_role() is distinct from 'guard' then raise exception 'forbidden'; end if;

  select * into v_post from posts where guard_id = v_uid;
  if not found then raise exception 'forbidden'; end if;

  perform 1 from teams where id = p_team_id for update;
  if not found then raise exception 'team_not_found'; end if;

  select * into v_existing from payouts where request_id = p_request_id;
  if found then
    if v_existing.guard_id = v_uid and v_existing.team_id = p_team_id
       and v_existing.amount = p_amount then
      return v_existing;
    end if;
    raise exception 'request_id_conflict';
  end if;

  select state into v_state from game_settings;
  if v_state not in ('open', 'paused') then raise exception 'game_not_active'; end if;

  if p_amount is null or p_amount < 1 then raise exception 'invalid_amount'; end if;

  insert into payouts (request_id, post_id, team_id, guard_id, amount, note)
  values (p_request_id, v_post.id, p_team_id, v_uid, p_amount, p_note)
  on conflict (request_id) do nothing
  returning * into v_row;
  if not found then raise exception 'request_id_conflict'; end if;

  update teams set cash = cash + p_amount where id = p_team_id;

  insert into audit_log (actor_id, action, payload)
  values (v_uid, 'payout_awarded',
          jsonb_build_object('payout_id', v_row.id, 'team_id', p_team_id,
                             'post_id', v_post.id, 'amount', p_amount));
  return v_row;
end $function$

;
