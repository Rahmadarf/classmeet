# 15. Mesin berita v2: 10–15 aset, event berbasis peluang, pemilihan menurut kondisi pasar

Dokumen ini **menggantikan** aturan lama di [05](05-game-rules.md) (§ pemilihan berita, 4–7 aset) dan [04](04-rpc-contracts.md) §3.4
(`process_news_cycle` memilih acak murni). Bagian lain tidak berubah: satu berita tayang pada satu waktu, harga hanya berubah
lewat efek berita yang diterapkan sistem, jeda 3–15 menit antara terbit dan efek, admin tidak melihat isi/urutan berita
sesudah game dibuka.

Kode: `scripts/sql/news-engine-v2.sql` (SQL, dijalankan kamu), `scripts/news-pool-lib.ts` + `scripts/data/news-themes.ts`
(pembuat kumpulan), `scripts/sim-news-engine.sh` (simulasi).

## 1. Aturan

| # | Aturan | Di mana |
|---|--------|---------|
| 1 | Setiap berita mengubah harga **10–15 aset** (sebelumnya 4–7), maksimal ±15 % per aset (`max_effect_bps`) | `game_settings.min_news_assets/max_news_assets`, `check_news_effects` |
| 2 | Event **bangkrut, suspensi, dividen** muncul menurut **peluang** yang dihitung dari kondisi pasar, bukan dilekatkan acak pada berita | `market_state()`, `event_chances()`, `pick_next_news()` |
| 3 | Tiap aset punya **≥ 1 berita per jenis event** di kumpulan (contoh panitia: 1 bangkrut, 2 suspensi, 5 dividen per aset). Tidak semua berita membawa event; berita **harga saja** tetap mayoritas | `news_pool()`, `news_pool_coverage()` |
| 4 | **Tidak ada event di masa tenang** (30 menit sejak pasar dibuka; pembukaan pertama, atau dibuka lagi setelah dijeda > 60 menit) dan tidak ada event bila ada event lain dalam 15 menit terakhir; satu aset tidak kena event lagi dalam 60 menit; bangkrut maks. 4 per game dan 2 per hari WIB | `game_settings.event_*`, `market_event_log` |
| 5 | Berita **tidak ditentukan sebelumnya**. Tidak ada antrean atau kolom "berita berikutnya": `pick_next_news()` dipanggil hanya saat berita diterbitkan dan membandingkan kondisi pasar **sekarang** dengan berita yang **belum terpakai** | `process_news_cycle` → `pick_next_news` |
| 6 | Satu berita membawa **paling banyak satu event**; aset bangkrut tidak punya efek harga di berita itu | `check_news_effects` |

## 2. Alur pemilihan (saat berita diterbitkan)

1. **Apakah giliran ini membawa event?** Hanya bila masa tenang lewat dan tidak ada event dalam jeda global.
   Sistem menghitung `p` tiap pasangan (aset, jenis) yang masih punya berita event layak di kumpulan. Jumlah semua `p`
   (dibatasi 40 %) adalah peluang giliran ini membawa event; bila jatuh, satu pasangan dipilih sebanding dengan `p`-nya,
   lalu satu berita event untuk aset + jenis itu diundi dari yang belum terpakai.
2. **Berita harga**: tiap berita harga yang belum terpakai diberi skor kecocokan terhadap kondisi sekarang, lalu dipilih
   **acak berbobot** (softmax, suhu `pick_temperature_milli`, bawaan 50); yang tertinggi tidak otomatis menang.
3. **Cadangan**: bila tidak ada berita harga layak, berita lain yang layak dipilih (berita event hanya sesudah masa
   tenang); bila tidak ada sama sekali, siklus idle. Bila pemilihan gagal, galat dicatat (`news_pick_failed`) dan pasar tidak macet.
4. Berita yang menyebut aset yang sudah bangkrut dipangkas efek aset itu saat terbit, selama sisanya masih ≥ 10 aset.

### Kondisi pasar (`market_state`)
Per aset aktif: `cum` (perubahan harga acuan sejak harga dasar), `up_streak` (berapa berita terakhir berturut-turut yang
menaikkan harganya), `vol` (simpangan baku perubahan 6 berita terakhir), `trades_10m`, waktu event terakhir.

### Peluang event per giliran penerbitan (`event_chances`; angka awal, disetel lewat simulasi)
- **Bangkrut** (kecil; naik bila aset sudah naik jauh atau terus naik): 0,03 % dasar; hingga +0,8 % menurut seberapa jauh
  harga di atas +15 % dari harga dasar (penuh di +60 %); +0,04 % per berita naik berturut-turut di atas 2 (maks. +0,16 %).
- **Suspensi** (naik bila bergejolak atau jatuh): 0,15 % dasar; +0,4 % bila `vol` > 4 %; +0,2 % bila ≥ 5 transaksi per 10
  menit; +0,3 % bila harga turun > 15 %.
- **Dividen** (naik bila stabil / naik sedang): 0,15 % dasar; +0,2 % bila `vol` < 4 %; +0,15 % bila naik 0–40 %; +0,1 % bila
  > 60 menit sejak dividen terakhir; setengahnya bila sudah naik > 80 %.
- `game_settings.event_intensity_pct` (100) mengalikan semuanya.

### Skor kecocokan berita harga
Untuk tiap aset dalam berita: bernilai tinggi bila arah efek **berlawanan** dengan simpangan harga aset itu dari harga dasar
(aset yang sudah naik jauh cocok dengan berita negatif, dan sebaliknya), dikurangi bila aset itu baru kena 3 berita
terakhir, dan dikurangi bila harga akan menabrak batas. Dirata-ratakan per berita.

## 3. Kumpulan berita
- Dibuat `npm run generate-news` dari tema di `scripts/data/news-themes.ts`: **252 berita harga** (63 tema × 2 arah × 2
  varian) dan **240 berita event** (30 aset × [1 bangkrut + 2 suspensi + 5 dividen]); hasilnya `scripts/data/news-pool.json`
  dan `docs/14-kumpulan-berita.md` untuk ditinjau. Teks fiksi; nama perusahaan memakai nama aset.
- Dimasukkan dengan `npm run seed` (berita `ready`, event lewat `admin_set_news_bankruptcy` / `admin_set_news_event`).
- Kebutuhan: ±220 berita terbit per game (3 hari × 11 jam, rata-rata 9 menit per berita). Berita harga terpakai ±185, jadi
  kumpulan 252 memberi cadangan ±27 %. Bila kumpulan harga habis, mesin memakai berita event sebagai cadangan.
- Admin (sebelum game dibuka): papan Berita menampilkan **cakupan event per aset** (30 × 3) dan jumlah per jenis.
  Sesudah dibuka: hanya jumlah per jenis (`get_news_pool_kinds`); `news_pool_coverage` ditolak (`game_started_locked`) supaya
  admin tidak tahu aset mana yang masih punya berita event.

## 4. Simulasi dan hasil
`scripts/sim-news-engine.sh [hari] [suhu] [benih] [intensitas]` menjalankan 3 hari permainan (jam simulasi via
`classmeet.now`) di dalam transaksi yang di-ROLLBACK, memakai kumpulan berita yang sama. Jangan dijalankan saat acara
berlangsung (menahan kunci `game_settings` beberapa menit).

Hasil 3 hari permainan (kumpulan 492 berita, suhu 50, 3 benih berbeda):

| Ukuran | Hasil | Target |
|--------|-------|--------|
| Berita terbit per game | 218–225 | ±220 |
| Berita event / semua | 36–39 (±17 %) | "terkadang" |
| Bangkrut per game | 2, 1, 2 (rata-rata 1,7) | kecil, maks. 4 |
| Suspensi per game | 10, 15, 9 | |
| Dividen per game | 27, 20, 26 | |
| Event paling awal sesudah pasar dibuka | 33–72 menit | ≥ 30 menit |
| Berita harga terpakai / tersedia | 179–188 / 252 (sisa 64–73) | tidak habis |
| Perubahan harga akhir (simpangan baku) | 0,13–0,16 | |
| Aset di batas harga 30 % / 300 % pada akhir | 0 | sedikit |
| Pergerakan harga terjauh sepanjang game | −35 % sampai +58 % | |

Pemilihan menurut kondisi pasar menahan ekstrem: pada benih yang sama, suhu 5000 (hampir acak murni) menghasilkan
kenaikan sampai +122 % dan simpangan baku akhir 0,15–0,18, sedangkan suhu 50–80 menghasilkan maksimum +35–58 % dan
simpangan baku 0,13–0,16. Efeknya sedang, bukan keras, karena memang acak berbobot. Bangkrut terjadi pada aset yang
kenaikannya beragam (−9 % sampai +37 %), terbanyak pada kondisi naik, sesuai rumus peluang.


## 5. Batasan dan hal yang perlu diputuskan
- Besaran peluang adalah angka awal; setel dengan simulasi sebelum acara.
- Berita yang sudah terbit tidak bisa "dibatalkan" bila kondisi berubah selama jeda 3–15 menit; peluang dan pilihan dihitung
  saat terbit.
- Menaikkan efek per berita dari 4–7 ke 10–15 membuat harga lebih sering bergerak; `max_effect_bps` bisa diturunkan (misal 800).
- Teks berita event memakai nama perusahaan sungguhan dari daftar aset; semua peristiwanya rekaan.

## 6. Langkah penerapan
1. **SQL** (sekali per database, sesudah `event-bankruptcy.sql` dan `event-dividend-suspend.sql`): jalankan `scripts/sql/news-engine-v2.sql`.
   - Docker: `docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < scripts/sql/news-engine-v2.sql`, lalu `notify pgrst, 'reload schema'` bila API belum melihat fungsi baru.
   - Cloud: tempel di SQL Editor. Aman dijalankan ulang.
2. **Kumpulan berita** (HANYA sebelum game dibuka): `npm run generate-news` (tinjau `docs/14-kumpulan-berita.md`), lalu `npm run seed`.
3. Buka papan **Admin → Berita**: periksa kartu "Cakupan event per aset" (semua aset harus punya bangkrut, suspensi, dan dividen).
4. Restart `npm run dev:https` bila halaman admin belum menampilkan kartu jenis berita (modul server lama masih terpasang).
5. Game yang **sudah berjalan** memakai mesin baru langsung (skrip mengisi `market_opened_at` = saat skrip dijalankan), tetapi kumpulan berita harus sudah berisi
   berita `ready`; berita baru tidak bisa dimasukkan sesudah game dibuka.

