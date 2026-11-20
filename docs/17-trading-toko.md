# 17 — Trading model toko (menggantikan order book `docs/12`)

Status: **rancangan disetujui 20 Nov 2026, belum diterapkan.** Setelah diterapkan dokumen ini menggantikan [12](12-order-book.md), `05` §4, dan `07` bagian order. Dikerjakan di cabang `feat/trading-toko`.

Alasan: order book mirip bursa nyata, sehingga sulit dibaca admin dan pemain. Acuan: halaman Market IT Fest 2026, yaitu toko dengan satu harga per aset, sisa stok, dan tombol Beli (pengamatan 20 Nov: kartu aset, "N in stock" dengan titik merah saat menipis, pencarian, urut harga; tanpa grafik, order book, atau order limit). Pembeda yang dipilih: selisih jual, tekanan stok, batas pegang.

## 1. Keputusan

| Hal | Keputusan |
|-----|-----------|
| Model | **Toko**: tim membeli dari dan menjual ke pasar (stok panitia) pada satu harga. Tidak ada order antre, tidak ada transaksi antar tim |
| Harga | **Harga tayang** = harga acuan (digeser berita, mesin berita tidak berubah) × faktor tekanan stok |
| Beli | Harga tayang, instan, 1 sampai batas pegang unit |
| Jual | **Harga tayang − 2 %** (dibulatkan ke bawah), instan; stok kembali ke pasar |
| Tekanan stok | Tiap unit dibeli menaikkan faktor 0,2 %, tiap unit dijual menurunkannya 0,2 %; faktor kembali ke 1 dalam ±10 menit; harga tayang tidak keluar dari ±15 % harga acuan |
| Label stok | hijau > 50 % stok awal, kuning 20–50 %, merah **"Langka"** < 20 % |
| Batas pegang | maksimal **30 % stok awal** per aset per tim, minimal 1 unit (aset bersetok 10 → 3 unit) |
| Nilai aset (peringkat, net worth) | **harga tayang** saat ini (bukan VWAP) |
| Biaya | tidak ada biaya terpisah; selisih jual 2 % adalah satu-satunya biaya |
| Dihapus | order limit/market, order antre, kunci saldo/aset, fraksi harga, ARA/ARB, bandar pemasang order, biaya 0,25 %, VWAP, halaman Order Terbuka |
| Tetap | berita, event (bangkrut, suspensi, dividen), hadiah pos, penjaga, QR, leaderboard, display |

## 2. Antarmuka (yang dipertahankan dan yang diganti)

**Dipertahankan persis** (permintaan 20 Nov): daftar aset di kolom kiri halaman Pasar tim (`components/market/asset-list.tsx`):
kotak cari, filter sektor ("Semua sektor (28)"), keterangan "28 aset · 6 sektor", baris aset (lencana simbol, nama, harga, chip perubahan % terhadap harga open dengan ▲/▼, chip "Suspensi"), baris terpilih berlatar `bg-nav-active`. Perubahannya hanya sumber angka: harga di baris = **harga tayang**.

| Bagian | Sekarang | Nanti |
|--------|----------|-------|
| Detail aset (`asset-detail.tsx`) | harga terakhir, Open/High/Low/Acuan/Avg/ARA/ARB/Lot/Val/Freq | harga beli, harga jual, chip perubahan, Open, Acuan berita, **Stok** (sisa/awal + label), **Dimiliki** (jumlah, rata-rata beli, untung/rugi), **Batas pegang** |
| Order book, Order Terbuka | tabel antrean dan daftar order | **dihapus** |
| Form order (`order-form.tsx`, 480 baris) | limit/market, harga, lot, kunci | **Panel Beli/Jual**: tab, stepper jumlah, ringkasan (harga satuan, total, saldo sesudah), tombol konfirmasi; mati bila pasar tidak `open`, aset suspensi/bangkrut, stok habis, atau batas terlampaui, dengan alasan tertulis |
| Halaman Orders (`/team/orders`) dan lencana sidebar | ada | **dihapus** |
| Portofolio | daftar + tautan Jual | tetap, ditambah harga jual dan untung/rugi bersih; tombol Jual membuka panel tab Jual |
| History | dropdown detail | tetap; baris jadi Beli/Jual/Dividen/Hadiah dengan harga satuan dan jumlah |
| Layout | 3 kolom (xl): daftar, detail+book, form+order | 3 kolom: daftar, detail, panel Beli/Jual; ponsel: daftar, detail, panel menumpuk seperti sekarang |
| Admin | Order | **Transaksi** (daftar dan ringkasan per aset) |
| Display `/display/market` | "Transaksi terakhir" dari `trades` | dari transaksi baru (aset, jumlah, harga) |

## 3. Aturan terperinci

1. **Harga tayang** `P = round_to_step(ref × (10000 + f) / 10000)`, `f` = faktor tekanan (bps, −1500…+1500), `ref` = harga acuan setelah berita. Pembulatan ke `price_step` (Rp 100).
2. **Beli** `n` unit: biaya `n × P` (dikunci per transaksi, satu harga untuk seluruh `n`; tekanan baru berlaku setelah transaksi). Syarat: pasar `open`, aset aktif dan tidak suspensi, `n ≤ stok`, `holding + n ≤ batas pegang`, saldo ≥ biaya. Efek: saldo turun, holding naik (`cost_basis` bertambah), stok turun, `f += n × 20` (maks. +1500).
3. **Jual** `n` unit: terima `n × P_jual`, `P_jual = floor(P × 0,98 / step) × step`. Syarat: pasar `open`, `n ≤ holding`. Efek: saldo naik, holding turun (`cost_basis` berkurang proporsional), stok naik, `f -= n × 20` (min. −1500).
4. **Pemulihan tekanan**: siklus `market-cycle` (10 dtk) menarik `f` menuju 0 secara linear agar penuh pulih dalam 10 menit.
5. **Suspensi**: beli dan jual ditolak selama suspensi. **Bangkrut**: likuidasi seperti sekarang (pemegang menerima persentase harga terakhir; stok tidak kembali).
6. **Dividen**: tetap, dibayar ke pemegang pada saat event (nilai memakai harga tayang).
7. **Idempoten**: setiap transaksi membawa `request_id`; pengiriman ulang mengembalikan hasil yang sama.
8. **Pasar ditutup** (`paused`, `finished`, `setup`): transaksi ditolak. Tidak ada lagi pembatalan massal karena tidak ada order antre.
9. **Invarian**: untuk tiap aset, `stok + Σ holding tim = stok awal` (kecuali yang dilikuidasi saat bangkrut). Diperiksa tes dan skrip verifikasi.
10. **Keamanan**: semua lewat RPC `security definer` (`buy_asset`, `sell_asset`); klien tidak menulis tabel langsung; penjaga dan penguncian game tetap berlaku (`classmeet.system`).

## 4. Parameter (kolom `game_settings`, bisa diubah admin sebelum game dibuka)

| Kolom baru | Bawaan | Arti |
|------------|--------|------|
| `sell_spread_bps` | 200 | selisih jual |
| `pressure_bps_per_unit` | 20 | tekanan per unit |
| `pressure_cap_bps` | 1500 | batas faktor tekanan |
| `pressure_decay_minutes` | 10 | lama pemulihan penuh |
| `hold_cap_pct` | 30 | batas pegang (% stok awal) |
| `stock_mid_pct`, `stock_low_pct` | 50, 20 | batas label stok |

Kolom lama dibuang atau tidak dipakai: `fee_bps`, `sell_fee_bps`, `band_bps`, `house_*`, `rank_min_lots`, `rank_window_minutes`.

## 5. Dampak ke database

| Objek | Tindakan |
|-------|----------|
| `orders` (±183 ribu baris, hampir semua order bandar), `trades` (79) | dibuang setelah dicadangkan; diganti `transactions(id, team_id, asset_id, side, qty, unit_price, total, request_id, created_at)` |
| `place_order`, `cancel_order`, `ob_*`, `get_order_book`, `get_market_summary`, `process_market_cycle` (pengisi bandar) | dibuang/diganti; `process_market_cycle` hanya memulihkan tekanan dan memperbarui harga |
| `holdings.locked_qty`, `teams.locked_cash`, `v_team_net_worth`, `get_leaderboard`, `get_my_summary` | kunci dihapus; nilai aset = harga tayang |
| `assets.stock` | tetap sebagai sisa stok pasar; tambah `price_factor_bps` |
| `market_state()` (mesin berita) | `trades_10m` dihitung dari `transactions` (jumlah transaksi 10 menit); sisanya tidak berubah |
| `award_payout`, hadiah pos, berita, event, cron berita dan IKC | tidak berubah |
| `index_history` (IKC) | tetap; IKC memakai harga tayang |

Migrasi database laptop: cadangan `pg_dump` sebelum SQL dijalankan; saldo dan kepemilikan tim dipertahankan; kunci (`locked_cash`, `locked_qty`) dikembalikan ke saldo/kepemilikan sebelum kolomnya dibuang; stok pasar tidak diubah.

## 6. Urutan pengerjaan (cabang `feat/trading-toko`, satu commit per tahap)

1. Spesifikasi ini (selesai, menunggu tinjauan).
2. SQL: `buy_asset`, `sell_asset`, tekanan stok, batas pegang, migrasi data, pembuangan order book; tes SQL (beli, jual, batas, tekanan, invarian, idempoten, suspensi, bangkrut).
3. Penyesuaian mesin berita (`market_state`), peringkat, IKC; simulasi 3 hari.
4. UI tim: Market (daftar dipertahankan + detail + panel Beli/Jual), Portofolio, History; hapus Orders.
5. Display dan admin (Transaksi).
6. Dokumen (`04`, `05`, `07`, `PANDUAN-TRADING.md`), tes vitest dan Playwright, ringkasan hasil.

## 7. Yang perlu diperhatikan

- Tim tidak lagi bisa berdagang satu sama lain. Interaksi tim ke tim hilang; bila dirindukan, "pasar tim" bisa menyusul sebagai fitur terpisah.
- Keunggulan pembaca berita tetap ada: beli saat jeda 3–15 menit antara terbit dan efek. Selisih jual 2 %, tekanan stok, dan batas pegang membatasinya.
- Pembeda tambahan yang belum dipilih dan bisa menyusul tanpa mengubah dasar ini: Flash Drop (stok kilat berdiskon), bonus diversifikasi sektor, kartu "Analis" dari pos.
