# Panduan Gladi Resik Classmeet Market

Panduan untuk panitia: satu kali latihan penuh di kondisi sungguhan sebelum hari acara, lalu urutan kerja pada hari H. Pakai bersama [docs/08-operasional](docs/08-operations.md) (daftar periksa dan rencana darurat) dan [PANDUAN-TRADING](PANDUAN-TRADING.md) (untuk peserta).

**Gambaran acara:** 17 tim bermain, tetapi hanya 4–5 laptop tim yang aktif bersamaan (tim bergantian memindai kartu QR di kiosk). Semua layanan jalan di satu laptop panitia (Supabase di Docker, aplikasi Next, Cloudflare Tunnel). Karena itu risiko terbesar ada pada laptop dan jaringan, bukan pada kode. Uji beban sudah dilakukan (30 klien simulasi, tanpa galat); lihat `docs/13-log-implementasi.md`.

## 1. Ringkasan

| Hal     | Isi                                                                                                                                 |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Kapan   | Sehari sebelum acara (H-1), atau paling lambat pagi hari H sebelum peserta datang                                                   |
| Lama    | 60–90 menit (ditambah 15 menit membereskan)                                                                                         |
| Di mana | Lokasi acara, dengan laptop server, WiFi/hotspot, layar TV, dan perangkat yang sama dengan hari H                                   |
| Siapa   | Minimal 6 orang: 1 teknis (laptop server), 1 admin, 2 penjaga pos (ponsel), 2 relawan sebagai tim (laptop tim), 1 pemegang layar TV |
| Hasil   | Semua kotak di bagian 6 tercentang, temuan dicatat, game di-reset bersih                                                            |

Aturan emas selama gladi:

- **Jangan menekan "Akhiri game".** Tombol itu membekukan peringkat akhir. (Reset game memang bisa mengembalikan, tetapi menghapus semua data gladi, jadi tidak ada gunanya mencoba.)
- Pakai **akun dan kartu QR tim sungguhan** supaya kartu yang dicetak ikut teruji, lalu **Reset game** di akhir (saldo kembali Rp 0).
- Catat semua yang janggal di kertas atau ponsel, jangan diingat saja.

## 2. Persiapan (H-2 sampai H-1)

### Laptop server

- [ ] Charger terpasang dan **tidak boleh tidur**: Pengaturan Sistem > Baterai/Daya > matikan tidur otomatis, atau jalankan `caffeinate -dims` di satu tab terminal dan biarkan terbuka.
- [ ] Matikan pembaruan otomatis, notifikasi, dan aplikasi berat lain (Zoom, browser dengan banyak tab, dsb.).
- [ ] Docker Desktop terbuka dan semua kontainer Supabase sehat:

```bash
cd deploy/supabase
./10-up.sh --tunnel
docker ps --format '{{.Names}} {{.Status}}'
```

- [ ] Aplikasi dijalankan dalam mode produksi (lebih stabil dari `npm run dev`):

```bash
npm run build && npm start
```

- [ ] Cek kesehatan dari laptop server **dan dari ponsel di jaringan lain** (data seluler):
  - `https://classmeet.rahmadarifin.my.id/api/health` menjawab `{"ok":true}`.
  - `https://classmeet.rahmadarifin.my.id/login` terbuka.
- [ ] Studio tidak terbuka dari internet: `https://api.rahmadarifin.my.id/` menjawab 403.
- [ ] Cadangan awal dibuat dan salinannya dikirim ke luar laptop (flashdisk atau drive):

```bash
cd deploy/supabase && ./70-backup.sh
```

### Data permainan

- [ ] 17 tim sudah dibuat (Admin > Tim). Tiap tim punya kartu QR; cetak **dua set** (satu untuk tim, satu cadangan panitia). Kartu QR adalah kredensial: jangan difoto atau dibagikan.
- [ ] Pos dan penjaga: tiap pos punya akun penjaga, sudah pernah login sekali di ponselnya.
- [ ] Aset dan harga awal final (Admin > Aset). Setelah game dimulai, harga, berita, dan pengaturan **terkunci**.
- [ ] Kumpulan berita cukup: halaman Status Game menampilkan angka **Siap** dan **Boleh terbit** (butuh ±220 untuk 3 hari penuh, atau lebih sedikit bila jeda antarberita diperbesar).
- [ ] Pengaturan toko (Admin > Aset > Pengaturan toko: selisih jual, tekanan stok, batas pegang) sudah final.
- [ ] **Analisa Pasar:** harga dan saklar (Admin > Aset > kartu Analisa Pasar) sudah diputuskan. Patokan Rp 75.000 sampai Rp 100.000 (docs/19); boleh diubah kapan saja, juga saat game berjalan.
- [ ] Kumpulan berita dimuat dengan laporan analisa (`npm run load-news -- --replace`, game `setup`); jumlah laporan sama dengan jumlah berita siap.
- [ ] Akun `display` login di layar TV.

### Perangkat

- [ ] 4–5 laptop tim: kamera berfungsi, halaman `/kiosk` terbuka, layar tidak tidur.
- [ ] Ponsel penjaga: kamera berfungsi, baterai penuh, ada paket data atau WiFi.
- [ ] Layar TV: terbuka di `/display`, dicoba dari jarak terjauh penonton.
- [ ] Internet cadangan siap (hotspot seluler) dan sudah pernah dicoba.

## 3. Skenario gladi (urut)

Waktu hanya perkiraan. Kerjakan berurutan; jangan lanjut bila satu langkah gagal sebelum dicatat.

### A. Cek awal (10 menit)

1. Status game harus **SETUP / Belum dimulai**. Bila bukan, tekan **Reset game** (ketik `RESET`).
2. Layar TV harus menampilkan **"Game belum di mulai"** pada kelima tampilan (bergilir, pasar, berita, peringkat, pos). Cek dari jarak terjauh: terbaca jelas?
3. Admin: buka Status Game, Aset, Tim, Pos, Hadiah, Transaksi, Audit. Semua halaman terbuka tanpa galat.
4. Beri saldo uji bila perlu lewat **Koreksi saldo** (Admin > Tim). Catat nominalnya; semuanya hilang saat Reset game di akhir.

### B. Perangkat dan kartu QR (15 menit)

1. **Setiap kartu QR tim** dipindai di salah satu laptop tim. Tandai kartu yang gagal (rusak, buram, terlalu kecil) dan cetak ulang.
2. Setiap laptop tim: masuk sebagai satu tim, lalu tekan **Selesai**. Masuk lagi sebagai tim lain tepat setelahnya: sesi tim pertama **tidak boleh terbawa**.
3. Biarkan satu laptop **5 menit tanpa disentuh**: sesi harus keluar sendiri. Tutup tab tanpa menekan Selesai, buka `/kiosk` lagi: harus kembali ke layar pindai.
4. Penjaga: pindai kartu beberapa tim di bawah cahaya terang dan redup. Catat pos yang kameranya bermasalah.

### C. Mulai game (5 menit)

1. Admin: Status Game, tekan **Mulai game**, konfirmasi.
2. Periksa:
   - Status menjadi OPEN, hari 1.
   - Layar TV berganti dari "Game belum di mulai" ke tampilan normal dalam ±5 detik.
   - **Satu berita langsung tayang**; muncul di layar berita dan di Pasar laptop tim.
   - Laptop tim menampilkan Pasar dengan harga, bukan "pasar belum dibuka".
3. Penjaga: tekan **Tersedia** di pos masing-masing. Daftar pos di TV ikut berubah.

### D. Simulasi permainan (25–30 menit)

Jalankan seperti hari sungguhan, dengan 4–5 laptop sekaligus.

1. Penjaga memberi **hadiah** ke tim lewat pindai QR + nominal. Saldo tim di laptop harus naik **tanpa memuat ulang**. Tes juga salah nominal lalu dikoreksi admin (Koreksi saldo, alasan wajib).
2. Tim membeli dan menjual berbagai aset: beli, jual, jumlah lebih dari batas pegang, saldo kurang, aset stok habis. Pesan galat harus jelas dan tidak membuat halaman macet.
3. **Tidak ada arbitrase:** satu tim membeli aset sebanyak mungkin (batas pegang) lalu langsung menjualnya semua. Hasilnya harus RUGI sekitar 2 % (selisih jual), bukan untung; total beli lebih dari jumlah x harga tayang. Lalu **beli serentak:** minta semua laptop tim membeli aset yang sama dalam beberapa detik. Stok tidak boleh negatif, pesan "stok habis" muncul bagi yang kalah cepat.
4. Tunggu berita berikutnya. Periksa: berita tayang, harga bergerak setelah 3–15 menit, notif bangkrut atau suspensi (bila ada) muncul lalu hilang setelah berita berikutnya diterapkan.
5. Periksa **peringkat** di TV (5 tim teratas), **grafik IKC**, dan **Transaksi terakhir**: bergerak sesuai transaksi.
6. Admin memeriksa halaman **Hadiah**, **Transaksi**, dan **Audit**: semua tindakan tadi tercatat.
7. **Analisa Pasar:** saat satu berita tayang, satu tim membeli analisa di Pasar. Periksa: saldo turun sebesar harga, laporan 4 paragraf tampil dan tersimpan di Riwayat, tombol berubah menjadi "Lihat laporan", dan tim lain tidak melihat laporan itu. Admin melihat pembelian di Transaksi (tanpa isi laporan). Bandingkan isi laporan dengan pergerakan harga sesudahnya: ciri yang disebut naik harus benar naik. Coba juga mengubah harga di Admin > Aset saat game berjalan dan beli dengan tim lain (harga baru dipakai), serta mematikan saklar (tombol tim mati, laporan lama tetap bisa dibuka).
8. Tombol **Tutup pasar**, lalu **Buka pasar**: tim tidak bisa beli/jual saat tutup, dan berita berhenti. Buka lagi dan pastikan kembali normal.

### E. Uji gangguan (15–20 menit)

Lakukan satu per satu; catat berapa lama pulih.

1. **WiFi putus 2 menit** di satu laptop tim, lalu sambungkan lagi: halaman harus pulih sendiri (data baru muncul, realtime tersambung).
2. **Pindah ke hotspot** di satu laptop atau ponsel: tetap bisa login dan memuat Pasar.
3. **Tab laptop server ditutup/di-restart:** hentikan `npm start`, jalankan lagi. Tim harus bisa melanjutkan tanpa login ulang (atau login ulang dengan cepat).
4. **Restart Docker/laptop server** (bila berani): semua kontainer hidup lagi, data utuh, `https://classmeet.rahmadarifin.my.id/api/health` hijau, siklus berita berlanjut. Catat langkah yang diperlukan.
5. **Layar TV dimatikan dan dinyalakan lagi:** tetap login, kembali menampilkan data.

### F. Akhir gladi (10 menit)

1. Admin: **Bekukan leaderboard** lalu **Lepas pembekuan** (uji tombolnya; jangan tekan Akhiri game).
2. Buat **cadangan** (`./70-backup.sh`) dan salin keluar laptop. Ini juga latihan cadangan akhir hari.
3. **Reset game** (ketik `RESET`). Periksa:
   - Status SETUP, semua saldo Rp 0, Transaksi dan Hadiah kosong, grafik IKC kosong.
   - Layar TV kembali menampilkan "Game belum di mulai".
   - Tim, pos, aset, dan berita utuh (berita kembali ke kumpulan).
4. Catat daftar temuan dan perbaiki sebelum hari H.

## 4. Pemantauan selama gladi (untuk teknis)

- Beban laptop: Monitor Aktivitas (CPU, memori). Wajar bila Postgres di bawah 30% dan tidak ada proses yang membengkak.
- Log aplikasi: terminal tempat `npm start` berjalan. Cari galat merah yang berulang.
- Log tunnel: `docker logs --tail 50 supabase-cloudflared` (galat "Unable to reach the origin" berarti aplikasi mati).
- Kesehatan: `curl https://classmeet.rahmadarifin.my.id/api/health` dari perangkat lain.
- Siklus berita: bila harga tidak bergerak lebih dari 16 menit setelah berita tayang, periksa `cron.job_run_details` (lihat [docs/08](docs/08-operations.md)).

## 5. Hari H

### Pagi (sebelum peserta datang)

- [ ] Charger, tidak tidur (`caffeinate -dims`), aplikasi lain ditutup.
- [ ] `./10-up.sh --tunnel`, lalu `npm run build && npm start` (build ulang hanya bila ada perubahan kode).
- [ ] Health check dari ponsel di data seluler (bagian 2).
- [ ] Cadangan pagi dibuat dan disalin keluar laptop.
- [ ] Status game **SETUP** dan layar TV menampilkan "Game belum di mulai". Bila ada sisa data gladi, **Reset game**.
- [ ] Semua laptop tim, ponsel penjaga, dan TV login dan diuji dengan satu kartu.
- [ ] Penjaga sudah di pos dan membuka **Tersedia** saat siap.
- [ ] Tepat waktu mulai: Admin menekan **Mulai game** (hari pertama). Hari kedua dan ketiga: **Buka pasar**.

### Selama acara

- Satu admin memantau Hadiah dan Audit secara berkala untuk nominal janggal.
- Teknis memantau laptop server dan tunnel; cadangan tiap 30 menit.
- Satu petugas di area laptop tim (antrean, kartu hilang, sesi macet) dan satu di meja bantuan.
- Pukul 19.00: **Tutup pasar**, pos menekan Tidak tersedia, cadangan akhir hari dibuat dan disalin keluar.
- Hari terakhir: bekukan leaderboard 15 menit sebelum akhir, tutup pasar, tunggu berita yang sedang tayang selesai (bisa sampai 15 menit), lalu **Akhiri game**.

### Larangan

- **Reset game menghapus semua saldo, transaksi, hadiah, dan riwayat.** Setelah acara dimulai, hanya tekan bila memang berniat mengulang dari nol. Selalu buat cadangan dulu.
- **Akhiri game** tidak dibatalkan lewat tombol biasa; pastikan semua berita sudah selesai dan semua pihak setuju.
- Jangan membuka Studio atau konsol database di tengah game.

## 6. Kriteria lulus gladi

| Pemeriksaan          | Lulus bila                                                             |
| -------------------- | ---------------------------------------------------------------------- |
| Kartu QR             | 100% kartu terbaca di laptop tim dan di ponsel penjaga                 |
| Sesi kiosk           | Tidak ada sesi yang terbawa; keluar sendiri setelah 5 menit            |
| Mulai game           | Layar TV berganti, berita pertama tayang, tidak ada galat              |
| Hadiah dan transaksi | Saldo berubah langsung; semua tercatat di Hadiah, Transaksi, dan Audit |
| Beli serentak        | Stok tidak negatif, pesan galat jelas                                  |
| Tanpa arbitrase      | Beli banyak lalu langsung jual semua selalu rugi (±2 %)                |
| Berita               | Berita berikutnya terpilih sendiri; harga bergerak dalam 3–15 menit    |
| Realtime dan polling | Laptop tim dan TV tetap segar tanpa muat ulang                         |
| WiFi putus / hotspot | Pulih sendiri, tidak perlu login ulang atau paling banyak sekali       |
| Restart              | Aplikasi dan Docker kembali sehat dalam ≤ 10 menit, data utuh          |
| Reset game           | Semua kembali bersih, TV menampilkan "Game belum di mulai"             |
| Cadangan             | Ada berkas cadangan di luar laptop                                     |

## 7. Catatan yang perlu diketahui

- Menu **Ekspor** di sidebar admin belum punya halaman (menuju `/admin/export` dan menampilkan 404). Untuk hasil akhir, catat dari halaman Tim (net worth), Transaksi, dan cadangan database.
- Skrip `npm run load-test` memakai akun uji (seed), jadi **tidak dipakai di hari H**; hanya untuk uji teknis di database uji.
- Tim yang berbagi laptop bergantian: gunakan tombol **Selesai** setiap kali selesai, dan pasang petugas di area laptop.
- Bila internet mati: pindah ke hotspot; penjaga mencatat hadiah di kertas sementara dan mengirim setelah pulih (aman karena idempotensi).
