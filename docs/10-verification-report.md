# 10 — Laporan Verifikasi Rancangan SQL

Rancangan SQL di [03-database](03-database.md) dan [04-rpc-contracts](04-rpc-contracts.md) dijalankan di **PostgreSQL 16 sungguhan** (instance lokal sementara, dengan stub minimal untuk `auth.uid()`, skema `auth`, dan peran `anon` / `authenticated` yang meniru Supabase). Laporan ini menggantikan versi sebelumnya dan mencakup **revisi aturan ketiga**, termasuk **penghapusan sistem ACC** (hadiah langsung masuk saldo lewat `award_payout`; tabel `payout_requests`, `admin_review_payout`, dan batas nominal pos dihapus; 13 Nov): berita dipilih **sistem secara acak berbatas** dari kumpulan berita `ready` (efek 15 menit, jeda 5 menit), pasar dibuka/ditutup admin, tombol Tersedia pos, dan pencatatan login laptop (`log_kiosk_event`). Batas pegang kumulatif dan ketiadaan pergerakan acak dari revisi kedua tetap berlaku.

Cara kerja: skrip [`tests/build2.py`](tests/build2.py) mengambil **semua blok `sql` dari dokumen** secara berurutan (31 blok; blok bertanda `-- [lewati-uji]` dilewati), memuatnya ke database kosong, lalu delapan skrip uji ([`run1.py`](tests/run1.py), [`run2.py`](tests/run2.py), [`run2n.py`](tests/run2n.py), [`run3.py`](tests/run3.py), [`run_ob.py`](tests/run_ob.py), [`run_ob2.py`](tests/run_ob2.py), [`run_ob3.py`](tests/run_ob3.py), [`run_ob4.py`](tests/run_ob4.py)) memanggil fungsi atas nama pengguna berbeda lewat koneksi terpisah (`set role authenticated` + `request.jwt.claim.sub`). Yang diuji adalah SQL yang tertulis di dokumen, bukan salinan terpisah.

## Ringkasan

| Pemeriksaan | Hasil |
|-------------|-------|
| 31 blok SQL dimuat berurutan ke database kosong | Lulus, tanpa error |
| Perilaku dasar, hak akses, RLS, hadiah QR, publikasi Realtime, penguncian setelah game dibuka (`run1`) | **120 dari 120 lulus** |
| Leaderboard, jeda, transisi status, penutupan game (`run2`) | **37 dari 37 lulus** |
| Siklus berita, jeda acak, pause/resume, konkurensi, tombol pos (`run2n`) | **132 dari 132 lulus** |
| Konkurensi dan stres, sudah dialihkan ke `place_order` (`run3`) | **89 dari 89 lulus** |
| **Order book** (revisi 8): pencocokan, prioritas harga-waktu, parsial, market, self-trade, kunci kas/lot, bandar, ARA/ARB, tick, idempotensi, hak akses (`run_ob`) | **250 dari 250 lulus** |
| Order book: acak 270 transaksi, konkurensi 12 thread (~276 transaksi, 5,3 dtk), invarian, penguncian (`run_ob2`) | **182 dari 182 lulus** |
| Order book: pemeriksaan tambahan hasil mutasi M6/M10 (`run_ob3`) | **22 dari 22 lulus** |
| Harga peringkat VWAP: pengisi, jendela waktu, perhitungan ulang dari `trades` (`run_ob4`) | **15 dari 15 lulus** |
| **Total** | **847 pemeriksaan, 0 gagal** (120 + 37 + 132 + 89 + 250 + 182 + 22 + 15) |
| Kekekalan uang (Σ (saldo + saldo terkunci) + kas bandar = Σ hadiah + koreksi) | Lulus, termasuk setelah stres acak dan setelah tutup game |
| Kekekalan unit (stok + Σ pegangan tim = stok awal, semua aset uji) | Lulus, stok tidak pernah negatif |
| Paling banyak satu berita `live` (status `queued` sudah dihapus) | Lulus setelah stres dan setelah 8 pemanggil bersamaan saat kosong |
| Berita yang dipilih sistem tidak pernah membuat harga aset aktif keluar dari `min_price`/`max_price` | Lulus pada uji pemilih berbatas (termasuk kasus pembulatan tepat ke batas) |

## Staging di Supabase Cloud (17 Nov)

Project `classmeet-staging` (ref `sjqboaqkhykmzconskvn`, region ap-southeast-1, Postgres 17). SQL dari dokumen (tanpa stub `auth`) dimasukkan sebagai lima migrasi: skema + RLS, order book inti, pasar/hadiah/status game, leaderboard/berita/hak akses, `pg_cron`.

**Terbukti di Supabase asli**
- Semua migrasi masuk tanpa error pada skema `auth` dan peran bawaan Supabase.
- Hak eksekusi: `anon` tidak bisa menjalankan satu fungsi pun; 10 fungsi internal (`process_*`, `ob_*`, `check_news_effects`, `news_would_hit_bounds`, `freeze_leaderboard_internal`) tertutup juga untuk `authenticated` (dicek lewat `has_function_privilege`).
- Smoke test satu transaksi (di-rollback): game dibuka admin → bandar memasang 10 order; tim A market beli 3 lot terisi; A jual limit 2 lot, B beli limit terisi 2 lot; `get_order_book` 10 baris untuk tim, `forbidden` untuk admin; `anon` ditolak `permission denied`; tim A membaca 0 order milik tim B lewat tabel (RLS); invarian uang (Σ saldo + `house_cash` = modal awal) dan unit (stok + pegangan = stok awal) terpenuhi.
- `pg_cron` 1.6.4: jadwal `10 seconds` benar-benar jalan, 5 eksekusi per pekerjaan dalam 40 detik, semuanya `succeeded`. Ini menutup catatan lama "interval detik butuh pg_cron 1.5+".
- `realtime.send` berjalan tanpa error; publikasi `supabase_realtime` berisi `assets, game_settings, news_feed, payouts, posts`.
- Advisor keamanan: hanya temuan yang disengaja (RPC `security definer` untuk `authenticated` dengan pemeriksaan peran di dalamnya; `leaderboard_snapshot` tanpa kebijakan karena hanya lewat `get_leaderboard`) dan lima fungsi pembantu murni tanpa `search_path` tetap (tidak berbahaya, bisa dirapikan).

**Belum teruji di Supabase asli** (sandbox tidak punya koneksi langsung ke database, hanya lewat alat manajemen)
- Suite penuh (847 pemeriksaan, tanpa harga peringkat di staging) **belum diulang** di sana; yang berjalan hanyalah smoke test di atas. Tidak ada uji konkurensi 12 thread, uji acak, maupun mutasi di Supabase.
- Login nyata lewat GoTrue, JWT dan PostgREST (`/rest/v1/rpc/...`) dari klien sungguhan.
- Pengiriman Realtime Broadcast ke klien WebSocket, dan perilaku lewat Cloudflare Tunnel (jalur Docker self-hosted).
- Beban di paket gratis (batas koneksi, jeda otomatis project tidak aktif).

## Revisi 8 (17 Nov): order book menggantikan beli/jual langsung

`buy_item`/`sell_item` dan tabel `transactions` dihapus. Gantinya `orders`, `trades`, `place_order`, `cancel_order`, bandar otomatis (`process_house_quotes`), `get_order_book` (hanya tim), `get_market_summary`, `get_market_index`. Rancangan di [12-order-book](12-order-book.md); simpangan implementasi di §10 dokumen itu.

Yang dibuktikan: harga-waktu, maker price, fee 25 bps dibulatkan ke atas per transaksi, parsial, market maksimal 5 level, self-trade ditolak, kas dan lot terkunci kembali utuh saat batal, bandar tidak melampaui stok dan tidak dikenai fee, ARA/ARB ±15 % dari harga acuan, tick 500/1.000/2.500, idempotensi `request_id`, penutupan game membatalkan semua order, dan invarian uang serta unit setelah acak dan konkurensi.

### Uji mutasi order book

38 mutan (M1–M38, tanpa M22–M24, M26) dijalankan **satu per satu**. M1–M36 (33 mutan) terhadap `run_ob`, `run_ob2`, `run_ob3`: **semua 33 tertangkap** (minimal 1 baris FAIL). Lima mutan harga peringkat (M34–M38: tanpa pengisi, jendela waktu diabaikan, net worth memakai harga terakhir, berita tidak menyetel ulang `rank_price`, pengisi berbobot penuh) dijalankan terhadap `run_ob4`, `run_ob`, `run2`; **semua 5 tertangkap**. Beberapa mutan juga membuat satu skrip crash karena fungsi melempar error; crash itu tidak dihitung sebagai tangkapan, hanya FAIL yang dihitung.

Catatan jujur:

- **M6 (batas sapuan market) dan M10 (offer bandar tanpa batas persediaan) lolos pada suite awal.** Ditambah `run_ob3` (22 pemeriksaan); kini masing-masing 2 gagal.
- **M15 (market beli tanpa batas saldo) awalnya terbaca "0 gagal" padahal skripnya crash** (`IndexError` pada helper `filled`). Helper dibuat tahan-crash; kini tertangkap dengan 3 FAIL. Pelajaran yang sama dengan M4: crash bukan lulus dan bukan tangkapan.
- Penyebab kegagalan uji sendiri yang ditemukan dan diperbaiki: `select (fn(...)).*` mengevaluasi fungsi sekali per kolom (order ganda/`order_not_open`), ID aset dari DB sebelumnya, pendanaan uji kurang, hadiah tidak dihitung di buku besar, harga limit < 1 pada aset murah.

### Belum teruji / risiko tersisa revisi 8

- **Kolusi dua tim**: dimitigasi sebagian oleh harga peringkat VWAP 10 menit (17 Nov); dua tim yang berdagang ≥ 5 lot per 10 menit tetap bisa menggeser peringkat sampai batas ARA/ARB. Angka 10 menit dan 5 lot belum dituning. Perubahan ini belum diterapkan ke staging Supabase (migrasi 02–04 perlu dibuat ulang).
- Kunci penjaga tidak menghentikan pemilik database atau `service_role`.
- Parameter order book terkunci setelah game dibuka; harus dituning di gladi.
- Aset murah (±Rp 1.000) tidak mendapat kuotasi bandar.
- `ob_lock` menserialkan semua order: cukup untuk beban rencana (12 thread, ~276 transaksi dalam 5 dtk), belum diuji di ponsel/jaringan nyata maupun di Supabase sungguhan.
- UI baru berupa desain Figma; state Pasar dijeda, error isian, dan Jual+Market sudah digambar. Belum: state Pasar ditutup permanen (game selesai).
- Jalur online `scripts/import-news.ts` belum diuji terhadap Supabase.

## Revisi 7 (17 Nov): berita diundi sistem, waktu acak 3–15 menit, harga terkunci setelah game dibuka

> Tabel "Yang dibuktikan pada revisi 3", bagian mutasi lama, dan catatan 0–4 di bawah menggambarkan model lama (efek tetap 15 menit, antrean `queued`, `admin_set_price`, `force`). Yang berlaku sekarang adalah bagian ini. Angka total di Ringkasan sudah yang baru.

- **Diubah:** (1) jeda dari berita terbit ke perubahan harga diundi sistem per berita, 180–890 detik; (2) urutan berita sepenuhnya milik sistem; (3) sejak pembukaan pertama (`started_at`), pemicu `guard_game_lock()` menolak penulisan harga, batas, aset, berita, efek, `price_history`, dan parameter berita dari siapa pun kecuali fungsi sistem; RLS menyembunyikan `news`/`news_effects` dari admin. Dihapus: `admin_queue_news`, `admin_unqueue_news`, `admin_run_news_cycle`, `admin_set_price`, opsi `force`, status `queued`, kolom `queued_at`, `news_effect_delay_minutes`.
- **Diuji (PostgreSQL 16):** jeda acak tersebar lebar dalam [180, 890] detik dan berdetik pecahan; min=max=20 menit dihormati; `news_gap_minutes`; jeda game menggeser tenggat; Selesai ditolak `news_pending` tanpa jalan pintas; bila semua calon menabrak batas, berita tetap terbit dan harga dijepit; aset nonaktif saat peluncuran mengembalikan berita ke draf; admin ditolak `game_started_locked` untuk setiap jalur tulis dan tidak bisa membaca `news`; stok masih boleh diubah; 8 pemanggil bersamaan menerapkan efek sekali dan meluncurkan **tepat satu** berita.
- **Mutasi (13):** tertangkap M2, M3b, M4, M6, M7, M8b, M9, M10, M11, M12, M13, M14. **M5b lolos dan memang setara**: mutasinya tidak mengubah perilaku yang dapat diamati.
- **Dua yang awalnya lolos, keduanya cacat uji, sudah diperbaiki:** M4 (resume tidak menggeser tenggat) hanya "lolos" karena skrip uji **crash** (`IndexError`) sebelum mencatat kegagalan; harness mutasi menghitung crash sebagai 0 gagal. Uji dibuat tahan crash dan kini mencatat 2 kegagalan. M3b (tanpa kunci `game_settings`) lolos karena tidak ada uji balapan **peluncuran**: indeks unik `news_one_live` menjaga jumlah live, tetapi pemanggil yang kalah diam-diam melempar berita ke `draft` dan mencatat `news_launch_failed`. Ditambahkan uji 8 pemanggil saat tidak ada berita live yang memeriksa tidak ada peluncuran gagal dan tidak ada berita terlempar ke draf; mutasi kini tertangkap.
- **Pelajaran untuk pembaca laporan:** "0 gagal" pada uji mutasi bisa berarti uji crash, bukan uji lolos. Setiap mutan yang lolos harus dijalankan satu per satu dan stderr-nya dibaca.
- **Batas yang jujur:** penguncian hanya menghentikan akun aplikasi. Pemilik database, `service_role`, dan akses shell server tetap bisa mengubah data. Ini tidak bisa diuji pada tingkat SQL karena memang di luar batas pemicu; mitigasinya organisasional ([06](06-security.md), [08](08-operations.md)).
- **Tidak diuji:** `scripts/import-news.ts` terhadap kunci kumpulan (jalur online belum pernah dicoba di Supabase); `pg_cron` per 10 detik; pengundian waktu pada jam dinding sungguhan; desain order book (belum ada kodenya).

## Revisi 6 (16 Nov): batas pegang dihapus

- **Diuji:** kolom `assets.max_hold`, pemeriksaan di `buy_item`, dan kode `hold_limit_exceeded` dihapus. Tes batas pegang diganti tes tanpa batas (beli 11 sekaligus sukses) dan tes stok konkuren. Seluruh suite diulang di PostgreSQL 16: **353 dari 353 lulus** (selisih dari 364 karena 13 uji batas pegang dihapus dan beberapa uji baru ditambah). Uji mutasi M1 (hapus cek `max_hold`) ikut dihapus.
- **Risiko baru, bukan bug:** satu tim kaya bisa memborong seluruh stok satu aset sehingga tim lain tidak bisa membeli. Satu-satunya pengaman sekarang stok awal; periksa di gladi.

## Revisi 5 (16 Nov): saldo tim untuk penjaga, sinkron dengan Figma

- **Diuji:** `resolve_team_qr` dan `resolve_team_code` kini mengembalikan `cash` (tipe `team_ref` bertambah satu kolom). Dua tes baru di `run1`: hasil resolve memuat saldo (0 untuk tim baru) dan penjaga tetap tidak bisa membaca tabel `teams` langsung. Seluruh suite diulang di PostgreSQL 16: **364/364 lulus**. Mutasi untuk perubahan ini **tidak** dijalankan.
- **Tidak diuji (hanya dokumen):** desain Figma terbaru (palet biru, sidebar tanpa bilah atas, tombol Selesai di kartu akun, form penjaga sebagai lembar di halaman pindai, kartu aset baru, badge layar publik terpisah). `DESIGN.md` dan [07](07-ui-ux.md) disinkronkan; kontras dihitung ulang dengan skrip, bukan diukur di layar.
- **Perubahan keputusan yang perlu disadari:** sebelumnya penjaga tidak boleh melihat saldo tim. Sekarang boleh, hanya untuk tim yang kartunya dipindai ([06](06-security.md)).

## Revisi 4 (16 Nov): yang diuji dan yang tidak

- **Skrip berita** (`scripts/news-lib.ts`, `import-news.ts`): rumus harga di TypeScript dicocokkan dengan rumus SQL pada **400 kasus acak (0 selisih)**; mode `check` dijalankan pada data contoh. Bagian `import` (login admin, `admin_save_news`, `admin_set_news_ready` lewat supabase-js) **belum dicoba** karena belum ada project Supabase; `admin_run_news_cycle` diuji di PostgreSQL lokal.

- **Diuji:** perubahan view `v_team_net_worth` ke harga beli (dua tes baru di `run2`; seluruh suite 362/362 lulus). Mutasi untuk perubahan ini **tidak** dijalankan.
- **Tidak diuji (hanya dokumen, belum ada kode UI):** semua perubahan layout, toggle pos, penghapusan kode cadangan/riwayat penjaga/daftar hadiah, layar publik 5 kartu, dialog beli tanpa batas saldo, halaman berita tampilan-saja, dan panel status ringkas. `short_code` dan RPC resolve-by-code masih ada di database dan masih diuji, tetapi tidak dipakai UI.

## Penghapusan ACC: yang dibuktikan

| Area | Yang diperiksa | Hasil |
|------|----------------|-------|
| Hadiah langsung | `award_payout`: saldo naik seketika; kirim ulang `request_id` sama (juga 10 paralel) menambah sekali; request_id sama dengan nominal atau tim beda → `request_id_conflict`; nominal 0, negatif, null → `invalid_amount`; tim tak dikenal; pos tutup → `post_closed`; setelah `finished` → `game_not_active` dan saldo tetap | Lulus |
| Hak | Hanya penjaga: tim, admin, display, dan akun tanpa profil → `forbidden`; insert/update langsung `payouts` oleh klien ditolak; RLS `payouts` (tim milik sendiri, penjaga pos sendiri, admin semua) | Lulus |
| Tanpa pengaman (sesuai keputusan) | 6 hadiah beruntun ke tim+pos yang sama diterima; nominal 10¹² diterima; `admin_adjust_cash` negatif memulihkannya | Lulus |
| Sistem lama hilang | `payout_requests`, `admin_review_payout`, `submit_payout_request` tidak ada | Lulus |
| Audit | `payout_awarded` tercatat | Lulus |
| Mutasi | Tanpa penambahan saldo (M12): 11 uji gagal. Tanpa pemeriksaan idempotensi (M13): 3 uji gagal. Tanpa pemeriksaan status game (M14): 3 uji gagal. Tanpa pemeriksaan nominal positif (M15): 3 uji gagal | Tertangkap |

## Yang dibuktikan pada revisi 3

| Area | Yang diperiksa | Hasil |
|------|----------------|-------|
| Kumpulan berita | `admin_set_news_ready`: hanya admin, berita tak ada, null, aset nonaktif (`news_invalid_effects`, tetap draf), dua kali (`news_wrong_status`), game selesai (`game_finished`); berita `ready` tak bisa disunting sebelum dikeluarkan; keluarkan ke draf; `get_news_pool_status` (siap, boleh terbit) hanya admin | Lulus |
| Pemilih acak berbatas | Berita `ready` terbit sendiri dan masuk `news_feed`; saat ada `live` siklus menunggu; 12 berita terbit semuanya tepat sekali, urutannya bukan urutan pembuatan, semuanya menjadi `applied`; kumpulan kosong → siklus idle tanpa error | Lulus |
| Batas harga | Berita yang membuat aset melewati `min_price` atau `max_price` tidak terpilih; hanya berita aman terbit; tinggal berita berbahaya → idle dan tetap `ready`; setelah harga bergeser berita itu boleh terbit; hasil yang dibulatkan tepat ke batas boleh terbit dan harga akhir = batas; `news_would_hit_bounds` tak bisa dipanggil klien | Lulus |
| Pasar dibuka/ditutup | Saat `paused` siklus idle dan berita `ready` tidak terbit; saat lanjut berita terbit dari kumpulan; berita `ready` tidak menghalangi penutupan game | Lulus |
| Penimpaan darurat | Berita `queued` terbit lebih dulu dari kumpulan; berita `ready` bisa dipaksa lewat `admin_queue_news` | Lulus |
| Tombol pos | `guard_set_post_open`: hanya penjaga (tim, admin, display, tanpa profil ditolak); penjaga 2 hanya mengubah pos 2; null ditolak; audit mencatat penjaga dan pos; boleh saat game dijeda; ditolak setelah game selesai | Lulus |
| Daftar pos | `get_post_list` terbaca tim dan display (2 baris, 4 kolom, memuat status); ditolak untuk akun tanpa profil; `posts` ada di publikasi Realtime | Lulus |
| Log laptop | `log_kiosk_event`: tim mencatat login, logout, dan keluar otomatis (tiga baris audit atas nama tim); jenis peristiwa asing, null, dan nama perangkat > 40 karakter ditolak; admin, penjaga, display, dan akun tanpa profil tidak boleh mencatat | Lulus |

## Apa saja yang dibuktikan (revisi 2, tetap berlaku)

| Area | Yang diperiksa | Hasil |
|------|----------------|-------|
| Tanpa batas pegang | 11 sekaligus sukses; jual lalu beli lagi; 8 beli bersamaan sukses; tim lain tidak terpengaruh; stok tidak bocor saat ditolak | Lulus |
| Stok, konkuren | 30 pembelian @1 bersamaan oleh tim yang sama pada aset berstok 20 → tepat 20 sukses, sisanya `out_of_stock`; 30 pembelian @4 pada aset berstok 100 → tepat 25 sukses | Lulus |
| Validasi berita | 3 atau 8 aset, aset ganda, persen 0, ±1501, aset nonaktif, judul kosong, bukan array, aset tak ada; penyimpanan gagal tidak meninggalkan berita atau efek yatim | Lulus |
| Validasi ulang saat dipilih | Aset dinonaktifkan atau batas diubah setelah disimpan → `news_invalid_effects`, tetap draf | Lulus |
| Antrean | Antre saat `setup` (terbit saat game dibuka); antre saat ada berita live → menunggu; antrean kedua → `news_queue_full`; batalkan dan ganti; edit berita antre/live → `news_wrong_status` | Lulus |
| Efek 15 menit | `effect_at` = terbit + 15 menit; `news_effect_delay_minutes=20` dipakai; harga belum berubah sebelum waktunya; pembelian di harga lama selama menunggu sukses | Lulus |
| Hasil harga | +5 % (10.000→10.500), +7 % (20.000→21.400), +12 % (5.000→5.600), −6 % dengan pembulatan (7.520→7.500), dijepit max, −15 %, aset nonaktif dilewati, aset di luar berita tidak berubah | Lulus |
| Jeda 5 menit | Dimulai saat harga benar-benar berubah; berita antre tidak terbit selama jeda; terbit otomatis setelahnya; diterapkan lalu jeda baru dimulai | Lulus |
| Pause / resume | Efek jatuh tempo saat `paused` tidak diterapkan; saat lanjut `effect_at` dan jeda bergeser sebesar lama jeda (diperiksa +2 dan +8 menit) | Lulus |
| Tutup game | Berita live/antre → `news_pending`; dengan `force` → `cancelled`; setelah `finished` siklus idle dan harga tidak berubah | Lulus |
| Peluncuran gagal | Aset dinonaktifkan setelah berita diantre → berita kembali ke draf, tercatat di audit, siklus tidak macet | Lulus |
| Biaya jual | `sell_fee_bps=500`: jual 3 × 10.000 → fee 1.500, saldo naik 28.500; 10.050 × 5 % = 502,5 → fee 502 (dibulatkan ke bawah) | Lulus |
| Konkurensi siklus | 8 pemanggil `process_news_cycle` bersamaan → efek diterapkan sekali | Lulus |
| Akses | `news` dan `news_effects` tak bisa ditulis klien; tim, penjaga, dan display **tidak bisa membaca tabel `news`** (jadi `effect_at` tersembunyi dan hitung mundur tidak bisa diambil lewat REST), hanya `news_feed` (judul, isi, waktu tayang); `news_feed` tak bisa ditulis klien dan tak punya kolom waktu efek; tim tak pernah melihat efek; `process_news_cycle`, `check_news_effects` tak bisa dipanggil klien; dua berita `live` ditolak indeks unik; `live` tanpa `published_at` ditolak constraint | Lulus |
| Stres | 8 thread × 40 operasi acak (beli, jual, ajukan, ACC, antre berita, paksa siklus berita, koreksi) dengan 8 aset; ada berita yang benar-benar diterapkan | Tanpa deadlock (`40P01`), tanpa error tak terduga, semua invarian terjaga |
| Tutup game vs lalu lintas | 6 ronde: 6 thread beli/jual/ajukan+ACC dan satu thread yang terus memilih berita dan memaksa siklus sementara game ditutup | Snapshot identik dengan data akhir **dan harga tidak berubah setelah penutupan** pada 6 dari 6 ronde |

Area dari revisi 1 yang tetap diuji (modal 0, hadiah idempoten, QR, hak akses, leaderboard, transisi status) lulus kembali; lihat `run1.py` dan `run2.py`. **Tes ACC (ACC/Tolak, ACC bersamaan, `already_reviewed`, `pending_payouts_exist`) dihapus bersama fiturnya**, sehingga jumlah tes turun dari 358 ke 352 walau ada tes baru.

## Uji mutasi: apakah uji ini benar-benar bisa gagal?

Pengaman dirusak sengaja pada salinan SQL, template database dibangun ulang dari salinan rusak itu, lalu uji dijalankan. Hasil:

| Kerusakan yang disuntikkan | Hasil |
|----------------------------|-------|
| Resume tidak menggeser `effect_at` | **5 uji gagal**: efek bergeser −1 menit bukan +2, jeda tidak bergeser |
| `process_news_cycle` mengabaikan status game | **7 uji gagal**: berita terbit saat `setup`, efek diterapkan saat `paused` |
| Jeda 5 menit tidak diset setelah efek | **1 uji gagal**: berita antre terbit tanpa menunggu jeda |
| `process_news_cycle` memilih calon tanpa `news_would_hit_bounds` (M9b) | **6 uji gagal**: berita yang menabrak batas terpilih |
| `admin_set_news_ready` tanpa `check_news_effects` (M11) | **2 uji gagal**: aset nonaktif lolos jadi `ready` |
| `news_would_hit_bounds` tanpa pembulatan `price_step` (M10) | **0 uji gagal pada awalnya**; setelah ditambah uji kasus pembulatan tepat ke batas, **3 uji gagal** (lihat catatan 0) |
| `admin_queue_news` tanpa `check_news_effects` | **2 uji gagal** setelah ditambah uji khusus (lihat catatan) |
| `process_news_cycle` tanpa kunci `game_settings` | **Tertangkap**: tutup-game vs lalu lintas gagal 4 dari 6 ronde pada satu kali jalan, dan deadlock `40P01` pada uji stres di jalan lain |
| Buka kembali pembacaan tabel `news` untuk peserta setelah tayang | **2 uji gagal**: tim dan penjaga/display dapat membaca `news` termasuk `effect_at` |
| Hapus kunci semua tim pada `admin_set_game_state('finished')` | **Tertangkap**: tutup-game gagal pada 1 dari 6 ronde (hasil acak; pada revisi 1 terukur 5/6 dan 6/6) |

Catatan jujur tentang hasil mutasi:

0. **Dua mutasi revisi 3 awalnya lolos.** M9 pertama mengenai fungsi yang salah (`get_news_pool_status`, bukan pemilih di `process_news_cycle`); diulang sebagai M9b dengan konteks pemilih dan tertangkap. M10 (membuang pembulatan di penyaring batas) lolos dengan 0 uji gagal, karena tidak ada uji yang bergantung pada pembulatan; ditambah tiga pemeriksaan (aset 4.900 naik 2,1 % menjadi 5.002 yang dibulatkan ke 5.000, tepat di maksimum) dan mutasinya kini tertangkap. Perbedaannya halus: tanpa pembulatan penyaring akan membuang berita yang sebenarnya aman, sehingga kumpulan bisa menyusut tanpa alasan.

1. **Mutasi `admin_queue_news` pertama lolos (0 gagal).** Itu karena validasi sudah dilakukan saat simpan dan saat peluncuran, sehingga pemeriksaan ulang saat memilih tidak punya uji yang membedakannya. Ditambahkan dua uji (aset dinonaktifkan setelah disimpan; batas jumlah diubah setelah disimpan), dan mutasi itu kini tertangkap. Pelajaran: lolosnya mutasi menunjukkan celah uji, bukan keamanan.
2. **Mutasi "tanpa kunci `game_settings`" pertama kali dicoba hanya dengan uji siklus berita dan lolos (0 gagal)**, karena kunci baris berita sudah mencegah penerapan ganda. Kunci `game_settings` tetap **diperlukan** untuk dua hal lain: berurutan dengan penutupan game dan urutan kunci yang konsisten. Itu terbukti pada uji penutupan dan uji stres, bukan pada uji siklus tunggal.
3. **Hasil mutasi kunci semua tim bersifat probabilistik** (bergantung penjadwalan thread): 1 dari 6 ronde gagal kali ini, 5 dan 6 dari 6 pada revisi 1. Gagal di satu ronde sudah cukup membuktikan kunci itu diperlukan.
4. **Mutasi "hapus pemeriksaan peran `guard`" di `guard_set_post_open` lolos (0 gagal).** Pemeriksaan itu berlapis dengan pencarian pos milik pemanggil: akun tim, admin, atau display tidak punya pos, jadi tetap ditolak dengan `forbidden`. Ini kelebihan lapisan, bukan celah. Satu-satunya jalan celah terbuka adalah bila admin dijadikan `guard_id` sebuah pos; pemeriksaan peran dipertahankan untuk kasus itu.

## Masalah yang ditemukan dan diperbaiki sepanjang pengerjaan

1. **`app_role()` ditulis sebelum tabel `profiles` ada** (versi awal). Migrasi gagal. Dipindah ke [03-database, bagian 3.1](03-database.md#31-profiles).
2. **`v_team_net_worth` terbaca klien dan memotong RLS.** Ditambahkan `revoke all` dan ujinya.
3. **Risiko deadlock pada rancangan awal**: diganti hierarki tunggal *tim (urut id) → game_settings → berita → aset (urut id)* (kunci `payout_requests` dihapus bersama tabelnya). Pada revisi 2 hierarki ini diperluas dengan tabel `news`, dan melepas kunci `game_settings` dari siklus berita terbukti menimbulkan deadlock di uji stres.
4. **Pemeriksaan peran `app_role() not in (...)` bernilai `NULL` untuk pengguna tanpa profil.** Diperbaiki dengan `coalesce`, ditambah uji.
5. **Jebakan pembulatan harga.** `game_settings.price_step` (default Rp 100) dipakai; pada revisi 2 uji menangkap kasus nyata: aset Rp 1.000 yang naik 3 % tetap Rp 1.000. Ini dicatat sebagai pedoman, bukan bug.
6. **Kesalahan di skrip uji sendiri** (bukan di SQL), revisi 2: harapan harga A2 salah (mengabaikan pembulatan), urutan uji salah (menguji peluncuran gagal sebelum jeda berakhir; antrean penuh membuat uji lain tak menguji yang dimaksud), satu uji yang selalu benar (vakum) diganti pemeriksaan nyata, dan batas `check` pada `game_settings` terlanggar oleh uji perubahan batas (`max < min`) sehingga skrip berhenti. Semua diperbaiki; hasil akhir adalah 288 uji.
7. **Template uji basi setelah mutasi.** Pada salah satu jalan mutasi, template database masih dibangun dari mutasi sebelumnya sehingga hasilnya menyesatkan. Prosedur sekarang selalu membangun ulang template dari SQL yang sedang diuji sebelum menjalankan uji.

## Yang BELUM diverifikasi

**Tambahan revisi 3**

- **Login kartu QR di laptop.** `signInWithPassword` memakai `qr_token` sebagai kata sandi akun tim, keluar otomatis 5 menit, `/kiosk` yang menghapus sesi lama, dan `scripts/rotate-team-qr.ts` belum ada kodenya dan belum diuji. Yang teruji hanya sisi SQL (`log_kiosk_event`). Rotasi `qr_token` di database saja **tidak** mencabut kartu lama bila kata sandi Auth tidak ikut diganti.
- **Docker Supabase self-hosted.** Seluruh uji berjalan di PostgreSQL 16 biasa dengan stub. Ketersediaan `pg_cron` di image, pengaturan GoTrue, Realtime lewat Cloudflare Tunnel (WebSocket), dan kamera lewat HTTPS **belum diuji**. Langkah verifikasi ada di [11-deployment](11-deployment.md).
- **Perilaku kumpulan berita sepanjang tiga hari.** Pemilih berbatas teruji per langkah, bukan pada simulasi ±99 berita berurutan terhadap 25 aset sungguhan. Penyaring hanya melihat harga **sekarang**; akumulasi pergeseran yang membuat suatu aset terus mentok di batas dan kumpulan kehabisan calon tidak terukur. Skrip pemeriksa daftar berita (simulasi harga kumulatif per aset) belum dibuat.
- **Penimpaan darurat** `admin_queue_news` masih ada di database walau tidak ada tombolnya.

**Dari revisi 1 dan 2**

- **Berjalan di Supabase sungguhan.** `auth.uid()` dan peran di uji memakai stub. Perilaku PostgREST, JWT, Realtime (termasuk RLS pada langganan `news` dan `payouts`), dan penerapan `revoke ... on all functions` pada skema Supabase belum diuji.
- **`pg_cron`.** Blok penjadwalan dilewati. Yang diuji hanya `process_news_cycle()` yang dipanggil manual, termasuk dari banyak sesi bersamaan, bukan penjadwalnya. Ketepatan ±10 detik (jadwal tiap 10 detik, butuh `pg_cron` 1.5+) adalah perilaku `pg_cron`, bukan hasil uji.
- **Waktu nyata.** Tenggat diuji dengan memundurkan `effect_at`/`news_next_allowed_at` di database, bukan dengan menunggu. Perhitungan interval diperiksa (15,00 menit, 20,00 menit, jeda 5 menit), tetapi jalannya siklus selama menit-menit sungguhan diuji pada gladi di staging (lihat [08-operations](08-operations.md)).
- **Fungsi yang hanya berupa spesifikasi** ([04-rpc-contracts bagian 3.9](04-rpc-contracts.md#39-fungsi-admin-yang-baru-berupa-spesifikasi)): `admin_set_stock`, `admin_set_post_open`, `admin_upsert_asset`, `admin_upsert_post`, `admin_set_news_settings`. Pekerjaan implementasi (tahap M4–M6).
- **Seluruh lapisan aplikasi**: Next.js, Server Action, pemindai QR, antrean lokal penjaga, halaman Hadiah admin, panel berita, layar publik. Belum ada kodenya.
- **Beban nyata dari ponsel** dan jaringan seluler.
- **Pembatas laju opsional** di [06-security](06-security.md#batas-laju-opsional-di-rpc) : hanya wacana.
- **Bukti ketiadaan deadlock.** Uji stres dan 6 ronde tutup-game tidak membuktikan tidak ada deadlock; hanya tidak menemukannya pada konfigurasi akhir. Argumennya didukung penalaran urutan kunci, bukan pembuktian formal.
- **Sifat probabilistik uji.** Uji tutup-game bergantung pada penjadwalan thread. Lulus memberi keyakinan, bukan jaminan.
- **Isi permainan**: daftar aset, profil/sifat, dan bahan berita belum ada. Sistem hanya menyimpan dan menjalankannya; apakah petunjuk berita bisa dibaca tim adalah soal materi, bukan SQL.
- **Konsekuensi desain** yang tidak berkaitan dengan kebenaran SQL: **hadiah tanpa pengaman apa pun** (salah ketik atau penjaga curang langsung berpengaruh; keputusan panitia), skala keuntungan trading yang kecil dibanding hadiah pos, dan tebakan benar nyaris tanpa risiko tanpa biaya jual (lihat [05, bagian 4.5](05-game-rules.md#45-catatan-desain-untuk-panitia) dan [09, register risiko](09-roadmap-and-testing.md#4-register-risiko)).
- **Diagram Mermaid** belum dirender; ditulis mengikuti sintaks standar.
- **Peninjauan keamanan oleh manusia.** Lulus uji otomatis bukan berarti bebas celah.

## Cara mengulang

Skrip ada di folder [`tests/`](tests/). Nyalakan PostgreSQL 16 sementara, jalankan `python3 tests/build2.py` (membuat `full2.sql` dari dokumen), lalu `python3 tests/mk_tpl.py` (template database), dan `run1.py`, `run2.py`, `run2n.py`, `run3.py`, `run_ob.py`, `run_ob2.py`, `run_ob3.py`, `run_ob4.py`. Skrip mengasumsikan klaster di `/tmp/pgdata`, port 54329, soket `/tmp`; ubah konstanta di `tests/t2.py` bila berbeda. `tests/mut.py` menjalankan uji mutasi (lihat komentar di dalamnya). Untuk Supabase Cloud ada dua berkas: [`tests/staging_smoke.sql`](tests/staging_smoke.sql) (satu transaksi yang selalu di-rollback; hasil ada di pesan galat `HASIL: {...}`, nilai harapan di komentar kepalanya) dan [`tests/staging_cron_check.sql`](tests/staging_cron_check.sql) (pg_cron, hak eksekusi, Realtime; jalankan per kueri). Keduanya belum menguji login, JWT, PostgREST, atau pengiriman Realtime ke klien sungguhan; ulangi pada klien Supabase sungguhan sebelum dipakai.
