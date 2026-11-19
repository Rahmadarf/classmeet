# 05 — Aturan Permainan

Dokumen ini menjadi acuan **panitia** dan **developer**. Angka bertanda *(default)* bisa diubah lewat `game_settings`, data seed, atau panel admin.

> **Perubahan 17 Nov 2026 (sudah diimplementasikan dan diuji):** mekanisme trading diganti menjadi order book (bandar panitia + order antar-tim). Bagian §1 (net worth), §2 (biaya), §3 (Trading), §4.5 (biaya jual), dan §7 di dokumen ini sudah disesuaikan; aturan lengkap, parameter, dan contoh ada di [`12-order-book.md`](12-order-book.md), SQL di [`03-database.md`](03-database.md) dan [`04-rpc-contracts.md`](04-rpc-contracts.md) §3.1.

## 1. Tujuan permainan

Tim dengan **net worth tertinggi** saat status game `finished` menang.

```
net worth = saldo bebas + saldo terkunci di order + Σ jumlah unit × harga peringkat (VWAP 10 menit)
```

Setiap tim **mulai dari Rp 0**. Satu-satunya sumber uang adalah **hadiah pos** (setelah disetujui admin). Setelah punya uang, tim berdagang; uang bertambah atau berkurang lewat trading, dan nilai aset yang dipegang ikut naik-turun mengikuti harga.

## 2. Parameter default

> **Diganti 19 Nov:** pemilihan berita, jumlah aset per berita (kini **10–15**, bukan 4–7), dan event berbasis peluang (bangkrut, suspensi, dividen) diatur di [15-mesin-berita-v2](15-mesin-berita-v2.md). Baris dan bagian lama tentang 4–7 aset dan pemilihan acak berbatas di bawah sudah tidak berlaku.

| Parameter | Default | Tempat mengubah |
|-----------|---------|-----------------|
| Modal awal per tim | **Rp 0** (tetap, bukan pengaturan) | — |
| Biaya transaksi | **0,25 % per sisi** (pembeli dan penjual), dibulatkan ke atas per pencocokan, dibayar ke panitia | `game_settings.fee_bps` (25) |
| Batas kepemilikan per tim per aset | **Tidak ada** (dihapus 16 Nov); hanya stok dan saldo yang membatasi | — |
| Batas kunjungan per tim per pos | **Tidak ada** | — |
| Berita terbit → harga berubah | **Acak 3–15 menit**, diundi sistem untuk tiap berita (bukan patokan tetap) | `game_settings.news_delay_min_minutes` (3), `news_delay_max_minutes` (15) |
| Jeda setelah harga berubah sebelum berita berikutnya | **0** (berita berikutnya langsung terbit); boleh diisi sebelum game dibuka | `game_settings.news_gap_minutes` |
| Urutan berita dan waktu perubahan harga | **Sepenuhnya sistem.** Panitia tidak bisa memilih, mengantre, mempercepat, menunda, atau mengubah harga sejak game dibuka sampai selesai | `game_is_locked()`, pemicu `guard_game_lock()` |
| Jumlah aset yang terpengaruh per berita | **4–7**, eksplisit per aset | `game_settings.min_news_assets`, `max_news_assets` |
| Besar efek per aset | **8–14 %** (pedoman admin); **maksimum 15 %** yang ditegakkan database | `game_settings.max_effect_bps` (pedoman 8–14 % ada di tangan admin, bukan kode) |
| Perubahan harga acak | **Tidak ada**. Yang acak hanya **pemilihan berita**, bukan besar harga | — |
| Pemilihan berita | **Otomatis, acak berbatas** dari kumpulan berita siap; admin tidak memilih | `news.status = 'ready'`, `process_news_cycle()` |
| Jumlah berita yang disiapkan | **±220** bila `news_gap_minutes = 0` dan pasar tak pernah ditutup; lihat §4.4 | `news` |
| Jam pasar | **08.00–19.00 WIB, 3 hari**; admin membuka dan menutup pasar sendiri dengan tombol | `admin_set_game_state('open' / 'paused')` |
| Jumlah aset | **25** (5 sektor × 5) | `assets` |
| Pembulatan harga | Rp 100 | `game_settings.price_step` |
| Batas harga bawah / atas aset | 30 % / 300 % dari harga awal | `assets.min_price`, `assets.max_price` |
| Batas nominal hadiah per pos | **Tidak ada** (diputuskan) | — |
| Leaderboard | Hanya di layar ruang publik | Akun `display` |
| Pembekuan leaderboard | 15 menit sebelum akhir | Tombol admin |
| Akhir game | Admin menekan **Selesai** setelah perubahan harga terakhir | `admin_set_game_state('finished')` |

## 3. Trading (order book)

Ringkasan; rincian, parameter, dan contoh angka di [`12-order-book.md`](12-order-book.md).

1. **Hanya saat pasar `open`.** Saat `setup`, `paused`, atau `finished`, memasang dan membatalkan order ditolak. Saat game ditutup (`finished`), semua order antre dibatalkan otomatis dan kuncinya dikembalikan.
2. **Dua jenis lawan.** Bandar panitia selalu memasang 5 bid dan 5 offer di sekitar harga acuan; tim juga saling mencocokkan order. Harga yang tampil adalah **harga transaksi terakhir**; harga yang dihitung untuk net worth dan peringkat adalah **harga peringkat** (VWAP 10 menit, `rank_price`). Harga acuan hanya digeser berita.
3. **Order.** `limit` (harga + lot, antre sampai terisi, dibatalkan, atau pasar ditutup) dan `market` (lot saja, menyapu paling banyak 5 level harga terbaik, sisanya dibatalkan). 1 lot = 1 unit aset. Harga harus kelipatan fraksi (Rp 500 / 1.000 / 2.500 menurut rentang harga) dan berada dalam ±15 % harga acuan (ARA/ARB) serta batas min/maks aset.
4. **Pencocokan** otomatis di server: harga terbaik dulu, lalu yang masuk lebih dulu; harga transaksi = harga order yang sudah antre; boleh sebagian (*partial fill*). Order tim yang sama tidak dicocokkan satu sama lain.
5. **Kunci.** Order beli limit menahan `harga × lot + biaya` dari saldo; order jual menahan lot dari kepemilikan. Pembatalan mengembalikan sisa kunci. Saldo bebas dan lot bebas tidak bisa dipakai dua kali.
6. **Biaya 0,25 % per sisi**, dibulatkan ke atas per pencocokan. Bandar tidak membayar biaya.
7. **Stok adalah persediaan bandar.** Seluruh stok awal dipegang bandar; offer bandar dibatasi sisa persediaannya, sehingga unit aset tetap konstan: bandar + Σ milik tim = stok awal. Stok awal ditentukan per aset (murah: banyak, mahal: sedikit; §5). Level yang habis dimakan tidak diisi ulang sampai siklus berikutnya (tiap 5 menit atau setelah berita berlaku), jadi tekanan beli terasa di harga.
8. **Tidak ada jual kosong (short selling), pinjaman, atau margin.** Saldo dan kepemilikan tidak boleh negatif. Tidak ada batas kepemilikan per tim.
9. **Order dan pembatalan adalah keputusan tim.** Kesalahan sistem dikoreksi panitia lewat `admin_adjust_cash` dan tercatat di audit. Panitia tidak bisa mengubah harga acuan, kuotasi bandar, atau parameter order book sejak game dibuka.
10. **Aset yang dinonaktifkan** (`is_active = false`) tidak punya kuotasi baru dan tidak bisa diorder; harganya tidak ikut berubah oleh berita.
11. **Tim bersaldo Rp 0 tidak bisa memasang order beli.** Pesan: "Saldo belum cukup; dapatkan hadiah di pos dulu."
12. **Hanya di perangkat trading panitia.** Tim tidak membawa ponsel. Mereka membawa **kartu QR** yang punya dua fungsi: dipindai penjaga untuk menerima hadiah, dan dipindai di laptop trading untuk masuk ke akun tim. Sesi keluar otomatis setelah **5 menit tanpa gerakan**, atau saat tim menekan *Selesai*. Pemindai di laptop memakai kamera. Order yang sudah antre tetap berjalan setelah tim keluar sesi.

## 4. Harga: berita dan waktunya diatur sistem

### 4.1 Siklus

Harga **tidak pernah bergerak acak**, dan **tidak ada manusia yang menggerakkannya**. Satu-satunya perubahan berasal dari berita yang dipilih dan dijadwalkan oleh **sistem** dari kumpulan berita siap:

```
sistem memilih berita acak ──(3 s.d. 15 menit, diundi sistem)──► harga aset berubah ──(jeda, default 0)──► berita berikutnya
```

- Hanya **satu berita aktif** pada satu waktu.
- **Waktu perubahan harga acak.** Saat sebuah berita terbit, sistem mengundi jedanya sendiri: antara 3 menit dan 15 menit (resolusi detik; undian dibatasi supaya perubahan nyata tidak pernah lewat dari 15 menit karena penjadwal berjalan tiap 10 detik). Tidak ada patokan tetap, jadi tim tidak bisa menebak kapan harga bergerak.
- Selama menunggu, **harga lama masih berlaku**. Tim yang membaca petunjuk berita dengan benar boleh bertransaksi sekarang dan mengambil untung setelah harga bergerak. Itulah inti permainannya.
- **Urutan berita ditentukan sistem.** Begitu berita sebelumnya selesai berlaku (ditambah `news_gap_minutes`, default 0) dan pasar `open`, sistem **memilih satu berita secara acak** dari kumpulan `ready`. Admin tidak memilih, tidak mengantre, dan tidak punya tombol untuk memicu siklus.
- **Acak berbatas.** Calon yang efeknya membuat harga aset mana pun jatuh di bawah harga minimum atau naik di atas harga maksimum dibuang dari undian saat itu. Bila **tidak ada** calon aman, sistem tetap memilih satu berita `ready` secara acak dan harga **dipotong ke batas** (dijepit), supaya pasar tidak macet. Berita tidak pernah terbit dua kali. Bila kumpulan habis, pasar diam dan panel admin memberi peringatan.
- **Buka dan tutup pasar manual.** Pasar bergerak hanya saat status `open`. Tombol *Tutup pasar* (jeda) menghentikan siklus dan perdagangan; pos tetap boleh memberi hadiah. Tombol *Buka pasar* melanjutkan; tenggat perubahan harga bergeser sebesar lama jeda, jadi jeda tidak bisa dipakai untuk mengubah waktu.
- **Tidak ada koreksi manual.** `admin_set_price`, antrean berita, dan tombol "Jalankan siklus" **dihapus**. Kesalahan harga tidak diperbaiki lewat harga: harga adalah hasil mekanisme, dan koreksi yang adil dilakukan lewat saldo (`admin_adjust_cash`, tercatat di `audit_log`).
- Ketepatan waktu ±10 detik (penjadwal `pg_cron` berjalan tiap 10 detik).

### 4.1a Penguncian setelah game dibuka

Semua yang memengaruhi harga **dikunci oleh database** begitu game dibuka pertama kali (`game_settings.started_at` terisi):

| Terkunci setelah dibuka | Tetap boleh |
|---|---|
| Harga, batas harga, status aktif aset; tambah/hapus aset | Stok aset (`admin_set_stock`) |
| Membuat, mengubah, menandai siap atau membatalkan berita dan efeknya | Tutup/buka pasar, bekukan leaderboard, koreksi saldo |
| Mengubah parameter berita (rentang jeda, jeda antarberita) | Menutup game (**Selesai**) |
| Menulis `price_history` | |

Admin juga **tidak bisa membaca** isi berita (`news`, `news_effects`) setelah game dibuka; tim hanya melihat berita lewat `news_feed` saat sudah tayang.

**Batas jujur penguncian ini:** ia mencegah akun admin aplikasi. Ia **tidak** mencegah orang yang memegang akses `service_role`, kata sandi pemilik database, atau akses shell ke server. Siapa pun dengan akses itu tetap bisa mengubah data. Karena itu: simpan kunci itu di satu orang yang **bukan panitia penyelenggara**, atau segel (jangan dipakai) selama game berlangsung, dan tidak ada yang membuka konsol database sepanjang acara. Tanpa langkah itu, "panitia tidak bisa mengubah harga" hanya berlaku untuk antarmuka, bukan untuk basis data.

### 4.2 Aturan efek (ditegakkan database, bukan hanya panel)

| Aturan | Nilai |
|--------|-------|
| Aset per berita | 4–7, ditulis **eksplisit per aset** (tidak ada efek per sektor) |
| Aset ganda dalam satu berita | Ditolak |
| Aset nonaktif | Ditolak |
| Besar efek | Tidak boleh 0 dan tidak boleh melebihi ±15 % |
| Pedoman admin | Perubahan 8–14 %. Batas kode tetap 15 % |
| Pelanggaran | Berita **ditolak saat disimpan**, **ditolak saat ditandai siap**, dan **ditolak lagi saat terbit** |
| Batas harga | Berita yang membuat harga aset mana pun menabrak batas min/maks **tidak dipilih** (tetap siap, menunggu harga bergeser) |
| Aset yang kena berita berturut-turut | **Tidak ada aturan jeda aset.** Penjaga satu-satunya adalah batas harga di atas |

Harga baru = harga lama × (1 ± persen), dibulatkan ke `price_step`, lalu dijepit antara harga minimum dan maksimum aset. Efek diterapkan sekali untuk semua aset berita itu dalam satu transaksi, jadi semua harga berubah serentak.

> **Jebakan pembulatan.** Dengan `price_step` Rp 100, aset berharga Rp 1.000 yang naik 3 % (Rp 1.030) dibulatkan kembali ke Rp 1.000 dan tidak bergerak. Untuk aset permainan (Rp 90.000 ke atas) tidak masalah, tetapi jangan membuat aset murah dengan `price_step` besar.

### 4.3 Menulis berita

Berita berupa teks bebas. Pola yang dipakai panitia: tiga paragraf; di tiap paragraf ada **satu petunjuk inti** tentang sifat sebuah perusahaan, ditambah **dua kalimat pengecoh**. Tim yang jeli menghubungkan petunjuk itu dengan profil aset.

Contoh dari panitia (berita 3, kategori kesehatan/distribusi):

> *Sejumlah distributor melaporkan adanya peningkatan permintaan terhadap berbagai produk kesehatan dalam beberapa waktu terakhir. Kondisi tersebut membuat beberapa produsen mulai mengevaluasi persediaan bahan baku dan kapasitas produksi. Sejumlah perusahaan juga dikabarkan sedang memperluas jaringan pemasaran untuk menjangkau wilayah baru. Perusahaan yang mampu menjaga ketersediaan produk dan memiliki sistem distribusi yang kuat diperkirakan mendapat keuntungan dari situasi ini. Di sisi lain, sebuah organisasi profesi merencanakan seminar mengenai perkembangan pendidikan kesehatan. Sejumlah pusat kebugaran juga memperkenalkan program keanggotaan baru untuk pelanggan.*

Petunjuk inti: perusahaan yang punya **ketersediaan produk dan sistem distribusi yang kuat** diuntungkan (aset kesehatan/distribusi dengan sifat itu naik). Dua kalimat pengecoh: seminar organisasi profesi dan program keanggotaan pusat kebugaran. Kunci jawabannya (aset mana, berapa persen) baru bisa ditulis setelah profil aset ada. Tiga kalimat pertama menjadi konteks (sektor kesehatan, permintaan naik, ekspansi pemasaran), kalimat keempat memuat petunjuk, dua kalimat terakhir pengecoh. Sistem tidak peduli bentuknya karena teks disimpan apa adanya.

Contoh berita untuk aset daftar final (usulan, 13 Nov). Format: empat kalimat inti yang memuat kata kunci sifat (§5.1), lalu dua kalimat pengecoh tanpa kata kunci aset mana pun.

**Contoh A: berita positif, lintas sektor (5 aset)**

Judul: *Libur Panjang Tiba, Perjalanan Wisata Meningkat Tajam*

> Menjelang libur panjang, jumlah penumpang dan pemesanan tiket penerbangan dilaporkan naik jauh dibanding bulan lalu. Pabrik pesawat disebut menerima pesanan pesawat baru dari sejumlah maskapai untuk melayani rute-rute yang semakin padat. Di kota tujuan wisata, jumlah pengemudi yang beroperasi dan permintaan pengantaran makanan meningkat bersamaan dengan datangnya wisatawan. Pembayaran kartu bank dan transaksi nontunai di pusat wisata juga tercatat naik sepanjang pekan ini. Warung dan toko di kawasan wisata melaporkan penjualan biskuit dan permen melonjak. Di sisi lain, sebuah sekolah menyelenggarakan pameran karya siswa pada akhir bulan, dan pemerintah daerah memperbarui jadwal perawatan jalan di pusat kota.

| Aset | Efek | Petunjuk di teks |
|------|-----:|------------------|
| Airbus | +14 % | "pesanan pesawat baru", pabrik pesawat |
| Grab | +11 % | pengemudi, pengantaran makanan |
| Garuda Indonesia | +10 % | jumlah penumpang, tiket penerbangan |
| BCA | +9 % | pembayaran kartu bank, transaksi nontunai |
| Mayora | +8 % | warung dan toko, biskuit dan permen |
| Honda, Toyota | tidak terdampak | jebakan: terdengar "transportasi", tetapi tidak ada kata kuncinya |

**Contoh B: berita campuran, ada yang rugi dan ada yang untung (4 aset)**

Judul: *Harga Bahan Baku Melonjak, Produsen Mulai Menanggung Biaya Tambahan*

> Harga sejumlah bahan baku utama naik cukup tajam dalam dua pekan terakhir akibat pasokan yang tersendat. Produsen saus dan makanan kalengan serta produk susu melaporkan biaya rantai pasok yang membengkak, dan sebagian mulai memangkas jumlah produksi. Perusahaan jamu dan suplemen herbal juga mengeluhkan sulitnya mendapat bahan baku dalam jumlah yang biasa mereka pakai. Di sisi lain, penyaluran pembiayaan mikro kepada petani dan pedagang kecil dilaporkan meningkat karena kebutuhan modal usaha yang naik. Sebuah komunitas lari mengumumkan acara tahunan di taman kota, dan sebuah galeri seni membuka pameran baru bulan depan.

| Aset | Efek | Petunjuk di teks |
|------|-----:|------------------|
| Kraft Heinz | −12 % | saus dan makanan kalengan, rantai pasok membengkak |
| Danone | −10 % | produk susu, biaya rantai pasok |
| Sido Muncul | −9 % | jamu dan suplemen herbal, sulit bahan baku |
| BRI | +10 % | pembiayaan mikro, petani dan pedagang kecil |
| Mayora, Indofood, Nestlé | tidak terdampak | jebakan: sama-sama pabrik makanan, tetapi tidak disebut |

#### Berita tingkat sulit (16 Nov)

Setelah batas pegang dihapus, tim yang salah baca bisa rugi besar karena boleh memborong. Berita karena itu dibuat lebih sulit dengan lima cara, dan **tiap berita sulit tetap punya kunci jawaban yang tidak ambigu**:

1. **Petunjuk tidak langsung (satu langkah sebab-akibat).** Teks menyebut penyebab, bukan nama bisnisnya; peserta menurunkan sendiri siapa yang kena. Cukup satu langkah, lebih dari itu kunci jawaban jadi debat.
2. **Hanya fakta yang dihitung.** Kabar burung, "dikabarkan", "wacana", "diprediksi", dan "dibantah" **tidak** menggerakkan harga. Hanya yang sudah terjadi, diresmikan, atau dilaporkan terjadi yang masuk kunci.
3. **Sinyal ganda dalam satu berita.** Satu aset bisa mendapat kabar baik dan buruk sekaligus; kunci jawabannya arah bersih (yang lebih kuat), dan teks menyebut alasan pemenangnya.
4. **Jebakan nama dan sektor.** Aset sesektor yang terdengar relevan tetapi tidak disebut tetap 0 %. Aset dari sektor berbeda boleh bergerak berlawanan arah.
5. **Efek tidak seragam.** Campur +8 sampai +15 dan −8 sampai −15 dalam satu berita (batas database tetap 15 %), supaya peserta tidak bisa memborong satu sisi.

**Contoh C: rantai tidak langsung, pelabuhan macet (4 aset)**

Judul: *Antrean Kapal di Pelabuhan Utama Memanjang Tiga Pekan*

> Antrean kapal di pelabuhan utama memanjang hingga tiga pekan, membuat kiriman komponen impor tertahan di dermaga. Perakit gawai yang bergantung pada komponen dari luar negeri mengumumkan jadwal peluncuran produk barunya mundur. Sebaliknya, produsen yang seluruh bahan bakunya berasal dari kebun dan pabrik dalam negeri melaporkan tidak ada gangguan dan menerima pesanan limpahan dari pelanggan yang beralih pemasok. Maskapai melaporkan harga bahan bakar penerbangan naik karena pasokan ikut tertahan, sementara tarif tiket tidak boleh dinaikkan. Pejabat pelabuhan menyebut antrean akan terurai bulan depan. Di sisi lain, sebuah klub catur menggelar turnamen antar-sekolah, dan sebuah perpustakaan kota memperpanjang jam buka akhir pekan.

| Aset | Efek | Alasan jawaban |
|------|-----:|----------------|
| Xiaomi | −12 % | gawai, komponen impor tertahan |
| Apple | −10 % | peluncuran produk baru mundur |
| Indofood | +10 % | bahan baku dari kebun sendiri, pesanan limpahan |
| Garuda Indonesia | −9 % | harga avtur naik, tarif tiket tidak boleh naik |
| Samsung, Mayora | tidak terdampak | jebakan: terdengar terkait komponen atau pabrik, tetapi tidak disebut |

"Antrean akan terurai bulan depan" adalah prediksi dan tidak dihitung.

**Contoh D: hanya yang terkonfirmasi, perbankan (4 aset)**

Judul: *Dua Kabar dari Dunia Perbankan, Hanya Sebagian yang Resmi*

> Beredar kabar bahwa bank swasta terbesar akan menaikkan biaya kartu dan transaksi, tetapi manajemennya menyebut itu hanya wacana internal yang belum diputuskan. Di sisi lain, bank milik negara resmi menandatangani penyaluran kredit untuk proyek jalan tol dan pelabuhan baru dengan nilai sangat besar. Jaringan pembayaran global melaporkan transaksi lintas negara tumbuh pesat pada pekan ini, meski analis memperkirakan pertumbuhan melambat musim depan. Bank dengan jaringan sampai ke desa melaporkan sejumlah nasabah usaha kecil gagal membayar cicilan setelah panen gagal. Dompet digital mengumumkan gangguan sistem selama dua hari yang menunda transfer antar pengguna. Di sisi lain, sebuah komunitas fotografi membuka pameran di taman kota, dan dinas pariwisata merilis kalender acara bulan depan.

| Aset | Efek | Alasan jawaban |
|------|-----:|----------------|
| Mandiri | +12 % | kredit infrastruktur sudah ditandatangani |
| Visa | +9 % | transaksi lintas negara tumbuh (fakta); perlambatan hanya prediksi |
| BRI | −10 % | nasabah usaha kecil gagal bayar, jaringan desa |
| PayPal | −8 % | gangguan sistem, transfer antar pengguna tertunda |
| BCA | tidak terdampak | jebakan: hanya wacana yang dibantah, belum terjadi |

**Contoh E: efek berlawanan dalam rantai yang sama, kemarau panjang (4 aset)**

Judul: *Kemarau Panjang, Cadangan Air Sejumlah Daerah Menipis*

> Kemarau yang berlangsung lebih dari dua bulan membuat sejumlah daerah mulai menjatah air bersih untuk rumah tangga. Penjualan air dalam kemasan di toko dan swalayan dilaporkan melonjak karena warga enggan mengandalkan sumber air setempat. Perkebunan di beberapa wilayah gagal panen kelapa sawit dan pasokan bahan baku minyak goreng menyusut. Warga disebut mengurangi mencuci pakaian dan memakai sabun serta deterjen dalam jumlah yang jauh lebih sedikit demi menghemat air. Apotek melaporkan permintaan minuman kesehatan dan obat pereda dehidrasi meningkat tajam. Sementara itu, sebuah penerbit mengumumkan terbitan buku anak baru, dan sebuah kampus membuka pendaftaran beasiswa.

| Aset | Efek | Alasan jawaban |
|------|-----:|----------------|
| Danone | +10 % | air dalam kemasan melonjak |
| Kalbe Farma | +9 % | minuman kesehatan, apotek |
| Indofood | −11 % | gagal panen sawit, minyak goreng menyusut |
| Unilever | −8 % | sabun dan deterjen dipakai jauh lebih sedikit |
| Mayora, Nestlé | tidak terdampak | jebakan: sama-sama pangan, tetapi tidak disebut |

Contoh C dan E sengaja memakai Indofood dengan arah berbeda (+10 % dan −11 %): aset yang sama boleh naik di satu berita dan turun di berita lain, jadi menimbun satu aset "karena beritanya bagus kemarin" adalah strategi yang berbahaya.

**Komposisi 100 berita yang disarankan:** sekitar 40 % mudah (seperti A dan B), 40 % sedang (satu sinyal tidak langsung atau satu jebakan fakta), 20 % sulit (seperti C sampai E). Berita sulit jangan menumpuk di satu hari; sebarkan agar tim tidak kehilangan semangat.

Catatan penyusunan: pengecoh sengaja tidak memuat kata kunci aset mana pun (kata seperti "bank" atau "obat" akan menjadi soal yang lebih sulit); satu aset yang terdengar relevan tetapi tidak disebut per berita sudah cukup sebagai jebakan; satu aset yang berlawanan arah dalam berita buruk (BRI di contoh B) mencegah peserta menjual semua aset yang terkait; aset yang sama boleh muncul di berita berbeda karena tidak ada aturan jeda per aset.

Konsekuensi untuk persiapan:

1. **Setiap aset butuh profil/sifat yang jelas** (apa bisnisnya, apa yang memengaruhinya) supaya petunjuk berita bisa diterjemahkan tim. Tanpa profil, berita hanya tebak-tebakan. Profil aset dibagikan ke tim sebelum acara.
2. **Kunci jawaban** untuk tiap berita wajib ada: aset mana, naik atau turun, berapa persen. Itulah isi `news_effects`.
3. Siapkan **lebih banyak berita daripada yang dibutuhkan**: sekitar 100 untuk 3 hari (kebutuhan sekitar 99, lihat §4.4). Tulis semuanya di `news.json` dan jalankan `scripts/import-news.ts check` (aturan + simulasi kecukupan kumpulan) sebelum mengimpor dengan `--ready`; berita yang belum rampung tidak diimpor. Berita yang tidak terpakai sampai akhir tidak masalah.
4. Hindari dua berita dengan isi yang sama.
5. Berita yang sudah tayang tidak bisa disunting, dan efeknya tidak pernah ditampilkan ke tim (tim hanya melihat teks dan perubahan harga).

### 4.4 Jumlah berita yang dibutuhkan

Pasar buka 08.00–19.00 (11 jam) selama 3 hari, jadi 33 jam. Jeda berita acak 3–15 menit (rata-rata sekitar 9 menit) dengan `news_gap_minutes = 0` menghasilkan kira-kira 6–7 berita per jam: sekitar **215–220 berita** bila pasar tidak pernah ditutup. Siapkan **±220**, atau naikkan `news_gap_minutes` sebelum game dibuka (jeda 5 menit mengecilkan kebutuhan menjadi sekitar 140). Kumpulan harus **lengkap sebelum game dibuka**, karena sesudahnya tidak bisa ditambah. Bila kumpulan habis, pasar diam: tidak merusak apa pun, tetapi harga berhenti bergerak.

Pemakaian per hari kira-kira 70 berita (default). Panel admin menampilkan jumlah berita *siap*, *aman diterbitkan*, dan *terpakai* hanya sampai game dibuka; sesudahnya admin tidak bisa membaca isi berita, hanya jumlahnya.

Permainan berakhir saat admin menekan **Selesai**, setelah perubahan harga terakhir. Cara menutup yang aman:

1. Tutup pasar (jeda) dan tunggu berita yang sedang tayang selesai (paling lama 15 menit); harga dari berita terakhir harus sudah berubah.
2. Pastikan semua pos sudah menutup dan tidak ada hadiah yang masih dikirim.
3. Bekukan leaderboard (opsional, sekitar 15 menit sebelum akhir) lalu tekan **Selesai**.

Menekan Selesai saat masih ada berita yang tayang **ditolak** (`news_pending`). Tidak ada opsi `force`: membatalkan berita di tengah jalan sama dengan campur tangan atas harga. Tunggu berita itu berlaku. Berita `ready` yang tersisa tidak menghalangi.

### 4.5 Catatan desain untuk panitia

- **Skala keuntungan trading.** Dengan efek 8–14 % (diputuskan untuk memperlebar pembeda), aset Rp 300.000 bergerak sekitar Rp 24.000–42.000 per unit; tanpa batas pegang, nilai satu tebakan tepat bergantung pada saldo dan stok: memegang 9 unit berarti sekitar Rp 216.000–378.000 per aset. Itu setara satu atau dua kunjungan pos. Pos tetap penghasil uang utama (sesuai tujuan panitia), trading kini menjadi pembeda yang nyata, bukan sekadar hiasan. Satu berita yang menyentuh 4–7 aset bisa menggeser kekayaan tim yang memegang aset-aset itu secara berarti, jadi salah baca berita juga menyakitkan (efek bisa negatif).
- **Biaya transaksi 0,25 % per sisi** (diputuskan 17 Nov; `game_settings.fee_bps`). Jauh lebih kecil dari biaya jual 5 % sebelumnya karena bandar selalu memasang kuotasi dengan spread 2 fraksi harga; spread itu sendiri sudah menjadi biaya bolak-balik. Biaya dibayarkan ke panitia (uang hilang dari peredaran tim), tidak ke tim mana pun.
- **Berita tampil di layar publik.** Tim tidak membawa ponsel, jadi berita ditampilkan di layar ruang publik (tanpa hitung mundur) dan di perangkat trading. Tanpa layar publik, tim yang kebetulan duduk di perangkat punya informasi lebih dulu.
- **Perangkat trading terbatas.** Tim berdagang hanya di laptop panitia (§3 butir 12 dan dokumen 07). Saat berita tayang, tim berebut perangkat; keluar dari sesi (tombol Selesai atau 5 menit tanpa gerakan) membebaskan perangkat.
- **Pembaca berita yang cepat menang.** Berita tampil di semua tim sekaligus, tetapi tim yang saldonya sudah ada saat berita tayang punya keunggulan atas tim yang belum sempat ke pos. Karena hadiah langsung masuk, tidak ada lagi keterlambatan akibat persetujuan.

## 5. Aset

**Aturan harga.** Harga dibuat sendiri oleh panitia, tidak dipatok ke harga saham asli (diputuskan 13 Nov, menggantikan usulan 8 % dan 10 % dari harga asli). Nama perusahaan memakai nama asli, seperti IT FEST; harganya rekaan dan mengikuti ukuran dan gengsi perusahaan (teknologi dan keuangan besar paling mahal, barang konsumen dan pangan paling murah). Harga tertinggi sengaja di bawah Rp 1.000.000 karena hadiah pos hanya Rp 100.000 – Rp 500.000. Semua harga kelipatan `price_step` (Rp 100) dan di atas Rp 1.000, jadi efek 8–14 % tidak hilang oleh pembulatan (lihat jebakan pembulatan di §4.2).

**Daftar aset: 25 aset (5 sektor × 5), diputuskan 13 Nov** (sebelumnya 15; dinaikkan karena permainan 3 hari dan sekitar 100 berita). Nama, sektor, dan harga sudah dipilih; simbol memakai huruf depan nama (2 huruf, supaya unik); profil dan sifat ada di §5.1. Stok awal dan batas pegang mengikuti aturan: **makin murah, makin banyak stoknya**.

| Sektor | Simbol | Nama | Harga awal | Stok awal |
|--------|--------|------|-----------:|----------:|
| Teknologi | AP | Apple | 800.000 | 10 |
| Teknologi | MI | Microsoft | 750.000 | 10 |
| Teknologi | SA | Samsung | 450.000 | 16 |
| Teknologi | XI | Xiaomi | 250.000 | 36 |
| Teknologi | TE | Telkom Indonesia | 150.000 | 36 |
| Pangan | NE | Nestlé | 380.000 | 24 |
| Pangan | KH | Kraft Heinz | 280.000 | 24 |
| Pangan | DA | Danone | 200.000 | 36 |
| Pangan | MA | Mayora | 130.000 | 36 |
| Pangan | IN | Indofood | 120.000 | 50 |
| Keuangan | BC | BCA | 700.000 | 10 |
| Keuangan | VI | Visa | 600.000 | 16 |
| Keuangan | MD | Mandiri | 500.000 | 16 |
| Keuangan | BR | BRI | 400.000 | 24 |
| Keuangan | PA | PayPal | 300.000 | 24 |
| Transportasi | AI | Airbus | 650.000 | 10 |
| Transportasi | TO | Toyota | 450.000 | 16 |
| Transportasi | HO | Honda | 400.000 | 24 |
| Transportasi | GR | Grab | 300.000 | 24 |
| Transportasi | GA | Garuda Indonesia | 150.000 | 36 |
| Konsumen dan kesehatan | LO | L'Oréal | 500.000 | 16 |
| Konsumen dan kesehatan | PF | Pfizer | 380.000 | 24 |
| Konsumen dan kesehatan | UN | Unilever | 180.000 | 36 |
| Konsumen dan kesehatan | KA | Kalbe Farma | 140.000 | 36 |
| Konsumen dan kesehatan | SM | Sido Muncul | 110.000 | 50 |

Tingkatan stok yang dipakai: harga ≤ Rp 120.000 → stok 50; ≤ 250.000 → 36; ≤ 400.000 → 24; ≤ 600.000 → 16; di atasnya → 10. Kolom "sektor" hanya label tampilan; berita tidak menarget sektor.

### 5.1 Profil dan sifat aset

Profil dipakai peserta untuk menebak aset yang terdampak berita; **kata kunci sifat dipakai penulis berita sebagai petunjuk** (muncul di kalimat inti berita dan tidak muncul di kalimat pengecoh). Kata kunci sengaja dibuat berbeda antar aset yang mirip (mis. Garuda memakai penumpang dan tiket, Airbus memakai pesanan pesawat) supaya kunci jawaban tidak ambigu. Ini usulan awal; panitia boleh mengubahnya. Sektor hanya label tampilan; berita tidak menarget sektor.

| Aset | Sektor | Profil | Kata kunci sifat |
|------|--------|--------|------------------|
| Apple | Teknologi | Perangkat premium dengan ekosistem sendiri | perangkat premium, peluncuran produk, ekosistem aplikasi |
| Microsoft | Teknologi | Perangkat lunak dan layanan komputasi awan | komputasi awan, perangkat lunak perusahaan, langganan, kecerdasan buatan |
| Samsung | Teknologi | Elektronik dan komponen chip | pabrik besar, komponen chip, elektronik rumah tangga |
| Xiaomi | Teknologi | Ponsel dan gadget terjangkau | ponsel terjangkau, penjualan volume besar, negara berkembang |
| Telkom Indonesia | Teknologi | Operator telekomunikasi dan internet | jaringan internet, pelanggan seluler, paket data, kabel dan menara |
| Nestlé | Pangan | Makanan bayi, cokelat, dan sereal global | makanan bayi, cokelat dan sereal, merek global |
| Kraft Heinz | Pangan | Saus dan makanan kalengan bermerek global | saus, makanan kalengan, rantai pasok bahan baku |
| Danone | Pangan | Susu, yoghurt, dan air minum kemasan | produk susu, air minum kemasan, gaya hidup sehat |
| Mayora | Pangan | Biskuit, permen, dan kopi sachet untuk pasar massal | biskuit dan permen, kopi sachet, warung dan toko, ekspor Asia |
| Indofood | Pangan | Mi instan dan bahan pangan pokok | mi instan, tepung dan minyak goreng, perkebunan sendiri |
| BCA | Keuangan | Bank swasta terbesar, kuat di transaksi digital | tabungan dan kartu bank, nasabah menengah-atas, transaksi nontunai domestik |
| Visa | Keuangan | Jaringan pembayaran global | pembayaran lintas negara, belanja daring, jaringan pembayaran global |
| Mandiri | Keuangan | Bank negara dengan kredit besar | bank BUMN, kredit korporasi, proyek pemerintah, infrastruktur |
| BRI | Keuangan | Bank dengan jaringan sampai desa | kredit UMKM, usaha kecil, jaringan desa, pembiayaan mikro |
| PayPal | Keuangan | Dompet digital dan pembayaran daring | dompet digital, pembayaran daring, transfer antar pengguna |
| Airbus | Transportasi | Pembuat pesawat penumpang | pesanan pesawat, pabrik pesawat, pengiriman pesawat |
| Toyota | Transportasi | Pembuat mobil dan kendaraan hibrida | penjualan mobil, kendaraan hibrida dan listrik, dealer resmi |
| Honda | Transportasi | Pembuat sepeda motor dan suku cadang | sepeda motor, suku cadang, bengkel resmi, pabrik otomotif |
| Grab | Transportasi | Aplikasi transportasi dan pengantaran | ojek dan taksi daring, pengantaran makanan, pengemudi |
| Garuda Indonesia | Transportasi | Maskapai penerbangan nasional | jumlah penumpang, tiket penerbangan, rute penerbangan, bahan bakar avtur |
| L'Oréal | Konsumen dan kesehatan | Kosmetik dan perawatan kulit | kosmetik, perawatan kulit, tren kecantikan |
| Pfizer | Konsumen dan kesehatan | Obat resep dan vaksin | obat resep dan vaksin, riset medis, izin edar |
| Unilever | Konsumen dan kesehatan | Barang rumah tangga dan perawatan pribadi | sabun dan sampo, deterjen, produk rumah tangga |
| Kalbe Farma | Konsumen dan kesehatan | Obat bebas dan minuman kesehatan | obat bebas, minuman kesehatan, distribusi apotek |
| Sido Muncul | Konsumen dan kesehatan | Jamu dan suplemen herbal | jamu dan herbal, suplemen, produk kesehatan harian |

Setiap sektor punya 5 aset, jadi berita boleh menyentuh satu sektor saja (4–5 aset) atau lintas sektor (sampai 7 aset). Campur keduanya agar peserta tidak menyimpulkan "berita X selalu soal sektor Y".

Pedoman mengatur stok:
- Aset mahal diberi stok sedikit sehingga menjadi rebutan. Stok 10 dengan 16 tim dan tanpa batas pegang berarti satu tim kaya bisa memborong seluruhnya; sisanya kehabisan.
- **Total uang yang beredar ditentukan oleh hadiah pos**, bukan modal awal. Perkirakan: jumlah tim × kunjungan rata-rata per tim × hadiah rata-rata. Contoh untuk 3 hari: 16 tim × 30 kunjungan × Rp 300.000 ≈ Rp 144 juta uang masuk. Kapasitas pasar (Σ stok × harga untuk 25 aset) sekitar Rp 182 juta, dan tanpa batas pegang satu tim secara teori bisa memborong seluruh stok. Angka kunjungan hanyalah contoh; hitung ulang dengan jumlah tim dan pos sebenarnya. Bandingkan dengan nilai yang bisa ditampung stok; bila uang beredar jauh lebih besar dari kapasitas, uang menganggur dan trading tidak lagi menjadi pembeda.
- Karena modal awal 0, **penghasilan tim sepenuhnya bergantung pada seberapa sering dan seberapa baik mereka bermain di pos.** Pos menjadi penentu utama; trading adalah pengganda terbatas (lihat 4.5).

## 6. Pos game dan hadiah

### 6.1 Ketentuan umum

- Setiap pos dijaga satu orang dengan satu akun penjaga.
- Setiap akun tim punya **QR sendiri** (tanpa kode cadangan di UI). Tim menunjukkannya ke penjaga setelah selesai bermain.
- Penjaga memindai QR di halaman pindai miliknya. Muncul nama tim dan form nominal. Setelah submit, **form langsung hilang** dan penjaga bisa memindai tim berikutnya.
- Hadiah **langsung masuk** ke saldo tim begitu penjaga menekan kirim. **Tidak ada persetujuan admin, tidak ada batas nominal, dan tidak ada batas kunjungan** (diputuskan 13 Nov, tanpa pengaman pengganti).
- Penjaga **hanya** bisa memberi hadiah atas nama pos miliknya sendiri.
- **Tim boleh mengunjungi pos yang sama berkali-kali.**
- **Penjaga membuka dan menutup posnya sendiri** lewat tombol Tersedia / Tidak tersedia (`is_open`); semua pos mulai tertutup. Pos tertutup tidak memberi hadiah baru. Tim melihat status ini di halaman **Daftar pos**. Admin masih bisa mengubahnya lewat panel (fungsi `admin_set_post_open`, masih spesifikasi).
- Penjaga melihat daftar hadiah yang ia berikan. Penjaga melihat **saldo tim yang kartunya sedang dipindai** (hanya saat form hadiah terbuka; keputusan 16 Nov), tetapi tidak pernah melihat daftar tim, saldo tim lain, atau peringkat.
- **Salah ketik tidak bisa dibatalkan oleh penjaga.** Penjaga melapor ke admin; admin mengoreksi lewat `admin_adjust_cash` (nilai negatif disertai alasan). Karena tidak ada pengaman, penjaga harus **memeriksa nominal sebelum menekan kirim** dan diberi briefing singkat sebelum acara.

### 6.2 Pengawasan penjaga (tanpa ACC)

Tidak ada persetujuan sebelum uang masuk, jadi pengawasan hanya bisa dilakukan sesudahnya:

- Setiap hadiah tercatat atas nama penjaga, pos, tim, dan waktu di tabel `payouts` dan `audit_log` (`payout_awarded`); panel admin menampilkan daftar hadiah terbaru dan total per pos.
- Admin yang melihat angka janggal (mis. hadiah jauh di atas pos lain, atau satu tim menerima banyak hadiah beruntun) memeriksa dengan penjaga bersangkutan dan mengoreksi dengan `admin_adjust_cash`.
- Hasil akhir sebaiknya diperiksa panitia sebelum diumumkan.

### 6.3 Template tabel konversi hasil game ke uang

Tiap pos menentukan sendiri cara menilai game. Sistem hanya mencatat nominal akhir. Contoh yang bisa disalin ke lembar penjaga:

| Hasil di pos | Hadiah |
|--------------|-------:|
| Menang / selesai sempurna | Rp 500.000 |
| Selesai dengan sebagian tugas | Rp 300.000 |
| Berpartisipasi tetapi gagal | Rp 100.000 |

### 6.4 Daftar pos

Diisi panitia. Kolom `penjaga` menjadi akun `guard`.

| # | Nama game | Lokasi | Penjaga | Pagar hadiah |
|---|-----------|--------|---------|--------------|
| 1 | *(isi)* | *(isi)* | *(isi)* | 100.000 – 500.000 |
| … | | | | |

## 7. Penilaian dan penentuan juara

1. Peringkat berdasarkan **net worth** pada saat status `finished`. Net worth = saldo bebas + saldo terkunci + Σ jumlah unit × **harga peringkat** (VWAP transaksi 10 menit terakhir; bila volume jendela kurang dari 5 lot, kekurangannya diisi harga peringkat sebelumnya). Beranda tim menampilkan tiga angka: **total**, **saldo saat ini**, dan **nilai seluruh aset menurut harga peringkat**. **Konsekuensi:** naik-turun harga langsung memengaruhi peringkat tanpa perlu menjual; order yang masih antre dibatalkan otomatis saat game ditutup sehingga tidak ada kunci yang menggantung. **Mitigasi kolusi (diputuskan 17 Nov):** peringkat memakai VWAP 10 menit, bukan harga terakhir, sehingga satu transaksi kecil tidak menggeser nilai aset; pelaku harus berdagang ≥ 5 lot terus-menerus. Risiko **tidak hilang**: dua tim yang rela membayar biaya 0,25 % dan terus berdagang masih bisa menggeser harga sampai batas ARA/ARB (lihat `12-order-book.md` §7).
2. **Seri:** tim dengan saldo tunai lebih besar menang. Jika masih seri, juri/panitia memutuskan; sistem membagi peringkat yang sama.
3. **Leaderboard tampil di ruang publik**, di layar yang login sebagai akun `display`. **Tim tidak melihat leaderboard di akun mereka**; mereka hanya melihat saldo dan portofolio sendiri. Konsekuensinya tim tidak tahu posisinya kecuali melihat layar publik.
4. **Pembekuan.** Sekitar 15 menit sebelum akhir, admin membekukan leaderboard. Layar publik menampilkan 5 tim teratas saat pembekuan (tanpa lencana atau penanda bahwa data dibekukan), sementara admin tetap melihat data langsung. Saat game ditutup (`finished`), leaderboard otomatis dibekukan.
5. **Penutupan game** dilakukan admin dengan menekan **Selesai**, setelah perubahan harga terakhir. Syaratnya: tidak ada berita yang masih tayang. Admin menunggu berita itu selesai; tidak ada jalan pintas.
6. **Hasil final** diekspor dari panel admin ke CSV, dan disimpan sebagai bukti.
7. **Keberatan.** Tim yang keberatan mengajukan ke panitia. Panitia memeriksa `trades`, `orders`, `payouts`, dan `audit_log`. Keputusan panitia final.

## 8. Fair play

- Satu akun dipakai satu tim. Berbagi akun atau **memfoto/membagikan QR tim ke orang lain** tidak menguntungkan siapa pun (kartu itu juga kunci masuk akun tim, lihat [06-security](06-security.md)); dilarang karena orang lain bisa berdagang atas nama tim.
- Penjaga tidak boleh memihak. Setiap hadiah tercatat atas nama penjaga dan dapat diperiksa, tetapi tidak ada persetujuan sebelum uang masuk.
- Mengutak-atik sistem (mencoba akses ke data tim lain, memanipulasi request) menyebabkan diskualifikasi.
- Semua tindakan panitia yang mengubah uang, harga, atau stok tercatat di `audit_log` dan dapat diperiksa.
