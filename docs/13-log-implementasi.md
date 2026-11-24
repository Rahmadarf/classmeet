# 13 — Log implementasi

Catatan deviasi, pertentangan dokumen, dan keputusan teknis selama membangun aplikasi. Urutan: terbaru di bawah. Kolom **Perlu ubah dokumen?** menandai apakah Figma/dokumen harus disesuaikan.

## Tahap 0 — fondasi (17 Nov 2026)

### Pertentangan dokumen dan pesan implementasi (pesan implementasi menang)

| # | Apa | Dokumen | Yang dipakai | Perlu ubah dokumen? |
|---|-----|---------|--------------|---------------------|
| 1 | Skala radius | DESIGN.md §5: kartu 24, ubin/tombol 16 | Pesan implementasi: panel dan kartu 10, tombol/ubin/input 8, baris daftar 14, tab 12 (kontainer 16), chip dan pil bulat penuh. Token: `--radius-panel/control/row/tab/tabs` | Ya: DESIGN.md §5 dan §6 menyebut 24/16 |
| 2 | Font | DESIGN.md §4: Sora + Plus Jakarta Sans | Pesan implementasi: tumpukan SF Pro (`-apple-system`, `SF Pro Text/Display`) dengan **Inter** (next/font) sebagai cadangan. SF Pro tidak dimuat sebagai berkas web (lisensi Apple). Di Windows tampilan nyata = Inter | Ya: DESIGN.md §4 dan §8 |
| 3 | `middleware.ts` | doc 02 §6 dan 06 §1 menyebut `middleware.ts` | Next.js 16 mengganti konvensi itu menjadi **`proxy.ts`** (fungsi `proxy`). Fungsi sama: menyegarkan sesi + pengalihan per peran | Ya (doc 02, 06, 07 §1) |
| 4 | Realtime | doc 02 §5 dan 07 §5: `postgres_changes` untuk `assets` | Pesan implementasi: polling 5 detik untuk order book dan harga; **tidak** memakai `postgres_changes` pada `orders`/`trades`. `news_feed`, `payouts`, `game_settings` boleh memakai `postgres_changes` bila terbukti aman RLS | Ya (doc 02 §5, doc 07 §5) |
| 5 | Jumlah aset | doc 05 §5: 25 aset (5 × 5) | **30 aset (6 sektor × 5)** atas permintaan: sektor **Energi** (Chevron CV, Shell SL, Pertamina PE, PLN PN, Adaro AD) ditambahkan. Harga dan profil sektor Energi adalah usulan saya (rekaan), perlu persetujuan panitia | Ya (doc 05 §5, 5.1; doc 01 yang menyebut 25) |
| 6 | Penjaga/pos pada seed | Pesan implementasi: "1 penjaga, beberapa pos" | Skema: `posts.guard_id unique` → **satu penjaga = satu pos**. Seed membuat **6 penjaga + 6 pos** supaya halaman Daftar Pos dan Admin Pos berisi data nyata | Tidak (skema sudah benar; pesan implementasi yang disesuaikan) |
| 7 | Batas harga aset | doc 05 §3: 30 % / 300 %; doc 07 §2.3: "30%–160%" | Seed memakai **30 % / 300 %** (doc 05) | Ya: doc 07 §2.3 |
| 8 | `docs/scripts/` | Pesan implementasi: berisi `import-news.ts`, `news-lib.ts`, `assets.example.json`, `news.example.json` | **Folder tidak ada** di repo. Data contoh dibuat ulang di `scripts/data/` (30 aset, 12 berita); `import-news.ts` dan `news-lib.ts` **belum ada** (seed memanggil RPC `admin_save_news` langsung) | Tidak, tetapi berkas aslinya perlu disediakan bila ada |
| 9 | `create-next-app` | Pesan implementasi Tahap 0 butir 1 | **Dilewati**: proyek Next.js sudah ada (Next 16.4.6, React 19.3, Tailwind 4.3.3 lewat `@tailwindcss/turbopack`). Konfigurasi `next.config.ts` (cacheComponents, partialPrefetching) dipertahankan | Tidak |
| 10 | Pustaka Radix/vitest | Daftar paket | `@types/node` dinaikkan dari `^20` ke `^24`: vitest 5 mensyaratkan `@types/node` ≥ 22 (peer dependency). Node lokal v26 | Tidak |

### Keputusan teknis

- **Tipe uang: `number` (bilangan bulat aman), bukan `bigint`.** Alasan: PostgREST mengirim bigint sebagai angka JSON; total uang beredar ≈ Rp 150 juta ≪ 2^53. `assertMoney` menolak nilai non-integer atau di luar rentang aman. Dicatat di kepala `lib/money.ts`.
- **Klien server memakai sesi pengguna**, tidak pernah `service_role`. `lib/supabase/env.ts` hanya membaca dua variabel `NEXT_PUBLIC_*`. Kunci `service_role` hanya dibaca `scripts/seed-dev.ts` dari env shell dan tidak ditulis ke berkas atau log.
- **Proxy**: `getClaims()` (validasi JWT) + satu kueri `profiles.role` per permintaan terproteksi. Tanpa sesi: `/team*` → `/kiosk`, rute lain → `/login`. Peran salah → beranda peran sendiri. `/kiosk` tidak pernah dialihkan karena halamannya sendiri akan `signOut` global. Ini lapis 1 (UX); RLS + RPC tetap penegak sebenarnya.
- **`cacheComponents: true`** dipertahankan. Akibatnya setiap komponen server yang memakai `cookies()` harus berada di dalam `<Suspense>`; `app/page.tsx` sengaja kosong karena proxy mengalihkan `/`.
- **Komponen klien tidak boleh menerima komponen fungsi dari server.** Ikon dilewatkan sebagai elemen terrender (`icon: <Home />`), ditemukan saat verifikasi visual (galat "Only plain objects can be passed to Client Components").
- **Layar sempit (< 1024 px):** `AppShell` hanya menampilkan bilah merek. Bilah atas + laci penjaga dibangun saat Tahap Penjaga dikerjakan (ditunda). Tim dan admin bekerja dari laptop.
- **Logo:** sementara ubin biru + ikon candlestick + "Classmeet Market" (nama dan logo resmi belum diputuskan, DESIGN.md §11).
- **`/dev`:** galeri komponen untuk pemeriksaan visual, hanya aktif di luar produksi (`notFound()` di produksi, tidak masuk daftar rute publik pada produksi). Boleh dihapus kapan saja.
- **`npm`** dipakai (pnpm tidak terpasang). `npm install` gagal menulis `~/.npm` (EACCES); dipakai cache sementara `--cache /tmp/npm-cache-classmeet`. Perbaikan permanen di mesin: `sudo chown -R $(id -u):$(id -g) ~/.npm`.
- **`turbopack.root`** dikunci ke folder proyek karena ada `package-lock.json` liar di `/Users/Kumar` yang membingungkan Next.
- **Font angka:** `tabular-nums` diuji pada Inter lewat pengukuran lebar (`111.111`, `100.000`, `888.888` semuanya 74,87 px dengan `tnum`; tanpa `tnum` 47,56 / 68,38 / 71,20). Fitur `tnum` tersedia di Inter dari `next/font`.

### Belum diuji (Tahap 0)

- `scripts/seed-dev.ts` **belum dijalankan** terhadap staging (membutuhkan `SUPABASE_SERVICE_ROLE_KEY` dari kamu). Validasi data dan logika murni sudah diuji vitest; panggilan Auth Admin dan RPC `admin_save_news` belum.
- Login nyata lewat proxy (peran → beranda) belum diuji karena belum ada akun; pengalihan tanpa sesi sudah dicek dengan `curl`.
- Tampilan di Windows dengan Inter (di Mac yang dipakai, SF Pro sistem yang tampil).
- Kontras komponen belum diaudit otomatis; token mengikuti angka DESIGN.md §2.5.

## Tahap A.1 — Masuk laptop `/kiosk` (17 Nov 2026)

Frame Figma: `Kiosk — Scan QR` (1084:320), `Tim — Sesi hampir habis` / `Banner sesi` (1102:398, 1102:515).

### Keputusan baru yang perlu masuk dokumen

| # | Apa | Yang dipakai | Perlu ubah dokumen? |
|---|-----|--------------|---------------------|
| 1 | **Format isi QR** tidak didefinisikan di dokumen mana pun (doc 02 hanya "nama akun + rahasia") | `CM1:<username>:<qr_token>` (`lib/qr.ts`, ada tesnya). `username` = nama akun Auth (email `username@classmeet.local`), `qr_token` = UUID = kata sandi akun. `print-qr.ts` (sudah ada, lihat bagian "Skrip print-qr" di bawah) **wajib** memakai `formatTeamQr` agar kartu cocok. Penjaga hanya memakai bagian token untuk `resolve_team_qr` | Ya: doc 02 §3.5, doc 08 (cetak kartu) |
| 2 | Doc 07 §3.3 bertentangan sendiri: "hanya logo, pratinjau kamera, dan status pasar" vs "tidak menampilkan ... status pasar" | Diikuti kalimat kedua dan Figma: **tidak ada status pasar** di `/kiosk` | Ya: doc 07 §3.3 |
| 3 | Nama laptop "diset sekali per perangkat di konfigurasi" (doc 07 §3.3) tanpa cara | Buka sekali `/kiosk?device=laptop-3` di laptop itu; disimpan di localStorage, query dihapus dari URL (`lib/kiosk/device.ts`). Dikirim ke `log_kiosk_event`; tidak tampil di layar | Ya: doc 08 (setup laptop) |
| 4 | Pembaca QR (`@yudiel/react-qr-scanner` → zxing WASM) memuat WASM dari **CDN** secara bawaan | WASM disalin ke `public/vendor/` oleh `scripts/copy-zxing-wasm.mjs` (jalan otomatis di `predev`/`prebuild`, hasilnya di-gitignore) dan dimuat lokal. Alasan: jaringan sekolah/tunnel bisa lambat atau memblokir CDN, dan semua laptop harus bisa memindai | Ya: doc 11 (daftar periksa) |
| 5 | Proxy mengalihkan `/vendor/*.wasm` ke `/login` (ditemukan saat verifikasi: WASM 404 di `/kiosk`) | `matcher` proxy kini mengecualikan `vendor/` dan `*.wasm` | Tidak |
| 6 | Logo sidebar/kiosk | Lingkaran oranye "C" + `CLASSMEET` / `MARKET` mengikuti Figma (`components/shell/brand.tsx`); menggantikan ubin biru Tahap 0 | Tidak |
| 7 | Radius kartu kamera | 10 (skala implementasi); Figma 24 | Ya (sudah di #1 Tahap 0) |

### Perilaku yang dibangun

- `/kiosk` selalu mencabut sesi lama dulu (`getSession` → bila ada, `log_kiosk_event('logout')`; lalu `signOut` global, cadangan `signOut` lokal), baru menyalakan kamera.
- QR terbaca → `signInWithPassword` → `log_kiosk_event('login', laptop)` → muat ulang penuh ke `/team/market`. Isi QR hanya variabel lokal; tidak masuk state React, log, URL, atau pesan galat.
- Galat: "Kartu tidak dikenali. Coba lagi atau minta bantuan panitia."; 5 kegagalan beruntun → tahan 10 detik dengan hitung mundur. Galat jaringan tidak dihitung sebagai kegagalan. Hitungan kegagalan hanya di sisi klien (reset saat halaman dimuat ulang); pembatas laju sebenarnya adalah bawaan Supabase Auth.
- Kamera ditolak/tak ada: "Kamera tidak bisa dipakai. Pindah ke laptop lain atau hubungi panitia." plus satu baris rincian untuk izin ditolak, bukan HTTPS, dan kamera dipakai aplikasi lain.
- Timer sesi `SessionBanner` (di layout tim): 5 menit diam → `log_kiosk_event('idle_logout')` + signOut global + `/kiosk`; banner kuning di 30 detik terakhir. Dihitung dari jam dinding, bukan jumlah detak interval. Gerakan kursor < 4 px diabaikan (tata letak yang bergeser memicu `pointermove` palsu di Chrome). Tombol **Selesai** di kartu akun (`logout`).
- Berkedip pada hitung mundur dibuat sebagai **cincin biru berdenyut**, bukan pudar-dan-muncul, agar kontras teks tetap penuh (Figma hanya menyebut "berkedip").
- `app/team/layout.tsx` dibuat lebih awal (AppShell + sidebar + banner sesi + Selesai) supaya alur masuk bisa diuji; menu memuat Beranda, Daftar Pos, Pasar, **Order**, Portofolio, Riwayat (Order dari doc 07 §2.1). `app/team/market/page.tsx` adalah **placeholder sementara** (diganti di langkah Pasar).

### Bug yang ditemukan saat verifikasi

- Menjeda pemindai (`paused`) membuat pustaka mematikan dan menyalakan ulang kamera tiap percobaan (kamera palsu dengan aliran yang sama langsung error). `paused` dihapus; penguncian dilakukan `busy` ref. Terverifikasi: `getUserMedia` dipanggil satu kali selama 5 percobaan gagal + masa tahan.

### Belum diuji (A.1)

- **Masuk sungguhan dengan kartu tim** dan **keluar** (Selesai, idle sungguhan 5 menit) terhadap akun nyata: belum ada akun di staging. Pembuatan akun lewat SQL ditolak pengaman; seed (`npm run seed`, butuh `SUPABASE_SERVICE_ROLE_KEY`) harus dijalankan dulu. Yang sudah diuji: jalur gagal (kartu tidak dikenal, 5 kegagalan + tahan 10 detik + pulih) memakai kamera palsu berisi QR sungguhan yang dibaca zxing; timer dan banner sesi diuji lewat `/dev/session` (batas 20 detik / 10 detik) termasuk keluar otomatis ke `/kiosk`.
- Kamera laptop sungguhan, pencahayaan/silau di kartu laminasi, mirror pratinjau, dan kamera di bawah HTTPS (Cloudflare Tunnel).
- `log_kiosk_event` (login/logout/idle_logout) belum terlihat di `audit_log` (butuh sesi tim nyata).
- Perilaku masa berlaku token pendek sebagai lapis cadangan (pengaturan JWT Supabase) belum dicek.

## Tahap A.2 — Beranda `/team` (17 Nov 2026)

Frame Figma: `Tim — Beranda` (1082:48) dan `Tim — Beranda (tooltip harga peringkat)` (1133:286). Kontrak: `get_my_summary()`, tabel `news_feed`, Realtime `news_feed` + `payouts`.

### Deviasi dari Figma/dokumen

| # | Apa | Yang dipakai | Perlu ubah dokumen? |
|---|-----|--------------|---------------------|
| 1 | Gradasi hero: DESIGN.md §2.3 `135°` | **167°** dengan titik berhenti 14,6 % / 85,4 % (dari Figma; Figma menang). Token `--hero` diperbarui | Ya: DESIGN.md §2.3, §9 |
| 2 | Total vs dua angka lain: bila ada saldo tertahan di order, Total (net worth) ≠ Saldo + Nilai aset | Baris keterangan kecil di bawah Total: "Termasuk Rp X yang tertahan di order" (hanya bila > 0). Bukan angka keempat | Ya: doc 07 §2.1 dan Figma (tambah baris opsional) |
| 3 | Tooltip harga peringkat: Figma menaruhnya di kanan angka, dengan panah dan garis penghubung | Dibuka dengan **ketukan** (juga hover/fokus), diletakkan di kanan **kolom** Nilai aset (offset diukur saat dibuka) agar tidak menutup angka mana pun; ditutup dengan ketukan di luar. Garis penghubung dan panah tidak dibuat | Tidak |
| 4 | Lencana "Baru" (doc 07: "berita terbaru diberi lencana") | Hanya baris **paling atas** dan hanya bila tayang ≤ 30 menit lalu, supaya tidak menempel selamanya | Ya: doc 07 §3.0 |
| 5 | Baris berita "dapat diketuk" tanpa tujuan | Membuka dialog berisi isi lengkap (teks biasa, `whitespace-pre-line`) | Ya: doc 07 §3.0 |
| 6 | Sidebar mengikuti Figma: radius item 10, jarak 8, teks 18 px, ikon 22 px, lencana Order biru `--primary` (sebelumnya abu `--bg-3`) | Terapkan | Tidak |
| 7 | Lencana jumlah Order di sidebar | Gaya dibuat, **angkanya belum tersambung** (menunggu halaman Order, langkah A.4); `NAV` tim belum memberi `badge` | Tidak |
| 8 | Tombol mata menyembunyikan angka | Status hanya di memori halaman (kembali tampil bila pindah halaman). Tidak disimpan di storage supaya tim berikutnya tidak mewarisinya | Tidak |

### Perilaku data

- Server: `get_my_summary()`, nama tim, dan 30 berita terbaru diambil di server (dibungkus `<Suspense>`), lalu diserahkan ke `BerandaLive`.
- Saldo: polling **10 detik** + segera setelah ada baris `payouts` baru untuk tim ini (Realtime, `filter team_id=eq.<id>`; toast "Hadiah Rp … dari Pos … masuk").
- Berita: Realtime `news_feed` (INSERT; toast "Berita baru: …") + polling cadangan 30 detik.
- Saat tab aktif lagi, jendela fokus, `online`, atau kanal Realtime tersambung ulang → ambil ulang semua (`lib/hooks/use-polling.ts`).
- Efek berita dan waktu efek tidak pernah ada di klien: hanya `news_feed` yang dibaca.
- Jam "Baru"/label tanggal dimulai `null` dan diisi setelah terpasang (React purity + hidrasi); sebelum itu "Baru" belum tampil.

### Masalah proses yang ditemukan

- **Menjalankan `npm run build` saat `next dev` berjalan merusak cache dev**: server dev terus menyajikan modul lama (kelas CSS lama di HTML SSR, galat hidrasi) walau berkas sudah berubah. Pemulihan: hentikan server dev lalu mulai ulang. Server dev yang sedang berjalan (PID 95721, bukan dimulai sesi ini) saya hentikan dan mulai ulang lewat preview. **Aturan kerja: hentikan `next dev` sebelum `build`.**

### Belum diuji (A.2)

- **Halaman nyata `/team` dengan akun tim** (data sungguhan, Realtime `news_feed`/`payouts`, toast, polling 10 detik): belum ada akun di staging (seed belum dijalankan). Tampilan diuji lewat `/dev/beranda` (data contoh, pakai komponen yang sama); mapping data diuji vitest (`lib/team/data.test.ts`).
- Perilaku hidden/tooltip/dialog sudah dicoba di peramban; belum dicoba dengan layar sentuh sungguhan.
- Hidrasi `BerandaLive` terhadap data server nyata, dan tampilan saat `get_my_summary()` gagal ("Data belum bisa dimuat, mencoba lagi…").

## Skrip print-qr (alat bantu, 17 Nov)

Dibuat atas permintaan agar tim uji bisa masuk lewat `/kiosk` tanpa kartu fisik. Bukan bagian halaman.

- **Pakai:** `npm run print-qr` (opsi `--input <berkas>`, `--copies N`). Keluaran di `scripts/.qr-output.local/` (gitignore, folder 0700, berkas 0600): `<username>.png` per tim dan `kartu-tim.html` (satu kartu A4 per halaman: nama tim + QR besar; tanpa `short_code`, tanpa teks token).
- **Pustaka:** `scripts/print-qr-lib.ts` (+ `print-qr-lib.test.ts`, 6 tes). Isi QR dibuat oleh `formatTeamQr` (`lib/qr.ts`). Tes memastikan QR yang dibuat terbaca persis sama oleh pembaca zxing, dan HTML tidak memuat token sebagai teks.

| # | Deviasi | Keputusan | Perlu update dokumen? |
|---|---|---|---|
| 1 | doc 08 §2: `print-qr.ts` membaca `teams.qr_token` lewat service role | Membaca berkas masukan lokal (default `scripts/.seed-output.local.json`, bentuk `{"teams":[{name,username,qr_token}]}`); **tidak butuh service role**. Untuk acara sungguhan, berkas itu harus dihasilkan skrip pembuat akun (`create-accounts.ts` belum ada; `rotate-team-qr.ts` juga belum) | Ya: doc 08, doc 02 §struktur `scripts/` |
| 2 | Paket baru | `zxing-wasm@3.1.7` dijadikan devDependency langsung (sudah terpasang sebagai dependensi pemindai `/kiosk`; tidak ada unduhan baru). Dipakai untuk **menulis** QR PNG, sehingga tidak perlu paket `qrcode`. | Tidak |
| 3 | doc 08: cetak dua set | Opsi `--copies 2`; bawaan 1 set | Tidak |

**Diuji:** 5 QR hasil seed dibaca kembali dengan zxing dan cocok dengan `CM1:<username>:<qr_token>` tiap tim; HTML 10 halaman (2 set × 5); lembar dilihat di peramban (nama tim, QR 130 mm, petunjuk); tsc, eslint, vitest (30 tes) bersih.
**Belum diuji:** pemindaian dari kamera laptop sungguhan terhadap kartu tercetak/layar HP; hasil cetak fisik (margin printer, skala 100 %).

## QR seret (sementara, hanya dev; 17 Nov)

Atas permintaan: kamera laptop tidak bisa dipakai, jadi login tim diuji dengan menyeret gambar QR ke `/kiosk`. **Fitur ini akan dihapus** setelah pengujian selesai.

- **Cara kerja:** `components/kiosk/dev-qr-drop.tsx` menangkap gambar yang diseret ke mana saja di halaman, dipilih lewat tombol "Pilih gambar", atau ditempel (⌘V). Gambar dibaca di peramban (zxing, WASM lokal `/vendor`), lalu isinya masuk ke `submitRaw` yang sama dengan hasil kamera (`parseTeamQr` → `signInWithPassword` → `log_kiosk_event`). Gambar tanpa QR terbaca menghitung sebagai satu kegagalan (batas 5 kali tetap berlaku). Isi QR tidak masuk state, log, atau URL.
- **Pengaman:** dirender hanya bila `process.env.NODE_ENV !== "production"`, dan `dynamic()`-nya dibuat di dalam kondisi itu. Terbukti: setelah `next build`, teks "Mode uji" tidak ada di `.next/static` maupun `.next/server`.
- **Cara menghapus:** hapus `components/kiosk/dev-qr-drop.tsx`; di `components/kiosk/kiosk-scanner.tsx` hapus konstanta `DevQrDrop`, blok `{DevQrDrop ? … : null}`, dan `onUnreadable`; gabungkan kembali `submitRaw` ke `onScan` (opsional); hapus bagian log ini.
- **Diuji:** seret gambar kosong → "Kartu tidak dikenali" dan halaman tidak berpindah (drop dicegah); pilih `tim1.png` → masuk dan sesi nyata terbentuk; Selesai → kembali ke `/kiosk`, `/team` mengalihkan ke `/kiosk`; `audit_log` mencatat `kiosk_login` dan `kiosk_logout`.
- **Belum diuji:** seret-lepas sungguhan dari Finder (diuji lewat `DragEvent` buatan dan input berkas) dan tempel (⌘V).

### Temuan saat uji dengan akun nyata (A.2)

- **Galat konsol:** `Route "/team": Next.js encountered the unstable value Date.now() while prerendering` (dari `TeamLayout`; klien Supabase memakai waktu untuk cek kedaluwarsa JWT saat render awal). **Perbaikan:** `await connection()` di awal `TeamShell` (`app/team/layout.tsx`) dan `BerandaContent` (`app/team/page.tsx`). Konsol bersih setelahnya. Halaman berikutnya yang membaca sesi di server harus melakukan hal yang sama.
- **Beranda nyata:** menampilkan "Halo, Tim Elang", Total/Saldo/Nilai aset `Rp 0` dan kartu Berita kosong. Itu **benar** untuk keadaan sekarang: saldo tim memang 0 sebelum game dibuka/hadiah, dan `news_feed` baru terisi oleh siklus berita saat status `open`.

## Tahap A.3 — Pasar `/team/market` (17 Nov)

**Dibangun:** halaman tiga kolom sesuai Figma `Tim — Pasar (order book)` (1082:164): berita terbaru satu baris (ketuk = isi penuh), banner status pasar, daftar aset + cari, detail aset (harga terakhir, Open/High/Low/Acuan/Avg/ARA/ARB/Lot/Val/Freq), order book 5 level (bid kiri, offer kanan, garis biru untuk order sendiri), form order (Beli/Jual × Limit/Market, stepper harga ±1 fraksi, stepper lot, ringkasan), dan ringkasan order terbuka dengan Batalkan.

**Berkas:** `app/team/market/{page,actions}.tsx|ts` (server action `placeOrder`/`cancelOrder` → RPC `place_order`/`cancel_order` dengan sesi pengguna, Zod di `lib/schemas/order.ts`), `components/market/*`, `lib/market/{data,rules}.ts` (+ tes), `lib/hooks/use-change-flash.ts`, `components/team/news-dialog.tsx` (dipecah dari kartu Berita), `PriceChangeChip` dapat `suffix`, keyframe `price-flash`.

**Data & realtime:** `get_market_summary` + `assets` (harga/statistik), `get_order_book`, `order_band` (ARA/ARB, satu sumber kebenaran: tidak dihitung ulang di klien), `game_settings`, `holdings`, `orders` (RLS: milik sendiri), `get_my_summary` (saldo). Polling 5 dtk (pasar, order book, status, kepemilikan, order) dan 10 dtk (saldo); ambil ulang saat tab aktif/koneksi kembali. Realtime hanya `game_settings` (UPDATE) dan `news_feed` (INSERT); TIDAK ada `postgres_changes` di `orders`/`trades`/`assets`. `request_id` dibuat per niat dan dipakai ulang hanya bila isian persis sama.

| # | Deviasi / keputusan | Alasan | Perlu update dokumen? |
|---|---|---|---|
| 1 | **Tombol Place Order dinonaktifkan hanya saat pasar tidak `open`** (label "Pasar dijeda / belum dibuka / ditutup"), mengikuti Figma Pasar dijeda. Saat `open` tombol **tidak pernah** nonaktif; semua penolakan terjadi saat ditekan (docs/07 §3.1) | Status pasar publik, tidak membocorkan angka | docs/07 §3.1 (kecualikan keadaan tidak-open) |
| 2 | Frame error isian Figma (1129:935) menonaktifkan tombol dan memberi pesan di tiap isian **sebelum** kirim. Dibangun sesuai docs/07: tombol aktif, pesan isian muncul **setelah** penolakan server (`price_out_of_range`, `invalid_tick`, `insufficient_cash`, `insufficient_holdings`) + "Perbaiki N isian di atas, lalu coba lagi." Isian kosong/0 dicegah di klien | docs/07 §3.2 eksplisit: input tidak dibatasi saldo/lot | Figma 1129:935 |
| 3 | Teks Figma pada Pasar dijeda "Batalkan order terbuka tetap bisa" bertentangan dengan docs/12 §5 dan `cancel_order` (`market_closed` bila bukan `open`). Banner dan tombol Batalkan mengikuti DB: pembatalan tidak bisa saat dijeda | DB menang | Figma 1129:612 (teks) |
| 4 | Label "Prev" → **"Acuan"**; chip perubahan = harga terakhir vs **harga acuan** | Skema tidak punya penutupan hari sebelumnya; acuan adalah dasar ARA/ARB | Figma, docs/07 |
| 5 | Daftar aset menampilkan 30 aset / 6 sektor (Figma 25 / 5) dan bisa dicari menurut simbol, nama, dan sektor; daftar bisa digulir di dalam panelnya | Keputusan 30 aset (A.0) | Figma |
| 6 | Hint "saldo cukup untuk maks N lot" (Figma) tampil untuk beli limit sebagai informasi; tidak membatasi input | Saldo sudah tampil di form yang sama | — |
| 7 | Pesan hasil order inline + toast ("Terisi 3 dari 6 lot; sisa dibatalkan." dst.) | docs/07 §3.2 | — |
| 8 | Tautan "Lihat semua →" mengarah ke `/team/orders` (belum dibangun: 404 sampai langkah Order). Lencana jumlah Order di sidebar masih belum terhubung | Langkah A.4 | — |
| 9 | docs/07 §5 menyebut berlangganan `assets` via Realtime; di Pasar memakai polling 5 dtk (perubahan `assets` = akibat transaksi) | Aturan prompt: tanpa `postgres_changes` untuk order/trade | docs/07 §5 |
| 10 | Perbaikan bug `SidebarNav`: "Beranda" (`/team`) ikut aktif di `/team/market`. Kini hanya item paling spesifik yang aktif | Ditemukan saat uji visual | — |

### Temuan database (perlu keputusan/aksi, BUKAN diubah oleh app)

1. **`UPDATE` tanpa `WHERE` ditolak Supabase hosted** (`UPDATE requires a WHERE clause`, pg_safeupdate pada sesi PostgREST). Terbukti: `admin_set_game_state('open')` gagal pada staging. Tujuh fungsi terdampak: `admin_set_game_state`, `admin_set_leaderboard_visible`, `admin_unfreeze_leaderboard`, `freeze_leaderboard_internal`, **`ob_match`** (update `house_cash`, dipanggil `place_order` tiap pencocokan), `process_house_quotes`, `process_news_cycle`. Tes lokal tidak menangkapnya karena Postgres biasa tidak memuat ekstensi itu. Perbaikan (hanya menambah `where true`, perilaku sama): `scripts/sql/fix-safeupdate-game-settings.sql` (idempoten, ada kueri pemeriksaan di akhir). **Belum diterapkan**: pengguna memilih menjalankannya sendiri. SQL di docs/04 (§3.1, §3.3, §3.4) harus diselaraskan.
2. **Hak berlebih untuk peran `authenticated`** pada `assets`, `orders`, `holdings`, `game_settings`, `trades`: `TRUNCATE`, `TRIGGER`, `REFERENCES` (selain `SELECT`). PostgREST tidak membuka `TRUNCATE`, jadi tidak bisa dipakai lewat API, tetapi melanggar prinsip hak minimum dan docs/03 §5. Disarankan `revoke truncate, trigger, references on all tables in schema public from authenticated, anon`.
3. `order_band(uuid)` dapat dipanggil `authenticated` (tidak ada di daftar pencabutan docs/04 §6). Hanya-baca, dipakai app untuk ARA/ARB; tidak berbahaya.

### Data uji yang saya ubah di staging (disetujui pengguna)

- `admin_adjust_cash` +Rp 10.000.000 untuk `tim1` dan `tim2` (alasan "Saldo uji halaman Pasar") lewat akun admin seed.
- Migrasi `scripts/sql/fix-safeupdate-game-settings.sql` dijalankan pengguna (kueri pemeriksaan: 0 baris), lalu saya memanggil `admin_set_game_state('open')`. Pasar kini `open`, `started_at` terisi (harga aset, kumpulan berita, dan pengaturan berita terkunci), 300 order bandar terpasang, siklus berita berjalan. Saya sempat memanggil `paused` lalu `open` lagi untuk uji banner. Ada order dan trade uji `tim1`/`tim2` di aset BC.

### Diuji (akun nyata, staging, peramban 1440 px)

| Skenario | Hasil |
|---|---|
| Order book 5 level dari bandar (BC: bid 697.500…687.500, offer 702.500…712.500, 1 lot/level) | Sama dengan contoh docs/12 §8 |
| Limit beli @700.000 (antre) | "Order antre: 1 lot @ 700.000."; muncul di Order terbuka; saldo bebas turun Rp 701.750; baris bid milik sendiri bergaris biru |
| Harga di atas ARA (900.000) | "Di atas batas ARA 805.000. Turunkan harga." + "Perbaiki 1 isian di atas, lalu coba lagi."; tombol tetap aktif |
| Harga bukan kelipatan fraksi (700.100) | "Harga harus kelipatan Rp 2.500." |
| 50 lot beli, saldo kurang | "Saldo tidak cukup untuk 50 lot (maksimal 13 lot)." (13 = hitungan benar) |
| Limit beli @702.500 (cocok dengan offer bandar) | "Order terisi penuh: 1 lot."; harga terakhir 702.500; saldo benar sampai rupiah (biaya dibulatkan ke atas) |
| Market beli 3 lot | Estimasi Rp 2.122.500 = 705.000 + 707.500 + 710.000 (cocok); terisi penuh; harga terakhir 710.000 |
| Market jual 2 lot | Estimasi melewati bid milik sendiri (700.000), terisi di 697.500 + 695.000 |
| Jual limit 10 lot (dimiliki 2) | "Aset tidak cukup untuk dijual 10 lot (tersedia 2 lot)." |
| Market beli saat offer kosong | "Tidak ada lawan dalam 5 level. Order dibatalkan."; estimasi "–" |
| Batalkan order terbuka | Toast "Order BC dibatalkan."; Order terbuka 1 → 0; kunci kembali |
| Order antre tim1 diisi tim2 (skrip, akun tim2) | Tanpa aksi di layar tim1: Order terbuka 1 → 0, harga terakhir 712.500 dan order book berubah lewat polling ≤ 5 dtk |
| `request_id` sama + isi sama / beda (skrip) | Baris order yang sama (tidak ganda) / `request_id_conflict` |
| Pasar dijeda (admin) | Banner "Pasar dijeda" dan tombol "Pasar dijeda" nonaktif ±1,5 dtk setelahnya (Realtime `game_settings`); lalu dibuka lagi |
| Sorotan harga saat berubah | Kelas `.price-flash` terpasang pada harga terakhir saat trade |
| Beranda sesudah trading | Total/Saldo Rp 9.963.428, Nilai aset Rp 0 (semua aset sudah dijual), berita "Baru" tampil |
| Pemeriksaan kode | `npm run build` (sebelum perubahan a11y satu baris), tsc, eslint, vitest 45 tes bersih; konsol halaman bersih |

Perbaikan kecil dari uji: pesan galat isian kini `role="alert"` agar terbaca pembaca layar.

### Belum diuji

- Penolakan `market_closed` pada balapan (pasar dijeda setelah form terbuka, tombol belum sempat nonaktif); `request_id` ulang saat jaringan benar-benar putus; banner "Permainan selesai"; Realtime `news_feed` (toast berita baru) di halaman Pasar; layar sentuh; garis biru untuk order jual milik sendiri; ≥ 5 lot per level (bar kedalaman bertingkat) dan beberapa level berisi lot > 1.
- Console `403 /auth/v1/logout?scope=global` muncul di `/kiosk` bila sesi lama sudah tidak valid (signOut global ditolak lalu jatuh ke `local`); tidak berbahaya, sudah ada sebelum Pasar.

## Tahap A.4 — Order `/team/orders` (18 Nov)

**Dibangun** sesuai Figma `Tim — Order terbuka` (1122:612) dan docs/07 §2.1: kepala "Order Terbuka", tiga angka (Order antre + "N beli · M jual", Saldo terkunci, Aset terkunci), tabel **Order antre** (aset, sisi, jenis, harga, lot, terisi, dikunci, waktu, Batalkan), tabel **Riwayat order hari ini**, banner status pasar (dipakai ulang dari Pasar), keadaan kosong, dan keadaan memuat. Tabel memakai `<table>` sungguhan (`caption`, `th scope`), kolom kedua tabel sejajar, dapat digulir mendatar di layar sempit.

**Lencana jumlah order di sidebar (semua layar tim):** `OpenOrdersCountProvider` + `TeamNav` (`components/team/open-orders-count.tsx`). Nilai awal dari server (layout), diperbarui halaman Pasar/Order begitu daftar mereka berubah, dan penyedia mengambil ulang sendiri tiap 10 dtk. `AppShell` kini menerima `navigation` (pengganti menu bawaan).

**Berkas:** `app/team/orders/page.tsx`, `components/orders/orders-board.tsx`, `lib/orders/view.ts` (+ tes), tambahan di `lib/market/data.ts` (`fetchClosedOrders`, `fetchOpenOrderCount`, `fetchAssetNames`, `lockPerLot` di `OpenOrder`).

**Data:** `orders` (RLS: milik sendiri; antre dan selesai), `trades` (milik sendiri, untuk harga rata-rata terisi order market), `holdings` (aset terkunci), `get_my_summary` (saldo terkunci), `game_settings`. Polling 5 dtk (order, kepemilikan, status) dan 10 dtk (saldo); Realtime hanya `game_settings`. Tanpa `postgres_changes` di `orders`/`trades`. Pembatalan memakai server action `cancelOrder` yang sama dengan Pasar.

| # | Deviasi / keputusan | Alasan | Perlu update dokumen? |
|---|---|---|---|
| 1 | Kartu angka radius **10** (Figma 24); baris tabel radius 14 | Skala radius implementasi (panel/kartu 10, baris 14) | Figma 1122:927 |
| 2 | Waktu "07:29" (titik dua, WIB 24 jam) bukan "14.20" | docs/07 §6: 24 jam, WIB | Figma |
| 3 | "Riwayat order hari ini" = order yang **dibuat hari ini menurut WIB** (jam kalender) | Skema tidak punya hari permainan | docs/07 §2.1 |
| 4 | Kolom Harga order market di riwayat = harga rata-rata terisi (dari `trades`), diberi "(rata-rata)"; belum terisi = "–" | Order market tak punya harga | Figma |
| 5 | Teks status riwayat: tambahan "Tidak terisi · tidak ada lawan" (market tanpa lawan) dan "Dibatalkan saat pasar ditutup" (state `finished`). "Dibatalkan oleh tim" dipakai untuk pembatalan limit lainnya | DB tidak mencatat siapa yang membatalkan; pasar ditutup membatalkan otomatis | Figma |
| 6 | Tombol Batalkan nonaktif + catatan saat pasar tidak `open` | `cancel_order` menolak (`market_closed`), docs/12 §5 | — |
| 7 | Saat tidak ada order, lencana Order disembunyikan (Figma selalu menunjukkan angka) | Angka 0 tidak informatif | — |
| 8 | Link "Lihat semua →" di Pasar kini valid | — | — |

### Diuji (akun nyata, staging, peramban 1440 px)

| Skenario | Hasil |
|---|---|
| Tiga angka dan tabel dengan data nyata (2 beli + 1 jual; 1 order lama dari 17 Nov) | Saldo terkunci Rp 4.882.175 = 1.624.050 + 3.258.125 (benar per order); aset terkunci "1 unit, BCA untuk order jual" |
| Batalkan dari halaman Order | Toast "Order BC dibatalkan."; angka, tabel, riwayat (Dibatalkan oleh tim), dan lencana sidebar (3 → 2) ikut berubah |
| Riwayat | Market beli terisi "827.500 (rata-rata) · Terisi 1 / 1"; limit batal "Dibatalkan oleh tim" |
| Lencana sidebar di Beranda (halaman lain) | Menunjukkan jumlah yang benar |
| Pasar dijeda (admin) | Banner "Pasar dijeda" dan semua tombol Batalkan nonaktif (±1,8 dtk, Realtime); lalu dibuka lagi |
| Akun tanpa order (tim2) | Dua keadaan kosong dengan teks yang benar, "Rp 0", "0 unit", tanpa lencana |
| Kolom tabel | Lima kolom pertama kedua tabel sejajar piksel demi piksel |
| Pemeriksaan kode | `npm run build` (rute `/team/orders` partial prerender), tsc, eslint, vitest 51 tes (baru: `lib/orders/view.test.ts`); konsol 0 galat |

### Belum diuji

Order **sebagian terisi** yang masih antre (status `partial`, kolom Terisi `x / y`) karena butuh dua tim yang saling cocok; status "Dibatalkan saat pasar ditutup" dan "Tidak terisi · tidak ada lawan" hanya diuji lewat tes unit; Realtime tidak dipakai untuk order (hanya polling) sehingga order yang terisi oleh tim lain muncul ≤ 5 dtk; layar sentuh; tabel di bawah 900 px (hanya menggulir).

## Tahap A.5 — Portofolio `/team/portfolio` (18 Nov)

**Untuk apa halaman ini:** ringkasan *aset yang sedang dipegang tim*: berapa nilainya sekarang, berapa untung/ruginya dibanding harga beli, dan pintu cepat untuk menjual. Berbeda dari Beranda (uang total) dan Order (order yang masih antre): Portofolio hanya menjawab "apa yang kami pegang dan apakah itu untung atau rugi".

**Dibangun** sesuai Figma `Tim — Portofolio` (1083:350) dan docs/07 §2.1: kepala "Keuanganku / Portofolio", kartu **Total nilai portofolio** dengan pil untung/rugi (▲/▼ + tanda + persen) dan catatan harga beli total, kartu **Yang kamu pegang** (ubin simbol, nama, "qty × harga beli rata-rata", nilai sekarang, untung/rugi, tombol **Jual**), keadaan kosong ("Kamu belum punya aset" + tombol Buka Pasar), dan keadaan memuat. Polling 10 dtk + saat tab aktif lagi.

**Rumus** (`lib/portfolio/view.ts`, tes `view.test.ts`): nilai = `qty × coalesce(rank_price, price)` (HARGA PERINGKAT, sama dengan `get_my_summary` dan Beranda); harga beli = `holdings.cost_basis` (sudah termasuk biaya beli; berkurang rata-rata saat menjual); untung/rugi = nilai − cost_basis. Baris diurutkan dari nilai terbesar. **Jual** membuka `/team/market?asset=<SIMBOL>&side=sell` (halaman Pasar kini membaca `asset` dan `side`; tab Jual hanya untuk aset tautan itu, ganti aset = kembali Beli).

| # | Deviasi / keputusan | Alasan | Perlu update dokumen? |
|---|---|---|---|
| 1 | Nilai memakai **harga peringkat**, bukan "harga pasar saat ini". Teks Figma ("Beranda menampilkan nilai aset menurut harga beli") diganti: "Nilai memakai harga peringkat… sama dengan Beranda dan peringkat, jadi bisa sedikit berbeda dari harga terakhir di Pasar." Subjudul: "…nilainya menurut harga peringkat." | doc 12 §7 / doc 03 §4 (17 Nov) menggantikan aturan harga beli 16 Nov; aturan dua harga | Figma 1083:402/411, docs/07 §2.1 (kalimat terakhir) dan DESIGN.md |
| 2 | "qty × harga" = harga beli **rata-rata termasuk biaya** (cost_basis ÷ qty), bukan harga transaksi mentah; dijelaskan di catatan total | cost_basis memuat biaya beli (docs/04 `ob_match`) | — |
| 3 | Untung dipakai warna cyan-text, rugi accent-text (oranye tua), keduanya dengan ▲/▼ dan tanda | Mengikuti Figma Portofolio (di Pasar rugi memakai merah) | — |
| 4 | Baris menambah "· N terkunci di order jual" bila ada aset yang tertahan di order jual | Informasi berguna, tidak ada di Figma | — |
| 5 | Keadaan kosong memakai ikon garis, bukan ilustrasi | Tidak ada aset ilustrasi di Figma | docs/07 §2.1 |
| 6 | Tombol Jual berupa tautan (bukan membuka dialog) | docs/07: menjual lewat form order di Pasar | — |
| 7 | Tes `scripts/print-qr-lib.test.ts` kini memakai WASM lokal untuk pembaca zxing | Sebelumnya mengunduh dari CDN dan habis waktu (5 dtk) saat jaringan lambat; tes tidak boleh bergantung pada jaringan | — |

### Diuji (akun nyata, staging, 1440 px)

- `tim1`: total Rp 824.700 = angka "Nilai aset" di Beranda (satu sumber yang sama); harga beli total 829.569 = 827.500 + biaya 2.069; ▼ −Rp 4.869 (−0,6 %).
- Dua aset (Airbus 2 unit dan BCA 1 unit): diurutkan menurut nilai; total 2.257.700 = 1.433.000 + 824.700; catatan "1 terkunci di order jual" muncul saat ada order jual antre.
- Tombol Jual: membuka Pasar pada BCA dengan tab Jual dan baris "Dimiliki (tersedia)"; berganti aset mengembalikan tab Beli; sidebar hanya Pasar aktif.
- `tim3` (tanpa aset): Total Rp 0, tanpa pil, keadaan kosong dan tombol Buka Pasar.
- `npm run build` (rute `/team/portfolio` partial prerender), tsc, eslint, vitest 55 tes (baru: `lib/portfolio/view.test.ts`, 4 tes), konsol bersih.

### Belum diuji

Keadaan **untung** (belum ada aset yang naik terhadap harga beli di staging; warna dan tanda dicakup tes unit untuk angka, bukan visual), banyak aset (> 8 baris), polling 10 dtk saat harga peringkat berubah, layar sentuh.

## Tahap A.6 — Riwayat `/team/history` (18 Nov)

**Dibangun** sesuai Figma `Tim — Riwayat` (1083:459) dan docs/07 §2.1: kepala "Aktivitas / Riwayat Transaksi", satu kartu "Aktivitas terbaru / Transaksi" dengan baris **dikelompokkan per hari WIB** ("Hari ini · 18 Nov", "Kemarin · 17 Nov", lalu tanggal penuh). Baris transaksi: ubin simbol aset, "Beli/Jual <nama aset>", "2 × Rp 800.000 · 14:07", nominal dengan panah dan tanda (− keluar, oranye tua; + masuk, cyan), chevron. Baris hadiah pos: ubin nomor pos ("01"), "Hadiah Pos 1 · Lempar Bola", "Dari penjaga pos · 07:51", "+ Rp 50.000". Ketuk baris membuka **dialog rincian** (transaksi: aset, jumlah, harga per lot, nilai, biaya, total dibayar/diterima; hadiah: pos, lokasi, catatan, jumlah). Keadaan kosong dan memuat tersedia.

**Berkas:** `app/team/history/page.tsx`, `components/history/history-board.tsx`, `lib/history/{view,data}.ts` (+ `view.test.ts`, 6 tes).

**Data:** `trades` (RLS: milik sendiri; satu baris per pencocokan), `payouts` (RLS: milik tim; join `posts`), `assets`. Polling 10 dtk + saat tab aktif lagi; Realtime `payouts` (INSERT, filter `team_id`) hanya sebagai pemberitahuan untuk mengambil ulang. Batas baca: 300 transaksi dan 100 hadiah terbaru. Catatan hadiah dari penjaga dirender sebagai **teks biasa** (diuji: `<b>` tampil apa adanya).

| # | Deviasi / keputusan | Alasan | Perlu update dokumen? |
|---|---|---|---|
| 1 | Nominal = **pengaruh ke saldo termasuk biaya** (beli: −(nilai + biaya); jual: +(nilai − biaya)); Figma menunjukkan nilai tanpa biaya | Riwayat harus cocok dengan saldo; rincian memperlihatkan nilai dan biaya terpisah | Figma 1083:525/549 |
| 2 | **Satu baris per pencocokan**, bukan per order: order market yang menyapu dua level harga tampil sebagai dua baris | Tabel `trades` per pencocokan; sesuai harga sebenarnya | docs/07 §2.1 |
| 3 | Nama pos "Pos 1 · Lempar Bola" dipakai apa adanya; ubin memakai nomor dari nama ("Pos 3 …" → "03"), tanpa nomor → "Pos" | Skema `posts` tidak punya kolom nomor | Figma memakai "Pos 3 — Merakit Buta" |
| 4 | Tahap ini tidak menampilkan penyesuaian saldo admin (`admin_adjust_cash`) dan "Dari penjaga pos" tanpa nama penjaga | Tim tidak boleh membaca `audit_log`; hanya `payouts` dan `trades` yang terbuka | — |
| 5 | Warna keluar memakai accent-text dan masuk cyan-text (Figma), bukan merah/hijau seperti di Pasar | Mengikuti Figma Riwayat | — |
| 6 | Dialog rincian tidak menampilkan lawan transaksi (bandar atau tim lain) | Tidak boleh bocor; tabel `trades` memang tidak menamai lawan untuk tim | — |

**Temuan (di luar halaman):** toast "Hadiah Rp … masuk" dan "Berita baru" hanya dipasang di Beranda dan Pasar (berita). docs/07 §4 menghendaki toast hadiah di **semua** layar tim. Hadiah baru yang masuk saat tim berada di Riwayat/Order/Portofolio tidak memunculkan toast (daftar dan saldo tetap benar lewat polling/Realtime). Disarankan memindahkan langganan toast ke layout tim (langkah tersendiri; belum dikerjakan).

### Data uji di staging (saya tulis)

Dua hadiah dari akun penjaga seed `guard1` (Pos 1 · Lempar Bola) ke `tim1` lewat `resolve_team_qr` + `award_payout`: Rp 50.000 (catatan "Uji halaman Riwayat" + baris kedua berisi `<b>`) dan Rp 25.000 (tanpa catatan). Saldo `tim1` bertambah Rp 75.000.

### Diuji (akun nyata, 1440 px)

| Skenario | Hasil |
|---|---|
| Daftar `tim1` (53 baris: transaksi 17 dan 18 Nov + hadiah) | Dikelompokkan "Hari ini · 18 Nov" dan "Kemarin · 17 Nov"; urut terbaru; angka beli: Beli BCA 1 × 827.500 → −Rp 829.569 (= nilai + biaya 2.069, sama dengan harga beli di Portofolio) |
| Order market yang menyapu 2 level | Dua baris "Beli Airbus" dengan harga berbeda |
| Dialog hadiah | Pos, lokasi, catatan dua baris; `<b>` tampil sebagai teks (0 elemen `<b>`); fokus kembali ke baris saat ditutup |
| Dialog transaksi | Aset, 1 lot, harga, nilai, biaya Rp 2.069, total dibayar Rp 829.569 |
| Realtime hadiah | Hadiah Rp 25.000 dari skrip muncul di baris teratas tanpa muat ulang (≤ 2,5 dtk) |
| `tim3` tanpa riwayat | Keadaan kosong + tombol Buka Pasar |
| Pemeriksaan kode | `npm run build` (rute `/team/history` partial prerender), tsc, eslint, vitest 61 tes, konsol tanpa galat aplikasi (403 `/kiosk` logout lama saja) |

### Belum diuji

Lebih dari 300 transaksi (batas baca), tampilan "Hari ini/Kemarin" melewati tengah malam WIB saat halaman terbuka (jam diperbarui tiap menit), layar sentuh, toast hadiah di halaman ini (lihat temuan).

## Tahap A.7 — Daftar Pos dipindah ke akun display (18 Nov)

**Keputusan pengguna (18 Nov):** Daftar Pos **tidak** dibuka di akun tim; dipindah menjadi layar akun `display`. Akibatnya: menu "Daftar Pos" dihapus dari sidebar tim (menu tim kini Beranda, Pasar, Order, Portofolio, Riwayat), tidak ada `/team/posts`, dan layar ini dibangun di `/display/posts`.

**Dibangun:**
- **`/display/posts`** (`components/display/posts-screen.tsx`): layar publik, tanpa sidebar dan tanpa interaksi. Judul "Stasiun aktivitas / Daftar Pos", dua pil hitungan besar ("3 Tersedia", "9 Tidak tersedia"), daftar dua kolom: ubin nomor, nama game, ikon pin + lokasi, pil status (titik + teks "Tersedia"/"Tidak tersedia", bukan hanya warna; baris tersedia juga diberi latar hijau tipis), dan "Diperbarui HH:MM:SS WIB" di sudut (untuk memastikan layar tidak membeku). Data dari `get_post_list()`; tanpa rentang hadiah. Berubah lewat Realtime `posts`; polling 15 dtk sebagai cadangan; peringatan "Terputus, mencoba menyambung kembali…" bila gagal.
- **Satu layar tanpa gulir:** semua ukuran memakai satuan `vh` dan kepadatan menurut jumlah pos (≤ 6 besar, 7–12 sedang, 13–16 rapat, > 16 sangat rapat). Terukur muat tanpa gulir dan tanpa menimpa footer pada 12 pos di 1280×720, 1366×768, 1440×900, dan 1920×1080 (nama ≥ 21 px), 16 pos di 1920×1080, dan 20 pos di 1920×1080.
- **`/display`** sementara mengalihkan ke `/display/posts` (`app/display/page.tsx`); Tahap B menggantinya dengan rotasi 5 tim teratas, Display pasar, dan Daftar Pos (docs/07 §2.4).
- **`/login`** (halaman masuk staf, perlu supaya akun display/admin/penjaga bisa masuk): `app/login/{page,actions}`, `components/login/login-form.tsx`, `lib/schemas/auth.ts`. Nama akun + kata sandi → server action `signInWithPassword` (sesi pengguna) → beranda perannya. **Akun tim ditolak di sini** ("Tim masuk dengan memindai kartu QR di laptop trading."); pesan galat sama untuk akun tidak ada dan sandi salah; batas laju Supabase (429) dipetakan ke pesan sendiri; yang sudah masuk langsung dialihkan ke beranda perannya.
- **`/dev/display-posts?n=12`**: pratinjau dengan data contoh (hanya pengembangan) untuk menguji kepadatan.
- Berkas lain: `lib/posts/{view,data}.ts` (+ `view.test.ts`, 3 tes), `components/team/` tak berubah selain `app/team/layout.tsx` (menu).

| # | Deviasi / keputusan | Alasan | Perlu update dokumen? |
|---|---|---|---|
| 1 | Daftar Pos hanya di akun `display`, bukan tim (keputusan pengguna) | Instruksi pengguna | docs/07 §0.1 (menu tim), §1 (peta halaman: hapus `/team/posts`, tambah `/display/posts`), §2.1 (baris Daftar pos), §2.4; docs/DESIGN.md bila menyebut menu tim |
| 2 | Tidak ada tombol Filter dan chip kecil Figma; diganti pil hitungan besar | Layar publik tanpa interaksi dan terbaca dari jauh | Figma 1083:589 (versi tim tidak lagi dipakai) |
| 3 | Nama pos "Pos N · Judul": ubin memakai N (dua digit) dan judul memakai sisanya; nama tanpa nomor → ubin "Pos" | Skema `posts` tidak punya kolom nomor | — |
| 4 | Urutan menurut nomor pos (bukan abjad, bukan status) | Konsisten dengan Figma; letak pos tidak berpindah saat status berubah | — |
| 5 | `/login` dibangun sekarang (di luar daftar Tahap A) | Akun display tidak bisa masuk tanpanya; juga dipakai admin dan penjaga nanti | docs/07 §1 sudah memuat `/login` |
| 6 | Display tidak punya batas waktu sesi (tidak ada auto-logout) | Layar ruang publik menyala sepanjang acara; akun dipegang panitia (docs/07 §2.4) | — |

### Data uji di staging (saya ubah, sudah dikembalikan)

`guard_set_post_open` oleh `guard1`: Pos 1 ditutup lalu dibuka lagi (kondisi akhir sama seperti awal).

### Diuji (akun display nyata, staging)

| Skenario | Hasil |
|---|---|
| `/login` kata sandi salah | "Nama akun atau kata sandi salah." |
| `/login` dengan akun tim (kredensial dari berkas seed, tanpa dicetak) | "Tim masuk dengan memindai kartu QR di laptop trading."; sesi tidak terbentuk |
| `/login` dengan akun display | Dialihkan ke `/display/posts`; 6 pos tampil, hitungan 3 Tersedia / 3 Tidak tersedia |
| Realtime | Pos 1 ditutup oleh penjaga: layar berubah ("Tidak tersedia", hitungan 2/4) ≤ 1,5 dtk tanpa muat ulang |
| Batas peran (proxy) | Display membuka `/team/market` → kembali ke `/display/posts`; tanpa sesi membuka `/display/posts` → `/login`; tim membuka `/display/posts` → `/team` |
| Menu tim | Beranda, Pasar, Order, Portofolio, Riwayat (tanpa Daftar Pos) |
| Kepadatan | Lihat di atas; `/dev/display-posts?n=…` |
| Pemeriksaan kode | `npm run build` (rute `/display`, `/display/posts`, `/login`), tsc, eslint, vitest 64 tes |

### Belum diuji

16 pos pada layar 1366×768 (tepat menimpa footer sekitar 10 px; di luar acuan 12 pos), layar dengan rasio selain 16:9 (mis. 4:3), nama pos sangat panjang (terpotong dengan elipsis), kehilangan koneksi lama pada layar display, login penjaga/admin (halaman perannya belum dibangun, jadi pengalihan setelah masuk mengarah ke 404 sampai Tahap C dan Penjaga dikerjakan).

## Tahap B — Layar display: 5 tim teratas, Display pasar, rotasi (18 Nov)

**Dibangun** (akun `display`; semua hanya baca, tanpa interaksi):
- **`/display/leaderboard`** (Figma `Layar publik — 5 tim teratas`, 1084:336): kolom badge 1–5 **tetap** (kuning, biru muda, oranye, abu, abu; warna menurut posisi) dan kartu tim yang **bergeser halus** saat urutan berubah (DOM kartu dibuat stabil menurut id tim dan posisinya lewat `translateY`, karena memindahkan simpul DOM membatalkan transisi CSS). Nama tim + Total, Saldo, Nilai aset. Dibekukan → snapshot dari server tanpa penanda apa pun; disembunyikan (`leaderboard_hidden`) → layar tunggu bertema "Segera dibuka". Tanpa ticker berita, status pasar, atau lencana beku. Versi pembaca layar berurutan menurut peringkat. Polling 5 dtk.
- **`/display/market`** (Figma `Layar publik — Display pasar`, 1123:612): bilah atas (status pasar + jam WIB), **IKC** dengan chip ▲/▼ dan grafik garis, indeks sektor (jumlah sektor mengikuti data), **Terbaik/Terlemah** (maks 4), **Berita terbaru** (teks biasa, 2 baris), **Transaksi terakhir**. Tanpa saldo tim dan tanpa order book (docs/12 §9). Polling 5 dtk.
- **`/display`**: rotasi 5 tim teratas (20 dtk) → Display pasar (20 dtk) → Daftar Pos (15 dtk); ketiganya tetap terpasang (grafik IKC dan data tidak hilang) dan yang tidak tampil disembunyikan dari teknologi bantu (`inert`). `?screen=leaderboard|market|posts` menahan satu layar.
- **`ScaledStage`**: panggung 1920×1080 yang diskalakan pas di layar mana pun (1280×720 sampai 1080p), dipusatkan; layar peringkat dan pasar memakai persis tata letak Figma.
- Berkas: `lib/display/{data,view,ikc}.ts` (+ tes, 14 + 7), `components/display/{scaled-stage,leaderboard-screen,market-screen,display-rotator}.tsx`, `app/display/{page,leaderboard,market}`; `.board-card` di `globals.css`.

| # | Deviasi / keputusan | Alasan | Perlu update dokumen? |
|---|---|---|---|
| 1 | **Grafik IKC dicuplik oleh layar itu sendiri** (tiap ≥ 15 dtk dari `get_market_index()`), disimpan di localStorage perangkat (maks 8 jam / 2.000 titik) dan bertahan saat dimuat ulang; grafik mulai dari saat layar pertama menyala | Skema tidak menyimpan riwayat IKC (IKC memakai harga transaksi terakhir; `price_history` hanya mencatat harga acuan oleh berita; `trades` tidak terbaca akun display). **Keputusan terbuka:** riwayat IKC di server butuh migrasi (mis. tabel `index_history` + `pg_cron`) | docs/07 §2.4, docs/12 §9 |
| 2 | Tab rentang (Hari ini / Hari 1 / Hari 2 / Semua) diganti keterangan "Grafik sejak 08:16" | Layar publik tanpa interaksi; skema tidak punya konsep hari | Figma 1123:633 |
| 3 | "Transaksi terakhir" = harga dan jam transaksi terakhir **per aset** (`assets.last_price`, `last_trade_at`), **tanpa jumlah lot** | Akun display tidak bisa membaca `trades`; tidak ada RPC untuk itu. Menampilkan lot butuh RPC baru (perubahan kontrak: perlu persetujuan) | Figma 1123:780 |
| 4 | "Terbaik/Terlemah **hari ini**" → "Terbaik"/"Terlemah" (perubahan harga terakhir terhadap harga **acuan**, sama dengan chip di Pasar); hanya aset yang bergerak; 4 baris (Figma 4, docs/07 §12 menyebut 5) | Tidak ada konsep hari; mengikuti Figma | docs/12 §9 |
| 5 | Pil status "PASAR BUKA · HARI 2" → "PASAR BUKA / DIJEDA / BELUM DIBUKA / PERMAINAN SELESAI" (tanpa hari) | Tidak ada konsep hari | Figma 1123:621 |
| 6 | Radius kartu 10 (panel), baris 14, tile/badge 8; Figma memakai 24/28 | Skala radius implementasi (sama dengan halaman tim) | Figma 1084, 1123 |
| 7 | Angka rupiah di papan peringkat tanpa "Rp" (seperti Figma) + keterangan "Angka dalam rupiah" di sudut; angka ≥ 11 karakter dikecilkan agar muat | Lebar kolom Figma | — |
| 8 | Judul indeks sektor boleh membungkus dua baris (mis. "Konsumen dan Kesehatan") | Nama sektor data uji lebih panjang dari Figma; 6 sektor (Figma 5), 30 aset (Figma 25) | Figma |
| 9 | Layar publik menampilkan **saldo dan nilai aset tiap tim** (seperti docs/07 §2.4 mengakui); akun display harus dipegang panitia | Sesuai spesifikasi; mengingatkan risiko | — |
| 10 | `/display` lama (pengalihan sementara ke `/display/posts`) diganti rotasi | Tahap B | — |

### Data uji di staging (saya tulis)

Hadiah dari akun penjaga seed `guard1` untuk menggerakkan peringkat: Rp 300.000 (Elang), Rp 300.000 (Harimau), Rp 400.000 (Elang), Rp 500.000 (Harimau), dan Rp 20.000.000 (Cendrawasih, untuk uji beku) yang **dikoreksi −Rp 20.000.000** lewat `admin_adjust_cash` (tercatat di audit). Leaderboard disembunyikan lalu ditampilkan kembali, dibekukan lalu dilepas; keadaan akhir `leaderboard_visible = true`, tidak beku.

### Diuji (akun display nyata, staging)

| Skenario | Hasil |
|---|---|
| 5 tim teratas pada 1920×1080 | Tata letak sama dengan Figma; nama dan angka benar; badge tetap |
| Urutan berubah (hadiah ke tim di peringkat 2 melewati peringkat 1) | Kartu bertukar tempat dalam polling ≤ 5 dtk; `translateY` terukur bergerak mulus (176→124→71→38→20→…→0 selama 0,7 dtk); badge tidak bergerak; urutan DOM tidak berubah |
| Disembunyikan (`admin_set_leaderboard_visible(false)`) | Layar tunggu "Segera dibuka"; setelah ditampilkan kembali papan pulih tanpa muat ulang |
| Dibekukan (`admin_freeze_leaderboard`) | Hadiah Rp 20 juta untuk tim lain **tidak** mengubah layar; sesudah dilepas langsung naik ke peringkat 1 |
| Display pasar | IKC 1.075,3 ▲ +7,5 % · +75,3; 6 sektor dengan chip; terbaik/terlemah; berita; 3 transaksi terakhir; pada 1920×1080 dan 1366×768 (skala) tanpa gulir; grafik tidak melewati tepi kartu |
| Rotasi `/display` | 0 dtk peringkat → 21 dtk pasar → 42 dtk Daftar Pos; `?screen=market` menahan satu layar |
| Pemeriksaan kode | `npm run build` (rute `/display`, `/display/leaderboard`, `/display/market`), tsc, eslint, vitest 78 tes |

Catatan konsol: saat leaderboard disembunyikan, `get_leaderboard` memang menjawab 400 (`leaderboard_hidden`); peramban mencatatnya sebagai galat jaringan. Perilaku yang diharapkan.

### Belum diuji

Grafik IKC dengan banyak titik/rentang berjam-jam (hanya beberapa menit data), animasi saat tim **masuk/keluar** lima besar (kartu baru memudar masuk, yang keluar hilang tanpa animasi), kehilangan koneksi lama, layar 4:3, pergantian ke layar Daftar Pos saat pos > 12, status pasar Dijeda/Selesai pada pil (dipetakan, belum dilihat), angka ≥ 11 karakter pada papan peringkat, tampilan sungguhan di proyektor/TV. Sebagian dev: setelah mengubah `globals.css`, `next dev` tidak memuat kelas CSS baru sampai dimulai ulang (build produksi tidak terpengaruh).

## Tahap C.1 — Admin: Status game `/admin/state` (18 Nov)

**Dibangun** sesuai Figma `Admin — Status game` (1085:324) dan docs/07 §2.3, §3.7:
- **Cangkang admin** (`app/admin/layout.tsx`, `AppShell` dengan `brandSubtitle="Admin"`): sidebar 8 menu (Hadiah, Status, Aset, Berita, Tim, Pos, Audit, Ekspor), kartu akun "Panitia" dengan status koneksi (● Terhubung / Terputus) dan tombol Keluar (cabut sesi, ke `/login`). `/admin` mengalihkan ke `/admin/state`. Menu selain Status belum punya halaman (404 sampai langkah berikutnya).
- **Kartu Status game:** pil status (OPEN / PAUSED / SETUP / FINISHED, titik + teks), "Hari N · HH:MM"; tombol **Buka pasar** (setup/paused) atau **Tutup pasar** (open) dan **Akhiri game**. Tiap aksi bermakna memakai `ConfirmDialog` baru (`components/ui/confirm-dialog.tsx`; fokus awal di "Batal", tombol aksi nonaktif selama berjalan, galat database tampil di dalam dialog): Buka pasar pertama (menyebut penguncian harga/berita), Tutup pasar, Akhiri game (merah, tidak bisa dibatalkan). Melanjutkan dari paused langsung tanpa konfirmasi.
- **Kartu Leaderboard:** kotak centang "Tampilkan di layar publik" dan tombol **Bekukan sekarang / Lepas pembekuan** (dengan keterangan "Dibekukan sejak HH:MM").
- **Kartu Kumpulan berita:** HANYA tiga angka dari `get_news_pool_status()` (Siap, Boleh terbit, Terpakai) + "Sedang tayang: N" bila ada; peringatan kuning bila boleh terbit ≤ 6 dan merah bila 0 saat pasar buka. **Tidak ada** isi/urutan/hitung mundur dan tidak ada tombol untuk menjalankan, mempercepat, atau menunda siklus berita.
- Penulisan lewat server action (`app/admin/state/actions.ts`: `setGameState`, `setLeaderboardVisible`, `setLeaderboardFrozen`; Zod + sesi pengguna + RPC `admin_set_game_state`, `admin_set_leaderboard_visible`, `admin_freeze/unfreeze_leaderboard`). Status: polling 5 dtk + Realtime `game_settings`; jumlah berita 10 dtk.
- **`/login`**: server action kini mengembalikan `{ok, redirectTo}` dan klien memuat ulang penuh (sebelumnya memakai `redirect()` yang tertelan `catch` dan menampilkan "Koneksi bermasalah" palsu setelah login berhasil).
- Berkas: `lib/admin/state.ts` (+ tes, 5), `components/admin/{state-board,admin-sign-out,connection-status}.tsx`, `app/admin/{layout,page,state/page,state/actions}`.

| # | Deviasi / keputusan | Alasan | Perlu update dokumen? |
|---|---|---|---|
| 1 | "Hari N" = selisih hari kalender WIB sejak `started_at` (+1); setup → "Belum dimulai", finished → "Game selesai" | Skema tidak punya konsep hari; game berjalan hari berturut-turut (docs/07 §3.7 menggambar "hari 2, 14:05") | docs/07 §3.7 |
| 2 | Tombol "Tutup pasar" = status `paused` (bukan `finished`) | Satu-satunya jalur sah open→berhenti harian (docs/04 transisi); banner tim "Pasar dijeda" | docs/07 §3.7 (nama status) |
| 3 | Radius tombol "Akhiri game" 8 (Figma 16) dan kartu angka berita 14 (Figma 16) | Skala radius | Figma |
| 4 | Menambah keterangan di bawah kotak centang ("layar tunggu") dan status beku | Admin perlu tahu apa yang tampil di layar publik | — |
| 5 | Peringatan merah memakai teks "Tidak ada berita yang boleh terbit…" (Figma hanya punya contoh kuning) | docs/07 §3.7 mendefinisikan merah | Figma |
| 6 | `Brand` dan `AppShell` menerima subjudul ("Admin") | Figma sidebar admin | — |

### TEMUAN PENTING di staging (bukan bug aplikasi)

**Kumpulan berita habis.** Panel menunjukkan `Siap 0 · Boleh terbit 0 · Terpakai 12`: ke-12 berita contoh sudah dipakai siklus sejak pasar dibuka (siklus tiap 3–15 menit). Artinya **harga acuan sudah berhenti bergerak** di staging dan panel menampilkan peringatan merah. Untuk event sungguhan kumpulan harus ±220 berita siap sebelum dibuka; `scripts/import-news.ts` dan `news.json` (docs/08) **belum ada**. Dan karena kumpulan terkunci sejak game dibuka, berita tambahan tidak bisa dimasukkan lagi di staging ini tanpa mengatur ulang database.

### Diuji (akun admin nyata, staging)

| Skenario | Hasil |
|---|---|
| Masuk lewat `/login` dengan akun admin | Ke `/admin/state`; hanya satu `<main>` (galat login tertelan sudah hilang) |
| Tampilan | Sesuai Figma: OPEN, "Hari 2 · 08:31", Siap 0 / Boleh terbit 0 / Terpakai 12 dengan peringatan merah |
| Tutup pasar → dialog → Batal | Dialog "Tutup pasar sekarang?", fokus awal di Batal; batal tidak mengubah status |
| Akhiri game → dialog → Esc | Dialog merah muncul; **tidak dieksekusi** (tidak bisa dibatalkan di staging) |
| Tutup pasar → konfirmasi | Status PAUSED, tombol berganti menjadi Buka pasar + Akhiri game + Bekukan |
| Buka pasar (lanjutkan) | OPEN lagi tanpa dialog |
| Kotak centang leaderboard | Dimatikan: DB `leaderboard_visible=false`, keterangan layar tunggu muncul; dinyalakan lagi |
| Bekukan / Lepas pembekuan | Keterangan "Dibekukan sejak 08:34 WIB…"; tombol berganti; dilepas |
| Batas peran (proxy) | Admin ke `/team/market` → `/admin/state`; tim ke `/admin/state` → `/team`; tanpa sesi → `/login` |
| Batas peran (DB) | Akun tim, penjaga, dan display memanggil `admin_set_leaderboard_visible` dan `get_news_pool_status` → semuanya `forbidden` |
| Pemeriksaan kode | `npm run build` (rute `/admin`, `/admin/state`), tsc, eslint, vitest 83 tes |

### Belum diuji

Penolakan `news_pending` saat Akhiri game (butuh berita live, dan mengakhiri game tidak bisa dibatalkan); Buka pasar pertama dari `setup` (staging sudah pernah dibuka; hanya dialognya yang ditulis); keadaan FINISHED; peringatan kuning (boleh terbit 1–6); Realtime perubahan status dari perangkat lain pada panel; layar < 1280 px (kolom menumpuk).

## Tahap C.2–C.7 — Admin: Berita, Hadiah, Aset, Tim (+ Koreksi saldo), Pos, Audit (18 Nov)

Dikerjakan berurutan dalam satu giliran atas instruksi pengguna ("langsung lanjut semua halaman yang tersisa, halaman ekspor abaikan dulu"). **Ekspor (`/admin/export`) belum dibangun** (menu ada, halaman 404). Semua halaman memakai cangkang admin C.1, `DataTable` bersama (`components/ui/data-table.tsx`, diekstrak dari halaman Order; kini punya `align` untuk kepala kolom angka), polling dan, bila relevan, Realtime sebagai pemberitahuan.

| Halaman | Dibangun | Data / penulisan |
|---|---|---|
| **Hadiah** `/admin/payouts` (Figma 1085:576) | 100 hadiah terbaru (jam, "Tim ← Pos (Penjaga)", nominal), penanda ⚠ ">3× rata-rata pos" (baris disorot, penanda visual saja), kartu Total per pos dan Total per tim, tombol **Koreksi saldo** (memilih tim) dan nama tim pada baris membuka koreksi untuk tim itu. Tanpa persetujuan | `payouts` + `teams`/`posts`/`profiles` (RLS admin); Realtime `payouts` INSERT + polling 10 dtk |
| **Tim** `/admin/teams` (1104:660) | Peringkat langsung (lencana 1 emas, 2 biru muda, 3 oranye, 4+ abu), saldo, nilai aset (harga peringkat), total; **Koreksi saldo** (dialog) dan **Ganti QR** (dialog penjelasan) | `get_leaderboard()` (admin = data langsung) + `teams.cash`; penulisan `admin_adjust_cash` lewat server action; polling 10 dtk |
| **Koreksi saldo** (1106:378) | Dialog: saldo sekarang (saldo **bebas**), selisih bertanda, alasan wajib, pratinjau saldo sesudah (peringatan bila negatif), pesan galat di dalam dialog; tercatat di audit | `app/admin/teams/actions.ts` → `admin_adjust_cash`; Zod |
| **Aset** `/admin/assets` (1104:378) | 30 aset, pencarian kode/nama, filter sektor, kolom kode, nama, sektor, harga acuan, terakhir, rentang harga, stok bandar, status | `assets` (semua login boleh baca); polling 15 dtk |
| **Pos** `/admin/posts` (1105:379) | Chip "N Tersedia / N Tidak tersedia", tabel nomor, game, lokasi, penjaga, total hadiah, status | `posts` + `profiles` + `payouts`; Realtime `posts`/`payouts` + polling 15 dtk |
| **Audit** `/admin/audit` (1105:653) | 100 kejadian terakhir, chip filter (Semua, Hadiah, Koreksi saldo, Status game, Pos, Berita, Perangkat), pil aksi, pelaku, ringkasan Indonesia dari payload; hanya baca | `audit_log` (RLS admin); polling 15 dtk |
| **Berita** `/admin/news` (1085:444) | Dua wajah menurut `started_at`. **Terkunci** (kondisi staging): "Berita saat ini" (`news_feed`, teks biasa) + kartu "Kumpulan berita terkunci: Siap · terpakai · sedang tayang" dari `get_news_pool_status()`; tanpa isi/urutan/hitung mundur/tombol peluncur. **Persiapan** (sebelum dibuka): daftar berita dengan jumlah aset terkena dan tombol Tandai siap / Keluarkan | `news_feed`, `get_news_pool_status`, `news`/`news_effects` (hanya sebelum dibuka), `admin_set_news_ready` |

Berkas baru: `lib/admin/{data,audit,payouts}.ts` (+ tes audit 5 dan payouts 5), `lib/schemas/admin.ts`, `components/admin/{payouts,teams,assets,posts,audit,news}-board.tsx`, `correction-dialog.tsx`, `list-skeleton.tsx`, `components/ui/data-table.tsx`, `app/admin/{payouts,teams,assets,posts,audit,news}/page.tsx`, `app/admin/{teams,news}/actions.ts`.

### Deviasi dan keputusan

| # | Deviasi / keputusan | Alasan | Perlu update dokumen? |
|---|---|---|---|
| 1 | **Aset: tanpa "Tambah aset" dan "Ubah"; Pos: tanpa "Buka/Tutup".** Halaman hanya tampilan | Fungsi `admin_upsert_asset`, `admin_set_stock`, `admin_set_post_open`, `admin_upsert_post`, `admin_set_news_settings` **belum ada di database** (docs/04 §3.9 "spesifikasi saja"; hanya `admin_adjust_cash`, `admin_rotate_team_qr`, `admin_save_news`, `admin_set_news_ready`, `admin_set_game_state`, `admin_set/freeze/unfreeze_leaderboard`, `guard_set_post_open` yang ada). Tombol yang pasti gagal tidak dibuat; keterangan di tiap halaman menyebut sebabnya. **Perlu migrasi: butuh persetujuan** | docs/07 §2.3 |
| 2 | **Ganti QR tidak memanggil `admin_rotate_team_qr`**, hanya menjelaskan langkahnya | Fungsi itu hanya mengganti `qr_token`; kata sandi akun tim (= qr_token) hanya bisa diganti dengan service role. Dipanggil langsung, kartu baru tidak bisa masuk dan kartu lama pun tidak berlaku sebagai kunci yang konsisten. `scripts/rotate-team-qr.ts` (docs/08) **belum ada** | docs/07 §2.3, docs/08 |
| 3 | Penanda ⚠ hadiah hanya bila pos itu punya ≥ 3 hadiah (rata-rata dari semua hadiah pos tersebut) | Dengan 1–2 hadiah, "3× rata-rata" tidak bermakna dan menandai hampir semuanya | docs/07 §3.5 |
| 4 | Filter audit: Semua, Hadiah, Koreksi saldo, **Status game, Pos, Berita, Perangkat** (Figma: Hadiah, Koreksi saldo, **Harga**, Status game, Pos) | Aksi yang nyata ditulis database tidak mencakup `set_price`/`set_post_open`; ada `kiosk_*`, `save_news`, `leaderboard_visible`, `freeze_*`, `guard_set_post_open`. Pil aksi memakai nama aksi sebenarnya (mis. `guard_set_post_open`, `rotate_qr`) | Figma 1105:653 |
| 5 | Tim: kolom "Nilai aset (harga **peringkat**)" (Figma: harga beli); "Saldo" = saldo bebas + terkunci dari `get_leaderboard()`, sedangkan dialog koreksi memakai saldo **bebas** (`teams.cash`) | Aturan 17 Nov; `admin_adjust_cash` mengubah `cash` bebas | Figma 1104:660 |
| 6 | Aset: kolom "Harga acuan" dan "Terakhir" (Figma satu "Harga"); stok = persediaan bandar; 30 aset tampil semua, bukan "8 teratas" | Aturan dua harga; keputusan 30 aset | Figma |
| 7 | Hadiah: nama penjaga dari `profiles.display_name` (data uji: "Penjaga Pos N") | Skema | — |
| 8 | Radius mengikuti skala (kartu 10, baris 14, tombol 8) | Aturan | Figma |

### Diuji (akun admin nyata, staging, 1440 px)

| Skenario | Hasil |
|---|---|
| Semua enam halaman dibuka dengan data nyata | Render tanpa galat konsol; angka cocok (mis. hadiah Cendrawasih Rp 20.000.000 ditandai ⚠ "3× rata-rata pos"; Total per pos Rp 21.575.000; 5 tim; 30 aset; 6 pos 3/3) |
| Koreksi saldo: tanpa alasan | "Alasan wajib diisi (minimal 3 huruf)." (dicegah di klien) |
| Koreksi saldo: −5.000 pada saldo 0 | Pratinjau "−Rp 5.000"; database menolak → "Saldo bebas tim tidak cukup untuk pengurangan ini." (dialog tetap terbuka) |
| Koreksi saldo: +10.000, lalu −10.000 | Dialog menutup, toast "Koreksi saldo tersimpan.", baris Tim berubah (Rp 10.000 lalu Rp 0); kedua koreksi tercatat di Audit dengan nama admin dan alasan |
| Koreksi dari Hadiah (tanpa tim terpilih) | Dropdown 5 tim; "Simpan koreksi" nonaktif sampai tim dipilih |
| Ganti QR | Dialog penjelasan; tidak ada panggilan database |
| Aset: cari "bca"; filter sektor Energi | 1 baris (BCA); 5 dari 30 aset |
| Audit: filter Koreksi saldo | Tiga koreksi (dua uji hari ini + koreksi −Rp 20 juta) dengan ringkasan dan alasan |
| Berita (terkunci) | "Berita saat ini" + "Siap 0 · terpakai 12 · sedang tayang 0" |
| Batas peran | `/admin/*` hanya admin (proxy C.1); DB: tabel `audit_log`, `news`, `teams` dibaca admin saja (RLS) |
| Pemeriksaan kode | `npm run build` (semua rute `/admin/*` kecuali Ekspor), tsc, eslint, vitest 92 tes |

### Data uji di staging (saya tulis)

Dua koreksi saldo pada Tim Cendrawasih (+Rp 10.000, −Rp 10.000; saldo akhir Rp 0), keduanya di audit.

### Belum diuji

Berita mode **persiapan** (tabel `news` baru terbaca admin sebelum game dibuka; staging sudah dibuka, jadi daftar draf dan tombol Tandai siap/Keluarkan hanya terkompilasi); koreksi saldo dengan nilai besar/format aneh selain input biasa; filter audit selain Koreksi saldo; Realtime halaman Hadiah/Pos dari perangkat lain; layar < 1280 px (tabel menggulir mendatar); Ekspor.

## SQL fungsi admin yang belum ada (18 Nov)

`scripts/sql/admin-functions-missing.sql` menulis lima fungsi dari docs/04 §3.9 yang belum ada di database: `admin_set_stock(asset, stock, reason)`, `admin_set_post_open(post, open)`, `admin_upsert_asset(...)`, `admin_upsert_post(post, name, location, guard)`, dan `admin_set_news_settings(...)`. **Belum diterapkan**: pengguna yang menjalankannya di SQL Editor (kueri pemeriksaan di akhir file harus mengembalikan lima baris, `anon_exec = false`, `auth_exec = true`).

Aturan yang dipakai (dibaca dari definisi di staging, bukan hanya dokumen): peran admin dicek di awal; `ob_lock()` lebih dulu bila menyentuh stok/aset; **setiap UPDATE ber-WHERE** (pelajaran pg_safeupdate); semua perubahan ditulis ke `audit_log` (`set_stock`, `set_post_open`, `upsert_asset`, `upsert_post`, `set_news_settings`); harga, rentang, status aktif, tambah aset, dan pengaturan berita dicek `game_is_locked()` lebih dulu (galat jelas `game_started_locked`, sebelum trigger `guard_game_lock` menolak); stok dan pos boleh diubah kapan saja (stok tidak termasuk kolom yang dikunci trigger `assets_price_lock`); `admin_set_post_open` menolak saat `finished` seperti `guard_set_post_open`. Kode galat baru: `post_not_found`, `symbol_taken`, `guard_invalid` (sudah dipetakan di `lib/errors.ts`).

Catatan perilaku: `admin_set_stock` mengubah persediaan bandar tanpa mengubah `init_stock`, sehingga "stok + Σ holdings = stok awal" tidak lagi berlaku untuk aset itu (koreksi panitia, sesuai spesifikasi).

**Diverifikasi:** kelima `CREATE FUNCTION` dijalankan di staging di dalam blok `DO` yang sengaja ditutup dengan `RAISE EXCEPTION` (otomatis dibatalkan): semuanya lolos pengurai dan pemeriksa badan fungsi; sesudahnya `pg_proc` terbukti kosong untuk kelima nama itu (tidak ada yang terpasang). **Belum diuji:** perilaku saat dipanggil (butuh dipasang dulu).

`lib/admin/audit.ts` sudah mengenali aksi baru itu (kategori Pos/Aset/Berita, ringkasan Indonesia, filter "Aset"; tes ditambah). Tombol di halaman Aset dan Pos **belum** dipasang: menunggu SQL diterapkan.

## Tombol Aset dan Pos (18 Nov)

SQL `scripts/sql/admin-functions-missing.sql` sudah diterapkan pengguna (lima fungsi ada, `authenticated` bisa menjalankan, `anon` tidak). Tombol dipasang:

- **Aset**: "Tambah aset" di header dan "Ubah" per baris (`components/admin/asset-dialog.tsx`; aksi `app/admin/assets/actions.ts`, Zod di `lib/schemas/admin.ts`).
  - Sebelum game dibuka: formulir penuh (kode, nama, sektor dengan saran sektor yang ada, harga acuan, min, maks, stok, aktif) lewat `admin_upsert_asset`; kode huruf besar 2–8, min ≤ harga acuan ≤ maks dicek di klien (database tetap pemutus).
  - Sesudah game dibuka (`started_at` terisi): "Tambah aset" disembunyikan; "Ubah" hanya stok + alasan wajib lewat `admin_set_stock`, dengan catatan bahwa harga/rentang/status terkunci.
- **Pos**: tombol Buka/Tutup per baris lewat `admin_set_post_open`; nonaktif saat game `finished`; toast dan refresh.
- `lib/errors.ts`: pesan `game_started_locked` disebut juga daftar aset.

### Deviasi dari Figma

| # | Deviasi | Alasan |
|---|---|---|
| 1 | Header halaman Aset dipindah ke komponen klien (supaya tombol "Tambah aset" tahu status terkunci) | Pola yang sama dengan Hadiah |
| 2 | Kolom aksi tambahan di tabel Aset dan Pos; dialog Aset tidak ada di Figma | Figma belum punya desain dialog; memakai pola dialog koreksi saldo |

### Diuji (admin nyata, staging, 1440 px)

| Skenario | Hasil |
|---|---|
| Aset: ubah stok tanpa alasan | "Alasan wajib diisi (minimal 3 huruf)." |
| Aset AD: stok 36 → 37 → 36 dengan alasan | Tabel berubah, dialog menutup; dua baris `set_stock` di Audit (sebelum/sesudah, alasan) |
| Pos 1: Tutup lalu Buka | Status berganti, toast "Lempar Bola ditutup."; dua baris `set_post_open` di Audit; keadaan akhir sama seperti awal |
| `admin_upsert_asset` saat game sudah dimulai (peran admin, blok DO yang dibatalkan) | `game_started_locked` (terpetakan di `lib/errors.ts`) |
| Pemeriksaan kode | tsc, eslint, vitest 93 tes, `npm run build` |

### Belum diuji / belum dipasang

Formulir penuh Aset (tambah/ubah harga) karena staging sudah dimulai; perilaku `admin_upsert_asset` saat game belum dimulai. Tidak ada tombol untuk `admin_upsert_post` (tambah/ubah pos) dan `admin_set_news_settings` (pengaturan berita): Figma tidak punya desainnya. Data uji: stok AD dan status Pos 1 dikembalikan; keempat aksi ada di Audit.

## Event "aset bangkrut" (18 Nov)

Permintaan pengguna: event seperti aset AP (Apple) bangkrut. Efek berita biasa tidak bisa (maks. ±15 %, harga dijepit di minimum, `price > 0`, `is_active` terkunci setelah game dibuka), jadi ditulis `scripts/sql/event-bankruptcy.sql`. **Belum diterapkan**: pengguna yang menjalankannya di SQL Editor (kueri pemeriksaan di akhir file).

Keputusan pengguna: unit yang dipegang tim **dilikuidasi ke uang pada 10 % harga acuan** (parameter per berita, `liquidation_bps` 0–5000; 0 = unit tidak bernilai).

Isi: kolom `assets.bankrupt_at` dan `assets.liquidation_price`; tabel `news_bankruptcies` (satu aset per berita, satu berita per aset; RLS admin-saja sebelum game dibuka; trigger penguncian game); `check_news_effects` memeriksa aset bangkrut (harus aktif, bukan juga aset berefek harga di berita yang sama); `admin_set_news_bankruptcy(berita, aset, bps)` (pasang/lepas; mengembalikan jumlah berita lain yang masih menyebut aset itu); `bankrupt_asset` (internal: batalkan semua order antre termasuk bandar, kembalikan kunci, likuidasi holdings ke kas, nonaktifkan aset, `price_history` + `audit_log`); trigger `news_bankruptcy_apply` pada `news` saat status menjadi `applied`. **`process_news_cycle` tidak diubah**; galat likuidasi ditangkap (`asset_bankrupt_failed`) supaya siklus berita tidak macet.

Aplikasi: `lib/admin/audit.ts` (+tes) mengenali `asset_bankrupt`, `asset_bankrupt_failed`, `set_news_bankruptcy`; `lib/errors.ts`: `bankruptcy_exists`.

### Diverifikasi (staging, dalam transaksi yang dibatalkan)

Seluruh skrip + blok uji dijalankan lalu `RAISE EXCEPTION` (tidak ada yang tersimpan; sesudahnya kolom, tabel, fungsi tidak ada dan AP tetap aktif). Hasil uji dengan data staging: `check_news_effects` lolos; pemasangan ganda ke aset yang sama → `bankruptcy_exists`; bps 6000 → `invalid_input`; aset yang juga punya efek harga di berita itu → `news_invalid_effects`; berita diterapkan (draft → ready → live → applied) → AP nonaktif, `bankrupt_at` terisi, harga likuidasi Rp 72.300 (10 % × 723.400, dibulatkan ke Rp 100), 12 order antre dibatalkan (2 tim + 10 bandar), holdings AP 0, kas tim naik tepat Rp 918.650 (701.750 kunci kembali + 3 × 72.300), `locked_cash` kembali 0, `audit_log` memuat daftar tim dan uang.

### Belum diuji / belum dibuat

- Staging sudah dimulai (berita terkunci) sehingga alur penuh lewat `process_news_cycle` dan `admin_set_news_bankruptcy` dengan game belum dimulai hanya diuji lewat blok simulasi di atas; uji ulang di database/reset bersih.
- Cabang `game_started_locked` pada `admin_set_news_bankruptcy` tidak teruji langsung (uji memanggilnya tanpa peran admin: `forbidden`).
- **UI belum ada**: tombol/dialog "Aset bangkrut" di halaman Berita (persiapan), label "Bangkrut" di Pasar dan Riwayat, peringatan bila aset yang bangkrut masih disebut di berita lain, dan penanganan aset terpilih yang hilang dari daftar Pasar saat polling. `database.types.ts` perlu dibuat ulang setelah SQL diterapkan.
- Efek samping yang disengaja: IKC dan indeks sektor tidak lagi menghitung aset itu (lompatan nilai); jumlah uang beredar bertambah sebesar likuidasi; berita lain yang menyebut aset bangkrut gagal terbit dan kembali ke draf (`news_launch_failed`).

### UI event aset bangkrut (18 Nov)

SQL `event-bankruptcy.sql` sudah diterapkan pengguna (diperiksa: dua kolom, tabel, tiga fungsi, trigger; `admin_set_news_bankruptcy` bisa dieksekusi `authenticated`, tidak oleh `anon`; fungsi internal tidak oleh siapa pun). UI dipasang:

- **Admin, Berita (persiapan)**: tombol "Aset bangkrut" per berita draf membuka dialog (aset aktif, penggantian unit 0–50 % harga acuan, bawaan 10 %, tombol Lepas bila sudah dipasang); baris berita menampilkan "Bangkrut: AP (Apple) · unit diganti 10 % harga acuan". Dinonaktifkan untuk berita berstatus siap (keluarkan dulu). Peringatan toast bila berita lain masih punya efek harga pada aset itu (berita itu akan gagal terbit). Aksi `setNewsBankruptcy` (`app/admin/news/actions.ts`), skema Zod `setNewsBankruptcySchema`, `fetchNewsPage` memuat `news_bankruptcies` dan daftar aset aktif.
- **Tim, Pasar**: kartu merah "Bangkrut" di atas papan untuk tiap aset bangkrut (`assets.bankrupt_at`), berisi uang pengganti per unit dan keterangan order dibatalkan. Bila aset yang sedang dilihat hilang dari daftar (bangkrut), papan berpindah ke aset pertama dan berhenti meminta antreannya (sebelumnya polling bisa terus gagal). `lib/market/data.ts`: `fetchBankruptAssets`.
- `lib/supabase/database.types.ts` ditambah kolom, tabel, dan fungsi baru (ditambal manual).

Deviasi: tidak ada di Figma (kartu, dialog, label); memakai pola banner Pasar dan dialog koreksi/aset.

### Diuji

| Skenario | Hasil |
|---|---|
| Dialog (halaman uji sementara, dihapus): simpan tanpa aset; persen 80 | "Pilih aset yang bangkrut."; "Likuidasi 0–50 % dari harga acuan (bilangan bulat)." |
| Simpan sungguhan ke RPC (admin, staging sudah dimulai) | "Game sudah dimulai. Harga, daftar aset, dan berita tidak bisa diubah lagi." (galat terpetakan) |
| Tombol pada berita "siap" | Nonaktif; baris yang sudah bangkrut punya tombol Lepas |
| RLS `news_bankruptcies` (transaksi dibatalkan) | Admin sebelum game dibuka: terbaca; tim: 0 baris; admin sesudah dibuka: 0 baris; INSERT dari klien: ditolak |
| Pasar tim (akun nyata, 1440 px) dengan respons ditiru: AP hilang dari daftar + dilaporkan bangkrut, AP sedang dipilih | Kartu "Bangkrut" tampil dengan Rp 72.300; pilihan pindah ke Adaro; daftar 29 aset; tanpa pesan "Data belum bisa diperbarui" |
| Pemeriksaan kode | tsc, eslint, prettier, vitest 94 tes. **`npm run build` tidak dijalankan**: server dev milik pengguna sedang jalan di port 3000 (build bersamaan merusak `.next`) |

### Belum diuji

Pemasangan dan pelepasan sungguhan lewat UI (butuh game belum dimulai); alur penuh berita bangkrut lewat `process_news_cycle` di UI; layar Display dan Portofolio setelah bangkrut (Portofolio tidak menampilkan aset berkepemilikan 0, tidak dicoba); label "Bangkrut" di Riwayat/Order (nama aset memakai `assets` tanpa filter aktif, jadi tetap tampil).

## Ganti password akun admin dan display (18 Nov)

Atas permintaan pengguna, kata sandi akun `admin` dan `display` di staging diganti menjadi yang diminta (`UPDATE auth.users … crypt(…, gen_salt('bf'))` lewat SQL; hash bcrypt, bukan service_role). Login kedua akun diuji lewat formulir `/login` (admin ke `/admin/state`, display ke `/display`). `scripts/.seed-output.local.json` (tidak di-commit) ikut diperbarui; `seed-dev.ts` memakai kata sandi dari berkas itu untuk akun yang sudah ada, jadi menjalankan ulang seed tidak mengembalikannya. Catatan keamanan: kata sandi pendek dan mudah ditebak untuk akun admin pada proyek Supabase yang terbuka ke internet; ganti sebelum acara bila datanya sungguhan.

## Event dividen dan suspensi (18 Nov)

`scripts/sql/event-dividend-suspend.sql` (jalankan SESUDAH `event-bankruptcy.sql`). **Belum diterapkan.**

- **Dividen**: saat efek berita berlaku, tiap tim yang memegang aset menerima unit × (harga acuan × bps / 10000, 0,1–10 %, minimal Rp 1). Uang dari panitia. Dicatat di tabel baru `dividends` (tim membaca barisnya sendiri, admin semuanya) dan `audit_log`. Harga tidak dipotong.
- **Suspensi**: aset tidak bisa diorder N menit (1–30); bandar menarik kuotasi; order antre tim boleh dibatalkan; dibuka kembali otomatis oleh `process_market_cycle` (cron 10 detik yang sudah ada; waktu suspensi mutlak, jadi berjalan juga saat pasar dijeda).
- Event menempel pada berita lewat tabel `news_events` (jenis, aset, nilai) dan `admin_set_news_event(berita, aset, jenis, nilai)` (nilai null = lepas); satu berita boleh membawa beberapa event; aset tidak boleh membawa event sekaligus bangkrut di berita yang sama.
- Aman: `process_news_cycle` dan `place_order` TIDAK diubah (event dijalankan trigger pada `news`; penolakan order oleh trigger pada `orders`). Diubah dengan badan lama + satu tambahan: `check_news_effects`, `process_house_quotes` (melewati aset yang disuspensi), `process_market_cycle` (memanggil `process_suspensions`). Galat event ditangkap (`asset_event_failed`), siklus berita tidak macet.
- Aplikasi: pesan galat `asset_suspended` (`lib/errors.ts`); label Audit untuk `set_news_event`, `asset_dividend`, `asset_suspended`, `asset_resumed`, `asset_event_failed` (+tes). **UI belum dibuat** (dialog event pada Berita admin, label Suspensi di Pasar dan penonaktifan form order, daftar dividen di Riwayat/Portofolio); `database.types.ts` perlu dibuat ulang setelah SQL diterapkan.

### Diverifikasi (staging, transaksi dibatalkan)

Seluruh skrip + blok uji dijalankan lalu `RAISE EXCEPTION`; sesudahnya kolom, tabel, fungsi, trigger tidak ada dan `process_market_cycle` tidak berubah. Hasil: `check_news_effects` lolos; bps 5 / menit 99 / jenis salah → `invalid_input`; pasang dua kali pada aset+jenis yang sama = satu baris (upsert), lepas (`null`) = 0 baris; berita diterapkan (draft → ready → live → applied): dividen AP 5 % pada 3 unit = Rp 108.510 (36.170 per unit; harga acuan 723.400) masuk kas tim, satu baris `dividends`; AD tersuspensi (`suspended_until` di masa depan), 10 order bandar AD ditarik; `place_order` tim pada AD → `asset_suspended`; setelah `suspended_until` dimundurkan, `process_market_cycle` membuka lagi AD (`suspended_until` null, 10 order bandar baru, audit `asset_resumed`, tanpa `asset_event_failed`).

### Belum diuji

Alur lewat `process_news_cycle` sungguhan (staging terkunci; diuji lewat simulasi), `admin_set_news_event` pada cabang `game_started_locked` (dipanggil di bawah peran admin dengan `started_at` dibuat null dalam transaksi), cron nyata menutup suspensi, dividen untuk tim dengan unit terkunci di order jual (qty total dihitung), dan seluruh UI.

### UI event dividen dan suspensi (18 Nov)

SQL `event-dividend-suspend.sql` sudah diterapkan pengguna (diperiksa: kolom `suspended_until`, tabel `news_events` dan `dividends`, enam fungsi, dua trigger, `process_market_cycle` dan `process_house_quotes` sudah berisi perubahan; `admin_set_news_event` bisa dieksekusi `authenticated`, bukan `anon`; fungsi internal tidak). UI dipasang:

- **Admin, Berita (persiapan)**: tombol "Event aset" per berita draf (menggantikan "Aset bangkrut") membuka dialog gabungan `components/admin/news-event-dialog.tsx`: daftar event terpasang (masing-masing tombol Lepas) + form jenis (Bangkrut / Dividen / Suspensi), aset aktif, dan nilai (bangkrut 0–50 %; dividen 1–10 % harga acuan; suspensi 1–30 menit; bawaan 10 % / 2 % / 5 menit). Dividen dikirim sebagai bps (persen × 100). Baris berita menampilkan semua event. Aksi `setNewsEvent` (`app/admin/news/actions.ts`), skema `setNewsEventSchema`, `fetchNewsPage` memuat `news_events`.
- **Tim, Pasar**: banner kuning "Suspensi" dengan hitung mundur per detik (`components/market/suspend-notice.tsx`), chip "Suspensi" di daftar aset menggantikan chip perubahan harga, dan form order dinonaktifkan (tombol "Aset disuspensi"; pesan di bawah form). `MarketAsset.suspendedUntil`, `isSuspended()`; jam berjalan dari `nowMs` server lalu jam peramban. Galat `asset_suspended` dari database menyegarkan papan.
- **Tim, Riwayat**: dividen tampil sebagai baris "Dividen {aset}" (+uang) bersama transaksi dan hadiah, dengan rincian (unit, dividen per unit, total). `fetchHistory` membaca `dividends` milik tim; `buildHistory` menerima daftar dividen (tes ditambah).
- `lib/supabase/database.types.ts` ditambah (kolom, dua tabel, fungsi) secara manual. `PANDUAN-TRADING.md` ditambah bagian "Event khusus" dan istilahnya di kamus.

Deviasi: tidak ada di Figma (banner, chip, dialog, baris dividen); memakai pola banner Pasar, chip, dan dialog yang sudah ada. Tombol "Aset bangkrut" digabung ke "Event aset".

### Diuji

| Skenario | Hasil |
|---|---|
| Dialog event (halaman uji sementara, dihapus): daftar event terpasang; simpan tanpa aset; dividen 50 % | "Pilih aset."; "Dividen per unit (% dari harga acuan): isi 1–10."; tampilan dialog sesuai |
| Pasang suspensi, lepas event, pasang bangkrut ke RPC sungguhan (admin, staging sudah dimulai) | Ketiganya sampai ke database dan dijawab "Game sudah dimulai. Harga, daftar aset, dan berita tidak bisa diubah lagi." |
| Pasar tim (akun nyata, 1440 px) dengan respons `assets` ditiru: Adaro disuspensi 5 menit | Banner "Suspensi … sampai 13:43 WIB (5:11 lagi)" menghitung mundur, chip "Suspensi" di daftar, tombol "Aset disuspensi" nonaktif, tanpa pesan "Data belum bisa diperbarui" |
| Riwayat tim dengan respons `dividends` ditiru (3 unit × Rp 36.170) | Baris "Dividen Apple, + Rp 108.510" dan dialog rincian benar; query `dividends` sungguhan (tanpa tiruan) berhasil dimuat |
| Pemeriksaan kode | tsc, eslint, vitest 96 tes, `npm run build` |

Catatan pengujian: server dev perlu dimulai ulang setelah menambah aksi server baru (modul aksi lama menghasilkan 500 "reading 'apply'"); setelah restart normal. Folder `.next/dev` dihapus karena menyimpan tipe halaman uji yang sudah dihapus.

### Belum diuji

Pemasangan/pelepasan event sungguhan lewat UI (butuh game belum dimulai); alur penuh berita beserta event lewat `process_news_cycle` dan pembukaan aset oleh cron; penolakan order sungguhan oleh database pada aset yang disuspensi (UI lebih dulu menonaktifkan form; uji database ada di bagian SQL); layar Display (tidak menandai suspensi) dan Portofolio.

## Tahap Penjaga: Pindai Hadiah (18 Nov)

**Dibangun** sesuai Figma `Penjaga — Siap pindai` (1084:412), `… (form nominal muncul)` (1096:483), `Penjaga — Toast sukses dan gagal` (1084:455) dan docs/07 §0.1, §2.2, §3.4 (mobile-first, 390 px). Menu penjaga hanya **Pindai**; tidak ada daftar tim, kode cadangan, riwayat hadiah, tombol nominal, atau catatan.

- **Rute**: `/guard` → `/guard/scan` (`app/guard/{layout,page,scan/page}.tsx`). Peran dicek di proxy dan di database.
- **Cangkang** (`components/guard/guard-shell.tsx`, `components/ui/sheet.tsx`): bilah atas tetap dengan tombol menu (☰) + logo; laci dari kiri berisi menu Pindai dan kartu akun dengan Keluar (memakai `AdminSignOut`).
- **Halaman** (`components/guard/scan-board.tsx`): eyebrow "POS n", judul "Pindai Hadiah", baris nama pos + **saklar** buka/tutup (`post-toggle.tsx`: hijau/bulatan kanan = tersedia, merah/bulatan kiri = tutup, `role=switch` dengan `aria-label`, konfirmasi satu ketukan "Tutup pos sementara?" / "Buka pos?", nonaktif saat game selesai), pratinjau kamera belakang dengan bingkai sudut, pesan galat kartu.
- **Form nominal** (`payout-sheet.tsx`): lembar dari bawah dengan "TIM TERBACA", nama tim, kartu **saldo tim** (dibaca sekali dari `resolve_team_qr`, tidak memengaruhi nominal), kolom nominal (hanya digit, nol di depan dibuang), "Kirim Rp …", "Batal". Kirim menutup form seketika dan kamera siap lagi.
- **Antrean hadiah lokal** (`lib/guard/{queue,use-payout-queue}.ts`, tes): `request_id` dibuat saat form muncul dan dipakai ulang pada tiap percobaan; jaringan putus → ulang otomatis (jeda 2/4/8/15/30 dtk, maks. 5); galat tetap (pos ditutup, game tidak aktif, dst.) → langsung gagal. Disimpan di `localStorage` (hanya id tim, nama, nominal, `request_id`; **tanpa rahasia kartu**) sehingga muat ulang tidak menghilangkan hadiah; peringatan sebelum menutup halaman bila masih ada yang terkirim.
- **Hasil** (`payout-notices.tsx`): kartu hijau "Rp 300.000 terkirim ke Tim Cakra" hilang sendiri (8 dtk); kartu merah "Gagal: pos ditutup. Hadiah Rp … untuk Tim … belum terkirim." **tetap tampil** dengan "Kirim ulang" dan "Tutup"; kartu netral "Mengirim…" saat berjalan.
- **Aksi server** (`app/guard/actions.ts`, Zod di `lib/schemas/guard.ts`): `resolveTeam` (hanya bagian token QR yang dikirim; tidak dicatat), `awardPayout`, `setMyPostOpen`. Banner untuk game `setup`/`finished`; polling 15 dtk untuk pos dan status game.
- Mode uji tanpa kamera (seret/tempel gambar QR, `DevQrDrop`) dipakai ulang di halaman ini, hanya di luar produksi.

### Deviasi dari Figma/dokumen

| # | Deviasi | Alasan |
|---|---|---|
| 1 | Radius kartu kamera/lembar mengikuti skala implementasi (panel 10), bukan ±24 px Figma; lembar bawah memakai radius atas 24 | Aturan radius proyek |
| 2 | Bingkai pemindai dibuat dari empat sudut CSS, bukan aset gambar | Tanpa aset |
| 3 | Kartu "Mengirim…" dan petunjuk "Pos tutup: hadiah belum bisa dikirim." di bawah nama pos | Tidak ada di Figma; mencegah penjaga mengira hadiah terkirim padahal pos tutup. Pindai tetap diizinkan saat pos tutup (database yang menolak) |
| 4 | Banner "Game belum dimulai"/"Game sudah selesai" | Hadiah ditolak database pada keadaan itu (`game_not_active`) |
| 5 | Kolom nominal tidak memakai pemisah ribuan (hanya digit), seperti Figma | Mengikuti Figma |

### Diuji (akun `guard1` nyata, staging, 390 × 844)

| Skenario | Hasil |
|---|---|
| Masuk lewat `/login` sebagai penjaga | Beranda `/guard/scan`; "POS 1", "Pos 1 · Lempar Bola", saklar sesuai status pos |
| Saklar: buka pos (konfirmasi "Buka pos?"), tutup pos | Status berubah, petunjuk "Pos tutup…" muncul/hilang; tersimpan di database |
| Kartu asing (format benar, token tidak ada) | "Kartu tidak dikenali. Coba lagi atau minta bantuan panitia." |
| Kartu tim → lembar; Batal; Kirim Rp 1.000 | Nama "Tim Elang", saldo Rp 8.192.152, tombol "Kirim Rp 1.000" nonaktif sampai ada nominal; lembar menutup; "Rp 1.000 terkirim ke Tim Elang" |
| Tutup pos lalu kirim Rp 2.000 | Kartu merah "Gagal: pos ditutup. Hadiah Rp 2.000 untuk Tim Elang belum terkirim." tetap ada setelah muat ulang halaman; buka pos lalu "Kirim ulang" → terkirim; kartu gagal hilang; **satu** baris `payouts` (tanpa ganda) |
| Jaringan putus pada pengiriman pertama (permintaan dibatalkan) | "Mengirim…", lalu ulang otomatis dengan `request_id` sama → "Rp 500 terkirim"; saldo naik tepat sekali |
| Notifikasi sukses | Hilang sendiri sesudah ±8 dtk |
| Banner game selesai (respons `game_settings` ditiru) | Banner tampil, saklar nonaktif |
| Laci menu dan Keluar | Menu "Pindai" + kartu akun; Keluar → `/login`; `/guard/scan` tanpa sesi → `/login` |
| Batas peran | Admin membuka `/guard/scan` → dialihkan ke `/admin/state`; di database, peran tim mendapat `forbidden` pada `resolve_team_qr`, `award_payout`, `guard_set_post_open` |
| Pemeriksaan kode | tsc, eslint, prettier, vitest 102 tes, `npm run build` |

Catatan uji: indikator pengembangan Next ("N") di pojok kiri bawah menutupi tombol Keluar pada viewport ponsel hanya di mode dev (tidak ada di produksi); klik dilakukan lewat skrip.

### Data uji di staging (saya tulis)

Empat hadiah uji ke `Tim Elang` (Rp 1.000, 1.000, 2.000, 500; total Rp 4.500) dari `guard1`, lalu dikoreksi **−Rp 4.500** lewat `admin_adjust_cash` (alasan "pulihkan uji halaman Penjaga"); saldo kembali Rp 8.192.152. Baris `payouts` dan `audit_log` tetap ada. Pos 1 dikembalikan ke **tutup** (keadaan sebelum uji).

### Belum diuji

Pemindaian dengan kamera sungguhan di ponsel (hanya jalur gambar seret; kamera butuh HTTPS atau `localhost`, tidak tersedia lewat IP LAN); tata letak pada layar lebih sempit dari 390 px dan lanskap; pemilihan kamera belakang di perangkat nyata (`facingMode: environment`); penjaga yang belum terhubung ke pos (pesan tersedia, tidak dicoba); Realtime (tidak dipakai; polling 15 dtk).

## Layar publik tanpa login (18 Nov)

Permintaan pengguna: `/display` tidak perlu login.

**Cara kerja** (`lib/supabase/proxy.ts`, `lib/supabase/env.ts`, tes `env.test.ts`): bila `/display` dibuka dengan GET tanpa sesi dan server punya `DISPLAY_USERNAME` + `DISPLAY_PASSWORD` (tanpa awalan `NEXT_PUBLIC_`; `.env.example` diperbarui, `.env.local` diisi), proxy memanggil `signInWithPassword` sebagai akun peran `display` lalu melanjutkan permintaan itu dengan cookie sesi yang baru. Kata sandi hanya ada di server; peramban hanya menerima cookie sesi seperti login biasa. Peran tetap `display`: RLS + RPC di database tidak berubah (hanya baca; `forbidden` untuk RPC peran lain). Variabel kosong → masuk otomatis mati dan `/login` berlaku seperti semula. Pembaruan data layar (polling dan Realtime di peramban) memakai sesi itu seperti sebelumnya.

**Konsekuensi keamanan (perlu keputusan sadar)**: siapa pun yang bisa membuka `/display` mendapat sesi `display` dan bisa membaca lewat API Supabase apa yang boleh dibaca peran itu (peringkat lengkap `get_leaderboard()`, ringkasan pasar, pos, berita yang sudah tayang). Sebelumnya butuh kata sandi akun. Bila layar hanya boleh terlihat di jaringan acara, batasi akses ke `/display` di tingkat jaringan (mis. Cloudflare Access atau daftar IP). Pilihan yang lebih ketat tetapi butuh migrasi DB: izinkan `anon` memanggil fungsi baca khusus layar yang hanya mengembalikan 5 teratas; tidak dikerjakan.

**Dokumen yang perlu diperbarui (tidak saya ubah)**: docs/06-security.md baris 24 dan 36 ("akun `display` ... login"), docs/07 (layar publik).

### Diuji

| Skenario | Hasil |
|---|---|
| `/display` tanpa cookie | 200, tanpa pengalihan; layar 5 tim teratas tampil dengan data nyata; satu cookie sesi `sb-…-auth-token` terpasang |
| `/display?screen=market` tanpa cookie | Terbuka dan berisi data |
| `/admin/state` dan `/guard/scan` tanpa sesi | Dialihkan ke `/login` |
| `/team` tanpa sesi | Dialihkan ke `/kiosk` |
| Sesi display membuka `/admin/state` | Dialihkan ke `/display` |
| Bundel klien (`.next/static`) berisi kata sandi atau nama variabel | Tidak ada |
| Pemeriksaan kode | tsc, eslint, vitest 104 tes, `npm run build` |

### Belum diuji

Layar yang dibiarkan menyala berjam-jam (penyegaran token di peramban sudah dipakai sebelumnya, tidak dicoba ulang); perilaku saat batas laju login Supabase tercapai (banyak pengunjung tanpa cookie dari IP yang sama); produksi (variabel harus diisi di lingkungan hosting, bukan hanya `.env.local`); skenario kata sandi akun diganti (env lama → masuk otomatis gagal, jatuh ke `/login`).

### Perbaikan: `/login` tidak bisa dibuka dari peramban yang sudah membuka `/display` (18 Nov)

Penyebab: sesi `display` yang didapat otomatis saat `/display` dibuka dianggap "sudah masuk", sehingga `/login` langsung mengalihkan ke `/display`. Perbaikan (`app/login/page.tsx`): sesi berperan `display` tidak lagi dialihkan; formulir tetap tampil supaya admin atau penjaga bisa masuk dari peramban yang sama (login menggantikan sesi display). Peran lain (admin, penjaga, tim) tetap dialihkan ke beranda perannya.

Diuji: buka `/display` tanpa cookie, lalu `/login` → formulir tampil; masuk sebagai admin → `/admin/state`; admin membuka `/login` → dialihkan ke `/admin/state`. tsc, eslint, vitest (104 tes) lolos.

## Persiapan pindah ke Supabase Docker (18 Nov)

Permintaan pengguna: memindah Supabase cloud ke Supabase self-hosted (Docker). Dibuat folder `deploy/supabase/` (di luar `docs/`): skrip dan konfigurasi; **tidak ada yang dijalankan terhadap cloud maupun Docker**, dan aplikasi tidak diubah.

**Temuan cloud** (lewat SQL baca-saja): PostgreSQL 17.12, 40 MB, 18 tabel, 56 fungsi, 13 akun Auth, 2 job `pg_cron` (`news-cycle`, `market-cycle`, tiap 10 dtk), 5 tabel Realtime, tanpa Storage dan Edge Function, ekstensi `pg_cron pgcrypto uuid-ossp supabase_vault`. Satu-satunya baris data yang wajib ada pada DB baru adalah `game_settings` (satu baris, semua kolom punya nilai bawaan).

**Isi** (README: `deploy/supabase/README.md`):
- `00-setup-stack.sh`: mengunduh berkas resmi `supabase/supabase` (folder `docker/`, commit `f1e7e6e` dipin), membuat `stack/.env` dengan rahasia acak lewat skrip resmi `utils/generate-keys.sh` (keluaran dibuang), mematikan pendaftaran mandiri dan autoconfirm yang tidak perlu.
- `10-up.sh`: menjalankan hanya `db meta studio api-gw auth rest realtime` (tanpa storage, functions, imgproxy, pooler); `--https` menambah Caddy (overlay resmi + `docker-compose.https.yml` + `Caddyfile.classmeet`: API di `https://<IP>`, aplikasi Next di `https://<IP>:3443`, CA internal). `15-export-ca.sh` mengekspor sertifikat akar publik.
- `20-dump-cloud.sh` (hanya baca terhadap cloud; alamat DB lewat variabel lingkungan kontainer): skema `public` lengkap dengan hak akses, job cron, tabel Realtime; `--with-data` menambah data `public` dan `auth.users`/`auth.identities` (kartu QR lama tetap berlaku). Hasil di `dump/` (gitignore; data sensitif).
- `30-restore-local.sh`: ekstensi → skema → (akun → data) → baris `game_settings` bawaan (tanpa `--with-data`) → cron → Realtime → `NOTIFY pgrst`. Menolak menimpa DB yang sudah berisi tabel Classmeet.
- `40-verify.sh` + `sql/inventory.sql`: inventaris yang bisa dibandingkan dengan cloud (tabel, fungsi, trigger, RLS, cron, Realtime, hak eksekusi `anon`/`authenticated` pada fungsi internal) dan cek gerbang API.
- `50-app-env.sh` (hanya URL + anon key; tidak pernah service-role), `60-seed-local.sh` (kunci service_role hanya untuk proses seed), `70-backup.sh`.
- `.gitignore`: `deploy/supabase/stack/` dan `deploy/supabase/dump/`.

### Diverifikasi
`bash -n` semua skrip; `00-setup-stack.sh` dijalankan sungguhan (unduhan resmi berhasil; `.env` terbentuk dengan semua rahasia diganti dari contoh; `ANON_KEY` dan `SERVICE_ROLE_KEY` terbukti ditandatangani `JWT_SECRET` dengan peran benar); `docker compose config` valid untuk mode HTTP dan mode HTTPS (overlay Caddy: port gerbang API dilepas, 80/443/3443, `host.docker.internal`); penutupan dependensi tujuh layanan itu terbukti lengkap (tidak menarik layanan lain).

### Belum diuji
Semua yang butuh menjalankan kontainer: unduhan image, `10-up.sh`, restore, `pg_cron` pada image `supabase/postgres`, Realtime atas tabel hasil restore, restore `auth.users` antar versi GoTrue, HTTPS Caddy dengan CA di ponsel, dan aplikasi di atas Supabase Docker. Folder `deploy/supabase/stack/` hasil uji `00-setup-stack.sh` masih ada di mesin ini (berisi rahasia acak yang tidak pernah dicetak; penghapusannya ditolak oleh pemeriksaan keamanan): hapus sebelum menjalankan `00-setup-stack.sh` lagi.

### Percobaan menjalankan tumpukan Docker (18 Nov)

`./00-setup-stack.sh http://localhost:8000 http://localhost:3000` dan `./10-up.sh` dijalankan sungguhan (mode HTTP lokal). Image diunduh dan **ketujuh kontainer sehat**: `supabase-db` (Postgres 17.6.1.136), `supabase-meta`, `supabase-studio`, `supabase-envoy`, `supabase-auth` (GoTrue v2.197.0), `supabase-rest` (PostgREST v14.18), `realtime-dev.supabase-realtime` (v2.148.3).

Pemeriksaan: `GET /auth/v1/health` = 200 dan `/realtime/v1/api/ping` = 200 lewat gerbang `http://localhost:8000` dengan anon key; `/rest/v1/` = 403 untuk anon (wajar, akar PostgREST tidak dibuka untuk anon); `pg_cron` 1.6.4, `pgcrypto`, `uuid-ossp` tersedia dan `pg_cron` ada di `shared_preload_libraries` image; publikasi `supabase_realtime` sudah ada; peran `anon`, `authenticated`, `service_role`, `authenticator` ada.

**Belum**: dump dari cloud, restore, verifikasi, seed, dan aplikasi di atas Docker. Dump butuh `CLOUD_DB_URL` (hanya pengguna yang memilikinya).

### Restore ke Docker dan verifikasi (18 Nov)

Dump dijalankan pengguna (`./20-dump-cloud.sh --with-data`: 18 tabel, 56 fungsi, 13 akun, 111.574 baris data). `./30-restore-local.sh --with-data` memuat ke Docker tanpa galat.

**Temuan (diperbaiki)**: restore pertama membuat `anon` bisa menjalankan fungsi `admin_*` dan `authenticated` bisa menjalankan fungsi internal (`process_news_cycle`, `ob_match`, `bankrupt_asset`, …) yang di cloud tertutup. Penyebab: image Supabase memasang `ALTER DEFAULT PRIVILEGES` yang memberi semua hak ke `anon/authenticated/service_role` pada tiap objek baru; dump hanya memuat `GRANT` untuk peran yang ada di ACL cloud, tanpa `REVOKE` bagi yang tidak ada. Perbaikan: `30-restore-local.sh` mencabut hak bawaan itu sebelum memuat skema; `35-reset-db.sh` (baru) mengosongkan DB lewat SQL (`drop schema public cascade`, hapus akun Auth, cron, tabel Realtime) tanpa menghapus berkas volume. Setelah restore ulang dengan perbaikan, `40-verify.sh` melaporkan dua baris hak eksekusi `-`, sama dengan cloud.

**Paritas dengan cloud** (inventaris yang sama dijalankan di kedua sisi): 18 tabel, 56 fungsi, 13 trigger, 17 kebijakan RLS, 18 tabel RLS aktif, 0 tabel tanpa RLS, 2 job cron, 5 tabel Realtime, 13 akun, ekstensi sama; `md5` daftar hak tabel (192 entri) dan hak fungsi (95 entri) untuk `anon/authenticated/service_role` **identik**; jumlah baris `teams`, `assets`, `trades`, `payouts`, `news`, `holdings`, `profiles` sama dan `game_settings` (state `open`, sudah dimulai) ikut tersalin.

**Uji lewat gerbang lokal** (`http://localhost:8000`, hash kata sandi tersalin utuh): login `admin`, `display`, `guard1` (kata sandi seed) dan tim dengan `qr_token` → 200; kata sandi salah → 400; `get_leaderboard` oleh display → 200 (5 baris), oleh tim → `forbidden`, oleh anon → ditolak; `get_news_pool_status` (admin) 200; `get_my_summary` (tim) 200; `resolve_team_qr` (penjaga) → "Tim Elang"; admin memanggil `process_news_cycle` → ditolak; tim memanggil `admin_set_game_state` → `forbidden`; tim membaca `teams` hanya 1 baris (miliknya). Job cron berjalan tiap 10 detik (`news-cycle` dan `market-cycle` `succeeded`; 300 order bandar terbuka).

**Belum**: aplikasi Next di atas Docker (`.env.local` belum diubah, server dev tetap ke cloud), HTTPS/Caddy, Realtime dari peramban, pulihkan dari `70-backup.sh`, dan `./60-seed-local.sh` (tidak perlu: data dan akun sudah tersalin).

### Aplikasi diarahkan ke Supabase Docker (18 Nov)

`.env.local`: `NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000` dan anon key Docker (dicetak `deploy/supabase/50-app-env.sh`; keduanya publik). Nilai cloud disimpan sebagai komentar `# (cloud, untuk kembali) …` di berkas yang sama; `SUPABASE_SERVICE_ROLE_KEY` tidak ada di berkas itu. `DISPLAY_USERNAME`/`DISPLAY_PASSWORD` tidak berubah. Server dev lama (milik pengguna, berjalan dengan env cloud) dihentikan dan dijalankan ulang agar membaca env baru.

Diuji di peramban terhadap `http://localhost:8000`: `/display` tanpa login (masuk otomatis ke akun display Docker; cookie `sb-localhost-auth-token`; semua permintaan hanya ke `localhost:8000`, tanpa respons ≥ 400); admin masuk dan membuka Status, Pos (6 baris), Hadiah (daftar hadiah tampil), tanpa galat; **Realtime** tersambung (`ws://localhost:8000/realtime/v1/websocket`, pesan "Subscribed to PostgreSQL" untuk kanal `admin-state`); penjaga `guard1` masuk, saklar pos terbaca ("Pos tutup", sesuai data tersalin), kartu tim dipindai (gambar) → lembar "Tim Elang" dengan saldo; tim masuk lewat kiosk (kartu QR) → `/team/market` dengan polling normal (`get_market_summary`, `get_order_book`, `order_band`, dst. semuanya 200).

Catatan: sekali uji kiosk gagal karena balapan skrip (gambar QR dijatuhkan saat kiosk masih mencabut sesi penjaga sebelumnya; kiosk mengabaikan masukan selama fase "booting"). Diulang dari keadaan tanpa cookie: berhasil. Perilaku yang sama dengan cloud.

Belum: HTTPS/Caddy, kamera sungguhan, pulihkan dari cadangan, dan build produksi terhadap Docker.

### Mode HTTPS (Caddy) untuk Supabase Docker (18 Nov)

Dijalankan `./10-up.sh --https` dengan `SUPABASE_PUBLIC_URL=https://192.192.2.246` (IP laptop saat itu; sebelumnya .97 lalu .202, jadi IP berubah antar sesi), `API_EXTERNAL_URL`, `SITE_URL=https://192.192.2.246:3443`. Caddy (image `caddy:2`) di port 80/443/3443 dengan CA internal; gerbang Envoy tidak lagi dipublikasikan ke host (`http://localhost:8000` mati, sesuai overlay resmi). CA diekspor ke `stack/caddy-root.crt` (publik).

**Temuan (diperbaiki)**: peramban dan curl tidak mengirim SNI untuk alamat berupa IP, sehingga Caddy menjawab `tlsv1 alert internal error`. Perbaikan: `default_sni {$PROXY_DOMAIN}` di `Caddyfile.classmeet`.

**Diuji dengan CA dipercayai** (curl `--cacert`, Node `NODE_EXTRA_CA_CERTS`): `https://192.192.2.246/auth/v1/health` 200, REST 401 untuk anon (wajar), `/realtime/v1/api/ping` 200; Studio 401 tanpa sandi dan 307 dengan sandi dasbor; preflight CORS dari origin `https://192.192.2.246:3443` ke API diizinkan; WebSocket Realtime dan HMR aplikasi lewat Caddy menjawab `101 Switching Protocols`; login admin lewat HTTPS dari Node = 200, dan Node tanpa CA gagal `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` (jadi percaya CA memang diperlukan di sisi server); `/display` lewat `https://192.192.2.246:3443` dan `http://localhost:3000` = 200 (masuk otomatis server ke Supabase lewat HTTPS berhasil).

**Perubahan aplikasi**: `.env.local` `NEXT_PUBLIC_SUPABASE_URL=https://192.192.2.246`; skrip npm `dev:https` dan `start:https` (menyetel `NODE_EXTRA_CA_CERTS`; variabel itu hanya dibaca saat Node mulai, tidak bisa lewat `.env.local`); konfigurasi peluncuran `classmeet-dev-https`; `allowedDevOrigins` menjadi `["192.192.2.*", "192.168.*.*"]` (pola satu label, jadi IP yang berubah tetap diizinkan).

**Belum diuji**: halaman di peramban sungguhan lewat `https://192.192.2.246:3443` (peramban uji saya tidak mempercayai CA Caddy: `ERR_CERT_AUTHORITY_INVALID`; memasang CA ke keychain sistem adalah perubahan keamanan yang harus dilakukan pengguna); kamera di HTTPS; ponsel (CA harus dipasang); build produksi dengan `start:https`; perilaku saat IP berubah.

### Uji browser lewat HTTPS (18 Nov)

Setelah pengguna memasang CA Caddy di keychain sistem macOS, peramban uji menerima `https://192.192.2.246:3443` (`isSecureContext` = true). Diuji terhadap Supabase Docker lewat HTTPS, tanpa respons ≥ 400 pada semua permintaan ke `192.192.2.246`:
- `/display` tanpa login: 200, layar 5 tim teratas tampil.
- Admin: login → `/admin/state`; `/admin/posts` memuat 6 pos; cookie sesi `sb-192-auth-token`; WebSocket Realtime `wss://192.192.2.246/realtime/v1/websocket` dan HMR `wss://…:3443/_next/hmr` tersambung.
- Penjaga `guard1`: halaman pindai termuat; `navigator.mediaDevices.getUserMedia` tersedia dan tidak ada pesan galat kamera (di HTTP lewat IP, API ini tidak ada dan pemindai melaporkan `insecure-context`); kartu tim dipindai (gambar) → lembar "Tim Elang".
- Kiosk: konteks aman, tanpa pesan "Kamera hanya bisa dipakai lewat HTTPS"; tim masuk lewat kartu QR → `/team/market` dengan 30 aset, tanpa pesan "Data belum bisa diperbarui".

Belum: kamera fisik (peramban uji tanpa perangkat kamera), ponsel nyata (CA harus dipasang di tiap perangkat), build produksi (`start:https`), dan perubahan IP laptop.

## Perbaikan tampilan Pasar dan dialog berita (18 Nov)

Permintaan pengguna (tim, halaman Pasar dan pop-up berita):

1. **Halaman Pasar bisa digulir jauh melewati isinya.** Diukur: tinggi dokumen 1997 px padahal isi hanya ±1141 px (±850 px kosong di bawah). Penyebab: daftar aset yang bisa digulir (`ul` dengan `overflow-y-auto`) berada di dalam kartu `sticky` tanpa `overflow`, dan Chrome menambahkan tinggi gulir daftar itu (1684 px) ke tinggi dokumen. Perbaikan: `overflow-hidden` pada kartu daftar aset (`components/market/asset-list.tsx`, dengan komentar alasannya). Hasil: tinggi dokumen 1141 px (sama dengan isi). Halaman tetap bisa digulir seperlunya bila isinya lebih tinggi dari layar (1141 > 900 px pada 1440 × 900), tanpa ruang kosong.
2. **Order book diberi pembatas** (`components/market/order-book.tsx`): garis di bawah judul, garis di bawah baris kepala kolom, garis vertikal di tengah yang memisahkan sisi beli (bid) dan jual (offer), dan garis di atas baris total. Celah antar-kolom dan antar-baris sedikit dilebarkan agar garis tidak menempel pada sel.
3. **Dialog detail berita** (`components/team/news-dialog.tsx`, `components/ui/dialog.tsx`): latar belakang abu-abu netral buram (`bg-neutral-500/35` + `backdrop-blur-md`) lewat properti baru `overlayClassName` pada `DialogContent` (dialog lain tetap memakai latar biru `--overlay`); kotak 560 → 760 px, padding lebih besar; judul 24 → 32 px, isi 18 → 22 px (jarak baris 1,7), tanggal 14 → 16 px.

Perbaikan terkait: `tsconfig.json` (`exclude: deploy`), `eslint.config.mjs` (`deploy/**`), dan `.prettierignore` mengabaikan folder `deploy/` yang berisi berkas unduhan Supabase (membuat `tsc` dan `next build` gagal setelah `stack/` ada).

Diuji di peramban (akun tim, 1440 × 900, HTTPS): tinggi dokumen 1141 px; order book dengan garis pemisah (diperiksa lewat tangkapan layar); dialog berita 760 px, huruf 32/22 px, latar abu-abu buram. tsc, eslint, vitest (104 tes) lolos. Belum: layar lebih sempit dari 1280 px dan dialog yang diisi berita sangat panjang (tinggi maksimum 88 % layar, isi menggulir di dalam kotak).

### Order book: pembatas antar-kolom di dalam baris (18 Nov)

Permintaan pengguna: tiap baris order book (Freq, Lot, harga) diberi garis pemisah agar mudah dibaca. `components/market/order-book.tsx`: garis vertikal tipis (`divide-x`, hitam 15–25 % transparan) di antara kolom pada baris kepala dan semua sel (sisi bid dan offer; sel kosong juga), dengan padding per kolom. Lebar kolom diubah dari tiga sama besar menjadi 3 : 3 : 6 (bid: Freq, Lot, Bid) dan 6 : 3 : 3 (offer: Offer, Lot, Freq) supaya angka harga tidak menempel pada garis dan kolom baris sejajar dengan kepalanya. Baris milik tim (garis biru) tetap mempertahankan garis biru dan pembatasnya. Diuji di peramban (akun tim, 1440 × 900) pada Adaro dan BCA; tsc dan eslint lolos.

## Latar halaman putih (18 Nov)

Permintaan pengguna: latar semua halaman putih; pemisah memakai garis tepi (outline) dan bayangan.

- `app/globals.css`: `--page` dari `#f3f6ff` (biru pucat) menjadi `#ffffff`; `--border` sedikit lebih tegas (`#d3dcf7` → `#cbd5f5`) supaya garis terlihat di atas putih; `--shadow-card` diperkuat dua lapis (`0 1px 3px rgba(13,43,227,.10), 0 4px 16px rgba(13,43,227,.08)`). `--bg-0` (isian/field) dan `--bg-2`/`--bg-3` (ubin, baris tabel, chip) tidak diubah: tetap biru pucat sebagai lapisan di dalam kartu putih.
- Semua panel (`rounded-panel` + `bg-card`) kini punya garis `border-line` **dan** `shadow-card`: 13 panel di `components/market/*` (order book, detail aset, order terbuka, daftar aset, form order, pemberitahuan bangkrut), `components/orders/orders-board.tsx` (3), dan `components/display/market-screen.tsx` (4); kartu pos di layar publik (`posts-screen.tsx`) diberi bayangan. Sidebar (laptop) diberi bayangan ke kanan dan garis tepi; bilah atas ponsel dan bilah atas penjaga diberi `shadow-card`.
- Dialog, tooltip, dan toast tidak berubah (sudah memakai `shadow-dialog`).

Perubahan token `:root` baru terbaca setelah server dev dimulai ulang (dilakukan; server dev milik pengguna ikut dihentikan dan dijalankan ulang lewat konfigurasi `classmeet-dev-https`).

Diperiksa lewat tangkapan layar (HTTPS, akun nyata): `body` `rgb(255, 255, 255)`; tim (Pasar, Beranda, Portofolio), admin (Tim), penjaga (ponsel), layar display (peringkat, pasar, pos), dan login. Kartu terpisah jelas dari latar oleh garis + bayangan. `docs/DESIGN.md` dan docs/07 masih menyebut latar biru pucat; tidak saya ubah (perlu pembaruan oleh pemilik dokumen).

Belum diperiksa satu per satu: halaman Order dan Riwayat tim (diambil, tidak diperiksa terperinci), halaman admin selain Tim, dialog yang sedang terbuka di atas latar putih, dan layar < 1280 px.

## Layout baru layar publik "Peringkat" (18 Nov)

Permintaan pengguna: cari referensi leaderboard di Refero, terapkan **layout dan posisi saja** pada `/display/leaderboard`, tanpa mengubah warna.

**Referensi Refero** (pencarian "leaderboard ranking top 5 with rank numbers and scores" dan "live leaderboard podium top 3 …", web): Duolingo (papan liga: judul + keterangan di atas, baris berperingkat dengan nama di kiri dan skor di kanan, sorotan untuk posisi atas), Product Hunt "Kitty Points Leaderboard" (tiap baris: nama di kiri, **batang komposisi berwarna di bawah nama beserta legenda angka per komponen**, skor besar rata kanan), Pexels Leaderboard (nomor peringkat besar di kiri, nama + statistik, isi di kanan), Brilliant Leagues (kartu baris putih berlapis dengan satu baris disorot). Yang dipakai: skor utama besar rata kanan, nama + batang komposisi + legenda di kiri, judul + keterangan di header.

**Perubahan** (`components/display/leaderboard-screen.tsx`; tidak ada warna baru, hanya token yang sudah dipakai: `brand`, `brand-light`, `soft`, `ink`, badge peringkat tetap):
- Baris kartu: sebelumnya nama + tiga angka sama besar (Total, Saldo, Nilai aset) berjajar; kini **kiri**: nama, **batang komposisi** (panjang isi = total ÷ total tim teratas, terbagi saldo `brand` | nilai aset `brand-light`) dan legenda "● Saldo … ● Nilai aset …"; **kanan**: **Total** sebagai angka utama (76 px, 62 px bila ≥ 11 karakter), rata kanan.
- Header: judul "Peringkat Tim" + keterangan "Total = saldo + nilai aset" di kanan (menyembunyikan diri saat layar tunggu).
- Tinggi kartu 160 → 152 px dan jarak 16 → 14 px agar header baru dan keterangan kaki tetap muat di 1080 px. Badge peringkat tetap di tempat (kolom terpisah); mekanisme animasi (DOM stabil menurut id tim + `translateY` menurut peringkat) tidak berubah; batang dan segmen juga beranimasi lewat transisi lebar.

Diuji (HTTPS, 1920 × 1080, data nyata): semua lima baris dan kaki "Angka dalam rupiah" muat tanpa terpotong; dengan respons `get_leaderboard` yang ditiru (Tim Rajawali jadi juara) urutan kartu berpindah (posisi Y 0/166/332/498/664 mengikuti peringkat baru) dan lebar batang berubah. tsc, eslint, vitest (104 tes) lolos.

Catatan: perbandingan batang relatif terhadap tim teratas, jadi saat satu tim jauh di depan (data uji: 200 juta vs ±10 juta) batang tim lain tampak pendek; angka tetap tertera. Belum diuji: layar tunggu (disembunyikan admin) setelah perubahan header, dan nama tim sangat panjang.

### Layar Peringkat: batang dihapus, diganti tabel klasemen (18 Nov)

Permintaan pengguna: hapus batang komposisi dan cari referensi leaderboard yang tidak memakai batang.

**Referensi Refero** (pencarian "tournament standings table teams rank points columns" dan "podium top three winners 1st 2nd 3rd leaderboard"): tabel klasemen Premier League di The Athletic (kepala kolom **sekali** di atas, baris berisi nilai yang sejajar kolom, tanpa label di tiap baris), daftar Quizlet (peringkat | nilai | nama berkolom, baris disorot) dan hasil kuis Deezer (daftar berurutan dengan lencana peringkat dan satu baris disorot). Dipilih pola tabel klasemen.

**Perubahan** (`components/display/leaderboard-screen.tsx`; warna tidak diubah, hanya `ink`, `ink-muted`, `line`, `card`, badge peringkat yang sama):
- Batang komposisi, legenda, dan label per baris **dihapus**.
- Kepala kolom sekali di atas papan: TIM | SALDO | NILAI ASET | TOTAL (huruf kapital, `ink-muted`), sejajar dengan kolom pada tiap baris.
- Tiap kartu: nama di kiri (52 px), tiga sel angka berlebar tetap (300 / 300 / 450 px) rata kanan dengan garis tipis pemisah kolom di kiri tiap sel; kolom **Total** paling besar dan tebal (72 px, 60 px bila ≥ 11 karakter), Saldo dan Nilai aset 50 px (42 px bila ≥ 11 karakter).
- Tinggi kartu 152 → 144 px dan jarak 14 → 12 px agar kepala kolom, header, dan kaki tetap muat di 1080 px. Badge peringkat dan animasi (DOM stabil + `translateY`) tidak berubah; judul "Peringkat Tim" di header dipertahankan.

Diuji (HTTPS, 1920 × 1080): semua baris dan kaki muat (tinggi dokumen 1080 px); tidak ada teks yang terpotong, juga dengan data tiruan ekstrem (`999.999.999`, `600.000.000`, nama "Tim Cendrawasih"); dengan respons `get_leaderboard` yang ditiru urutan kartu berpindah (posisi Y 0/156/312/468/624 mengikuti peringkat baru). tsc, eslint, vitest (104 tes) lolos. Belum diuji: layar tunggu (leaderboard disembunyikan) dan nama tim yang lebih panjang dari ±12 huruf (dipotong dengan elipsis).

### Layar baru: Display berita `/display/news` (19 Nov)

Permintaan pengguna: tambah halaman display **berita**. Tidak ada spesifikasinya di docs/07 maupun Figma (hanya tiga layar bergilir), jadi dirancang sendiri; pengguna memilih rute sendiri **dan** ikut rotasi `/display`.

**Referensi Refero** (pencarian "news feed featured headline with list of latest stories" dan "breaking news ticker timeline latest updates live blog"): Bloomberg Markets (satu berita utama besar di samping daftar berita), Perplexity Discover (kartu unggulan + kartu lain), Aboard "What's New" (lini masa kronologis dengan penanda waktu di kiri). Disintesis menjadi: berita terbaru besar di kiri, lini masa berita sebelumnya di kanan. Warna dan komponen sama dengan layar publik lain (tanpa warna baru).

**Perubahan**
- `components/display/news-screen.tsx` (baru): kiri kartu **Berita terbaru** (ikon, eyebrow, lencana "Baru" bila tayang ≤ 30 menit, waktu WIB, judul 64 px maks 3 baris, isi 32 px maks 8 baris, keterangan "Tayang N menit lalu"); kanan **Sebelumnya** (5 berita: jam besar + tanggal/"Hari ini", judul 2 baris, isi 2 baris). Keadaan kosong ("Belum ada berita") dan hanya satu berita ditangani. Polling 5 dtk; peringatan "Terputus…" bila gagal. Isi berita teks biasa (tanpa HTML).
- `lib/display/data.ts`: `fetchNewsBoard` (status game + `news_feed` terbaru; tanpa efek harga).
- `app/display/news/page.tsx` (baru); `app/display/page.tsx` dan `components/display/display-rotator.tsx`: layar ke-4, urutan Peringkat → Pasar → **Berita** → Pos (20 dtk); `?screen=news` menahan layar ini.
- `components/display/display-header.tsx` (baru): bilah atas (merek, status pasar, jam) diambil dari `market-screen.tsx` agar dipakai bersama; tampilan Display pasar tidak berubah.

**Diuji** (HTTPS, 1920 × 1080, data nyata + respons `news_feed` tiruan): data nyata terbaca benar; judul 180 huruf + isi 1.600 huruf + judul tanpa spasi tidak keluar kotak (isi dan keterangan "Tayang" tidak bertumpuk setelah perbaikan jumlah baris); kosong dan satu berita rapi; tinggi dokumen 1080 px; rotasi memuat 4 layar dan `?screen=news` menahan layar berita. tsc, eslint, vitest (104 tes) lolos.

**Belum diuji**: berita baru yang masuk saat layar tampil (hanya lewat polling, tanpa animasi pergantian) dan tampilan di proyektor 1280 × 720.

### Penjaga: form hadiah menampilkan saldo tim naik bertahap (19 Nov)

Permintaan pengguna: setelah QR tim dipindai dan "Kirim" ditekan, form **tidak langsung hilang**; ia menunjukkan saldo tim yang naik perlahan dari saldo awal ke saldo baru (contoh 100 + 50: 110 → 120 …), bukan langsung angka terbaru. Ini mengubah aturan lama di docs/07 §3.4 ("Kirim menutup form seketika"); docs/07 belum saya ubah.

**Perubahan**
- `components/guard/payout-sheet.tsx`: setelah "Kirim", isian dan tombol diganti tampilan **Hadiah dikirim ke {tim}**: kartu saldo besar (40 px) yang naik dari saldo saat QR terbaca ke saldo + nominal, chip "+ Rp nominal", keterangan status (**Mengirim…** / **Terkirim** / **Gagal terkirim**), dan tombol "Tutup" (jadi "Lanjut pindai" setelah angka selesai). Kartu menghijau saat angka selesai. Form menutup sendiri 1,4 dtk setelah angka selesai (atau 1,4 dtk setelah gagal); tombol dan geser-tutup tetap bisa dipakai lebih cepat. `prefers-reduced-motion`: langsung angka akhir. Pembaca layar hanya mendengar hasil akhir ("Saldo … sekarang …"), bukan tiap angka.
- `lib/guard/count-up.ts` (+ `count-up.test.ts`, 4 tes): `countUpValue` menghitung 24 langkah (90 ms, ≈ 2,2 dtk) dengan ease-out kuadrat; mulai tepat di saldo awal, berakhir tepat di saldo + nominal, tidak pernah turun.
- `components/guard/scan-board.tsx`: `send` tidak lagi menutup form, hanya memasukkan hadiah ke antrean dan menyimpan nominal; status form diturunkan dari antrean (`jobs` gagal → gagal, ada pemberitahuan sukses → terkirim, selain itu mengirim).

**Keputusan**: angka yang naik adalah **tampilan optimistis** (saldo saat dipindai + nominal), bukan saldo hasil bacaan ulang dari server; saldo tim tidak dibaca ulang karena penjaga tidak punya akses selain `resolve_team_qr`. Pengiriman tetap lewat antrean latar belakang dengan `request_id` yang sama, jadi tahan koneksi putus. Bila pengiriman gagal, angka dikembalikan ke saldo awal, keterangan menjadi "Gagal terkirim", dan kartu merah "Kirim ulang" di bawah kamera tetap ada. Kamera tetap terkunci selama form terbuka, jadi pindai berikutnya baru bisa setelah form menutup.

**Diuji** (HTTPS, akun guard1, data Docker): sukses Rp 50 ke Tim Elang: saldo 9.160.244 → 9.160.294 bertahap, keterangan menjadi Terkirim, form menutup ±3,4 dtk setelah Kirim, kartu hijau "terkirim" muncul; pos ditutup lewat SQL lalu kirim Rp 70: saldo tetap 9.160.294, "Gagal terkirim", form menutup sendiri, kartu merah "Gagal: pos ditutup…" dengan "Kirim ulang"/"Tutup" tampil. Pos dibuka kembali sesudah uji. tsc, eslint, vitest (108 tes) lolos. Efek samping uji: saldo Tim Elang di Docker bertambah Rp 50 (data uji).

**Belum diuji**: kamera sungguhan di ponsel, ponsel dengan gerak dikurangi, dan nominal sangat besar (12 digit) di layar sempit.

### Penjaga: animasi saldo pakai `motion`; istilah pos jadi Tersedia / Tidak tersedia (19 Nov)

Koreksi pengguna atas dua hal.

**1. Animasi saldo tidak mulus → library `motion`.** Versi sebelumnya memakai 24 langkah `setInterval` (re-render React tiap langkah) sehingga terlihat patah. Kini:
- Dependensi baru `motion` (^14.14, `package.json`).
- `components/guard/animated-rupiah.tsx` (baru): `animate(MotionValue, to, { duration, ease })` + `useTransform` ke teks Rupiah, ditulis langsung ke DOM tiap frame (tanpa render ulang React). Nilai dibulatkan hanya di teks; akhir selalu tepat. `useReducedMotion` → langsung angka akhir. `onDone` dipanggil sekali saat selesai, yang memicu kartu hijau dan penutupan form 1,4 dtk kemudian.
- `lib/guard/count-up.ts` kini hanya `countUpDurationMs` (1,6 dtk, +0,15 dtk per digit tambahan nominal, maks 2,6 dtk) dan kurva `COUNT_UP_EASE` (cubic-bezier 0,45 / 0 / 0,2 / 1). `countUpValue` dan konstanta langkah dihapus; tes diganti.
- `payout-sheet.tsx` memakai `AnimatedRupiah`; bila pengiriman gagal, komponen diganti saldo awal statis.
- Diuji (nominal Rp 50.000, rAF per frame di browser): 133 nilai berbeda dalam ±2,2 dtk, selang antar frame maks 19 ms, selalu naik, kecepatan naik lalu turun mengikuti kurva, berakhir tepat di saldo + nominal, form menutup ±3,7 dtk setelah Kirim. Catatan uji: mengambil tangkapan layar saat animasi menahan frame (artefak alat uji, bukan aplikasi).

**2. Istilah pos.** Arti yang dipakai: **Tersedia** = pos masih kurang tim atau belum ada tim untuk memulai permainan; **Tidak tersedia** = pos penuh atau permainan sedang dimulai. Kata "buka/tutup pos" dihapus dari semua teks pengguna:
- Penjaga (`post-toggle.tsx`): label saklar "Pos tersedia" / "Pos tidak tersedia"; dialog "Ubah pos jadi Tidak tersedia?" / "Ubah pos jadi Tersedia?" dengan penjelasan arti di atas; tombol "Jadikan tidak tersedia" / "Jadikan tersedia". `scan-board.tsx`: "Pos tidak tersedia: hadiah belum bisa dikirim."
- Admin (`posts-board.tsx`): tombol "Jadikan tidak tersedia / tersedia", toast "{pos} sekarang tersedia/tidak tersedia", keterangan di bawah tabel memuat arti kedua status; lebar kolom disesuaikan (tombol lebih panjang, tidak terpotong).
- Pesan galat `post_closed`: "Pos sedang tidak tersedia."; alasan antrean "pos tidak tersedia"; ringkasan Audit "Pos 3 · … jadi Tersedia / jadi Tidak tersedia" (+ tes). Layar publik dan chip admin sudah memakai Tersedia / Tidak tersedia.
- Nama kolom dan kode database (`is_open`, `post_closed`, `guard_set_post_open`) tidak diubah.

**Perlu keputusan pengguna**: aturan database lama masih menolak hadiah bila pos tidak `is_open` (`post_closed`), sehingga hadiah hanya bisa dikirim saat pos **Tersedia**. Dengan arti baru (Tidak tersedia = permainan sedang berlangsung), hadiah yang diberikan sesudah permainan akan ditolak. Belum saya ubah; docs/07 dan docs/04 juga belum diperbarui.

### Penjaga: saklar pos tanpa konfirmasi, gerak saldo 0,5 dtk, hadiah tanpa syarat pos, PIN (19 Nov)

Empat permintaan pengguna.

**1. Saklar pos tanpa konfirmasi** (`components/guard/post-toggle.tsx`): dialog konfirmasi dihapus. Saklar langsung berpindah saat ditekan (nilai sementara `pending`), lalu disimpan lewat `guard_set_post_open`; bila gagal saklar kembali dan pesan galat tampil di bawahnya. Teks status kecil "Tersedia" (hijau) / "Tidak tersedia" (merah) ditampilkan di bawah nama pos menggantikan peringatan "hadiah belum bisa dikirim" yang tidak berlaku lagi (poin 3). Ini menambah teks status pada saklar yang di Figma tanpa teks.

**2. Gerak saldo maks. 0,5 dtk** (`lib/guard/count-up.ts`): `COUNT_UP_MS = 500` (sebelumnya 1,6–2,6 dtk), kurva tetap. Form tetap menutup sendiri 1,4 dtk sesudahnya. Diuji: Rp 10.796.694 → 10.796.794 bertahap (27 nilai) dalam ≤ 0,5 dtk.

**3. Hadiah tidak lagi ditolak saat pos Tidak tersedia.** `scripts/sql/payout-allow-unavailable-post.sql` (baru): `award_payout` sama persis dengan sebelumnya, kecuali baris `if not v_post.is_open then raise exception 'post_closed'` dihapus. Sudah dijalankan di Supabase Docker (sebagai `supabase_admin`, pemilik fungsi; hak akses tidak berubah: anon tidak, authenticated ya). **Cloud belum**: jalankan berkas itu di SQL Editor bila kembali ke cloud; restore dari dump cloud lama juga mengembalikan fungsi lama. Kode galat `post_closed` dan teksnya dibiarkan (tak terpakai lagi). Admin dan layar publik tetap memakai `is_open` hanya sebagai status tampilan.

**4. PIN penjaga** (sementara 12345):
- Form hadiah punya kolom **PIN penjaga** (tersamar, 4–8 angka) di bawah Nominal; tombol Kirim aktif bila nominal valid dan PIN ≥ 4 angka.
- `verifyGuardPin` (`app/guard/actions.ts`): membandingkan PIN di server dengan `GUARD_PIN` (bawaan 12345 bila kosong/tidak valid; ada di `.env.example`), waktu-tetap (`lib/guard/pin.ts`). PIN tidak dikirim ke klien dan tidak dicatat. PIN salah: pesan "PIN salah." dan kolom dikosongkan; 5 salah berturut-turut mengunci akun itu 60 dtk (pembatas di memori server, `PinLimiter`). Hadiah baru masuk antrean setelah PIN benar; bila form ditutup saat PIN diperiksa, hadiah tidak dikirim.
- Batasan: PIN satu untuk semua penjaga dan diperiksa saat menekan Kirim (perlu koneksi); hadiah yang sudah di antrean tetap dicoba ulang tanpa PIN. Pemeriksaan ada di aplikasi, bukan di `award_payout`, sehingga bukan pengaman kuat terhadap penjaga yang memanggil API langsung.
- Tes baru: `lib/guard/pin.test.ts` (PIN bawaan, perbandingan, pembatas).

**Diuji** (HTTPS, guard1): saklar berpindah seketika tanpa dialog dan tersimpan; pos Tidak tersedia + PIN salah (99999) ditolak "PIN salah."; PIN 12345 memasukkan Rp 100 (tercatat di `payouts` walau pos tidak tersedia); tombol Kirim nonaktif tanpa PIN; form muat di layar 375 × 667. tsc, eslint, vitest (110 tes) lolos.

**Belum diuji**: pengunci 60 dtk lewat browser (hanya tes unit), `GUARD_PIN` kustom di `.env.local`, dan jalur offline (PIN butuh server).

### Penjaga: PIN jadi pop-up (19 Nov)

Permintaan pengguna: PIN tidak lagi kolom tambahan di bawah Nominal, melainkan pop-up. `components/guard/payout-sheet.tsx`: form hanya Nominal + Kirim; "Kirim" membuka pop-up **Masukkan PIN** ("Kirim Rp X ke {tim}", kolom PIN tersamar dengan fokus otomatis, Konfirmasi, Batal, X). PIN benar → hadiah masuk antrean dan tampilan saldo naik seperti sebelumnya; PIN salah → galat "PIN salah." di dalam pop-up dan kolom dikosongkan; Enter mengirim. Isi pop-up dibongkar saat ditutup, jadi PIN dan galat lama tidak tersisa. Pemeriksaan tetap `verifyGuardPin` di server (lihat bagian sebelumnya). Diuji (HTTPS, guard1): tidak ada kolom PIN di form, pop-up muncul dengan fokus di kolom PIN, PIN 00000 ditolak, PIN 12345 mengirim Rp 250 dan form menutup sendiri; tsc, eslint, vitest (110 tes) lolos.

### Mesin berita v2: 10–15 aset, event berbasis peluang, pemilihan menurut kondisi pasar (19 Nov)

Permintaan pengguna (5 poin): (1) efek per berita 10–15 aset; (2) event bangkrut/suspensi/dividen berbasis peluang menurut kondisi (aset yang sudah jauh/terus naik berpeluang kecil bangkrut; berita menyebut sebab: korupsi, perebutan kepemilikan, konflik, dst.); (3) tiap aset minimal 1 berita per jenis event, tidak semua berita membawa event; (4) tidak ada event saat pasar baru dibuka; (5) berita tidak ditentukan sebelumnya, dipilih sistem menurut kondisi sekarang dari berita yang belum muncul. Rencana disetujui sebelum dikerjakan. Rancangan lengkap: `docs/15-mesin-berita-v2.md`.

**SQL** (`scripts/sql/news-engine-v2.sql`, sudah dijalankan di Docker; **cloud belum**): `cm_now()` (jam yang bisa dimajukan untuk simulasi), kolom `game_settings` baru (`market_opened_at`, `event_warmup_minutes` 30, `event_gap_minutes` 15, `event_asset_gap_minutes` 60, `event_intensity_pct`, `bankrupt_max_total` 4, `bankrupt_max_per_day` 2, `pick_temperature_milli` 50) dan `min/max_news_assets` = 10/15; tabel `market_event_log`; `news_pool()`, `market_state()`, `event_chances()`, `pick_next_news()`; `process_news_cycle` memilih lewat `pick_next_news` (+ memangkas efek aset bangkrut, mencatat event); `check_news_effects` menambah "paling banyak satu event per berita"; `admin_set_game_state` mengisi `market_opened_at`; `news_pool_coverage()` (hanya sebelum game dibuka) dan `get_news_pool_kinds()`. Fungsi internal tidak bisa dipanggil klien (diuji lewat REST: `permission denied`).

**Kumpulan berita**: `scripts/news-pool-lib.ts` + `scripts/data/news-themes.ts` + `npm run generate-news` membuat `scripts/data/news-pool.json` (492 berita: 252 harga dari 63 tema × 2 arah × 2 varian; 30 bangkrut, 60 suspensi, 150 dividen = 1/2/5 per aset) dan `docs/14-kumpulan-berita.md` untuk ditinjau; `seed-dev.ts` memasukkannya (event lewat `admin_set_news_bankruptcy` / `admin_set_news_event`); `news.example.json` (4–7 aset) dihapus; `seed-lib` 10/15. Teks fiksi dengan nama aset sungguhan.

**Admin**: papan Berita menampilkan jumlah berita siap per jenis dan (sebelum game dibuka) cakupan event per aset; `lib/admin/data.ts` memakai agregat tertanam untuk jumlah efek (batas 1000 baris PostgREST) dan daftar sampai 800 berita; teks dialog event diperbarui. Perlu restart `npm run dev:https` agar modul server baru terpasang (server lama tetap menyajikan data tanpa kartu itu).

**Simulasi** (`scripts/sim-news-engine.sh`, di-ROLLBACK): 3 hari, 3 benih → ±220 berita, 36–39 event (±17 %), bangkrut 2/1/2, event paling awal 33–72 menit sesudah pasar dibuka, berita harga cukup (sisa 64–73), tak ada aset di batas harga. Penyetelan dari simulasi awal: kumpulan harga diperbesar (188 → 252, karena habis di hari ke-3), peluang bangkrut diturunkan (4 per game → 1–2) dan hanya naik bila harga di atas harga dasar, suhu pemilihan 80 → 50. Pemilihan menurut kondisi menahan ekstrem (maks +35–58 % vs +122 % pada pemilihan hampir acak).

**Diuji**: tsc, eslint, vitest (122 tes: pembuat kumpulan, seed, data admin). **Belum diuji**: tampilan papan Berita (server dev masih modul lama; perlu restart), peluncuran berita sungguhan di cron (kumpulan di Docker kosong karena game sudah dimulai), penerapan di cloud, dan penyetelan besaran peluang dengan data uji panitia.

### Kumpulan 1000 berita, pemuatan ke database, dan tombol Mulai ulang berita (19 Nov)

Permintaan pengguna: total berita jadi 1000; kumpulan sudah ditinjau dan lolos, minta dimasukkan ke web; tambah tombol untuk memulai ulang berita.

- **1000 berita**: 520 harga (130 tema × 2 arah × 2 varian; 67 tema baru di `scripts/data/news-themes-2.ts`) + 480 event (30 aset × 1 bangkrut + 5 suspensi + 10 dividen); sebab dividen 10 → 12; pemilihan sebab berurutan dari titik awal yang bergeser per aset (tak berulang per aset). Judul tema AI diubah karena bentrok dengan berita lama di database. Tes: tepat 1000 dan 1/5/10 per aset. Simulasi 3 hari (2 benih): 213–230 berita terbit, 31–40 event, bangkrut 0–3, sisa berita harga 328–338.
- **Dimuat ke Docker** (`npm run load-news`, `scripts/load-news-pool.sh`; SQL idempoten menurut judul, melewati penguncian lewat `classmeet.system`): `ready 1000` (+ 12 berita lama `applied`). Game di Docker sudah berjalan, jadi mesin langsung mulai menerbitkan. Untuk game baru sebelum dibuka tetap `npm run seed`.
- **Tombol Mulai ulang berita**: `admin_restart_news()` (`scripts/sql/news-restart.sql`, sudah dijalankan di Docker, cloud belum), server action `restartNews`, tombol + dialog konfirmasi di kartu "Kumpulan berita terkunci", audit `restart_news`. Mengembalikan berita `applied`/`live` ke `ready` (yang efeknya di luar 10–15 aset → `draft`; 12 berita lama 4–7 aset menjadi `draft`), mengosongkan `news_feed` dan `market_event_log`, menghapus jeda, memulai masa tenang event lagi. Harga, saldo, order tidak diubah. Mengubah aturan docs/07 §3.7.
- **Diuji**: di browser (admin): kartu jenis berita menampilkan 519/30/150/300 saat itu, dialog konfirmasi tampil, restart dua kali: database `ready` 1000, `draft` 12, `news_feed` kosong lalu berita baru terbit, audit 2 baris. tsc, eslint, vitest (122 tes) lolos.
- **Catatan**: panel Browser di aplikasi ini tidak mempercayai sertifikat port 443, jadi angka di layar admin tidak menyegarkan dirinya di panel itu (permintaan klien gagal); muat ulang halaman atau pakai browser yang mempercayai CA. Bukan galat aplikasi.

### Layar Daftar Pos `/display/posts`: dua zona Tersedia | Tidak tersedia (19 Nov)

Permintaan pengguna: cari referensi desain untuk layar Pos, lalu pilih arah **B (dua zona)**.

**Referensi Refero** (halaman status dan papan kerja): Revolut System Status (judul besar + kartu dua kolom), OpenSea Status, Zendesk Status (legenda, "Updated"), Workflow Kanban (kolom berjudul, kartu berpindah), Luma Events (penanda LIVE), Zendesk Live calls (kartu hitungan). Arah dipilih: dua zona dengan angka hitungan besar + kartu yang meluncur antar zona.

**Perubahan** (`components/display/posts-screen.tsx` ditulis ulang; data, Realtime, polling 15 dtk, dan peringatan "Terputus…" tetap):
- Panggung 1920×1080 (`ScaledStage`, seperti layar publik lain), tanpa gulir. Kiri **Tersedia** ("Masih kurang tim atau belum ada tim untuk memulai permainan", panel hijau tipis), kanan **Tidak tersedia** ("Pos penuh atau permainan sedang dimulai", panel putih); tiap zona punya angka hitungan 132 px, titik + nama zona (status selalu teks), dan keadaan kosong ("Tidak ada pos tersedia" / "Semua pos sedang tersedia").
- Satu kartu per pos (nomor, nama, lokasi). DOM stabil menurut id dan posisi lewat `transform`, jadi saat penjaga mengubah status, kartu **meluncur ke zona lain** (0,8 dtk; tanpa animasi bila gerak dikurangi); sisa kartu menata ulang. Pos yang baru berganti status diberi cincin oranye + lencana "Baru" selama 90 detik.
- `lib/display/posts-layout.ts` (+ tes, 5): kolom menurut jumlah pos per zona (≤5 satu kolom, ≤16 dua, ≤30 tiga, selebihnya empat), tinggi kartu dan huruf turunan; semua kartu muat untuk 0–60 pos.
- Pembaca layar: daftar tersembunyi per zona (nomor, nama, lokasi, status); kartu visual `aria-hidden`.
- `app/display/posts/page.tsx` dan pratinjau `/dev/display-posts` dibungkus `fixed inset-0`; pratinjau punya opsi `&open=none|all`.
- Warna dan komponen tidak diubah (token yang sama).

**Diuji** (1920×1080): data nyata (6 pos) tampil; mengubah dua pos jadi Tidak tersedia lewat SQL membuat kartunya berpindah lewat Realtime (posisi x 501 → 1000, lencana Baru muncul); 16 pos satu zona (dua kolom, nama terbaca), 2 pos semua tersedia, zona kosong; rotasi `/display?screen=posts` tetap jalan. tsc, eslint, vitest lulus. Catatan: animasi meluncur dihitung di panggung berskala; pada layar bukan 1920×1080 jaraknya mengikuti skala (tetap benar, hanya kurva halus). **Belum diuji**: layar 1280×720 sungguhan dan >30 pos.

### Admin → Berita: aset yang berubah dan persennya (19 Nov)

Permintaan pengguna: tambahkan aset apa saja yang perlu berubah dan seberapa persen perubahannya di halaman berita admin.

- **Sumber data**: sesudah game dibuka `news_effects` disembunyikan dari admin (RLS), jadi `scripts/sql/news-effects-admin.sql` menambah `admin_current_news_effects()` (hanya admin; sudah dijalankan di Docker, cloud belum): efek (bps), event (bangkrut/dividen/suspensi) berita terbaru yang `live` atau `applied`. Tidak mengembalikan `effect_at`, jadi admin tetap tidak tahu KAPAN harga berubah.
- **UI** (`components/admin/news-effects.tsx`, `news-board.tsx`, `lib/admin/data.ts`): kartu "Berita saat ini" memuat "Aset yang berubah (N)" dengan lencana **Belum berlaku** (live) atau **Sudah berlaku** (applied), kolom **Naik** dan **Turun** (urut dari terbesar; simbol, nama, chip ▲/▼ + persen) dan chip event. Sebelum game dibuka, tiap berita draf punya ringkasan "Lihat aset dan persen perubahannya" yang memuat efeknya saat dibuka (tidak memuat ratusan berita sekaligus). Teks kartu terkunci diperbarui.
- **Menyimpang dari aturan**: docs/07 §3.7 menyebut admin tidak boleh tahu apa yang akan berubah; untuk berita `live` admin kini melihat efeknya sebelum berlaku (catatan di docs/07). Bila ingin dibatasi hanya yang sudah berlaku, cukup ubah fungsi SQL itu.
- **Diuji**: di browser (admin): berita live menampilkan 13 aset (12 naik +0,6…+5,3 %, 1 turun −1,1 %) berstatus Belum berlaku. Tes: pemetaan data (bps/100, event, status, tanpa berita), `eventText`. tsc, eslint, vitest (129 tes) lolos. **Belum diuji di browser**: ringkasan efek berita draf (game di Docker sudah terkunci; hanya ada di tes dan kode).

### Halaman Pasar tim: persen perubahan mengikuti harga open hari ini (19 Nov)

Masalah (pengguna): chip persen di daftar aset Pasar sering hanya 0,0 %. Penyebab: persen = harga transaksi terakhir vs harga acuan **sekarang**; bandar mengutip di sekitar acuan, jadi hampir selalu 0,0 % (harga acuan sendiri berubah lewat berita, sehingga perubahannya "hilang").

Perubahan: pembanding diganti **harga open hari ini** = harga acuan saat hari (WIB) dimulai, yaitu harga acuan terakhir sebelum 00.00 WIB dari `price_history` (hari pertama: harga dasar). `scripts/sql/market-day-open.sql` menambah `get_day_open_prices()` (tim/admin/display; sudah dijalankan di Docker, cloud belum); `lib/market/data.ts` (`dayOpen`, cadangan = harga acuan bila RPC gagal), chip di `asset-list.tsx` dan `asset-detail.tsx` (persen dan selisih Rp), serta stat "Open" di detail (sebelumnya harga transaksi pertama sepanjang game) kini memakai harga open hari ini. ARA/ARB tetap berdasarkan harga acuan. Layar publik diubah menyusul (di bawah).

Diuji: tim Elang di browser: Airbus +6,4 %, Apple −5,8 %, BCA +4,8 % (sebelumnya 0,0 %). tsc, eslint, vitest lulus (tes `mergeMarket` ditambah).

**Menyusul: Terbaik/Terlemah di Display pasar** (`lib/display/data.ts`, `view.ts`): memakai harga open hari ini yang sama (`get_day_open_prices`, akun display boleh memanggilnya); `movers` menerima `openPrice` (bukan `refPrice`); gagal dimuat → harga acuan. IKC dan indeks sektor tidak berubah (basis 1.000 sejak awal game). Diuji: layar publik menampilkan Airbus +6,4 %, Visa +5,9 %, Telkom −7,0 %, Apple −5,8 %, sama dengan halaman tim. tsc, eslint, vitest (130 tes) lulus.

### Grafik IKC di Display pasar: sumbu mengikuti data + riwayat di server (19 Nov)

Pertanyaan pengguna: grafik tetap lurus walau sudah ada jual beli dan banyak berita. Penjelasan: IKC = rata-rata (harga terakhir / harga dasar) × 1000 atas 30 aset; berita menggeser IKC 2–15 poin saat efeknya **berlaku** (3–15 menit sesudah terbit), satu transaksi hanya ±0,02 poin. Grafik terlihat rata karena (1) sumbu Y selalu memuat garis 1.000 (sumbu 950–1.100 menekan 10 poin jadi ±7 % tinggi), (2) datanya dicuplik oleh browser layar itu sendiri (mulai dari layar pertama menyala, kosong di perangkat lain), (3) berita yang terlihat belum tentu sudah berlaku.

Perbaikan (disetujui pengguna: A dan B):
- **A. Sumbu mengikuti data** (`lib/display/ikc.ts`): rentang Y dari nilai data (garis dasar 1.000 hanya digambar bila kebetulan di dalam rentang). Grafik memperlihatkan **hari ini** (`todaySeries`, batas hari WIB; kurang dari 2 titik → seluruh seri) dengan keterangan "Grafik hari ini sejak HH:MM"; label sumbu X memuat tanggal bila rentang > 20 jam.
- **B. Riwayat IKC di server** (`scripts/sql/index-history.sql`, sudah dijalankan di Docker; cloud belum): tabel `index_history`, `record_index_sample()` lewat pg_cron `index-sample` tiap 30 detik (mencatat bila IKC berubah atau sudah ≥ 5 menit sejak catatan terakhir, hanya saat pasar `open`), `get_index_history(p_max=1200)` (tim/admin/display; dijarangkan di server), isi awal dari `price_history` (18 titik sejak 17 Nov). Layar memuat riwayat saat menyala lalu tiap menit (`fetchIndexHistory`), menyambungnya dengan cuplikan lokal yang lebih baru (`mergeSeries`); tanpa riwayat server (SQL belum dijalankan) layar memakai cuplikan lokal seperti sebelumnya.
- **Diuji**: layar memuat riwayat penuh sejak 17 Nov 13.50 (sebelum penyaringan hari ini), lalu grafik hari ini menampilkan 1.068 → 1.096 → 1.085 → 1.087 dengan sumbu 1.060–1.100 (sebelumnya terlihat rata). tsc, eslint, vitest (134 tes: `todaySeries`, `mergeSeries`, sumbu) lolos. **Belum**: penanda berita di grafik (usulan C).

### Paket perubahan 19 Nov (sebagian): riwayat berita admin, berita 2 paragraf, pembaca berita, dropdown riwayat, filter sektor, tabel aset, teks peringkat

1. **Riwayat berita yang sudah berlaku (admin/news)**: `scripts/sql/news-history-admin.sql` (`admin_applied_news`, `admin_news_effects`; hanya berita `applied`, tanpa yang belum berlaku/`effect_at`; sudah dijalankan di Docker, cloud belum), kartu "Riwayat berita yang sudah berlaku" (`components/admin/news-history.tsx`): terbaru dulu, waktu terbit/berlaku, jumlah aset, chip event, buka satu berita untuk melihat aset dan persennya. Diuji di browser.
3. **Berita minimal 2 paragraf**: `impactParagraph` di `scripts/news-pool-lib.ts` menambah paragraf kedua yang menyebut perusahaan yang diperkirakan naik/turun menurut efek sebenarnya (deterministik menurut judul, tidak menggeser undian efek); validasi pool menolak berita < 2 paragraf; `npm run load-news` kini juga memperbarui isi berita `ready`/`draft` yang sudah ada (981 berita di Docker diperbarui; efek diperiksa sama). Berita yang sudah terbit/berlaku tetap teks lama.
9. **Pop-up berita → halaman baca (state saja, URL tetap)**: `components/team/news-reader.tsx` (`NewsReaderHost` di `app/team/layout.tsx`, `useNewsReader`): isi halaman disembunyikan (tetap terpasang), tampil artikel berparagraf dengan "Kembali"/Escape; dipakai kartu Berita (Beranda) dan baris berita (Pasar); `news-dialog.tsx` dihapus. Pratinjau daftar memakai paragraf pertama; layar publik berita menampilkan dua paragraf. Diuji: URL tetap `/team`, 2 paragraf tampil, Escape kembali.
10. **Riwayat tim**: pop-up rincian transaksi diganti dropdown di bawah barisnya (`history-board.tsx`, satu terbuka sekali).
8. **Filter sektor** di daftar aset Pasar tim (`asset-list.tsx`): dropdown "Semua sektor (30)" + 6 sektor dengan jumlah, bersama pencarian.
6. **Tabel admin/assets**: lebar kolom dirapikan (tidak lagi terpotong di kolom Status/Aksi pada layar 1440), "Harga acuan" → "Acuan".
7. **Layar Peringkat**: tulisan "Peringkat Tim / Total = saldo + nilai aset" dihapus.

4. **Recharts untuk grafik display/market**: `npm install recharts` (^3.11); `components/display/ikc-chart.tsx` (AreaChart ukuran tetap, garis berundak `stepAfter`, tanpa animasi/tooltip, 5 label waktu berjarak sama, sumbu Y dari `valueDomain` yang mengikuti data, garis 1.000 hanya bila dalam rentang); SVG buatan sendiri dan `chartGeometry` dihapus dari `lib/display/ikc.ts` (tes diganti tes `valueDomain`). Diuji di 1920×1080: grafik tampil dengan sumbu 1.020–1.120, tinggi halaman 1080.

5. **Tambah pos (admin/posts)** dan 2. **Tambah tim (admin/teams)**: tombol + dialog form. Membuat akun Supabase Auth tidak bisa lewat fungsi SQL, jadi dua server action memakai **service role** (`lib/supabase/service.ts`, kunci `SUPABASE_SERVICE_ROLE_KEY` hanya di server, tanpa NEXT_PUBLIC) SETELAH peran admin diperiksa (`lib/admin/require-admin.ts`). Kunci itu kini ada di `.env.local` (diambil dari `.env` tumpukan Docker; berkas di-gitignore) dan perlu diisi juga di server produksi. Ini melonggarkan aturan docs/06 ("service role hanya di skrip lokal"): kunci kini dibaca proses server aplikasi.
   - **Tambah tim** (`createTeam`, `team-create-dialog.tsx`): isi nama; username `timN` berikutnya, `qr_token` UUID (kata sandi akun), dan kode cadangan unik dibuat otomatis; akun, profil, dan baris `teams` (saldo 0) dibuat, dengan pembatalan bila ada langkah gagal; audit `create_team`. Kartu QR ditampilkan sebagai GAMBAR (data URI dari zxing writer, tidak ada token sebagai teks) dengan tautan unduh PNG; gagal membuat gambar → petunjuk `npm run print-qr`.
   - **Tambah pos** (`createPost`, `post-create-dialog.tsx`): isi nama game, lokasi, dan kata sandi awal penjaga (min. 8); nomor pos dan username `guardN` berikutnya otomatis; akun penjaga dibuat dengan service role, lalu pos dibuat lewat `admin_upsert_post` memakai sesi admin (validasi dan audit database); pos mulai Tidak tersedia; audit `create_guard`.
   - **Diuji** di Docker dengan akun admin: tim "Tim Uji Otomatis" (tim6) dibuat, QR di dialog terbaca kiosk dan masuk sebagai tim itu; pos "Pos 7 · Lompat Uji" + guard7 dibuat, guard7 bisa masuk lewat API, baris tampil di tabel. Data uji sudah dihapus. Tes: `lib/admin/accounts.test.ts` (nomor berikutnya, kode cadangan). tsc, eslint, vitest (141 tes) lulus.

### Fitur hapus tim dicabut (19 Nov)

Permintaan pengguna: tombol/fungsi hapus tim tidak jadi dipakai, kembalikan ke commit sebelumnya. Dilakukan dengan `git revert` commit `10ed4a4` (riwayat git tetap utuh, bisa dikembalikan lagi dari commit itu): dialog Hapus, pascode 6 digit, aksi `deleteTeam`, `scripts/sql/team-delete.sql`, dan catatan `ADMIN_DELETE_PASSCODE` dihapus. Dipertahankan (bukan bagian fitur hapus): perbaikan pembuatan QR tim baru tanpa internet (`lib/admin/qr-png.ts` memuat biner `.wasm` dari `node_modules`) dan entri `.gitignore` untuk `KREDENSIAL.local.md`. Di database Docker, objek SQL fitur itu juga dicabut: fungsi `admin_delete_team`, trigger `orders_deleted_team_guard`, kolom `teams.deleted_at`, dan view/fungsi (`v_team_net_worth`, `get_leaderboard`, `resolve_team_qr`, `resolve_team_code`, `award_payout`) dikembalikan ke definisi semula; tidak ada tim yang sempat tertandai dihapus. Baris pascode di `KREDENSIAL.local.md` dihapus. Untuk memakainya lagi: `git revert` pada commit pencabutan ini.

## Berita format baru: petunjuk lewat sifat aset, tanpa nama perusahaan (20 Nov)

Permintaan: berita bergaya contoh panitia (tren sektor, ciri perusahaan sebagai petunjuk, kalimat pengecoh), minimal 2 paragraf; perbarui tema dan mesin berita. Rancangan disetujui sebelum mulai (lihat docs/15 §3a).

Perubahan (hanya generator dan data; mesin SQL `news-engine-v2` tidak berubah):
- `scripts/data/asset-traits.ts`: kamus sifat 30 aset (frasa ciri + kata kunci khas); `docs/16-sifat-aset.md` untuk ditinjau.
- `scripts/data/news-noise.ts`: bank pengecoh (27 umum + 18 per sektor, termasuk contoh panitia); tidak memuat kata kunci sifat aset.
- `scripts/data/news-themes-3.ts`: 6 tema tren sektor (3 dari contoh panitia, 3 tambahan); `Theme.a` = bobot per simbol. Enam tema lama paling mirip dilepas: tetap 130 tema, 1000 berita (520 harga + 480 event).
- `scripts/news-pool-lib.ts`: paragraf 2 = `hintSentence` (maks. 2 aset naik + 2 turun dari ciri, efek ≥ 1 %) + "Di sisi lain, …" (topik berdekatan dengan sektor utama) + "Selain itu, …". Efek pengisi dikecilkan (≤ 0,9 %) agar tidak pernah jadi petunjuk; peluang masuk aset berbobot ≥ 2 dinaikkan (97 %). `validatePool` baru: berita harga tidak menyebut nama aset, berita event hanya subjeknya, petunjuk aset naik/turun terbesar ada di paragraf 2.
- `npm run load-news -- --replace`: mengganti semua berita `ready`/`draft` (isi dan efek); yang punya riwayat dibatalkan + judul arsip; yang sudah terbit tidak disentuh. Dimuat ke Docker lokal: ready 952 (48 judul sudah terpakai di game uji lama), cancelled 12.

Hasil: vitest 144 lolos (tes baru: nama tidak bocor, petunjuk cocok efek, pengecoh bebas kata kunci, kamus tanpa kata kunci ganda), tsc/eslint/prettier bersih. Simulasi 3 hari (rollback): 192 berita terbit (164 harga, 28 event; 2 bangkrut), event paling awal 198/61/39 menit setelah pasar dibuka (≥ 30), sisa berita harga 318, tidak ada aset di batas harga, sd perubahan akhir 0,14. Server sekolah belum memuat berita (ditunda sesuai keputusan).

## Mulai ulang berita dan petunjuk aset bangkrut (20 Nov)

Mulai ulang berita di Docker laptop (memanggil `admin_restart_news` sebagai admin): 1000 berita `ready`, feed dan catatan event dikosongkan, berita pertama terbit dari kumpulan baru. Temuan: petunjuk menyebut ciri Xiaomi, padahal Xiaomi bangkrut sehingga efeknya dibuang saat terbit. Perbaikan: `news_pool()` di `scripts/sql/news-engine-v2.sql` mengecualikan berita yang aset berpetunjuknya nonaktif (lihat docs/15 §3a). Diterapkan ke Docker laptop (bukan cloud). Uji: 721 dari 999 berita `ready` layak pakai, 0 yang petunjuknya menyebut aset nonaktif (diperiksa terhadap aturan pembuat berita); satu berita yang efeknya sudah terpangkas karena pernah terbit diganti lewat `load-news -- --replace`.

## Trading model toko, tahap 2: SQL (20 Nov)

Cabang `feat/trading-toko`. Spesifikasi di docs/17. `scripts/sql/trading-shop.sql` (migrasi sekali, diterapkan ke Docker laptop setelah cadangan penuh) dan `scripts/sql/test-trading-shop.sql` (54 pemeriksaan, rollback). Isi dan keputusan teknis di docs/17 §8. Total kas sebelum dan sesudah sama (Rp 310.316.320); order lama dibuang; simulasi berita 3 hari sehat. UI tim, display, dan admin masih memakai order book lama sehingga sementara tidak berfungsi sampai tahap 4–5.

## Trading model toko, tahap 4: UI tim (20 Nov)

Cabang `feat/trading-toko`. Pasar (daftar aset dipertahankan, detail aset baru, panel Beli/Jual), Portofolio, Riwayat memakai `transactions`; halaman Orders dan komponen order book dihapus; `database.types.ts` dibuat ulang; tes diperbarui (135 lolos). Rincian di docs/17 §9. Display dan admin belum diubah; `PANDUAN-TRADING.md` ditulis ulang di tahap dokumentasi.

## Trading model toko, tahap 5: admin dan display (20 Nov)

Admin: halaman Transaksi baru, kartu Pengaturan toko di Aset, istilah bandar/order dibersihkan, label audit. Display: Transaksi terakhir dari `get_last_transactions`. SQL baru `admin_transaction_summary` dan `get_last_transactions` di `trading-shop.sql` (diterapkan ke Docker lokal). Rincian dan hasil uji di docs/17 §10. Halaman admin belum diuji di browser.

## Trading model toko, tahap 6: pembersihan dan dokumentasi (20 Nov)

`scripts/sql/trading-shop-cleanup.sql` membuang kolom order book (`locked_*`, `fee_bps`, `band_bps`, `house_*`, `rank_*`, dan lain-lain) dan menyesuaikan view/tipe ringkasan; diterapkan ke Docker lokal setelah cadangan. `PANDUAN-TRADING.md` ditulis ulang; docs/04, 05, 07, README diperbarui. Rincian di docs/17 §11.

## Cloudflare Tunnel sebagai pengganti Caddy (20 Nov)

Alasan: tester lain di jaringan yang sama membuka `https://192.192.2.222:3443` tetapi realtime gagal, karena API/WebSocket di `https://192.192.2.222` (port 443) memakai sertifikat CA internal Caddy yang belum dipercaya perangkatnya (pengecualian peramban hanya berlaku untuk `:3443`). Saat acara pasti ada internet, jadi Caddy diganti Cloudflare Tunnel (sertifikat publik, tanpa instal CA, tidak terikat WiFi/IP).

Dibuat:
- `deploy/supabase/docker-compose.tunnel.yml`: kontainer `cloudflared` (tunnel dikelola jarak jauh lewat `TUNNEL_TOKEN`).
- `deploy/supabase/10-up.sh --tunnel`: memeriksa URL https dan token, menyetel `COMPOSE_FILE`, menghentikan `supabase-caddy`.
- `deploy/supabase/55-tunnel-env.sh app.<domain> api.<domain>`: menyetel `SUPABASE_PUBLIC_URL`, `API_EXTERNAL_URL`, `SITE_URL`, mencetak baris `.env.local`.
- `next.config.ts`: `allowedDevOrigins` ikut membaca `CLASSMEET_PUBLIC_HOSTS`.
- README: bagian "Cloudflare Tunnel (mode C)". Caddy dan `dev:https` tetap ada sebagai cadangan.

Hasil (domain `rahmadarifin.my.id`, app dan api lewat tunnel `classmeet`): HTTPS aktif setelah sertifikat Universal Cloudflare terbit; `/display/market` memuat data, WebSocket Realtime menjawab ok. Catatan: penyebaran nameserver `.id` lambat; resolver 8.8.8.8/9.9.9.9/1.0.0.1 masih menjawab nameserver lama (NXDOMAIN) berjam-jam setelah ganti nameserver, sehingga perangkat di jaringan tertentu belum bisa membuka alamatnya (Safari: "tidak dapat menemukan server").

## Mode server sekolah: image aplikasi di port 8111 (20 Nov)

Server sekolah (`172.16.27.38`, SFTP port 2222) dipasangi lewat VS Code SFTP. Dibuat:
- `.vscode/sftp.json`: bagian `ignore` (node_modules, .next, .git, data Postgres mentah, dump, kredensial lokal); berkasnya sendiri masuk `.gitignore` karena berisi kata sandi server.
- `Dockerfile` (3 tahap: `npm ci`, `next build`, `next start`; node 22; `NEXT_PUBLIC_*` sebagai build arg; rahasia tidak masuk image) dan `.dockerignore`.
- `deploy/supabase/docker-compose.app.yml`: layanan `app` (`classmeet-app`), port 8111 menuju 3000, `env_file: .env.local`.
- `10-up.sh --server`: Supabase + cloudflared + aplikasi.
Hasil uji lokal (laptop): image dibangun (`classmeet-app:local`), kontainer sehat di port 8111, `/login` 200, `/display/market` 200 dan menampilkan data pasar (masuk otomatis peran display). Temuan: penyebaran DNS domain belum selesai, sehingga kontainer tidak bisa menjangkau `api.<domain>` lewat DNS biasa; pengujian memakai `extra_hosts` sementara (tidak disimpan). Opsi `dns: 1.1.1.1` di compose dicoba dan dibuang (tidak membantu, dan bisa memutus resolusi bila jaringan sekolah memblokir DNS luar).

## Paket migrasi database ke server sekolah (20 Nov)

Keputusan: di server sekolah hanya skema dan akun admin yang dipindah; data game dan berita menyusul.
- `deploy/supabase/80-export-bundle.sh [--roles admin[,display]]`: satu berkas `bundle/migrasi-<waktu>.sql` berisi ekstensi, penetral hak bawaan, skema `public` (tanpa `CREATE SCHEMA public`), akun terpilih (auth.users, auth.identities, public.profiles lewat COPY dengan kolom non-turunan), baris `game_settings` bawaan, job cron (3), dan tabel Realtime (5).
- `deploy/supabase/85-import-bundle.sh <berkas>`: menolak bila `teams` sudah ada, menunggu `auth.users`, memuat berkas, mencetak pemeriksaan (tabel, fungsi, cron, Realtime, akun).
- Pengujian: berkas dimuat ke database sementara (`scratch_mig`, auth.* dan `auth.uid()` ditiru; pg_cron tidak bisa di luar database `postgres`): 20 tabel, 70 fungsi, 2 akun + 2 identitas, 1 baris pengaturan, 5 tabel Realtime, impor sukses (exit 0). Hak akses cocok dengan sumber (anon 0 fungsi dieksekusi, authenticated 47, anon 0 hak tabel). Pernyataan cron dijalankan ulang di database asli: daftar job identik (idempoten). Penjaga `teams` ada: impor ke database yang sudah berisi ditolak. Impor penuh ke stack baru belum dicoba (butuh server sekolah).
- Folder `deploy/supabase/bundle/` ada di `.gitignore`; sengaja tidak masuk ignore SFTP supaya bisa diunggah.

## Pemulihan setelah sinkron remote ke lokal (20 Nov)

Sinkron "remote -> lokal" lewat SFTP membuat 32 berkas menjadi 0 byte (`.gitignore`, `.env.example`, `README.md`, `lib/supabase/*`, `deploy/supabase/10-up.sh`, README deploy, docs, generator berita, dan `stack/.env`). Dipulihkan dari git (HEAD) lalu perubahan hari ini diterapkan ulang; daftar berkas 0 byte disimpan di `~/classmeet-recovery/zero-files.txt`.

## Alamat internal Supabase untuk kode server (21 Nov)

Pengamatan guru: jalur "muter-muter". Kode server Next memanggil Supabase lewat alamat publik (Cloudflare) padahal satu mesin. Ditambah `SUPABASE_INTERNAL_URL` (opsional, server saja): `supabaseEnv()` kini mengembalikan `serverUrl` (internal bila diisi, selain itu publik) yang dipakai `lib/supabase/{server,proxy,service}.ts`; browser tetap memakai alamat publik. Nama cookie sesi dihitung dari alamat publik (`lib/supabase/cookie-name.ts`) dan diberikan eksplisit ke klien browser, server, dan proxy, jadi login tidak putus. Ukur (Node, 15 panggilan `rest/v1/assets`): publik median 134 ms (maks 2.108 ms) lawan internal median 15 ms (maks 36 ms). Uji lewat domain tunnel: login QR dua kali, Pasar memuat data server-side, display masuk otomatis; tes vitest 146 lolos. Catatan: satu percobaan login tepat setelah env dan kode berubah gagal (dev server belum selesai memuat ulang); sesudah dipanaskan berjalan normal.

## Notif bangkrut hilang setelah berita berikutnya (21 Nov)

Sebelumnya kotak "Bangkrut" di Pasar tim tampil selamanya untuk semua aset bangkrut. Kini tampil hanya sampai efek berita BERIKUTNYA diterapkan: fungsi baru `get_bankrupt_notices()` (security definer; tim tidak boleh membaca `news`, jadi disaring di server) menyaring aset yang `bankrupt_at`-nya belum disusul berita `applied` lain (`effect_applied_at > bankrupt_at`, berita pemicu sendiri dikecualikan). `fetchBankruptAssets` memanggil RPC itu; aset tetap bangkrut dan tak bisa diperdagangkan, hanya notifnya yang hilang. Migrasi: `scripts/sql/bankrupt-notice.sql`. Uji: transaksi di-ROLLBACK (0, lalu 1 saat bangkrut baru, lalu 0 setelah berita berikutnya diterapkan); di peramban Pasar tim memanggil RPC (200) dan dua notif lama (SM, XI) sudah hilang; tsc, eslint, vitest lolos. Suspensi sudah otomatis hilang saat waktunya habis.

## Grafik IKC display: garis lurus, bukan berundak (21 Nov)

Grafik IKC di display tampak berkotak-kotak. Sebabnya `stepAfter` (sejak grafik dibangun ulang dengan Recharts) dipadukan dengan titik riwayat yang hanya dicatat saat nilai IKC berubah (`index-sample`), sehingga pada model toko (IKC bergerak per transaksi dan berita, bukan per order) tiap perubahan tampil sebagai anak tangga. Diganti `type="monotone"` (kurva halus yang tidak melampaui nilai asli; sempat `linear`) di `components/display/ikc-chart.tsx`. Diperiksa di 1920×1080: garis kini menyambung halus antar titik; lint dan tes display lolos.

## Tombol Reset game (21 Nov)

Permintaan: satu tombol untuk memulai ulang game dan mereset semua uang, riwayat, berita, dan grafik IKC. Dibuat `admin_reset_game()` (`scripts/sql/game-reset.sql`; hanya admin, boleh di status apa pun, satu transaksi, penguncian `classmeet.system` hanya di dalam fungsi):
- **Dikosongkan:** `transactions`, `holdings`, `payouts`, `dividends`, `price_history`, `index_history`, `leaderboard_snapshot`, `news_feed`, `market_event_log`.
- **Dikembalikan:** saldo tim Rp 0; aset ke `base_price`, `init_stock`, tekanan stok 0, aktif lagi (bangkrut/suspensi dicabut); berita `live`/`applied` kembali `ready` (efek 10-15 aset) atau `draft`; `game_settings.state = setup` dengan `started_at`, `paused_at`, `market_opened_at`, pembekuan, dan jeda berita dikosongkan; `shop_clock` diulang. Karena `started_at` kosong, harga, berita, dan pengaturan bisa diedit lagi.
- **Tidak diubah:** akun, tim (nama, QR), pos, daftar aset, isi berita, pengaturan, log audit (ditambah `reset_game`).
UI: kartu "Reset game" di Status Game (`components/admin/state-board.tsx`) dengan dialog konfirmasi yang meminta mengetik `RESET` (`ConfirmDialog` kini punya `children` dan `confirmDisabled`); aksi server `resetGame`; log audit menampilkan ringkasannya (kategori status). Uji: SQL dalam transaksi yang di-ROLLBACK (tim ditolak `forbidden`; sesudah reset saldo 0, semua tabel riwayat 0, tidak ada aset dengan harga/stok menyimpang, 1000 berita `ready`, status `setup`, tim dan pos utuh, audit tercatat); di peramban dialog: tombol mati sampai `RESET` diketik, Batal menutup. Reset sungguhan lewat tombol tidak dijalankan pada data uji supaya data tidak hilang.

## Tombol Mulai game dan layar "Game belum di mulai" (21 Nov)

- **Status Game saat `setup`:** tombol "Buka pasar" dan "Akhiri game" diganti satu tombol lebar **Mulai game** (konfirmasi: pasar dibuka, berita mulai dari awal, harga/berita/pengaturan terkunci). Tombolnya memanggil `admin_set_game_state('open')` yang sama (mengisi `started_at` dan `market_opened_at`, langsung menjalankan siklus berita sehingga berita pertama terbit, dan `shop_init_assets`); tidak ada perubahan SQL. Saat `open`/`paused`, tombol Buka/Tutup pasar dan Akhiri game tidak berubah.
- **Layar publik:** `components/display/game-gate.tsx` (`DisplayGate`) membungkus `/display` (bergilir), `/display/market`, `/display/news`, `/display/leaderboard`, dan `/display/posts`. Status game dicek tiap 5 detik (nilai awal dari server, tanpa kedipan); selama `setup` layar tertutup tulisan besar "Game belum di mulai" (240 px di panggung 1920×1080, dua baris, tebal, supaya terbaca dari jauh di TV; merek di kiri atas), dan layar di bawahnya tetap terpasang sehingga langsung tampil saat game dimulai.
- **Uji (peramban, data uji dalam keadaan setup setelah reset):** kelima layar menampilkan tulisan itu; klik Mulai game, konfirmasi: status `open`, `started_at` dan `market_opened_at` terisi, 1 berita langsung tayang; lalu Reset game lewat UI (ketik `RESET`) mengembalikan `setup`, 1000 berita `ready`, grafik IKC kosong, audit `reset_game` tercatat (jalur tombol Reset sampai database kini teruji). Cadangan sebelum uji: `~/classmeet-recovery/db-pre-startbutton-*.dump`. `tsc` dan ESLint bersih.

## Layar "Game belum di mulai": penanda hidup dan baris keterangan (22 Nov)

Referensi Refero (Teams "Waiting for others to join...", Rivian, Intercom, Pedestal): layar tunggu memakai satu pesan di tengah dengan sedikit elemen. Dipakai dua hal saja, latar tetap terang: **penanda hidup** (cincin putar halus 56 px, `animate-spin`, mati bila pengguna memilih kurangi gerak) dan **satu baris kecil** "Menunggu panitia memulai" (56 px) di bawah judul 240 px. `components/display/game-gate.tsx`. Diperiksa lewat halaman uji sementara (dihapus); lint dan tsc bersih.

## `npm run build` gagal: font Inter dari Google Fonts (22 Nov)

Galat: `Failed to fetch Inter from Google Fonts` saat `npm run build` (tidak ada akses ke fonts.googleapis.com; `next/font/google` mengunduh font saat build). Diganti `next/font/local`: berkas `app/fonts/inter-latin-wght-normal.woff2` (Inter variabel 100-900, subset latin, 48 KB, dari paket `@fontsource-variable/inter` 5.3.0, lisensi OFL disertakan di `app/fonts/INTER-LICENSE.txt`) dan `app/layout.tsx` memakai `localFont` dengan variabel `--font-inter` yang sama, jadi tampilan tidak berubah. Efek lain: aplikasi dan build tidak lagi butuh internet untuk font (penting di jaringan sekolah). Hasil: `npm run build` selesai (±17 detik), semua rute terbentuk; halaman `/login` memuat font dari `/_next/static/media/...woff2` (lokal).

## Uji beban ringan di laptop (22 Nov)

Konteks: 17 tim bermain, tetapi hanya 4–5 perangkat tim (ditambah 1–2 display, 1 admin, 6 penjaga) yang aktif bersamaan, sehingga beban nyata jauh di bawah 30 klien. Skrip `scripts/load-test.mjs` (`npm run load-test -- --clients 30 --seconds 150 --displays 2 --spike [--url ...]`) meniru aplikasi: login 5 akun tim + display (akun seed), lalu tiap klien mem-polling pasar 5 dtk (6 panggilan), saldo 10 dtk, berita 30 dtk, membuka satu koneksi Realtime, dan beli/jual acak 1 unit tiap ±20 dtk; display mem-polling 5 panggilan tiap 5 dtk; opsi `--spike` membuat semua klien membeli aset yang sama bersamaan. Persiapan: cadangan `~/classmeet-recovery/db-pre-loadtest-*.dump`, game dibuka lewat `admin_set_game_state`, saldo tim Rp 200 juta; sesudahnya game di-reset (`setup`, saldo 0, 686 transaksi uji dihapus).

Hasil (Supabase lokal, lewat `localhost:8000`, 30 klien tim + 2 display, ±40 panggilan/detik, 150 dtk dengan lonjakan):
- Median 6–13 ms, p95 13–23 ms, **tidak ada galat teknis**; 30 dari 30 koneksi Realtime tersambung. Lonjakan 30 pembelian serentak pada satu aset: median 36 ms, maks 49 ms, semua berhasil.
- Galat yang muncul hanya penolakan aturan yang benar: `insufficient_holdings` (menjual yang tidak dimiliki) dan `insufficient_stock` (stok habis sesudah lonjakan).
- Beban server rendah: Postgres 2–20 % CPU, PostgREST ≤ 34 %, cloudflared < 2 %; tugas cron rata-rata 16 ms (maks 0,29 dtk), tidak ada yang gagal.
- Temuan: sesekali ada **jeda 1–2 detik yang mengenai semua panggilan sekaligus** (dua dari empat putaran; tampak juga pada penguji terpisah yang memanggil PostgREST tiap 0,2 dtk, jadi bukan dari skrip). Tidak ada log Postgres yang menjelaskannya (kemungkinan penjadwalan macOS/Docker Desktop). Dampaknya hanya satu siklus polling terlambat.
- Lewat tunnel Cloudflare (`https://api.rahmadarifin.my.id`, 15 klien + 1 display, 90 dtk): median ±140 ms, p95 ±700 ms, maks ±2 detik, tidak ada galat teknis, 15 dari 15 Realtime tersambung. Angka ini termasuk perjalanan keluar-masuk jaringan dari laptop sendiri; di perangkat lain bergantung pada WiFi acara.
- Tidak tercakup: render halaman oleh server Next (hanya saat halaman dibuka/diganti, bukan polling) dan 6 penjaga yang memindai QR.
Kesimpulan: kapasitas jauh melebihi kebutuhan (≈15 klien); risiko acara ada di kondisi laptop dan jaringan (tidur, daya, WiFi), bukan di kode.

## Panduan gladi resik (22 Nov)

Dibuat `PANDUAN-GLADI-RESIK.md` (akar repo): persiapan H-2/H-1 (laptop server tidak tidur, tunnel, `npm run build && npm start`, cadangan, 17 tim + kartu QR dua set, kumpulan berita, perangkat), skenario gladi berurutan (cek awal, kartu QR dan sesi kiosk, Mulai game, simulasi permainan, uji gangguan, penutup dengan Reset game), pemantauan, urutan hari H, larangan (Reset/Akhiri game), dan kriteria lulus. Temuan saat menulis: menu **Ekspor** di sidebar admin mengarah ke `/admin/export` yang tidak ada (404); dicatat di panduan sebagai hal yang perlu diketahui.

## Data lama tampil saat kembali ke halaman (22-23 Nov)

Keluhan: di `admin/transactions` transaksi baru muncul sendiri, tetapi bila keluar halaman lalu kembali setelah ada transaksi baru, data lama tampil sampai di-refresh (sama di Portofolio tim). Penyebab: halaman memang tidak memakai Realtime (publikasi hanya `assets`, `game_settings`, `news_feed`, `payouts`, `posts`), tetapi memakai polling 10 detik lewat `usePolling`; dan Next 16 dengan Cache Components menyimpan halaman yang ditinggalkan (`<Activity>` tersembunyi) beserta `useState`-nya, sedangkan komponen mengisi state dari data awal hanya sekali. Saat kembali, pewaktu polling mulai dari nol dan tidak mengambil data langsung, jadi data lama tampil sampai ±10 detik. Terbukti di peramban (1 transaksi lama tampil 1 detik setelah kembali, 2 transaksi baru setelah 12 detik).

Perbaikan di satu tempat, `lib/hooks/use-polling.ts`: efek yang dijalankan ULANG (halaman muncul kembali) langsung memanggil `refresh`; pemasangan pertama tetap tidak memanggil (data awal dari server). Berlaku untuk semua halaman yang memakai `usePolling` (Transaksi admin, Portofolio, Riwayat, Pasar, dll.). Catatan: di mode dev, StrictMode menjalankan efek dua kali sehingga ada satu panggilan ekstra saat dipasang; tidak terjadi di produksi. Uji (build produksi): transaksi dibuat saat admin berada di halaman Aset, kembali ke Transaksi: transaksi baru tampil dalam ≤ 1,5 detik tanpa refresh. Data uji di-reset ke `setup`.

## Analisa Pasar (pay to win), tahap 1: SQL (23 Nov)

Fitur: tim membeli laporan analisa 4 paragraf untuk berita yang SEDANG TAYANG (efek harga belum berlaku); isinya frasa ciri (tanpa nama aset) yang akan naik/turun beserta kekuatannya dan perkiraan sisa waktu. Keputusan: hanya berita tayang, hint = frasa ciri tanpa nama, sekali beli per berita per tim (membeli lagi mengembalikan laporan lama tanpa biaya), harga awal Rp 200.000 yang boleh diubah admin kapan saja. Tahap 1 (`scripts/sql/analysis.sql`, tes `scripts/sql/test-analysis.sql`, 51 pemeriksaan lolos dalam transaksi ROLLBACK):
- `game_settings.analysis_price` (0..100 juta) dan `analysis_enabled`; sengaja tidak masuk penjaga `game_settings_news_lock`, jadi bisa diubah setelah game dimulai (`admin_set_analysis_settings`, tercatat di audit `set_analysis_settings`).
- `news_analysis` (laporan per berita, 4 paragraf, paragraf 1 memuat `{waktu}`; hanya admin dan hanya sebelum game dibuka, terkunci seperti `news`) dan `analysis_purchases` (salinan laporan yang dibeli, unik per tim dan berita; hanya terbaca tim pembeli, admin TIDAK membaca isi karena membocorkan efek berita).
- RPC tim: `get_analysis_offer()` (harga, bisa beli, alasan, sudah dimiliki; tidak membocorkan waktu efek), `buy_analysis(request_id)` (serial dengan beli/jual lewat `ob_lock`, idempoten, memotong saldo, mengganti `{waktu}` dengan rentang 2 menit seperti "sekitar 9 sampai 11 menit"), `get_my_analyses(limit)`. Galat: `forbidden`, `invalid_input`, `team_not_found`, `request_id_conflict`, `market_closed`, `feature_disabled`, `no_live_news`, `window_closed` (sisa waktu efek < 30 dtk; pemilik tetap bisa melihat laporannya), `analysis_unavailable`, `insufficient_cash`.
- RPC admin: `admin_set_analysis_settings`, `admin_analysis_log(limit)` dan `admin_analysis_summary()` (tanpa isi laporan).
- `admin_reset_game` (game-reset.sql, jalankan sesudah analysis.sql) kini juga mengosongkan `analysis_purchases`; harga dan teks laporan tetap.
- Tipe TS dibuat ulang dari database (postgres-meta). Tahap berikut: 2 pembuat laporan di generator berita dan muat ulang kumpulan, 3 UI tim, 4 UI admin, 5 dokumen dan uji peramban. Catatan: sampai tahap 2 selesai belum ada baris `news_analysis`, jadi `buy_analysis` menjawab `analysis_unavailable`.

## Analisa Pasar, tahap 2: pembuat laporan dan muat ulang kumpulan berita (23 Nov)

`scripts/news-pool-lib.ts`: `PoolNews.analysis` (4 paragraf) dibuat oleh `analysisParagraphs()` dari efek berita yang sebenarnya; tidak memakai RNG utama (hash judul), jadi judul, isi, dan efek 1000 berita TIDAK berubah (`docs/14` tidak berubah; ada tes yang memastikannya).
1. **Ringkasan:** judul, arah pasar (condong naik/turun/campuran), jumlah ciri naik dan turun yang berarti (efek ≥ 1 %), dan `{waktu}` (diganti `buy_analysis`, mis. "dalam sekitar 6 sampai 8 menit ke depan").
2. **Ciri naik** dan 3. **ciri turun:** sampai 3 ciri per sisi, urut dari terbesar, memakai frasa sifat ALTERNATIF aset (bukan frasa yang dipakai berita, `traitPhraseAlt`), dengan kekuatan kuat (> 4 %), sedang (2 sampai 4 %), ringan (1 sampai 2 %); sisanya disebut jumlahnya. Subjek berita event ditulis "perusahaan yang disebut di berita". Tanpa nama atau kode aset.
4. **Catatan:** jumlah perusahaan yang bergerak tipis (< 1 %), kalimat pengecoh tidak memengaruhi harga, catatan event (kebangkrutan/suspensi/dividen), dan pengingat selisih jual, tekanan stok, batas pegang (tanpa angka, karena bisa disetel admin).
`validatePool` kini memeriksa: 4 paragraf, `{waktu}` tepat sekali di paragraf 1, tidak menyebut nama perusahaan (selain subjek event lewat judul), dan arah tiap ciri sesuai tanda efek (≥ 1 %). Tes baru (5): lengkap, frasa unik per aset, isi benar dan urut dari terbesar, "Tidak ada ciri" bila kosong, catatan event, dan tidak menggeser berita lama. `poolToSql` memuat `news_analysis` (dan memperbarui laporan berita yang sudah ada tanpa mengubah efeknya). Kumpulan dimuat ulang (`npm run load-news -- --replace`, game `setup`): 1000 berita siap, 1000 laporan, tidak ada berita tanpa laporan. Uji ujung ke ujung (transaksi di-rollback): game dibuka, berita pertama tayang, tim membeli lewat `buy_analysis` dan menerima laporan nyata yang benar. Catatan: `npm run seed` (lewat RPC admin) tidak memuat laporan; untuk game sungguhan pakai `npm run load-news`. Pada data efek berita: ±38 % berita tidak punya ciri naik berarti dan ±53 % tidak punya ciri turun berarti, laporan menyatakannya.

## Analisa Pasar, tahap 3: UI tim (23 Nov)

- **Pasar:** kartu "Analisa Pasar" (`components/market/analysis-card.tsx`) di kolom kanan di atas panel Beli/Jual: harga, judul berita yang dianalisa, tombol "Beli analisa · Rp 200.000" (gaya `secondary`, supaya satu aksi utama di layar tetap panel Beli), konfirmasi (saldo dipotong dan sisa saldo), lalu dialog laporan 4 bagian (ringkasan, ciri naik, ciri turun, catatan; ikon panah dan judul, bukan hanya warna; `components/market/analysis-report.tsx`). Sudah dibeli: tombol "Lihat laporan" (membuka laporan dari `get_my_analyses`) dan tulisan "Sudah dibeli untuk berita ini." Tombol mati disertai alasan tertulis (pasar tutup, fitur dimatikan, belum ada berita tayang, waktu membeli habis, laporan belum tersedia, atau saldo kurang dengan selisihnya; `lib/analysis/view.ts`). Tawaran diambil ulang tiap 5 dtk bersama pasar dan seketika saat berita baru terbit (Realtime `news_feed`). Satu `request_id` per niat beli (idempoten saat koneksi putus).
- **Aksi server:** `buyAnalysis` di `app/team/market/actions.ts` (sesi pengguna, `buy_analysis`); pesan galat ramah baru di `lib/errors.ts` (`feature_disabled`, `no_live_news`, `window_closed`, `analysis_unavailable`). Data: `lib/analysis/data.ts` (`fetchAnalysisOffer`, `fetchMyAnalyses`).
- **Riwayat:** pembelian analisa tampil sebagai baris "Analisa Pasar" (uang keluar), dan rinciannya membuka laporan lengkap (`lib/history/{data,view}.ts`, `components/history/history-board.tsx`).
- **Uji:** tes baru `lib/analysis/view.test.ts` dan riwayat; 157 tes lolos; `tsc` dan ESLint bersih. Peramban (server dev port 3001 karena kiosk produksi tidak punya unggah QR uji; masuk sebagai Tim Elang): kartu tampil dengan harga dan berita; beli lewat konfirmasi memotong saldo Rp 5.000.000 jadi Rp 4.800.000 dan menampilkan laporan nyata; kartu berubah menjadi "Lihat laporan" dan membukanya; Riwayat menampilkan "Analisa Pasar, − Rp 200.000" yang rinciannya memuat laporan. Sesudahnya game di-reset (setup, saldo 0, pembelian kosong). Build produksi dibangun ulang dan `npm start` dijalankan ulang.

## Analisa Pasar, tahap 4: UI admin (23 Nov)

- **Aset:** kartu baru "Harga dan saklar laporan analisa" (`components/admin/analysis-settings-card.tsx`) di bawah Pengaturan toko: isian harga (Rp, boleh bertitik, 0 = gratis, maks. Rp 100 juta) dan kotak centang "Analisa aktif". Berbeda dari pengaturan toko, kartu ini TIDAK terkunci setelah game dimulai (diuji saat game `open`); tombol Simpan hanya aktif bila ada perubahan; berlaku untuk pembelian berikutnya. Aksi server `setAnalysisSettings` (`app/admin/assets/actions.ts`, skema `analysisSettingsSchema`) memanggil `admin_set_analysis_settings`.
- **Transaksi:** panel "Pembelian analisa" (jumlah pembelian, tim pembeli, pendapatan, dan 50 pembelian terbaru: waktu, tim, judul berita, harga) dari `admin_analysis_summary` dan `admin_analysis_log` (`fetchAnalysisLog`); diambil ulang bersama polling halaman. TANPA isi laporan (membocorkan efek berita); ada catatan di panel.
- **Audit:** `set_analysis_settings` masuk kategori Aset dengan ringkasan "Analisa Pasar aktif/dimatikan, harga Rp …" (`lib/admin/audit.ts`, tes baru).
- **Uji (build produksi, admin di peramban):** kartu tampil; harga diubah ke 150.000 saat game berjalan: toast "Analisa Pasar aktif, harga Rp 150.000", database `analysis_price = 150000`, audit tercatat; tim membeli (150.000) dan panel Transaksi menampilkan 1 pembelian, 1 tim, pendapatan Rp 150.000, baris "Tim Cendrawasih membeli analisa: …" tanpa isi laporan. 31 tes admin lolos; `tsc` dan ESLint bersih. Sesudahnya game di-reset dan harga dikembalikan ke Rp 200.000 (aktif). Catatan: batas pegang di database sekarang 70 % (diubah admin 22 Nov), bukan 30 % seperti di panduan pemain; samakan dokumen bila memang disengaja.

## Analisa Pasar, tahap 5: dokumen dan uji ujung ke ujung (23 Nov)

- **Dokumen:** `docs/18-analisa-pasar.md` (keputusan, cara kerja, isi 4 paragraf, SQL, kode galat, UI, memuat laporan, menyetel harga, pengujian); ditautkan dari `docs/README.md`; `docs/04` (6 fungsi baru di ringkasan, 4 kode galat), `docs/05` (aturan trading no. 11), `docs/07` (tambahan UI); `PANDUAN-TRADING.md` (bagian 8 "Analisa Pasar (bantuan berbayar)" untuk pemain, entri kamus, Riwayat, urutan main); `PANDUAN-GLADI-RESIK.md` (persiapan harga/saklar dan laporan, langkah uji analisa di simulasi, kriteria lulus).
- **Uji beban `--spike`:** `scripts/load-test.mjs` kini juga memanggil `get_analysis_offer` di polling pasar dan membuat semua klien membeli Analisa Pasar serentak. Hasil (30 klien tim dari 5 akun + 1 display, 60 dtk, localhost): 30 panggilan `buy_analysis` serentak, median 23 ms, maks 29 ms, tanpa galat; di database hanya **5 pembelian, 5 tim, pendapatan Rp 1.000.000** (satu per tim, 25 sisanya mengembalikan laporan yang sama tanpa biaya); `get_analysis_offer` 330 panggilan, median 8 ms, tanpa galat; 30 dari 30 Realtime tersambung. Sesudahnya game di-reset (setup, saldo 0, tanpa pembelian; harga Rp 200.000 aktif; 1000 laporan tetap).
- **Seluruh fitur:** tahap 1 SQL (51 pemeriksaan), tahap 2 pembuat laporan (1000 laporan, 5 tes), tahap 3 UI tim, tahap 4 UI admin, tahap 5 dokumen dan beban. Catatan terbuka: batas pegang di database 70 % (diubah admin 22 Nov) berbeda dari 30 % di dokumen dan panduan; samakan bila disengaja. Harga awal Rp 200.000 perlu dicoba di gladi resik.

## Berita tingkat sulit dan muat ulang kumpulan (23 Nov)

Permintaan: karena ada Analisa Pasar, berita dipersulit; hapus berita yang ada, perbarui tema, generate, dan masukkan ke DB Docker. Perubahan di `scripts/news-pool-lib.ts` dan `scripts/data/news-themes-4.ts` (rincian di `docs/15` §3b):
- **Paragraf 1** hanya kalimat peristiwa (`firstSentence`); kalimat akibat per sektor dan konteks sektor dibuang (varian b memakai komentar netral). Hanya 18 dari 620 berita harga yang paragraf 1-nya masih menyebut kata akibat (peristiwanya memang tentang panen/harga).
- **Petunjuk** (`hintSentence`): 1 ciri naik + 1 turun terbesar (dulu 2+2), dan separuh tanpa arah ("merasakan dampak langsungnya").
- **Pengecoh sifat** (`decoyOf`): satu kalimat netral yang menyebut ciri aset yang tidak terdampak (< 1 % atau tanpa efek); laporan analisa menyebutnya pengecoh di paragraf 4. Pengecoh topik kini berdekatan dengan sektor LAIN, bukan sektor utama.
- **Tema:** `news-themes-4.ts` menambah 25 tema samar (dampak tidak satu arah, akibat tidak langsung) = 100 berita harga baru: kumpulan kini **1100 berita** (620 harga + 480 event). Tes disesuaikan (1100/620; hint 1+1; separuh tanpa arah; pengecoh; paragraf 1) dan 23 tes `news-pool-lib` lolos; tsc dan ESLint bersih.
- **Basis data:** cadangan `~/classmeet-recovery/db-pre-newsv3-*.dump`; SEMUA berita lama (1000 siap + 106 arsip batal, dengan efek, event, bangkrut, dan laporan) dihapus (tabel riwayat sudah kosong setelah reset), lalu `npm run load-news`: 1100 berita `ready`, 1100 laporan analisa, 13.765 efek, 450 event, 30 pemetaan bangkrut, tidak ada berita tanpa laporan; `news_pool()`: 1100 dari 1100 layak terbit; game tetap `setup`. Simulasi mesin 3 hari (di-ROLLBACK): sehat (tidak ada aset di batas harga; perubahan akhir −29 % sampai +31 %; sisa kumpulan 430 harga, 28 bangkrut, 282 dividen, 139 suspensi).
- **Dokumen:** `docs/14` dibuat ulang, `docs/15` §3b, `docs/16`, `docs/18`, dan `PANDUAN-TRADING.md` (berita sengaja sulit).

## Koreksi dari luar: arbitrase beli lalu jual ditutup, docs/05 disinkronkan (23 Nov)

Koreksi teman: (1) kunci jawaban bocor di repo publik, (2) teks berita mudah dibaca mesin, (3) ekonomi terlalu sensitif, (4) arbitrase beli lalu jual, (5) jatah sesi laptop menentukan pemenang, (6) efek berita kecil, (7) docs/05 tidak sinkron. Diverifikasi: 1, 4, 6, 7 terbukti; 2 sebagian; 3 dan 5 butuh keputusan/simulasi. Dikerjakan: 4 dan 7.
- **Arbitrase (4):** `buy_asset`/`sell_asset` membayar semua unit pada harga tayang sebelum transaksi dan tekanan baru berlaku sesudahnya. Beli `n` unit lalu jual `n` unit untung tanpa risiko bila `n × 0,2 %` > 2 % (n ≥ 11); terbukti di database dengan batas pegang 70 %: IN dan SM beli 35 lalu jual 35 untung +4,8 %, aset lain +2,8–2,9 %, dapat diulang. Perbaikan `scripts/sql/trading-impact.sql`: harga bergerak satu langkah tekanan per unit di dalam transaksi (beli: unit ke-i pada faktor `min(batas, faktor + i × langkah)`; jual: unit ke-j pada `maks(−batas, faktor − j × langkah)` lalu dikurangi selisih jual); `n = 1` tidak berubah; `unit_price` = rata-rata, `total` jumlah tepat. Pengaman: `selisih jual > tekanan per unit` lewat constraint `game_settings_spread_gt_pressure` dan `admin_set_trade_settings` (kartu pengaturan toko dan skema zod ikut memeriksa).
- **Hasil:** bolak-balik n unit kini rugi ±1,9 % berapa pun n (AD, IN, SM pada 1, 10, 20, dan batas pegang).
- **Tes SQL:** `test-trading-shop.sql` 139 pemeriksaan lolos (termasuk bolak-balik 1, 2, 5, 10, 20, dan batas pegang pada 6 aset: selalu rugi ≥ 1,5 %; tiga putaran penuh tetap rugi; total = jumlah harga per unit; constraint dan galat pengaturan); `test-analysis.sql` disesuaikan (laporan sudah termuat, `on conflict`) dan lolos.
- **UI:** `lib/market/rules.ts` (`buyTotal`, `sellTotal`, `shopPriceAt`, `maxBuyQty` dengan biaya sebenarnya) mencerminkan SQL, dicocokkan dengan database pada 750 kombinasi (aset × tekanan × jumlah), nol selisih; panel Beli/Jual memakai total itu dan "harga rata-rata per unit" untuk > 1 unit; `Game` dan `MarketAsset` memuat `priceStep`, `pressureBpsPerUnit`, `pressureCapBps`, `minPrice`, `maxPrice`; Riwayat memakai label "rata-rata". 167 tes lolos.
- **Dokumen (7):** `docs/05` (tabel parameter dan aturan efek: 10–15 aset, efek tematis 1–15 % dan pengisi ≤ 0,9 %; aturan trading no. 4 tentang tekanan di dalam transaksi), `docs/17` (rumus dan bagian "Tambahan 23 Nov"), `docs/04` (kontrak `buy_asset`/`sell_asset`), `PANDUAN-TRADING.md`, `PANDUAN-GLADI-RESIK.md` (uji tanpa arbitrase).
- **Belum dikerjakan:** kebocoran repo publik (perlu repo privat, benih rahasia, berkas pool tidak dilacak), kalibrasi efek berita vs selisih jual dengan simulator strategi (efek berarti rata-rata 2,87 %, hanya 33 % efek > 2 %; efek terbesar per berita rata-rata 4,1 %), jatah sesi laptop, dan keterbacaan mesin.

## Kalibrasi efek berita (23 Nov)

Permintaan: kalibrasi efek berita (koreksi: efek rata-rata ±2,6 % vs selisih jual 2 %, ekonomi terlalu sensitif). Hasil lengkap di `docs/19-kalibrasi-ekonomi.md`.
- **Simulator strategi** `scripts/sim-strategy.ts`: satu tim memperdagangkan kumpulan berita sungguhan dengan rumus beli/jual sungguhan (tekanan di dalam transaksi, selisih, batas pegang, stok) selama 3 hari; strategi pembaca petunjuk, pembeli analisa (rasional), dan acak; kisi skala efek × selisih jual.
- **Sebelum:** efek berarti rata-rata 2,87 %, hanya 33 % efek > 2 %; pembaca petunjuk +2,5 % (selisih 2 %) dan −3,4 % (selisih 3 %).
- **Keputusan:** `PoolConfig.effectScale` (bawaan **2**; opsi `--scale` di `generate-news`) mengalikan efek bertema dan event (pengisi tetap kecil), batas 15 %. Sesudah: efek berarti rata-rata 5,7 %, terbesar per berita 8,1 %; pembaca petunjuk +20,8 % (p10 +14,6, p90 +28,2; menang 84 %), +14,5 % pada selisih 3 %, +23,9 % pada 1,5 %; acak −25,6 %; efek ×0,75/×1,25: +11 %/+26 %. Simulasi mesin 3 hari sehat (tidak ada aset di batas; −41 % sampai +91 %, sd 0,28).
- **Analisa:** pita kekuatan laporan disesuaikan (kuat > 8 %, sedang 4–8 %, ringan 1–4 %) dan catatan "efek ringan sering habis oleh selisih jual"; harga patokan **Rp 75.000–100.000** (Rp 100.000: +18,7 %; Rp 150.000 rugi; Rp 200.000 tidak dibeli siapa pun); default kolom `analysis_price` di `analysis.sql` menjadi 100000 (basis data yang sudah ada tidak diubah: sekarang masih Rp 200.000, ubah lewat Admin > Aset).
- **Alat:** `sim-news-engine.sh` menerima skala efek (argumen ke-5), mengganti berita siap di dalam transaksi ROLLBACK, dan `sim-news-engine.sql` mengembalikan berita tayang/terpakai ke `ready` di dalam transaksi itu (sebelumnya simulasi tak jalan bila game sedang berjalan).
- **Catatan:** kumpulan di repo (`news-pool.json`, `docs/14`) sudah diganti ke skala 2 (1100 berita, 1100 laporan); **database belum dimuat ulang** karena game sedang `open` (muat dengan `npm run load-news -- --replace`, hanya berita siap yang diganti; atau saat game `setup`). Simulator bukan ramalan: satu tim, 20 % stok terjangkau, tanpa kejutan event; hasil sangat bergantung pada asumsi kapasitas.

## Teks berita: perbaikan struktur (23 Nov)

Keluhan: teks berita terasa seperti buatan mesin dan strukturnya berulang. Diukur: paragraf 2 hanya 62 kerangka untuk 620 berita harga; "Di sisi lain," di 100 % berita; pengecoh sifat dan petunjuk tanpa arah hanya 3 rumusan tetap (ciri khas yang membocorkan pengecoh); kalimat pengecoh topik dipakai rata-rata 48 kali; ada tata bahasa janggal. Perbaikan di `scripts/news-pool-lib.ts` (rincian di `docs/15` §3b): pustaka rumusan netral bersama untuk petunjuk tanpa arah dan pengecoh sifat (12 rumusan) dan rumusan berarah (7 naik, 7 turun); jumlah dan urutan kalimat acak (1 naik + 1 turun, 0–2 pengecoh sifat, 1–2 pengecoh topik); penyambung variatif dan separuh kosong; tanpa RNG utama (hash judul dengan pengacak murmur3); komentar paragraf 1 12 buah; laporan analisa menyebut 0–2 pengecoh.
Hasil: 607 kerangka unik (dulu 62), "Di sisi lain," 22 % (dulu 100 %), 2–6 kalimat per paragraf 2; 43 tes `scripts` lolos (14 baru/berubah, termasuk tes keragaman, tanpa ciri khas, dan tata bahasa); `tsc` dan ESLint bersih. Kalibrasi diperiksa ulang karena urutan RNG berubah: pembaca petunjuk +23,1 % (selisih 2 %), +16,7 % (3 %), acak −25,5 %; simulasi mesin 3 hari sehat. Kumpulan dimuat ulang ke database (`load-news -- --replace`, game `open`: hanya 1098 berita siap yang diganti; 1 tayang dan 1 terpakai tidak disentuh; cadangan `~/classmeet-recovery/db-pre-struktur-*.dump`): 1100 laporan, 1100 layak terbit, efek berarti rata-rata 5,69 %. Belum dikerjakan: pengecoh topik yang wajar, variasi genre, tekstur konkret.

## Teks berita: pengecoh wajar, genre, dan tekstur (23 Nov)

Lanjutan perbaikan teks (tahap 2 dari saran): (1) bank pengecoh topik ditulis ulang menjadi 179 kalimat yang terdengar seperti berita daerah dan pasar, bukan kegiatan hobi; (2) enam genre paragraf 1 (lurus, singkat/kawat, kutipan, sumber, rilis, lapangan) memberi variasi cara bertutur; (3) "suara" fiktif (kota, tokoh, lembaga, sumber, kutipan netral, adegan) di `scripts/data/news-voices.ts`. Detail dan angka di `docs/15` §3b. Efek, judul, dan 1100 laporan analisa identik dengan sebelumnya, jadi kalibrasi ekonomi tidak berubah; 1082 teks isi berubah. 47 tes `scripts` lolos (4 baru), `tsc` dan ESLint bersih. Kumpulan dimuat ulang ke database (game `open`, `load-news --replace`: hanya berita siap diganti; cadangan `~/classmeet-recovery/db-pre-genre-*.dump`): 1100 laporan, 1100 layak terbit, efek berarti rata-rata 5,69 %.

## Logo ISSC: logo situs dan di tengah QR (23 Nov)

Permintaan: logo `assets/issc-logo.png` (biru-putih, latar transparan, 2000×1061) dipakai sebagai logo situs dan diletakkan di tengah QR code dengan warna tetap, sementara QR tetap hitam.
- **Aset:** `public/brand/issc-logo.png` (800×424, 127 KB; turunan sumber di `assets/issc-logo.png` yang ikut di-commit), `app/icon.png` (ikon situs 512×512, logo di tengah kanvas transparan; `app/favicon.ico` bawaan Next dihapus). `sharp` (0.35.5) kini dependensi eksplisit.
- **Logo situs:** komponen `BrandMark` (`components/shell/brand-mark.tsx`) menggantikan lingkaran oranye "C" di `Brand` (sidebar admin/tim/penjaga, login, kiosk, daftar pos) dan header layar publik (`display-header`, `leaderboard-screen`, `game-gate`).
- **QR dengan logo:** `lib/qr-logo.ts` (`addCenterLogo`) menempel logo berwarna di tengah QR dengan bantalan putih bersudut bulat; lebar logo 28 % dari lebar gambar (luas ±3,7 %), QR dibuat dengan koreksi galat **H (30 %)** (dulu M) di `scripts/print-qr-lib.ts` (`npm run print-qr`, kartu cetak) dan `lib/admin/qr-png.ts` (QR di dialog Tambah tim). Modul QR tetap hitam-putih murni di luar logo.
- **Uji:** `lib/qr-logo.test.ts` (3 tes baru) memastikan QR terbaca persis sama oleh zxing, juga saat diperkecil (400, 240, 160 px), dikaburkan, atau miring 8°; piksel berwarna hanya di dalam kotak logo dan semua piksel di luarnya hitam atau putih murni; luas logo < 8 % dan pusat pola pencari tetap hitam. Pengukuran batas: terbaca sampai rasio logo 0,46; dipakai 0,28 sebagai margin untuk kamera laptop. 182 tes lolos, `tsc` dan ESLint bersih, build produksi bersih (peringatan Turbopack soal akses berkas dinamis dihilangkan dengan `turbopackIgnore`). Alur admin `qrDataUrl` diuji terbaca; kartu uji `tim1..5.png` dibuat ulang (`npm run print-qr`) dan terbaca oleh kiosk (permintaan login terkirim).
- Catatan: kartu QR yang sudah dicetak sebelumnya (koreksi galat M, tanpa logo) tetap berlaku (isi QR sama); hanya kartu baru yang memakai logo. Pada uji ini tunnel Cloudflare sempat putus (galat 530, QUIC timeout di cloudflared), sehingga login lewat API publik gagal dari peramban uji; bukan akibat perubahan ini.

## Admin > Tim: "Ganti QR" diganti "Lihat QR" (23 Nov)

Permintaan: hapus fungsi Ganti QR di dasbor admin; ganti tombolnya menjadi tampilan QR tim dengan tombol unduh, dengan pop up yang sama seperti QR saat membuat tim baru.
- **UI:** tombol "Ganti QR" di tiap baris `components/admin/teams-board.tsx` menjadi "Lihat QR"; dialog penjelasan lama dihapus. Dialog baru `components/admin/team-qr-dialog.tsx` memanggil server action, menampilkan gambar QR ber-logo dan tautan "Unduh QR (PNG)". Tampilan gambar + unduh dipisah ke `components/admin/qr-card.tsx` dan dipakai bersama oleh dialog "Tambah tim" (`team-create-dialog.tsx`) supaya keduanya identik.
- **Server:** `getTeamQr` di `app/admin/teams/actions.ts` (hanya admin; `qr_token` dan username dibaca dengan service role lalu diubah menjadi gambar `qrDataUrl`, token tidak dikembalikan sebagai teks dan tidak dicatat). Skema `viewTeamQrSchema`.
- **Audit:** tiap pembukaan tercatat sebagai `view_team_qr` (kategori Koreksi saldo, ringkasan "<tim>: kartu QR dilihat") karena QR adalah kredensial; tes baru di `lib/admin/audit.test.ts`.
- **Dampak:** fungsi `admin_rotate_team_qr` dan skrip `rotate-team-qr` yang memang belum ada tidak dipakai lagi dari UI; kartu hilang kini cukup dibuka dan diunduh ulang dari sini (kartu lama tetap berlaku). Dokumen operasi lama (`docs/08`, `docs/02`) yang menyebut rotasi QR masih berlaku sebagai opsi bila kartu dicurigai bocor.
- **Uji:** `tsc`, ESLint, 32 tes admin lolos, build produksi bersih, server `npm start` dijalankan ulang di port 3000. **Uji klik di peramban belum dilakukan**: pembacaan kata sandi admin dari berkas seed ditolak izin, jadi login admin di panel peramban tidak bisa kulakukan.

## Admin: hapus tim dan hapus pos (24 Nov)

Permintaan: admin bisa menghapus tim dan pos, HANYA saat status game `setup`; tombol diblokir saat `open`/`paused`/`finished`.
- **Database** (`scripts/sql/admin-delete-team-post.sql`, belum diterapkan ke database mana pun oleh sesi ini): `admin_delete_team(uuid)` dan `admin_delete_post(uuid)`; `security definer`, cek admin, `game_not_setup` bila status bukan `setup` (status dibaca `for share`), akun Auth ikut dihapus dalam transaksi yang sama (cascade `auth.users` → `profiles` → `teams`). Tim dengan saldo/aset/riwayat dan pos berhadiah diblokir (`team_has_activity`, `post_has_payouts`) alih-alih menghapus riwayat uang diam-diam; `audit_log` lama milik akun terhapus dilepas ke NULL dengan identitas di `payload.actor_deleted`. Tabel keputusan per relasi di [04 §3.10](04-rpc-contracts.md#310-hapus-tim-dan-hapus-pos-admin).
- **Server:** `deleteTeam` / `deletePost` (sesi admin, tanpa service role), skema `deleteTeamSchema` / `deletePostSchema`, tiga kode galat baru di `lib/errors.ts`, tipe RPC di `database.types.ts`, ringkasan audit `delete_team` / `delete_post` dan pelaku "(akun dihapus)" di `lib/admin/audit.ts`.
- **UI:** tombol Hapus + `ConfirmDialog` di `teams-board.tsx` dan `posts-board.tsx`; papan membaca status game langsung (`qk.admin("game")`); logika pemblokiran di `lib/admin/delete-guard.ts`. `PostsBoard` kini menerima `initialGame` (bukan `finished`) dan tombol buka/tutup pos ikut status langsung.
- **Uji:** `lib/admin/delete-guard.test.ts`, `lib/errors.test.ts`, tambahan `lib/admin/audit.test.ts`; `scripts/sql/test-admin-delete.sql` (rollback): forbidden untuk tim/penjaga/tanpa profil, `game_not_setup` di open/paused/finished (data utuh), hapus berhasil di setup (akun Auth hilang, audit tercatat, audit lama utuh), blokir saldo/kepemilikan/transaksi/hadiah/analisa/dividen, hak eksekusi `anon`/`authenticated`. Tes SQL dijalankan pada Postgres lokal sementara dengan skema tiruan (hanya tabel dan FK yang relevan), semua lolos; **belum dijalankan terhadap skema Supabase sebenarnya**.

## Tombol "Lewati berita" untuk pengujian (24 Nov)

Permintaan: tombol skip berita di dasbor admin untuk testing; "skip" berarti terapkan efek sekarang; tanpa env pengaman.
- **Database:** `scripts/sql/news-skip.sql` (`admin_skip_news()`, hanya admin, game harus `open`): kunci `ob_lock()`, majukan `effect_at` berita `live` ke sekarang, catat audit `skip_news`, lalu jalankan `process_news_cycle()` saat itu juga (bukan menunggu cron 10 dtk). Efek diterapkan lewat jalur biasa (harga, riwayat harga, pemicu bangkrut/dividen/suspensi, jeda antar-berita) dan berita berikutnya dipilih mesin dan tayang dengan jeda efek normal 3–15 menit. Galat: `forbidden`, `game_not_active`, `no_live_news`. Sudah diterapkan ke database Docker.
- **UI:** tombol "Lewati berita (untuk uji)" di kartu "Berita saat ini" (`components/admin/news-board.tsx`), tampil hanya bila berita berstatus "Belum berlaku"; dialog konfirmasi menyebut judul berita; server action `skipNews`; ringkasan audit "Berita dilewati (efek diterapkan sekarang): <judul>" (kategori Berita).
- **Uji:** `scripts/sql/test-news-skip.sql` (11 pemeriksaan OK: bukan admin ditolak, berita jadi applied, tepat satu berita ikut terpakai, riwayat harga dan audit tercatat, berita berikutnya tayang, tolak saat tak ada berita tayang dan saat game bukan open; ROLLBACK). Tes audit baru di Vitest (38 tes admin lolos), `tsc`, ESLint, build bersih; server `npm start` dijalankan ulang. **Uji klik di peramban belum dilakukan** (login admin di panel tidak tersedia).
- Catatan: efek tidak bisa dibatalkan dan tombol aktif juga saat acara sungguhan (sesuai permintaan tanpa env). Ini juga mengubah aturan docs/07 §3.7 (dicatat di sana).
