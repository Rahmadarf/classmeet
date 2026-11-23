# 18. Analisa Pasar (pay to win)

Fitur tambahan (23 Nov): tim boleh **membeli laporan analisa** tentang berita yang sedang tayang. Laporan 4 paragraf berisi ciri perusahaan yang akan naik dan turun, seberapa kuat, dan perkiraan waktunya. Harga laporan ditetapkan admin dan bisa diubah kapan saja. Fitur ini sengaja "berbayar untuk menang": tim yang mau membayar mendapat keunggulan informasi di jeda 3–15 menit sebelum harga bergerak.

## 1. Keputusan

| Hal | Keputusan |
| --- | --- |
| Cakupan | Hanya berita yang **sedang tayang** (sudah terbit, efek harga belum berlaku). Tidak ada berita tayang = tidak bisa beli. Tidak membocorkan berita yang belum terbit. |
| Isi hint | **Frasa ciri tanpa nama aset** (Kamus sifat, [16](16-sifat-aset.md)), bukan nama atau kode aset. Pembeli tetap mencocokkan ciri ke aset sendiri. |
| Batas beli | **Sekali per berita per tim.** Membeli lagi untuk berita yang sama mengembalikan laporan lama tanpa memotong saldo. |
| Harga | Patokan **Rp 75.000 sampai Rp 100.000** (kalibrasi [19](19-kalibrasi-ekonomi.md); awal basis data Rp 100.000), bebas diubah admin 0 sampai Rp 100 juta, kapan saja (juga saat game berjalan). Berlaku untuk pembelian berikutnya. |
| Uang | Keluar dari saldo tim, tidak ada penerima (kas beredar berkurang). Net worth dan peringkat menyesuaikan sendiri. |
| Kerahasiaan | Laporan hanya terbaca oleh tim pembeli. **Admin tidak bisa membaca isinya** (membocorkan efek berita); admin hanya punya log pembelian. Tim bisa saja menceritakannya ke tim lain; yang menahan hanya harga. |

## 2. Cara kerja

1. Berita terbit. Selama jeda sebelum `effect_at`, kartu **Analisa Pasar** di Pasar aktif.
2. Tim membeli. Database (`buy_analysis`) memeriksa peran, pasar `open`, saklar aktif, berita tayang, sisa waktu efek ≥ 30 detik, laporan ada, dan saldo cukup; lalu memotong saldo dan menyimpan salinan laporan.
3. Laporan tampil di dialog dan tersimpan di **Riwayat** (baris "Analisa Pasar", uang keluar).
4. Jendela beli ditutup 30 detik sebelum efek berlaku supaya tim tidak membayar laporan yang sudah basi. Pemilik tetap bisa membuka laporannya.

## 3. Isi laporan (4 paragraf)

Dibuat saat kumpulan berita dibuat (`scripts/news-pool-lib.ts`, `analysisParagraphs`), dari efek harga berita yang sebenarnya, jadi isinya selalu benar. Tanpa nama atau kode aset (kecuali subjek berita event lewat judul).

| # | Bagian | Isi |
| --- | --- | --- |
| 1 | Ringkasan | Judul berita, arah pasar (condong naik / condong turun / campuran), jumlah ciri naik dan turun yang berarti (efek ≥ 1 %), dan perkiraan waktu: rentang selebar 2 menit yang pasti memuat sisa waktu sebenarnya ("dalam sekitar 6 sampai 8 menit ke depan"; di bawah 1 menit: "kurang dari 2 menit"). |
| 2 | Ciri yang naik | Sampai 3 ciri, urut dari terbesar, masing-masing dengan kekuatan: **kuat** (di atas 8 %), **sedang** (4 sampai 8 %), **ringan** (1 sampai 4 %; sering habis oleh selisih jual). Sisanya disebut jumlahnya. Bila tidak ada: dinyatakan terus terang. |
| 3 | Ciri yang turun | Sama dengan paragraf 2. |
| 4 | Catatan | Jumlah perusahaan yang bergerak tipis (< 1 %, tidak layak dikejar), ciri pengecoh yang disebut berita dinyatakan sebagai pengecoh, kalimat pengecoh lain tidak memengaruhi harga, catatan event (kebangkrutan, penghentian sementara, atau dividen), dan pengingat selisih jual, tekanan stok, serta batas pegang. |

Frasa ciri di laporan adalah frasa **alternatif** dari aset yang sama (bukan frasa yang dipakai berita), supaya pembeli mendapat petunjuk tambahan, bukan pengulangan. Satu frasa menunjuk tepat satu aset (diuji). Sekitar 35 % berita tidak punya ciri naik yang berarti dan sekitar 49 % tidak punya ciri turun yang berarti; laporan menyatakannya. Berita sendiri kini bertingkat sulit ([15](15-mesin-berita-v2.md) §3b): hanya 1 ciri naik dan 1 turun yang dibocorkan (separuh tanpa arah) plus satu pengecoh sifat, sehingga laporan benar-benar menambah informasi. Paragraf 4 laporan menyebut pengecoh sifat itu sebagai pengecoh.

## 4. Database (`scripts/sql/analysis.sql`)

- `game_settings.analysis_price` (bigint, 0..100 juta) dan `analysis_enabled`. Tidak masuk penjaga `game_settings_news_lock`, jadi bisa diubah setelah game dimulai.
- `news_analysis(news_id, paragraphs text[4])`: laporan per berita. Hanya admin dan hanya sebelum game dibuka; terkunci seperti `news` setelahnya.
- `analysis_purchases(id, request_id, team_id, news_id, news_title, price, paragraphs, created_at)`: unik per (tim, berita) dan per `request_id`. RLS: tim membaca barisnya sendiri; admin **tidak** termasuk. Klien tidak bisa menulis langsung.
- Fungsi tim: `get_analysis_offer()` (harga, `can_buy`, `reason`, `owned`, judul berita; tidak membocorkan waktu efek), `buy_analysis(request_id)`, `get_my_analyses(limit)`.
- Fungsi admin: `admin_set_analysis_settings(price, enabled)` (audit `set_analysis_settings`), `admin_analysis_log(limit)` dan `admin_analysis_summary()` (tanpa isi laporan).
- `buy_analysis` memakai `ob_lock()` dan mengunci baris tim, sama dengan beli/jual, jadi serial dan idempoten.
- `admin_reset_game` ikut mengosongkan `analysis_purchases`; harga dan teks laporan tetap.

### Kode galat

| Kode | Arti | Pesan |
| --- | --- | --- |
| `forbidden` | Bukan tim | "Kamu tidak punya akses untuk aksi ini." |
| `invalid_input` | `request_id` kosong / harga di luar batas (admin) | "Input tidak valid." |
| `team_not_found` | Tim tidak ada | "Tim tidak ditemukan." |
| `request_id_conflict` | `request_id` milik tim lain | "Permintaan bentrok, muat ulang halaman." |
| `market_closed` | Status bukan `open` | "Pasar sedang tutup." |
| `feature_disabled` | Saklar dimatikan admin | "Analisa Pasar sedang dimatikan panitia." |
| `no_live_news` | Tidak ada berita tayang | "Belum ada berita yang tayang untuk dianalisa." |
| `window_closed` | Sisa waktu efek < 30 detik | "Waktu membeli analisa untuk berita ini sudah habis." |
| `analysis_unavailable` | Berita tanpa laporan | "Laporan analisa untuk berita ini belum tersedia." |
| `insufficient_cash` | Saldo kurang | "Saldo tidak cukup." |

## 5. Antarmuka

- **Pasar (tim):** kartu "Analisa Pasar" di kolom kanan, di atas panel Beli/Jual (tombol gaya `secondary`, agar aksi utama tetap Beli/Jual). Konfirmasi memuat potongan dan sisa saldo; sesudah beli, dialog laporan 4 bagian. Sudah dibeli: tombol "Lihat laporan". Tombol mati disertai alasan tertulis (pasar tutup, dimatikan, belum ada berita, waktu habis, laporan belum ada, saldo kurang dengan selisihnya). Tawaran diambil ulang tiap 5 detik dan seketika saat berita baru terbit.
- **Riwayat (tim):** baris "Analisa Pasar" (− harga); rincian membuka laporan lengkap.
- **Aset (admin):** kartu "Harga dan saklar laporan analisa" di bawah Pengaturan toko; tidak terkunci setelah game dimulai.
- **Transaksi (admin):** panel "Pembelian analisa" (jumlah, tim pembeli, pendapatan, 50 terbaru), tanpa isi laporan.
- **Audit:** `set_analysis_settings` (kategori Aset): "Analisa Pasar aktif/dimatikan, harga Rp …".

## 6. Memuat laporan

Laporan ikut dimuat bersama kumpulan berita: `npm run load-news -- --replace` (game harus `setup`). `npm run seed` (lewat RPC admin) tidak memuat laporan. Setelah mengubah `news-themes*.ts`, `asset-traits.ts`, atau pembuat laporan, jalankan `npm run generate-news` lalu muat ulang kumpulan.

## 7. Menyetel harga (catatan panitia)

- Terlalu murah: semua tim membeli tiap berita dan keunggulan hilang. Terlalu mahal: tidak ada yang membeli. Patokan: hadiah pos sekitar Rp 300.000 per kunjungan; harga aset Rp 130.000 sampai Rp 2.000.000 per unit; simulasi strategi ([19](19-kalibrasi-ekonomi.md) §4) menunjukkan Rp 75.000 sampai Rp 100.000 menguntungkan bagi pembeli rasional dan Rp 200.000 tidak dibeli siapa pun.
- Uji di gladi resik ([PANDUAN-GLADI-RESIK](../PANDUAN-GLADI-RESIK.md)): lihat berapa tim yang membeli dan apakah pembelinya benar-benar lebih untung.
- Harga bisa diubah di tengah game bila terlalu timpang; pembeli sebelumnya tidak terpengaruh.
- Saklar "Analisa aktif" mematikan pembelian seketika (laporan yang sudah dibeli tetap bisa dibuka).

## 8. Pengujian

- SQL: `scripts/sql/test-analysis.sql` (51 pemeriksaan: peran, beli, idempotensi, konflik, sekali per berita, saldo kurang, harga diubah saat game berjalan, harga 0, semua kode galat, RLS, log admin tanpa isi, reset).
- Pembuat laporan: `scripts/news-pool-lib.test.ts` (4 paragraf, `{waktu}` sekali, arah ciri benar menurut efek dan urut dari terbesar, tanpa nama perusahaan, frasa unik, tidak menggeser berita lama).
- UI: `lib/analysis/view.test.ts` dan riwayat; uji peramban sebagai tim dan admin ([13](13-log-implementasi.md)).
- Beban: `npm run load-test -- --spike` ikut menguji lonjakan beli analisa serentak (satu pembelian per tim).
