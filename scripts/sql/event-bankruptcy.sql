-- Event "aset bangkrut" (delisting), usulan 18 Nov. BELUM diterapkan; pengguna yang menjalankannya di SQL Editor.
--
-- APA YANG TERJADI
--   Berita bangkrut = berita biasa (tetap 4-7 aset dengan efek harga, mis. pesaing naik, pemasok turun) PLUS satu aset
--   yang bangkrut, dicatat di tabel baru `news_bankruptcies`. Saat efek berita itu berlaku (status `applied`), dalam
--   transaksi yang sama sistem:
--     1. membatalkan SEMUA order antre aset itu (order tim: saldo/unit terkunci dikembalikan; order bandar: dihapus dari antrean);
--     2. melikuidasi unit yang dipegang tim menjadi uang pada HARGA LIKUIDASI = harga acuan × liquidation_bps / 10000,
--        dibulatkan ke `price_step` (default 1000 bps = 10 %; 0 = unit tidak bernilai). Uangnya dari panitia
--        (jumlah uang beredar bertambah; disengaja, sama seperti hadiah pos);
--     3. menonaktifkan aset (`is_active = false`): hilang dari Pasar, kuotasi bandar, IKC, dan tidak bisa diorder;
--        `bankrupt_at` dan `liquidation_price` diisi supaya UI bisa menandainya "Bangkrut";
--     4. menulis `audit_log` (`asset_bankrupt`: daftar tim, unit, uang) dan `price_history` (alasan `bangkrut`).
--   Peringatan "Apple dalam pengawasan..." hanyalah berita biasa yang terbit lebih dulu (tidak butuh fitur baru).
--
-- DESAIN (supaya aman)
--   * `process_news_cycle()` TIDAK diubah. Likuidasi dijalankan trigger AFTER UPDATE pada `news` saat status menjadi
--     `applied` (di dalam transaksi siklus berita, kunci ob_lock sudah dipegang, flag classmeet.system = on).
--   * Bila likuidasi gagal, galatnya ditangkap di trigger: dicatat `asset_bankrupt_failed` di audit dan siklus berita
--     TIDAK macet (berita tetap `applied`, aset tetap aktif). Likuidasi itu sendiri atomik (semua atau tidak sama sekali).
--   * Semua tabel/kolom baru ikut penguncian game: sesudah `started_at` terisi, berita bangkrut tidak bisa dibuat/diubah.
--   * Setiap UPDATE ber-WHERE (pg_safeupdate di Supabase hosted).
--   * Berita yang BELUM terpakai dan menyebut aset yang sudah bangkrut akan gagal terbit (check_news_effects menolak aset
--     nonaktif), kembali ke draf, dan tercatat `news_launch_failed`: jadi jangan memakai aset itu di berita lain.
--     `admin_set_news_bankruptcy` mengembalikan jumlah berita lain yang masih menyebut aset itu supaya bisa diperingatkan.
--
-- Jalankan sebagai pemilik di SQL Editor Supabase. Aman dijalankan berulang (if not exists / create or replace).

-- ---------- 1. kolom dan tabel ----------
alter table public.assets
  add column if not exists bankrupt_at       timestamptz,
  add column if not exists liquidation_price bigint check (liquidation_price is null or liquidation_price > 0);

create table if not exists public.news_bankruptcies (
  news_id         uuid primary key references public.news (id) on delete cascade,
  asset_id        uuid not null unique references public.assets (id),
  liquidation_bps int  not null default 1000 check (liquidation_bps between 0 and 5000)
);

alter table public.news_bankruptcies enable row level security;

-- Admin hanya bisa membaca SEBELUM game dibuka (sama seperti news_effects); tim tidak membacanya sama sekali.
drop policy if exists news_bankruptcies_read on public.news_bankruptcies;
create policy news_bankruptcies_read on public.news_bankruptcies
  for select to authenticated
  using (app_role() = 'admin' and not game_is_locked());

revoke all on public.news_bankruptcies from public, anon, authenticated;
grant select on public.news_bankruptcies to authenticated;

drop trigger if exists news_bankruptcies_lock on public.news_bankruptcies;
create trigger news_bankruptcies_lock
  before insert or update or delete on public.news_bankruptcies
  for each statement execute function public.guard_game_lock();

-- ---------- 2. validasi berita: tambahkan pemeriksaan aset bangkrut (badan lama dipertahankan) ----------
create or replace function public.check_news_effects(p_news_id uuid)
returns void
language plpgsql stable security definer set search_path = public
as $$
declare
  v_min int; v_max int; v_cap int;
  v_n int; v_active int; v_bad int;
begin
  select min_news_assets, max_news_assets, max_effect_bps into v_min, v_max, v_cap from game_settings;

  select count(*),
         count(*) filter (where a.is_active),
         count(*) filter (where e.pct_bps = 0 or abs(e.pct_bps) > v_cap)
    into v_n, v_active, v_bad
    from news_effects e join assets a on a.id = e.asset_id
   where e.news_id = p_news_id;

  if v_n < v_min or v_n > v_max then raise exception 'news_invalid_effects'; end if;
  if v_active <> v_n then raise exception 'news_invalid_effects'; end if;
  if v_bad > 0 then raise exception 'news_invalid_effects'; end if;

  -- aset yang bangkrut harus aktif dan tidak boleh sekaligus punya efek harga di berita yang sama
  if exists (select 1 from news_bankruptcies b join assets a on a.id = b.asset_id
              where b.news_id = p_news_id and not a.is_active) then
    raise exception 'news_invalid_effects';
  end if;
  if exists (select 1 from news_bankruptcies b
               join news_effects e on e.news_id = b.news_id and e.asset_id = b.asset_id
              where b.news_id = p_news_id) then
    raise exception 'news_invalid_effects';
  end if;
end $$;

-- ---------- 3. admin: pasang / lepas aset bangkrut pada berita draf ----------
-- p_asset_id null = lepas. Mengembalikan jumlah berita LAIN (draf/siap) yang masih punya efek harga pada aset itu.
create or replace function public.admin_set_news_bankruptcy(p_news_id uuid, p_asset_id uuid, p_liquidation_bps int default 1000)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_status news_status;
  v_other  int := 0;
begin
  if app_role() is distinct from 'admin' then raise exception 'forbidden'; end if;
  if public.game_is_locked() then raise exception 'game_started_locked'; end if;
  if p_news_id is null then raise exception 'invalid_input'; end if;

  select status into v_status from news where id = p_news_id for update;
  if not found then raise exception 'news_not_found'; end if;
  if v_status <> 'draft' then raise exception 'news_wrong_status'; end if;

  if p_asset_id is null then
    delete from news_bankruptcies where news_id = p_news_id;
    insert into audit_log (actor_id, action, payload)
    values (auth.uid(), 'set_news_bankruptcy', jsonb_build_object('news_id', p_news_id, 'asset_id', null));
    return 0;
  end if;

  if p_liquidation_bps is null or p_liquidation_bps < 0 or p_liquidation_bps > 5000 then
    raise exception 'invalid_input';
  end if;
  perform 1 from assets where id = p_asset_id and is_active;
  if not found then raise exception 'asset_not_found'; end if;
  if exists (select 1 from news_effects where news_id = p_news_id and asset_id = p_asset_id) then
    raise exception 'news_invalid_effects';                 -- aset bangkrut tidak boleh juga punya efek harga di berita ini
  end if;
  if exists (select 1 from news_bankruptcies where asset_id = p_asset_id and news_id <> p_news_id) then
    raise exception 'bankruptcy_exists';                    -- satu aset hanya bisa bangkrut di satu berita
  end if;

  insert into news_bankruptcies (news_id, asset_id, liquidation_bps)
  values (p_news_id, p_asset_id, p_liquidation_bps)
  on conflict (news_id) do update
     set asset_id = excluded.asset_id, liquidation_bps = excluded.liquidation_bps;

  select count(*) into v_other
    from news n join news_effects e on e.news_id = n.id
   where e.asset_id = p_asset_id and n.id <> p_news_id and n.status in ('draft', 'ready');

  insert into audit_log (actor_id, action, payload)
  values (auth.uid(), 'set_news_bankruptcy',
          jsonb_build_object('news_id', p_news_id, 'asset_id', p_asset_id, 'liquidation_bps', p_liquidation_bps,
                             'other_news_with_asset', v_other));
  return v_other;
end $$;

-- ---------- 4. internal: likuidasi satu aset ----------
create or replace function public.bankrupt_asset(p_asset_id uuid, p_bps int, p_news_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  a         public.assets;
  v_prev    text := coalesce(current_setting('classmeet.system', true), '');
  v_step    int;
  v_liq     bigint;
  v_cancel  int := 0;
  v_total   bigint := 0;
  v_pay     bigint;
  v_holders jsonb := '[]'::jsonb;
  h         record;
  o         record;
begin
  perform public.ob_lock();                                  -- urutan kunci: ob_lock lebih dulu
  perform set_config('classmeet.system', 'on', true);

  select * into a from assets where id = p_asset_id and is_active for update;
  if not found then
    perform set_config('classmeet.system', v_prev, true);
    return;                                                  -- sudah nonaktif/bangkrut: tidak melakukan apa pun
  end if;

  select price_step into v_step from game_settings;
  if p_bps > 0 then
    v_liq := greatest(((a.price * p_bps / 10000 + v_step / 2) / v_step) * v_step, v_step);
  end if;

  -- 1) batalkan semua order antre (ob_cancel mengembalikan saldo/unit terkunci milik tim)
  for o in select id from orders where asset_id = a.id and status in ('open', 'partial') order by id loop
    perform public.ob_cancel(o.id);
    v_cancel := v_cancel + 1;
  end loop;

  -- 2) likuidasi unit tim menjadi uang
  for h in select team_id, qty from holdings where asset_id = a.id and qty > 0 order by team_id for update loop
    v_pay := h.qty * coalesce(v_liq, 0);
    if v_pay > 0 then
      update teams set cash = cash + v_pay where id = h.team_id;
    end if;
    update holdings set qty = 0, locked_qty = 0, cost_basis = 0
     where team_id = h.team_id and asset_id = a.id;
    v_total := v_total + v_pay;
    v_holders := v_holders || jsonb_build_object('team_id', h.team_id, 'qty', h.qty, 'proceeds', v_pay);
  end loop;

  -- 3) nonaktifkan aset
  update assets
     set is_active = false, bankrupt_at = now(), liquidation_price = v_liq
   where id = a.id;

  if v_liq is not null then
    insert into price_history (asset_id, price, news_id, reason) values (a.id, v_liq, p_news_id, 'bangkrut');
  end if;

  insert into audit_log (action, payload)
  values ('asset_bankrupt',
          jsonb_build_object('asset_id', a.id, 'symbol', a.symbol, 'news_id', p_news_id,
                             'ref_price', a.price, 'liquidation_price', v_liq,
                             'orders_cancelled', v_cancel, 'total_paid', v_total, 'holders', v_holders));

  perform set_config('classmeet.system', v_prev, true);
end $$;

-- ---------- 5. pemicu: jalankan likuidasi saat efek berita berlaku ----------
create or replace function public.trg_news_bankruptcy()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare b record;
begin
  for b in select asset_id, liquidation_bps from news_bankruptcies where news_id = new.id loop
    begin
      perform public.bankrupt_asset(b.asset_id, b.liquidation_bps, new.id);
    exception when others then
      -- jangan sampai siklus berita macet; catat dan lanjut (likuidasi atomik: tidak ada perubahan setengah jalan)
      insert into audit_log (action, payload)
      values ('asset_bankrupt_failed',
              jsonb_build_object('news_id', new.id, 'asset_id', b.asset_id, 'error', sqlerrm));
    end;
  end loop;
  return null;
end $$;

drop trigger if exists news_bankruptcy_apply on public.news;
create trigger news_bankruptcy_apply
  after update of status on public.news
  for each row
  when (old.status is distinct from 'applied' and new.status = 'applied')
  execute function public.trg_news_bankruptcy();

-- ---------- hak eksekusi ----------
revoke all on function public.admin_set_news_bankruptcy(uuid, uuid, int) from public, anon;
grant execute on function public.admin_set_news_bankruptcy(uuid, uuid, int) to authenticated;
-- fungsi internal: tidak boleh dipanggil dari klien mana pun
revoke all on function public.bankrupt_asset(uuid, int, uuid) from public, anon, authenticated;
revoke all on function public.trg_news_bankruptcy() from public, anon, authenticated;

-- ---------- pemeriksaan ----------
-- Harus: admin_set_news_bankruptcy auth_exec = true, anon_exec = false; bankrupt_asset dan trg_news_bankruptcy keduanya false.
select p.proname,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_exec,
       has_function_privilege('anon', p.oid, 'execute')          as anon_exec
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('admin_set_news_bankruptcy', 'bankrupt_asset', 'trg_news_bankruptcy')
 order by 1;
