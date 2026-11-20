# 12 — Mekanisme Trading Order Book (menggantikan harga tetap server)

> **Akan digantikan oleh [17](17-trading-toko.md)** (rancangan 20 Nov 2026, model toko tanpa order book; belum diterapkan). Dokumen ini tetap berlaku sampai penggantinya diterapkan.

Status: **diputuskan dan diimplementasikan 17 Nov 2026** (SQL di `03-database.md` dan `04-rpc-contracts.md` §3.1, tes di `tests/run_ob.py`, `run_ob2.py`, `run3.py`; hasil di `10-verification-report.md`). Dokumen ini menjadi acuan aturan; `05-game-rules.md` §3 hanya ringkasannya. UI masih berupa desain Figma, belum ada kode Next.js.

## 1. Keputusan

| Hal | Keputusan |
|-----|-----------|
| Model harga | **Hybrid:** berita menggeser harga acuan, **bandar panitia** selalu memasang bid/offer, tim juga saling mencocokkan order. Harga tampil = **harga transaksi terakhir** |
| Biaya | **0,25 % per sisi** (beli dan jual), dibulatkan ke atas, dibayar ke panitia. Menggantikan biaya jual 5 % |
| Peringkat | **Harga pasar terakhir** (menggantikan harga beli / *cost basis*) |
| Masa order | Sampai dibatalkan atau pasar ditutup admin. Saldo/aset terkunci selama order antre |

## 2. Hasil riset bursa nyata (IDX) dan bentuk di game

| Bursa nyata | Di Classmeet Market |
|-------------|---------------------|
| Order book: bid (beli) dan offer (jual), tiap level punya lot dan jumlah antrean (*Freq*) | Sama. 5 level tiap sisi di panel; Freq = jumlah order di level itu |
| *Price-time priority* | Sama: harga terbaik dulu, lalu yang masuk lebih awal |
| Partial fill, sisa tetap antre | Sama |
| Limit order dan market order | Limit: harga + lot, antre. Market: sapu level terbaik, maksimal **5 level**; sisa dibatalkan (setara FAK) |
| 1 lot = 100 lembar | **1 lot = 1 unit aset** (harga satu unit sudah Rp 110.000–800.000) |
| Fraksi harga menurut rentang harga | Fraksi menurut rentang (§3) |
| ARA/ARB | ±15 % dari harga acuan awal hari (§6) |
| Pra-pembukaan (*call auction*) dan periode non-cancel | **Tidak dipakai.** Admin membuka pasar dengan tombol; bandar memasang kuotasi saat dibuka |
| Market maker menjaga likuiditas | **Bandar panitia** (§4) |
| Biaya total < 0,5 % | 0,25 % per sisi |
| Short selling dilarang di game ini | Tetap tidak ada jual kosong, pinjaman, atau margin |

## 3. Parameter (semua tentatif, di `game_settings`)

| Parameter | Nilai awal |
|-----------|------------|
| Satuan order | 1 lot = 1 unit, minimal 1 lot |
| Fraksi harga | harga < Rp 200.000 → Rp 500; Rp 200.000 s.d. < 500.000 → Rp 1.000; ≥ Rp 500.000 → Rp 2.500 |
| Biaya transaksi | 25 bps per sisi, dibulatkan ke atas per fill |
| Level kuotasi bandar | 5 bid + 5 offer, berjarak 1 fraksi |
| Spread bandar | best bid = acuan − 1 fraksi, best offer = acuan + 1 fraksi |
| Lot per level bandar | `ceil(stok awal / 10)`, minimal 1 |
| Isi ulang kuotasi bandar | Tiap 5 menit dan setelah berita berlaku, dipusatkan ke harga acuan |
| Sapuan maksimum market order | 5 level dari harga terbaik |
| ARA/ARB | ±15 % dari harga acuan awal hari |
| Pembulatan harga acuan | ke fraksi terdekat |
| Harga peringkat (net worth) | VWAP transaksi `rank_window_minutes` = 10 menit; bila volume jendela < `rank_min_lots` = 5, kekurangannya diisi harga peringkat sebelumnya (atau acuan) |

## 4. Bandar panitia

- Satu akun sistem (`house`) memegang **seluruh stok awal** tiap aset, bukan tim. Total unit tiap aset tetap konstan: `bandar + Σ holdings tim = stok awal`.
- Offer bandar dibatasi **sisa inventarisnya**. Bid bandar dibatasi lot per level; bandar tidak pernah kehabisan uang (uang panitia tidak dihitung).
- **Harga acuan** hanya berubah oleh efek berita (waktu acak 3–15 menit diundi sistem, urutan dipilih sistem, ±15 %, seperti `05` §4 yang sudah diperbarui). Tekanan beli/jual tim menggeser harga transaksi terakhir, tetapi baru menggeser acuan tidak; bandar memusatkan kuotasi ke acuan lagi tiap isi ulang.
- Level yang habis dimakan **tidak diisi ulang** sampai siklus berikutnya. Itulah yang membuat tekanan beli terasa: harga naik beberapa fraksi, lalu ditarik kembali ke acuan.
- **Penguncian berlaku untuk order book.** Panitia tidak punya jalur untuk mengubah harga acuan, kuotasi bandar, atau parameter bandar setelah game dibuka. Pemasangan dan isi ulang kuotasi bandar, serta pencocokan order (yang memperbarui harga transaksi terakhir), hanya dilakukan fungsi sistem (`security definer`, GUC `classmeet.system`) dan dijalankan penjadwal, bukan tombol admin. Isi ulang tiap 5 menit dan setelah berita berlaku adalah jadwal tetap sistem. Pemicu `guard_game_lock()` perlu diperluas ke tabel order book, akun bandar, dan parameternya saat dirancang.
- Bandar tidak pernah menyerang order tim; order bandar ditandai `is_house` dan tidak terlihat sebagai tim di UI (tampil sebagai antrean biasa).

## 5. Order

| Hal | Aturan |
|-----|--------|
| Jenis | `limit` (harga + lot) dan `market` (lot saja) |
| Sisi | `buy` dan `sell` |
| Pasar harus `open` | Order dan pembatalan ditolak saat `setup`, `paused`, `finished` |
| Validasi | harga kelipatan fraksi; di antara ARB dan ARA; lot ≥ 1; aset aktif |
| Kunci saat order antre | Beli: `harga × lot × (1 + biaya)` dikunci dari saldo. Jual: `lot` dikunci dari kepemilikan |
| Pencocokan | Atomik di server (satu fungsi Postgres). Harga transaksi = **harga order yang sudah antre** (maker). Selisih kunci beli dikembalikan |
| Order sendiri | Tidak boleh dicocokkan dengan order tim yang sama (*self-trade prevention*): level itu dilewati |
| Pembatalan | Bebas kapan saja selama pasar `open`; sisa kunci dikembalikan |
| Pasar ditutup | Semua order terbuka dibatalkan otomatis dan kunci dikembalikan |
| Status order | `open`, `partial`, `filled`, `cancelled` |
| Idempotensi | Tiap order membawa `request_id`; pengiriman ulang tidak membuat order ganda |
| Tim bersaldo Rp 0 | Tidak bisa memasang order beli |

## 6. ARA/ARB dan harga acuan harian

- Awal tiap hari permainan (hari 1–3), harga acuan hari itu = harga acuan saat pasar dibuka.
- ARA = acuan × 1,15, ARB = acuan × 0,85, dibulatkan ke fraksi. Order di luar batas ditolak (`price_out_of_range`).
- Batas 15 % sengaja sama dengan efek berita maksimum; tim tidak bisa mendorong harga lebih jauh dari satu berita besar dalam sehari.

## 7. Nilai aset dan peringkat

```
net worth = saldo + saldo terkunci + Σ (qty + qty terkunci) × harga peringkat (rank_price)
```

- **Diputuskan 17 Nov: peringkat memakai VWAP 10 menit** (`assets.rank_price`), bukan harga terakhir. Rumus: `(Σ harga × lot dalam jendela + harga peringkat sebelumnya × max(5 − volume jendela, 0)) / max(volume jendela, 5)`; tanpa transaksi sebelumnya, pengisinya harga acuan. Contoh: satu lot @702.500 saat acuan 700.000 hanya menggeser peringkat ke 700.500 (seperlima dari selisih); lima lot dalam 10 menit baru mengikuti harga transaksi sepenuhnya. Harga terakhir tetap tampil di UI dan indeks.
- **Risiko yang tersisa:** mitigasi ini menaikkan biaya kolusi, tidak menghilangkannya. Dua tim yang berdagang ≥ 5 lot dalam 10 menit tetap menggeser peringkat, dibatasi ARA/ARB ±15 % dan biaya 0,25 % per sisi. Pelengkap: pembekuan leaderboard 15 menit sebelum akhir dan audit `trades`. Mengecualikan transaksi antar-tim kecil tidak dipilih.
- Biaya transaksi dibayar ke panitia, jadi uang tim tidak bertambah dari biaya.

## 8. Contoh

Asumsi: BCA, harga acuan Rp 700.000, fraksi Rp 2.500, lot per level bandar 1.

```
OFFER (jual)                 BID (beli)
 712.500  x1
 710.000  x1
 707.500  x1
 705.000  x1
 702.500  x1   <- best offer
                    697.500  x1   <- best bid
                    695.000  x1
                    692.500  x1
                    690.000  x1
                    687.500  x1
```

1. Tim A pasang **beli limit 2 lot @ 702.500**. Offer terendah 702.500 (1 lot) cocok: 1 lot terisi di 702.500, 1 lot sisanya antre sebagai bid 702.500 (`partial`). Dikunci Rp 702.500 × 1 × 1,0025.
2. Tim B pasang **jual limit 1 lot @ 702.500**. Bid antre milik A di 702.500 cocok: terisi di 702.500. Harga transaksi terakhir = 702.500, order A `filled`.
3. Tim C **market beli 6 lot**: menyapu offer 705.000, 707.500, 710.000, 712.500 (masing-masing 1 lot, offer 702.500 sudah habis di langkah 1). Sisa 2 lot tidak mendapat offer dalam 5 level, jadi dibatalkan. Harga terakhir naik ke 712.500 dan ini yang tampil di Beranda.
4. Berita BCA +10 % berlaku: acuan jadi Rp 770.000. Semua kuotasi bandar lama dibatalkan dan 5 bid + 5 offer baru dipasang di sekitar Rp 770.000. Order limit tim tetap antre di harganya.

## 9. Halaman baru dan perubahan UI

Diputuskan 17 Nov: **Pasar tim berubah menjadi halaman order book itu sendiri**, bukan halaman tambahan. Dialog Beli dihapus (frame Figma lama diberi awalan ARSIP).

| Halaman | Isi | Figma |
|---------|-----|-------|
| **Pasar (tim)** `/team/market` diubah | Tiga kolom: daftar aset; detail aset + order book 5 level; form order (Beli/Jual, Limit/Market, Trading Balance, Harga −/+, Lot −/+, Place Order) + ringkasan order terbuka | `Tim — Pasar (order book)` |
| **Order (tim)** `/team/orders` baru | Order antre dengan Batalkan, saldo dan aset terkunci, riwayat order hari ini. Item menu sidebar *Order* dengan lencana jumlah antre di semua layar tim | `Tim — Order terbuka` |
| **Display pasar publik** baru (akun `display`) | Indeks gabungan IKC dengan grafik garis dan rentang waktu, lima indeks sektor, lima terbaik dan terlemah hari ini, berita terbaru, transaksi terakhir. Terang, tanpa latar hitam | `Layar publik — Display pasar` |
| ~~Order Book publik~~ | **Dibatalkan 17 Nov**: order book hanya untuk tim | — |

Indeks gabungan (**IKC**): rata-rata harga terakhir 25 aset terhadap harga awal, basis 1.000 (aset berbobot sama; **diputuskan 17 Nov**). Indeks sektor dihitung sama untuk 5 aset tiap sektor.

## 10. Simpangan implementasi dari rancangan awal

Hal yang berbeda dari tabel di §1–§9 setelah dibangun dan diuji:

| Hal | Rancangan awal | Yang dibangun | Alasan |
|-----|----------------|---------------|--------|
| Batas ARA/ARB | ±15 % dari acuan **awal hari** | ±`band_bps` (15 %) dari **harga acuan saat ini** | Skema tidak punya konsep hari. Batas ikut bergeser dengan berita; tim tetap tak bisa mendorong harga lebih dari 15 % dari acuan |
| Harga tampil sesudah berita | Tidak diatur | `last_price` dan `rank_price` disetel ulang ke acuan baru saat berita berlaku | Tanpa ini, net worth tertinggal sampai ada transaksi |
| Serialisasi | Tidak diatur | Satu kunci penasihat `ob_lock()` untuk semua fungsi order book | Pencocokan menyentuh baris tim lawan; dua pencocokan pada aset berbeda bisa saling menunggu (kebuntuan). Lihat `04` §3.1 |
| Uang bandar | "Uang panitia tidak dihitung" | `game_settings.house_cash` membukukan selisihnya | Supaya konservasi uang bisa diperiksa: Σ(saldo + terkunci) + `house_cash` = Σ modal masuk |
| Kunci order beli | `harga × lot × (1 + biaya)` | `lot × (harga + ceil(harga × biaya))` | Biaya dibulatkan ke atas per pencocokan; jumlah ini tidak pernah kurang |
| Order market beli | Mengunci seperti limit | Tidak mengunci; memakai saldo bebas per pencocokan, berhenti saat tak mampu | Harga akhir tak diketahui di awal |
| Isi ulang bandar | Tiap 5 menit dan setelah berita | Sama, lewat `process_market_cycle()` (penjadwal 10 detik) dan `process_news_cycle()` | |
| Kuotasi bandar yang menyilang order tim | Tidak diatur | Dicocokkan seperti order biasa (harga maker = harga order tim) | Mencegah order book silang |
| Aset berharga kecil | Tidak diatur | Bila 15 % dari harga kurang dari 5 fraksi, level bandar dipotong; aset berharga Rp 1.000 (data uji) tidak mendapat kuotasi sama sekali | Hanya mengenai data uji; harga nyata Rp 110.000–800.000 memuat ≥ 33 fraksi |

Berkas yang sudah diubah: `03-database.md` (tabel `orders`, `trades`, kolom kunci, parameter, view net worth, RLS, penguncian), `04-rpc-contracts.md` (§3.1, `process_news_cycle`, `admin_set_game_state`, `get_my_summary`, error code, jadwal), `05`, `06`, `07`, `08`, `09`, `10`, `11`, `01`, `02`, `tests/`. Figma: Pasar, Order terbuka, Display pasar sudah digambar; juga sudah: Pasar dijeda, error isian, Jual+Market (Desain Web › Rally Game, frame "Tim — Pasar (...)"). Belum: Pasar ditutup permanen.

## 11. Hal yang masih terbuka

1. ~~Siapa yang melihat halaman Order Book~~ **Diputuskan 17 Nov: hanya tim.** Layar publik tidak menampilkan order book; Display pasar hanya indeks, terbaik/terlemah, berita, dan transaksi terakhir.
2. ~~Bobot IKC~~ **Diputuskan 17 Nov: bobot sama rata.**
3. Mitigasi manipulasi harga terakhir (VWAP atau minimum lot).
4. Berapa lot per level bandar untuk aset berstok 50 (rumus `ceil(stok / 10)` memberi 5).
