# 06 — Keamanan

Tujuan: peserta tidak bisa mengubah uang atau melihat data tim lain, penjaga tidak bisa menyalahgunakan pos, dan tidak ada rahasia yang bocor. Skala acara kecil, tetapi **uang virtual yang bisa dicurangi adalah risiko utama**.

## 1. Tiga lapis penegakan peran

| Lapis | Fungsi | Bisa dilewati? |
|-------|--------|----------------|
| 1. Middleware Next.js | Mengarahkan pengguna ke halaman sesuai peran (UX) | **Ya**, jangan dijadikan satu-satunya pengaman |
| 2. Server Action | Validasi input (Zod), cek sesi, petakan error | Ya jika seseorang memanggil API Supabase langsung |
| 3. Database (RLS + RPC) | Menentukan siapa boleh apa, menjaga data | **Tidak**. Ini sumber kebenaran |

Aturan: **setiap pengecekan penting harus ada di lapis 3.** Lapis 1 dan 2 hanya mempercantik pengalaman.

## 2. Autentikasi

- **Supabase Auth**, metode email + password.
- Pendaftaran publik **dimatikan** (`Disable signups` di dashboard Supabase).
- Konfirmasi email dimatikan, karena email adalah email palsu internal.
- Username dipetakan ke `username@classmeet.local`. Peserta hanya mengenal username dan password.
- Password dibuat acak (misalnya 10 karakter tanpa karakter yang mudah tertukar) oleh skrip `create-accounts.ts` dan dicetak di **kartu akses** per tim. Kartu dibagikan langsung, bukan lewat grup chat umum.
- Panitia bisa mereset password lewat skrip admin (service role, lokal).
- Peran disimpan di `profiles.role`, **bukan** di `user_metadata` yang bisa diubah pengguna sendiri.
- Ada empat peran: `admin`, `guard`, `team`, `display`. Akun `display` (layar ruang publik) dibuat sama seperti akun lain, hanya bisa membaca, dan sebaiknya login di perangkat yang tidak dipegang peserta. Password-nya tidak dicetak di kartu tim.
- Akun admin memakai password yang lebih panjang dan **tidak** dibagikan lewat kartu akses umum.
- Sesi memakai cookie bawaan `@supabase/ssr`. Middleware menyegarkan sesi.

## 3. Otorisasi

| Data | Siapa | Mekanisme |
|------|-------|-----------|
| Saldo, holdings, transaksi | Tim pemilik, admin | RLS `using (team_id = auth.uid() or app_role() = 'admin')` |
| Saldo tim lain | Tidak ada selain admin | Tidak ada kebijakan `select` untuk peran lain |
| Isi berita yang belum tayang dan efeknya | Admin **hanya sebelum game dibuka** | RLS `news`/`news_effects`: `app_role()='admin' and not game_is_locked()`; sesudah dibuka tidak ada yang bisa membaca |
| Identitas tim dari QR | Penjaga, admin | Hanya lewat `resolve_team_qr()` / `resolve_team_code()` yang mengembalikan id, nama, dan **saldo tim itu saja** (revisi 16 Nov, untuk ditampilkan di form hadiah). Penjaga tidak punya akses baca ke `teams`, jadi tidak bisa membaca daftar atau saldo tim lain. Risiko yang diterima: pemegang akun penjaga plus satu kartu QR bisa membaca saldo tim itu; kartu sudah merupakan kredensial penuh tim, jadi tidak ada kebocoran tambahan selain saldo yang memang sudah terlihat oleh pemegang kartu |
| Hasil leaderboard | `admin`, `display` | `get_leaderboard()` menolak `team` dan `guard`; `teams`, snapshot, dan view `v_team_net_worth` tidak bisa dibaca klien |
| Hadiah pos (`payouts`) | Tim (miliknya), penjaga (pos sendiri), admin | RLS pada `payouts`; tulis hanya lewat `award_payout` |
| Menulis apa pun | Tidak ada klien | `revoke insert, update, delete`; semua lewat RPC |

## 4. Idempotensi dan konkurensi

| Masalah | Mitigasi |
|---------|----------|
| Tombol ditekan dua kali, jaringan lambat, atau *retry* otomatis | `request_id` unik per aksi dengan `unique` constraint; aksi ulang mengembalikan hasil yang sama |
| Dua tim membeli stok terakhir | `update ... where stock >= qty` mengunci baris, yang kedua gagal rapi |
| Penjaga menekan kirim dua kali atau mengirim ulang bersamaan | Kunci baris tim, lalu `request_id` unik di `payouts`; saldo bertambah sekali (diuji 10 kiriman paralel) |
| Penjaga mengirim ulang hadiah (jaringan putus, antrean lokal) | `request_id` unik; pengiriman ulang mengembalikan hadiah yang sama |
| Hadiah atau transaksi "nyelip" saat game ditutup | Menutup game mengunci semua baris tim lebih dulu; hadiah setelah `finished` ditolak (`game_not_active`); snapshot leaderboard pasti sama dengan data akhir (diuji) |
| Efek berita diterapkan dua kali | `process_news_cycle` mengunci `game_settings` dan baris berita `live`; delapan pemanggil bersamaan hanya menerapkan sekali (diuji) |
| Membeli melewati stok dengan banyak permintaan paralel | Pengurangan stok bersyarat dalam satu pernyataan; 20 pembelian @1 bersamaan pada aset berstok 7 menghasilkan tepat 7 sukses (diuji). Tidak ada batas pegang per tim (dihapus 16 Nov) |
| Harga berubah di antara pembekuan leaderboard dan penutupan game | Penutupan mengunci `game_settings`, tempat siklus berita juga mengunci; harga tidak bisa berubah di tengahnya (diuji, mutasi gagal 4 dari 6 ronde) |
| Deadlock antar fungsi | Urutan kunci konsisten: tim (urut id) → game_settings → berita → aset (urut id); melepas kunci `game_settings` pada siklus berita terbukti menimbulkan deadlock di uji stres |
| Saldo negatif akibat bug | `check (cash >= 0)` di database |

## 5. Ancaman dan mitigasi

| Ancaman | Dampak | Mitigasi |
|---------|--------|----------|
| Peserta memanggil REST Supabase langsung untuk mengubah `teams.cash` | Curang total | RLS aktif, hak tulis dicabut dari `authenticated` dan `anon` |
| Peserta memanggil RPC admin | Mengubah harga/saldo | Setiap fungsi `admin_*` mengecek `app_role() = 'admin'` di baris pertama |
| Penjaga memberi hadiah atas nama pos lain | Hadiah tidak sah | Pos ditentukan dari `guard_id = auth.uid()`, bukan parameter |
| **Penjaga salah ketik, menggelembungkan nominal, atau berkolusi dengan tim** | Hadiah tidak sah, peringkat bergeser | **Tidak ada pengaman teknis (diputuskan 13 Nov: ACC, batas nominal, dan batas kunjungan dihapus).** Uang masuk seketika. Yang tersisa: hadiah tercatat atas nama penjaga di `payouts` dan `audit_log`, dan admin bisa mengoreksi sesudahnya dengan `admin_adjust_cash`. Risiko ini diterima panitia |
| Tanpa batas kunjungan, tim dapat dibayar berulang oleh pos yang sama | Pemenang ditentukan oleh siapa yang paling sering dibayar | Tidak dicegah (diputuskan). Terlihat hanya dari `payouts` setelah kejadian |
| **Kartu QR tim diambil atau difoto** | **Karena QR juga kunci masuk, siapa pun yang memegang kartu bisa menjual seluruh aset tim itu di laptop trading** (jauh lebih berat dari sebelumnya, saat QR hanya memicu pengajuan yang masih disaring ACC) | Diputuskan 13 Nov: **tanpa PIN**, karena tim tidak membawa ponsel dan kartu fisik dijaga timnya. Penutup: semua login/logout laptop dicatat (`log_kiosk_event`, `audit_log`); panitia berjaga di area laptop trading; kartu hilang atau dicurigai → `scripts/rotate-team-qr.ts` mengganti `qr_token` dan kata sandi seketika. Risiko sisa: penjaga atau panitia berponsel yang memotret kartu |
| Sesi tim tertinggal di laptop trading (tim lupa keluar, browser macet) | Tim berikutnya berdagang atas nama tim sebelumnya | `/kiosk` selalu `signOut` global saat dibuka, timer 5 menit tanpa gerakan, tombol Selesai besar, masa berlaku token pendek; mode kiosk di browser (tanpa tombol kembali, tanpa isi otomatis) |
| Menebak rahasia QR untuk login | Pengambilalihan akun tim | Rahasia acak panjang (≥ 32 karakter), batas laju login bawaan Supabase Auth; `short_code` tidak bisa dipakai masuk |
| Menebak `short_code` (tidak dipakai UI; RPC masih ada untuk konsol) | Memberi hadiah ke tim lain | Hanya akun `guard`/`admin` yang bisa memanggil; ruang kode 36⁶. Karena tidak ada ACC, hadiah itu langsung masuk; tidak ada pembatas laju khusus |
| Tim membaca leaderboard lewat REST atau view | Melanggar aturan "leaderboard hanya di ruang publik" | `get_leaderboard` menolak tim; view `v_team_net_worth` dicabut dari klien (view memotong RLS jika tidak dicabut; diuji); `teams` hanya terbaca baris sendiri |
| Panitia mengatur harga atau waktu perubahan harga setelah game berjalan | Hasil tidak adil, kecurigaan peserta | **Penguncian database** (`game_is_locked()`, `guard_game_lock()`): sejak pembukaan pertama harga, batas harga, aset, berita, efek, `price_history`, dan parameter berita tidak bisa ditulis siapa pun kecuali fungsi sistem (GUC `classmeet.system` hanya diset di dalam fungsi `security definer`). `admin_set_price`, antrean berita, dan tombol siklus dihapus. Urutan dan waktu berita diundi sistem. **Batas jujur:** pemilik database, `service_role`, dan siapa pun dengan shell server tetap bisa menembusnya; pegang kunci itu di orang non-panitia atau jangan dipakai selama acara |
| Efek berita/koreksi harga disalahgunakan | Harga liar | `process_news_cycle` dan `check_news_effects` tidak bisa dipanggil klien; efek dibatasi 4–7 aset, maksimum ±15 %, ditolak saat disimpan dan saat terbit; harga dijepit min/maks; semua perubahan di `price_history` |
| Tim mengetahui efek berita atau waktu perubahan harga sebelum terjadi | Keuntungan tanpa membaca petunjuk | `news_effects` dan tabel `news` (berisi `effect_at`) hanya terbaca admin; tim membaca `news_feed` yang hanya memuat judul, isi, dan waktu tayang; **waktu perubahan harga diundi acak 3–15 menit oleh sistem**, jadi tidak ada yang bisa memperkirakannya. Tanpa pemisahan ini hitungan mundur bisa diambil lewat REST/Realtime walau UI menyembunyikannya (diuji, termasuk mutasi). Admin yang menulis berita mengetahui isi dan efeknya sebelum game; ia tidak tahu urutan atau waktunya, tetapi sebaiknya tidak ikut bermain atau membocorkan kunci jawaban |
| Berita bermasalah (salah ketik, kunci salah) masuk kumpulan atau tayang | Hasil tidak adil | Berita `ready`/`live` tidak bisa disunting (`news_wrong_status`); berita `ready` bisa dikeluarkan sebelum terpilih; semua penandaan tercatat di `audit_log`; pemilih acak membuang berita yang menabrak batas harga |
| Kumpulan berita habis atau semua calon berbahaya | Pasar diam | `get_news_pool_status` dan peringatan di panel admin (*siap*, *boleh terbit sekarang*); ±220 berita disiapkan sebelum game dibuka (setelahnya tidak bisa ditambah) |
| Internet sekolah putus | Seluruh permainan tidak terjangkau lewat Cloudflare Tunnel meski server menyala | Lihat [11-deployment](11-deployment.md): sambungan cadangan (hotspot seluler), jeda pasar, penjaga mencatat di kertas |
| Panel Supabase Studio atau API terbuka ke internet | Akses penuh ke data | Studio tidak dipublikasikan lewat tunnel; hanya aplikasi dan API (Kong) yang dipublikasikan; kunci demo bawaan diganti |
| Replay permintaan | Transaksi ganda | `request_id` unik |
| Kebocoran `SUPABASE_SERVICE_ROLE_KEY` | Akses penuh ke database | Hanya di laptop panitia, tidak di container aplikasi, tidak di repo; rotasi setelah acara |
| Menebak password | Pengambilalihan akun | Password acak panjang, batas laju login bawaan Supabase |
| XSS lewat isi berita | Skrip berjalan di browser peserta | Tampilkan berita sebagai teks biasa; jangan pakai `dangerouslySetInnerHTML` |
| Akses data tim lain (IDOR) | Kebocoran saldo | RLS memakai `auth.uid()`, bukan id dari klien |
| `search_path` hijacking pada fungsi `security definer` | Eskalasi hak | `set search_path = public` di setiap fungsi |
| Panitia salah ketik | Data salah | Setiap aksi admin butuh alasan, konfirmasi, dan tercatat di audit |
| Spam klik massal ke RPC | Beban berlebih | Tombol dinonaktifkan saat proses; opsional batas laju per tim di RPC (lihat bawah) |

### Batas laju opsional di RPC

Jika perlu, tambahkan di awal `place_order`, setelah kunci tim:

```sql
if (select count(*) from orders
     where team_id = v_uid and created_at > now() - interval '1 minute') >= 30 then
  raise exception 'rate_limited';
end if;
```

Tambahkan `rate_limited` ke tabel error ([04-rpc-contracts](04-rpc-contracts.md#7-error-code)) jika dipakai.

## 6. Rahasia dan konfigurasi

- `.env*` di `.gitignore`. Hanya `.env.example` yang di-commit.
- `NEXT_PUBLIC_*` boleh publik (URL dan *anon key*). Keamanan dijaga RLS, bukan kerahasiaan kunci itu.
- `SUPABASE_SERVICE_ROLE_KEY` dan `DATABASE_URL` hanya di mesin lokal panitia.
- Aktifkan 2FA di akun GitHub dan Cloudflare yang dipakai. Ganti **semua** kunci bawaan Supabase self-hosted (JWT secret, anon key, service role key, kata sandi Postgres dan dashboard); jangan pakai nilai contoh dari repositori Supabase.
- Setelah acara: rotasi kunci, hapus akun peserta, matikan tunnel dan hapus data atau arsipkan cadangan.

## 7. Privasi

- Minimalkan data pribadi: yang disimpan hanya username, nama tampilan, dan nama tim. Tidak ada email asli, nomor telepon, atau data sensitif.
- Jangan menaruh nama lengkap peserta di data yang tampil ke semua orang.
- Hapus semua akun dan data peserta setelah acara selesai dan hasil diarsipkan.

## 8. Audit

`audit_log` mencatat setiap aksi panitia dan penjaga yang mengubah uang, harga, stok, status game, dan penerbitan berita. Isi minimal: pelaku, aksi, data sebelum/sesudah, waktu. Log **hanya ditulis fungsi database** dan hanya bisa dibaca admin.

## 9. Daftar periksa sebelum rilis

- [ ] RLS aktif di semua tabel; tidak ada tabel tanpa RLS.
- [ ] Uji: akun `team` mencoba `update teams set cash = ...` lewat REST → **ditolak**.
- [ ] Uji: `admin_set_price`, `admin_queue_news`, `admin_run_news_cycle` **tidak ada** sebagai fungsi; akun `admin` mengubah `assets.price` atau menulis `price_history`/`news` setelah game dibuka → `game_started_locked`.
- [ ] Uji: akun `guard`, `admin`, `display` memanggil `place_order` atau `get_order_book` → `forbidden`; `authenticated` memanggil `process_house_quotes`, `process_market_cycle`, `ob_match`, `ob_cancel` → ditolak.
- [ ] Uji: tim membaca `orders`/`trades` → hanya baris miliknya; tim menulis langsung ke `orders`/`trades` → ditolak; `update` pada `orders`, `trades`, `assets.last_price`, dan parameter order book tanpa penanda sistem setelah game dibuka → `game_started_locked`.
- [ ] Uji: akun `team` memanggil `get_leaderboard` → `forbidden`; `select` dari `v_team_net_worth` dan `leaderboard_snapshot` → ditolak.
- [ ] Uji: akun `guard` membaca `teams` → kosong; memanggil `admin_adjust_cash` → `forbidden`.
- [ ] Uji: hadiah pos **langsung** mengubah saldo, hadiah ganda dengan `request_id` sama (termasuk paralel) menambah sekali, dan setelah `finished` ditolak.
- [ ] Uji: `authenticated` tidak bisa memanggil `process_news_cycle`, `check_news_effects`, `freeze_leaderboard_internal`.
- [ ] Uji: klien tidak bisa `insert/update/delete` langsung pada `news` dan `news_effects`; dua berita `live` ditolak indeks unik.
- [ ] Uji: akun `team` melihat `news_effects` → kosong atau ditolak.
- [ ] Uji: `request_id` yang sama dikirim 20 kali paralel → satu transaksi (atau satu hadiah) tercatat.
- [ ] Pendaftaran publik Supabase mati.
- [ ] Service role key tidak ada di repo, container aplikasi, atau bundle browser (cek dengan pencarian string di hasil build).
- [ ] Semua fungsi `revoke execute ... from public, anon`.
- [ ] Tidak ada `dangerouslySetInnerHTML` yang menerima data pengguna.
- [ ] Peninjauan SQL fungsi oleh orang kedua (idealnya).

> Catatan: contoh SQL di dokumen ini sudah diuji pada PostgreSQL 16 dengan stub Supabase (lihat [10-verification-report](10-verification-report.md)), tetapi **belum diuji di Supabase sungguhan** dan **belum ditinjau orang lain**. Wajib diuji pada project staging sebelum dipakai.
