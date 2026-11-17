# 09 — Roadmap, Pengujian, dan Risiko

## 1. Urutan pengerjaan

Urutan ini mengutamakan bagian yang **paling mahal jika salah** (data dan transaksi) di awal. Tampilan dipoles belakangan. Estimasi waktu sengaja tidak diberikan karena tanggal acara belum diketahui; isi sendiri setelah tanggal pasti.

| Tahap | Isi | Selesai bila |
|-------|-----|--------------|
| **M0 — Fondasi** | Repo, Next.js + Tailwind, Supabase staging, `.env.example`, linting, struktur folder | Aplikasi kosong berjalan dan terhubung ke Supabase staging |
| **M1 — Data dan keamanan** | Migrasi skema, RLS, helper `app_role()`, `game_settings`, seed aset, pencabutan hak view dan fungsi | Semua tabel ada, RLS aktif, uji RLS lulus (SQL sudah ada dan lulus di Postgres lokal; ulangi di Supabase) |
| **M2 — Auth dan peran** | Skrip `create-accounts.ts` (termasuk `qr_token` sebagai kata sandi akun tim, akun `display`; `short_code` tetap dibuat tetapi tidak dipakai UI), `print-qr.ts`, `rotate-team-qr.ts`, login staf, **halaman `/kiosk`** (pindai QR → `signInWithPassword`, keluar otomatis 5 menit), middleware per peran | Empat peran bisa masuk; kartu QR tim masuk di laptop dan keluar sendiri setelah 5 menit |
| **M3 — Trading inti** | `place_order`, `cancel_order`, kuotasi bandar, `get_order_book`, `get_market_summary`, `get_market_index` (SQL dan uji sudah ada); halaman Pasar sebagai order book, halaman Order, Display pasar | Uji konservasi uang dan unit, pencocokan, konkurensi, dan idempotensi lulus; tim bisa pasang, batalkan, dan terisi end-to-end |
| **M4 — Pos, QR, dan hadiah** | `resolve_team_*`, `award_payout`, halaman pindai penjaga (kamera + toggle pos + antrean lokal, tanpa daftar/riwayat), daftar pos tim, layar publik 5 kartu, halaman Hadiah admin (tampilan saja) | Alur kartu QR → form → hilang → saldo tim langsung bertambah bekerja end-to-end di ponsel penjaga nyata |
| **M5 — Admin dan siklus berita** | Tombol Buka/Tutup pasar dan Akhiri, harga/stok manual **hanya sebelum game dibuka** (sesudahnya terkunci), halaman kumpulan berita admin (persiapan sebelum dibuka; kartu jumlah sesudahnya, tanpa hitung mundur), panel status dengan indikator kumpulan (`get_news_pool_status`), `scripts/import-news.ts` (pemeriksa + simulasi + impor; sudah ditulis, bagian online belum dicoba di Supabase), koreksi saldo, audit, **jadwal `pg_cron` `process_news_cycle`** tiap 10 detik (diverifikasi di image Supabase self-hosted) | Panitia menjalankan satu hari penuh: pasar dibuka, berita terpilih acak sendiri, harga berubah pada waktu acak 3–15 menit sesudah terbit, berita berikutnya terpilih sistem; harga tak pernah menabrak batas; setiap upaya admin mengubah harga atau berita ditolak |
| **M6 — Realtime dan layar publik** | Langganan Realtime (`assets`, `news_feed`, `game_settings`, `payouts`, `posts`), `get_leaderboard`, halaman `/display`, pembekuan, snapshot | Harga, status, dan saldo berubah tanpa muat ulang; layar publik menampilkan peringkat, tim tidak bisa melihatnya |
| **M7 — Pemolesan** | UI akhir, aksesibilitas, pesan error, banner status, ekspor CSV | Lolos daftar periksa UI di [07-ui-ux](07-ui-ux.md) |
| **M8 — Uji penuh** | Uji beban, uji keamanan, latihan pemulihan, gladi bersih | Semua daftar periksa di [08-operations](08-operations.md) lulus |
| **M9 — Hari-H** | Produksi, kartu akses, pelaksanaan | Acara selesai, hasil diekspor |

Jika waktu sempit, **potong** dari M7 dan M6 (layar publik bisa diganti halaman leaderboard admin yang diproyeksikan, dan pembaruan harga bisa memakai polling), tetapi **jangan memotong M1, M3, M4, dan uji di M8**. Tanpa pemberian hadiah yang andal, tim yang mulai dari Rp 0 tidak bisa bermain.

## 2. Definisi selesai (per fitur)

Fitur dianggap selesai bila:

1. Berjalan end-to-end di staging.
2. Punya uji otomatis untuk jalur sukses dan sedikitnya dua jalur gagal.
3. Pesan error ramah sudah ditampilkan, bukan pesan teknis.
4. Tercatat di `audit_log` bila mengubah uang, harga, stok, atau status.
5. Dicoba di perangkat nyata: ponsel untuk penjaga dan admin, laptop trading untuk tim.

## 3. Strategi pengujian

### 3.1 Uji database (paling penting)

Suite untuk PostgreSQL lokal ada di folder [`tests/`](tests/) (Python + psycopg2; 362 pemeriksaan, lihat [10-verification-report](10-verification-report.md)). Bagian yang berhubungan dengan Supabase sungguhan (JWT, PostgREST, Realtime, `pg_cron`) harus diulang di project staging dengan skrip Node yang memakai klien Supabase atas nama pengguna uji.

| Uji | Skenario | Hasil yang benar |
|-----|----------|------------------|
| Konkurensi stok | 30 pembelian paralel, stok 5, saldo cukup | Tepat 5 sukses; sisanya `out_of_stock`; stok akhir 0 |
| Konkurensi saldo | 1 tim, 10 pembelian paralel yang totalnya melebihi saldo | Saldo tidak pernah negatif; sisanya `insufficient_cash` |
| Idempotensi beli | `request_id` sama dikirim 20 kali paralel | 1 transaksi; semua panggilan mengembalikan transaksi yang sama |
| Konflik `request_id` | `request_id` sama untuk aset berbeda | `request_id_conflict` |
| Idempotensi hadiah | `request_id` sama untuk hadiah, 10–20 kali paralel | 1 baris `payouts`; saldo naik tepat sekali |
| **Hadiah langsung masuk** | Penjaga memberi hadiah | Saldo tim naik seketika sebesar nominal; `payout_awarded` di `audit_log` |
| Tanpa batas | 6 hadiah ke tim dan pos yang sama; nominal 1 triliun | Semua diterima (diputuskan); koreksi `admin_adjust_cash` memulihkan |
| Sistem ACC tidak ada | Cari `payout_requests`, `admin_review_payout`, `submit_payout_request` | Tidak ada |
| Tanpa batas pegang | Satu tim beli 11 sekaligus; beli 6 lalu 4 lalu 1; jual lalu beli lagi | Semua sukses selama stok dan saldo cukup; stok tidak bocor saat ditolak |
| Stok konkuren | 20 pembelian @1 bersamaan oleh tim yang sama pada aset berstok 7; 6 pembelian @4 pada aset berstok 10 | Tepat 7 sukses; tepat 2 sukses; stok tidak pernah negatif |
| Modal awal 0 | Tim baru membeli | `insufficient_cash` |
| QR | Resolve token valid, tidak valid, kode cadangan huruf kecil/spasi (RPC teknis, tanpa UI), rotasi QR | Sesuai; token lama mati setelah rotasi |
| Nominal tidak valid | Nominal 0, negatif, null | `invalid_amount` (tanpa batas atas) |
| Status game | Beli/jual saat `setup`, `paused`, `finished` | `market_closed` |
| Hadiah saat `paused` | Saat dijeda | Sukses (sesuai aturan) |
| Tutup game | Setelah `finished`, hadiah baru | `game_not_active`; snapshot dibuat |
| Tutup game vs transaksi | Beli/jual/hadiah ramai saat game ditutup | Snapshot sama dengan data akhir (tidak ada yang nyelip) |
| Validasi berita | 3 atau 8 aset, aset ganda, persen 0, ±1501, aset nonaktif, judul kosong | `news_invalid_effects` / `invalid_input`; tidak ada berita atau efek yatim tersisa |
| Siklus berita | Tandai siap saat setup; buka game; efek jatuh tempo; jeda antarberita; rentang jeda diubah (min=max) | Berita terbit otomatis, jeda diundi acak dalam [180, 890] detik (sebarannya lebar, bukan tetap), urutan acak, `news_gap_minutes` dihormati, hanya satu berita live |
| Penguncian setelah dibuka | Admin mengubah harga, batas, aset aktif, tambah/hapus aset, `price_history`, berita, efek, parameter berita; membaca `news` | Semua `game_started_locked` atau kosong; stok tetap boleh diubah; `started_at` terisi; fungsi `admin_set_price`/`admin_queue_news`/`admin_run_news_cycle` tidak ada |
| Hasil efek | Aset +5 %, +7 %, +12 %, −6 % (dengan pembulatan), dijepit max, aset nonaktif | 10.000→10.500; 20.000→21.400; 5.000→5.600; 8.000→7.500; dijepit ke max; aset nonaktif dilewati |
| Jeda dan lanjut | Efek jatuh tempo saat `paused`; lanjut setelah 3 menit | Harga tidak berubah saat jeda; `effect_at` bergeser sebesar lama jeda (tanpa membuka kunci) |
| Peluncuran gagal | Aset dinonaktifkan sebelum berita terpilih | Berita kembali ke draf, audit tercatat, siklus tidak macet |
| Efek diterapkan sekali | 8 pemanggil `process_news_cycle` bersamaan | Tepat sekali (4 baris `price_history`) |
| Tutup game dengan berita | Berita live; tanpa opsi `force` | `news_pending`; fungsi satu argumen; state dan berita tetap; sesudah `finished` siklus idle |
| Siklus tidak bisa dipanggil klien | `process_news_cycle` oleh admin/tim/penjaga/display/tanpa profil | Ditolak untuk semua; hanya `pg_cron` dan fungsi sistem |
| Batas harga saat semua calon tidak aman | Semua berita `ready` menabrak batas | Tetap terbit acak, harga dijepit ke batas, pasar tidak macet |
| Leaderboard | Dipanggil tim, penjaga, display, admin; disembunyikan; dibekukan; **harga transaksi terakhir naik 2× menaikkan nilai aset dan net worth**; saldo terkunci tetap dihitung | Tim/penjaga `forbidden`; display `leaderboard_hidden` saat disembunyikan, snapshot saat dibekukan; admin selalu langsung |
| Order book dasar | Beli/jual market ke bandar, limit antre, silang, partial fill, sapuan market ≤ 5 level, prioritas harga lalu waktu, self-trade, ARA/ARB, fraksi harga, saldo pas | Harga, biaya (0,25 %, dibulatkan ke atas), saldo, kunci, dan `trades` sesuai hitungan manual |
| Jual lebih dari dimiliki atau lot yang sudah terkunci | Jual qty melebihi `holdings.qty - locked_qty` | `insufficient_holdings` |
| Pembukuan | Setelah ratusan order acak dan konkuren | Σ(saldo + terkunci) + uang bandar = Σ modal masuk; bandar + Σ milik tim = stok awal; kunci = Σ order antre; saldo dan kepemilikan tiap tim sama dengan hasil pembangunan ulang dari `trades` |
| Koreksi saldo | `admin_adjust_cash` yang membuat saldo negatif | Ditolak |
| Stres campuran | 8 thread × 40 operasi acak (order beli/jual, batal, hadiah, tandai siap, siklus berita, koreksi); 12 thread order bersamaan dengan isi ulang bandar, jeda/lanjut, dan penutupan game | Tanpa deadlock; uang dan unit kekal; sesudah `finished` tak ada order antre dan kunci |
| Audit | Aksi admin dan hadiah | Baris audit tercipta dengan pelaku dan data yang benar |

### 3.2 Uji keamanan / RLS

| Uji | Hasil yang benar |
|-----|------------------|
| Tim `update teams set cash = ...` lewat REST | Ditolak |
| Tim membaca `teams` milik tim lain | Tidak ada baris |
| Tim membaca `news_effects` atau tabel `news` (`effect_at`) | Kosong atau ditolak; berita hanya lewat `news_feed` |
| Tim memanggil `admin_*` | `forbidden` |
| Penjaga, admin, display memanggil `place_order` / `get_order_book` | `forbidden` |
| Tim membaca `orders` / `trades` | Hanya baris miliknya; menulis langsung ditolak; order bandar tak terbaca |
| Klien memanggil `process_house_quotes` / `process_market_cycle` / `ob_match` | Ditolak (hak eksekusi dicabut) |
| Penjaga memberi hadiah atas nama pos lain | Mustahil: pos ditentukan dari akun |
| Pengguna anonim memanggil RPC apa pun | Ditolak |
| Penjaga membaca tabel `teams` langsung | Tidak ada baris (saldo hanya lewat `resolve_team_qr` untuk tim yang dipindai) |
| Tim / penjaga memanggil `get_leaderboard` | `forbidden` |
| Tim membaca `v_team_net_worth` atau `leaderboard_snapshot` | Ditolak |
| Klien memanggil `process_news_cycle` / `check_news_effects` | Ditolak (hak eksekusi dicabut) |
| Klien menulis langsung ke `news` / `news_effects` | Ditolak |

### 3.3 Uji aplikasi (E2E)

Dengan Playwright pada staging (Docker, bukan hosting terkelola), minimal alur berikut:

1. Tim memindai kartu di `/kiosk` → masuk → melihat pasar → membeli → melihat portofolio → menjual → Selesai (keluar).
   - Variasi: biarkan 5 menit tanpa gerakan → keluar otomatis; buka `/kiosk` setelah tim lain lupa keluar → sesi lama tidak terbawa; tidak ada kolom kode di `/kiosk`.
2. Admin membuka pasar dengan kumpulan berita siap → berita terpilih sendiri dan muncul di halaman tim tanpa muat ulang → pada waktu acak (dipercepat di staging) harga berubah tanpa muat ulang, efek tidak terlihat oleh tim.
3. Penjaga memindai kartu QR tim → form muncul → submit → form hilang dan kamera siap lagi → saldo tim langsung bertambah dan toast muncul di sisi tim (jika ada tim yang sedang login).
4. Admin menekan Tolak → saldo tim tidak berubah, penjaga melihat status ditolak.
5. Putuskan jaringan di ponsel penjaga saat submit → hadiah tetap masuk antrean lokal dan terkirim sekali saat tersambung.
6. Admin menekan Tutup pasar → tombol Beli tetap aktif tetapi konfirmasi ditolak dengan pesan pasar tutup, data pasar tetap terlihat dan siklus berita berhenti (diperiksa di halaman berita admin: hitung mundur berhenti); Buka pasar → siklus lanjut dengan tenggat bergeser.
7. Login dengan peran yang salah mencoba membuka halaman peran lain → diarahkan; akun tim tidak menemukan halaman leaderboard.
8. Layar `display` menampilkan peringkat dan berubah setelah transaksi; dibekukan → tidak berubah.

### 3.4 Uji manual di perangkat

- Ponsel penjaga: minimal tiga jenis (Android lama, Android baru, iPhone) dengan sinar matahari dan jaringan seluler.
- Laptop trading: semua laptop yang akan dipakai diuji kameranya membaca kartu QR cetak (laminasi, cahaya ruangan sebenarnya) lewat domain produksi (HTTPS).
- Putus-sambung jaringan saat transaksi untuk memastikan tidak ada transaksi ganda.
- Orientasi layar, kecerahan, dan ukuran font besar.

### 3.5 Gladi bersih

Satu rundown penuh yang dipercepat (misalnya 3 jam jadi 40 menit) dengan panitia dan relawan sebagai tim dan penjaga. Tujuan: menemukan masalah **alur manusia**, bukan hanya bug kode. Catat setiap kebingungan, lalu perbaiki UI atau panduannya.

## 4. Register risiko

| # | Risiko | Kemungkinan | Dampak | Mitigasi |
|---|--------|-------------|--------|----------|
| 1 | Internet lokasi tidak stabil | Sedang | Tinggi | Uji di lokasi; siapkan hotspot cadangan; prosedur catat di kertas; idempotensi membuat input ulang aman |
| 2 | Bug transaksi merusak saldo | Rendah | Sangat tinggi | RPC atomik, constraint `cash >= 0`, uji konkurensi, audit, koreksi admin |
| 3 | Panitia salah ketik harga/saldo | Sedang | Sedang | Alasan wajib, konfirmasi, audit, pratinjau berita, koreksi balik |
| 4 | Server sekolah atau Docker bermasalah (listrik, restart, disk penuh, kontainer mati) | Sedang | Tinggi | `restart: unless-stopped`, UPS bila ada, cadangan `pg_dump` berkala disalin keluar server, pemulihan sudah dilatih, server tidak boleh tidur, rencana tutup pasar |
| 5 | Kebocoran service role key | Rendah | Sangat tinggi | Hanya lokal dan di file `.env` server (bukan repo), kunci contoh Supabase diganti, rotasi setelah acara |
| 6 | Kecurangan peserta | Sedang | Sedang | RLS, RPC, audit, aturan fair play |
| 7 | Penjaga salah input atau tidak paham alat | Sedang | Sedang | Antarmuka sederhana, gladi, lembar panduan satu halaman, briefing "periksa nominal sebelum kirim", koreksi admin sesudahnya |
| 13 | **Salah ketik nominal atau penjaga curang langsung mengubah saldo; tanpa ACC, batas nominal, atau batas kunjungan (diputuskan panitia)** | **Sedang** | **Tinggi** | Tidak ada pengaman teknis. Briefing penjaga, halaman Hadiah untuk pengawasan sesudahnya, `admin_adjust_cash` untuk koreksi, pemeriksaan hasil akhir sebelum diumumkan. Risiko diterima |
| 14 | Tim dibayar berulang oleh pos yang sama; penjaga berkolusi | Sedang | Sedang | Tidak dicegah (diputuskan). Terlihat di `payouts`; aturan fair play; audit |
| 15 | Kamera/QR gagal di lapangan | Sedang | Sedang | Kode cadangan, kartu QR cetak, uji semua QR di staging, rotasi QR bila bocor |
| 16 | `pg_cron` tidak berjalan, harga tidak berubah atau berita tidak terbit | Rendah | Tinggi | Cek `cron.job_run_details` dan log database di server; tidak ada tombol atau hitung mundur di aplikasi (sengaja, supaya panitia tidak bisa menyentuh waktu harga); tanda macet: berita tayang >16 menit |
| 17 | Kumpulan berita habis, atau semua calon berbahaya bagi batas harga; pasar diam | Sedang | Sedang | ±220 berita untuk ±215 yang dibutuhkan (bila `news_gap_minutes = 0`), harus lengkap sebelum game dibuka; panel status memberi peringatan sebelum dibuka; bila tidak ada calon aman sistem tetap memilih dan menjepit harga; bila kumpulan habis pasar diam. Tidak ada koreksi manual; gladi tiga hari yang dipercepat |
| 18 | Petunjuk berita tidak bisa diterjemahkan karena aset tidak punya profil jelas, atau kunci jawaban ambigu | Sedang | Tinggi | Profil/sifat tiap aset dibagikan sebelum acara; kunci jawaban ditinjau orang kedua |
| 19 | Trading terlalu kecil atau terlalu besar dibanding hadiah pos (efek 8–14 %, tanpa batas pegang; tim kaya bisa memborong stok) | Sedang | Sedang | Efek sudah dinaikkan ke 8–14 % agar pembeda tidak tipis. Pantau di gladi apakah pemenang masih ditentukan pos; penyetelnya efek per berita (maks 15 %), hadiah pos, dan biaya jual. Lihat [05, bagian 4.5](05-game-rules.md#45-catatan-desain-untuk-panitia) |
| 20 | Parameter order book (biaya 0,25 %, spread bandar 1 fraksi, `ceil(stok/10)` lot per level, isi ulang 5 menit, ARA/ARB 15 %) belum teruji di permainan nyata | Sedang | Sedang | **Terkunci sejak game dibuka** (`fee_bps`, `band_bps`, level bandar, dll. tidak bisa diubah panitia). Tentukan angkanya di gladi, sebelum tombol Buka ditekan pertama kali |
| 27 | **Manipulasi harga terakhir**: dua tim bersekongkol jual-beli lot kecil untuk menggeser harga terakhir menjelang pembekuan, padahal peringkat memakai harga itu | Sedang | Tinggi | Dicatat dan belum ada mitigasi di kode: hanya batas ARA/ARB dan jejak `trades`. Opsi (doc 12 §7): VWAP 10 menit, atau abaikan transaksi antar-tim di bawah 2 lot. Putuskan sebelum gladi akhir; setelah game dibuka rumus tidak bisa diubah |
| 21 | Pembulatan `price_step` meniadakan perubahan pada aset murah | Rendah | Rendah | Jaga `price_step` jauh lebih kecil dari `harga × persen` (aset Rp 1.000 naik 3 % tetap Rp 1.000 dengan step Rp 100) |
| 8 | Peserta bingung aturan | Sedang | Sedang | Halaman "Cara bermain" singkat, pengarahan sebelum mulai |
| 9 | Waktu pengembangan tidak cukup | Sedang | Tinggi | Urutan M0–M9, kode beku H-3, potong dari M6–M7 bukan M1–M4 |
| 10 | Cloudflare Tunnel atau internet sekolah putus: **server hidup tetapi tidak bisa diakses** | Sedang | Tinggi | Hotspot seluler cadangan yang sudah diuji; tutup pasar dan catat di kertas; idempotensi membuat kirim ulang aman; cek jaringan tiap pagi |
| 11 | Beban lebih tinggi dari perkiraan (lonjakan saat berita terbit) | Rendah | Sedang | Uji beban; Realtime hanya memberi tahu, klien mengambil ulang data dengan jeda |
| 12 | Tombol "Akhiri game" tertekan tak sengaja | Rendah | Tinggi | Dialog konfirmasi dua langkah; prosedur darurat tertulis |
| 22 | **Kartu QR dicuri/dipinjam = akses penuh ke akun tim** (tanpa PIN, diputuskan) | Sedang | Sedang | Petugas di area laptop, log login per laptop di `audit_log`, rotasi kartu cepat lewat meja bantuan, tim tahu kartunya rahasia |
| 23 | Sesi tim tertinggal terbuka di laptop | Sedang | Sedang | Keluar otomatis 5 menit, `/kiosk` selalu menghapus sesi lama, tombol Selesai jelas |
| 24 | Jumlah laptop trading kurang, antrean panjang saat berita terbit | Sedang | Sedang | Tentukan jumlah laptop sejak sekarang (belum diketahui); sesi singkat 5 menit; petugas mengatur antrean |
| 25 | `pg_cron` tidak tersedia/aktif di image Supabase self-hosted (tidak bisa diuji di lingkungan pengembangan ini) | Sedang | Tinggi | Verifikasi di H-7 ([11-deployment](11-deployment.md)); cadangan: kontainer kecil atau cron host yang memanggil `process_news_cycle()` tiap menit |
| 26 | Admin lupa menutup pasar malam; berita terus terbit saat tidak ada yang melihat | Sedang | Sedang | Daftar periksa penutupan 19.00, satu orang ditugaskan; koreksi harga manual bila perlu |

## 5. Pertanyaan yang masih terbuka

Lihat [01-overview, bagian 9](01-overview.md#9-keputusan-yang-masih-terbuka). Keputusan terpenting yang memengaruhi kode sebelum M3 dimulai:

Sudah diputuskan: modal awal Rp 0; tanpa batas kunjungan; leaderboard hanya di ruang publik; hadiah lewat kartu QR **langsung masuk saldo, tanpa ACC, tanpa batas nominal** (diputuskan 13 Nov); **harga hanya berubah lewat berita (15 menit setelah tayang, jeda 5 menit); berita dipilih sistem secara acak berbatas dari kumpulan ±100 berita siap**; 4–7 aset per berita, eksplisit per aset, efek maksimum 15 %; tanpa batas kepemilikan per tim (dihapus 16 Nov); 25 aset; biaya jual 5 %; game 3 hari, pasar dibuka dan ditutup admin dengan tombol (08.00–19.00); tim tanpa ponsel, berdagang di laptop panitia dengan kartu QR (keluar otomatis 5 menit); Docker di server sekolah + Cloudflare Tunnel; game diakhiri manual setelah perubahan harga terakhir; beranda tim hanya tiga angka (nilai aset menurut harga beli, peringkat juga harga beli); layar publik 5 tim; tombol Beli tidak pernah nonaktif; folder `app/` tanpa `src/`; admin tambahan direkrut.

Masih terbuka:

1. **Bahan berita ±100** (teks, kalimat pengecoh, kunci jawaban) dan konfirmasi profil/kata kunci 25 aset. Menyusul dari panitia.
2. **Daftar pos nyata** (10–12: nama, lokasi, penjaga) dan rentang hadiah tiap pos.
3. **Jumlah laptop trading** dan rencana cadangan internet sekolah.
4. Stok final tiap aset.
5. ~~Apa yang ditampilkan layar publik selain peringkat?~~ Diputuskan 16 Nov: hanya 5 kartu tim, tanpa ticker berita.

## 6. Ide setelah versi 1

- Grafik harga lengkap dan sparkline di kartu aset.
- Ticker berita dan harga langsung di layar publik.
- Mode offline penuh untuk penjaga (antrean lokal dasar sudah ada di rancangan; ini menambah penyimpanan tahan restart).
- Efek berita bertahap (rumor dulu, konfirmasi kemudian) sebagai fitur bawaan, bukan dua berita terpisah.
- Deteksi pola hadiah janggal otomatis dan, bila panitia berubah pikiran, batas nominal per pos atau persetujuan admin.
- Penjadwal otomatis buka/tutup pasar (saat ini manual lewat tombol).
- Ekspor laporan PDF berisi ringkasan acara.
