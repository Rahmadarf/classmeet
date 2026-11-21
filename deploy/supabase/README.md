# Supabase self-hosted (Docker) untuk Classmeet Market

Memindahkan database dari Supabase cloud ke tumpukan Supabase di Docker (PostgreSQL 17, Auth/GoTrue, PostgREST,
Realtime, gerbang API Envoy, Studio). Aplikasi tidak berubah selain dua variabel lingkungan
(`NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY`).

Isi proyek cloud saat ini: 18 tabel, 56 fungsi, 2 job cron (`news-cycle`, `market-cycle`, tiap 10 detik), 5 tabel Realtime
(`posts`, `assets`, `payouts`, `news_feed`, `game_settings`), tanpa Storage dan tanpa Edge Function. Karena itu hanya
tujuh layanan yang dijalankan: `db meta studio api-gw auth rest realtime`.

> **Status (18 Nov):** tumpukan sudah dijalankan dan direstore dari cloud (`--with-data`) di laptop pengembang; inventaris,
> hak akses, dan jumlah baris cocok dengan cloud, login semua peran dan batas RPC lewat gerbang lokal lolos, cron berjalan.
> Yang belum diuji: aplikasi Next di atasnya, mode HTTPS/Caddy, Realtime dari peramban, dan cadangan/pulihkan. Coba lagi di
> mesin acara sebelum hari H.

## Prasyarat

- Docker + Compose v2 (sudah ada), `git`, `openssl`, `curl`, `bash`. RAM bebas ±3 GB, disk ±6 GB untuk image.
- Internet saat pertama kali (mengunduh berkas resmi dan image). Sesudahnya bisa offline.
- Untuk dump dari cloud: connection string **Session pooler** (Dashboard Supabase > Connect).

## Pilih mode

|                   | Alamat                                        | Kamera pemindai                              | Cocok untuk                                              |
| ----------------- | --------------------------------------------- | -------------------------------------------- | -------------------------------------------------------- |
| **A. HTTP lokal** | `http://localhost:8000`                       | Hanya di `localhost`                         | Mencoba di satu laptop                                   |
| **B. HTTPS LAN**  | `https://<IP laptop>` (+ aplikasi di `:3443`) | Jalan di semua perangkat yang mempercayai CA | Acara dengan laptop kiosk, ponsel penjaga, layar display |

Kamera (kiosk dan penjaga) butuh HTTPS atau `localhost`, dan halaman HTTPS tidak boleh memanggil API HTTP (mixed content).
Jadi untuk acara, pakai mode B: **API Supabase dan aplikasi sama-sama lewat HTTPS**.

## Langkah

Semua perintah dijalankan dari folder ini (`deploy/supabase`).

### 1. Siapkan tumpukan

```bash
./00-setup-stack.sh                                          # mode A (localhost)
./00-setup-stack.sh https://192.168.1.10 https://192.168.1.10:3443   # mode B (ganti dengan IP laptop)
```

Mengunduh berkas resmi `supabase/supabase` (folder `docker/`, commit yang dipin di `lib.sh`), membuat `stack/.env` berisi
rahasia acak, dan mematikan pendaftaran mandiri. Skrip menolak bila `stack/` sudah ada (hapus dulu bila mau mengulang).
`stack/` dan `dump/` ada di `.gitignore`.

### 2. Jalankan

```bash
./10-up.sh            # mode A
./10-up.sh --https    # mode B (menambah Caddy; Studio di https://<IP> dengan kata sandi dasbor)
```

Pertama kali mengunduh beberapa GB image. Berhenti: `./10-up.sh down` (data tetap di `stack/volumes/db/data`).

### 3. Dump dari cloud (hanya baca terhadap cloud)

```bash
read -rs CLOUD_DB_URL && export CLOUD_DB_URL     # tempel connection string, Enter (tidak tampil di layar)
./20-dump-cloud.sh                # skema + cron + Realtime; akun dan data dibuat ulang lewat seed
./20-dump-cloud.sh --with-data    # + data tabel public + akun Auth apa adanya (kartu QR lama tetap berlaku)
```

**Jangan tempel connection string ke chat, berkas, atau riwayat shell.** Berkas di `dump/` berisi data sensitif.

Pilih `--with-data` bila kartu QR sudah dicetak atau data (aset, berita, tim, pengaturan) harus sama persis. Tanpa itu,
`game_settings` dimulai dari nilai bawaan dan seed membuat akun serta tim baru (token QR baru: cetak ulang kartu).

### 4. Muat ke Docker

```bash
./30-restore-local.sh                 # sesuai pilihan di langkah 3
./30-restore-local.sh --with-data
```

Menolak berjalan bila database Docker sudah berisi tabel Classmeet. Mengosongkan:
`./35-reset-db.sh --yes` (lewat SQL; tidak menghapus berkas volume), lalu jalankan restore lagi.

Tanpa `--with-data`, buat akun dan data uji:

```bash
./60-seed-local.sh      # memakai kunci service_role dari stack/.env HANYA untuk proses seed (tidak dicetak/ditulis)
```

### 5. Verifikasi

```bash
./40-verify.sh          # dengan CLOUD_DB_URL terisi, membandingkan dengan cloud: harus "SAMA"
```

Yang dibandingkan: jumlah tabel/fungsi/trigger/kebijakan RLS, tabel tanpa RLS, job cron, tabel Realtime, dan **hak
eksekusi fungsi** (anon tidak boleh menjalankan fungsi `public` apa pun; `authenticated` tidak boleh menjalankan fungsi
internal seperti `process_news_cycle`, `ob_match`, `bankrupt_asset`).

### 6. Arahkan aplikasi

```bash
./50-app-env.sh         # mencetak NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY (keduanya publik)
```

Salin dua baris itu ke `.env.local` aplikasi (gantikan nilai cloud). Variabel `NEXT_PUBLIC_*` ikut terpanggang saat build:
jalankan ulang `npm run build` (atau restart `npm run dev`). `DISPLAY_USERNAME`/`DISPLAY_PASSWORD` tetap seperti semula.
**Jangan** menaruh `SERVICE_ROLE_KEY` di `.env.local`.

Mode B juga butuh aplikasi dilayani lewat Caddy: jalankan `npm run build && npm start` (port 3000) di laptop yang sama;
Caddy meneruskan `https://<IP>:3443` ke sana. Ganti `allowedDevOrigins` hanya bila memakai `npm run dev`.

## HTTPS LAN: mempercayai CA Caddy

Caddy menerbitkan sertifikat dari CA internalnya untuk alamat IP/nama lokal. Perangkat harus mempercayai CA itu, kalau
tidak peramban menolak (dan kamera tidak jalan).

```bash
./15-export-ca.sh       # menyimpan stack/caddy-root.crt (sertifikat PUBLIK)
```

Pasang `caddy-root.crt` di tiap perangkat:

- **macOS:** `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain deploy/supabase/stack/caddy-root.crt` (minta kata sandi macOS; atau Keychain Access > impor ke "System" > Get Info > Trust > Always Trust). Tutup dan buka ulang peramban.
- **Windows:** `certmgr.msc` > Trusted Root Certification Authorities > Import.
- **Android:** Pengaturan > Keamanan > Enkripsi & kredensial > Instal sertifikat > Sertifikat CA.
- **iOS:** buka berkasnya, instal profil, lalu Pengaturan > Umum > Tentang > Pengaturan Kepercayaan Sertifikat > aktifkan.
- **Node (skrip seed):** `60-seed-local.sh` memakai `NODE_EXTRA_CA_CERTS` otomatis bila berkas itu ada.

Alamat IP laptop harus tetap sama selama acara (atur IP statis/reservasi DHCP); mengubahnya membuat sertifikat dan
`SUPABASE_PUBLIC_URL` tidak cocok.

### Menjalankan aplikasi di mode HTTPS

```bash
npm run dev:https      # = NODE_EXTRA_CA_CERTS=deploy/supabase/stack/caddy-root.crt npm run dev
npm run start:https    # untuk build produksi (npm run build dulu)
```

Server Next memanggil Supabase lewat `https://<IP>` dari sisi server juga, jadi proses Node-nya harus mempercayai CA Caddy.
`NODE_EXTRA_CA_CERTS` hanya dibaca saat Node mulai (tidak bisa lewat `.env.local`), itu sebabnya ada skrip npm khusus.
Tanpa itu `/display`, login, dan semua halaman server gagal dengan `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`.
Buka aplikasi di **`https://<IP>:3443`** (bukan `localhost:3000`) supaya kamera dan cookie sesuai. Di mode HTTPS,
`http://localhost:8000` tidak lagi dibuka (Caddy mengambil alih; port gerbang API dilepas).

### Studio (dasbor Supabase) dan kata sandinya

Studio ada di `http://localhost:8000` (mode A) atau `https://<IP>` (mode B) dan meminta nama pengguna + kata sandi
(HTTP Basic). Lihat nilainya sendiri (jangan ditempel ke chat):

```bash
grep -E '^(DASHBOARD_USERNAME|DASHBOARD_PASSWORD)=' deploy/supabase/stack/.env
```

### Alamat IP yang berubah

Sertifikat Caddy dan `SUPABASE_PUBLIC_URL` terikat ke satu alamat. Bila IP laptop berubah (DHCP), peramban menolak
sertifikat. Atur IP statis/reservasi DHCP selama acara. Bila terpaksa berubah: ubah `SUPABASE_PUBLIC_URL`,
`API_EXTERNAL_URL`, `SITE_URL` di `stack/.env` (lihat `00-setup-stack.sh`), `NEXT_PUBLIC_SUPABASE_URL` di `.env.local`,
jalankan `./10-up.sh --https`, `docker restart supabase-caddy`, ekspor ulang CA bila perlu, dan pasang ulang di perangkat.

## Cloudflare Tunnel (mode C: ada internet, tanpa memasang sertifikat)

Menggantikan Caddy. Laptop tetap menjalankan semuanya; `cloudflared` (kontainer) membuka sambungan keluar ke Cloudflare,
dan Cloudflare memegang sertifikat HTTPS publik. Perangkat tim/penjaga cukup membuka alamat, tanpa CA, tanpa satu
jaringan WiFi dengan laptop. **Butuh internet** di laptop dan di perangkat pemakai.

### Sekali saja, di dasbor Cloudflare (manual, akun milikmu)

1. Daftar di cloudflare.com (paket Free), **Add a site** dengan domainmu. Cloudflare memindai catatan DNS yang ada; periksa
   hasilnya (catatan web/email di IDCloudHost harus ikut terbawa) sebelum lanjut.
2. Di **IDCloudHost** (panel domain, bagian Nameserver/DNS), ganti nameserver ke dua nameserver yang diberikan Cloudflare.
   Penyebaran bisa menit sampai beberapa jam; status situs di Cloudflare menjadi _Active_.
3. **Zero Trust > Networks > Tunnels > Create a tunnel > Cloudflared**, beri nama `classmeet`. Salin **token** (rahasia).
4. Di tab **Public Hostname** tambahkan dua entri (HTTP, bukan HTTPS):

   | Hostname       | Service                            |
   | -------------- | ---------------------------------- |
   | `api.<domain>` | `http://api-gw:8000`               |
   | `app.<domain>` | `http://host.docker.internal:3000` |

   Jangan menambahkan Studio. Cloudflare membuat catatan DNS-nya otomatis.

### Di laptop

```bash
cd deploy/supabase
./55-tunnel-env.sh app.<domain> api.<domain>   # mengubah stack/.env, mencetak baris untuk .env.local
echo 'TUNNEL_TOKEN=<token dari langkah 3>' >> stack/.env   # stack/ diabaikan git
./10-up.sh --tunnel                            # menjalankan Supabase + cloudflared (Caddy dihentikan)
```

Salin tiga baris dari `55-tunnel-env.sh` ke `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`CLASSMEET_PUBLIC_HOSTS`), lalu jalankan aplikasi dengan **`npm run dev`** (bukan `dev:https`; tidak ada CA internal,
jadi `NODE_EXTRA_CA_CERTS` tidak perlu). Buka **`https://app.<domain>`**. Akun yang sudah ada tetap berlaku.
`CLASSMEET_PUBLIC_HOSTS` memberi izin Next dev untuk host itu (tanpa ini JS halaman 403).

**Alamat internal (disarankan bila Next dan Supabase satu mesin):** tambahkan `SUPABASE_INTERNAL_URL=http://localhost:8000` ke `.env.local`.
Tanpanya, kode server Next memanggil Supabase lewat alamat publik (keluar ke Cloudflare lalu kembali ke mesin yang sama, ±134 ms per
query); dengan alamat internal ±15 ms (9x lebih cepat) dan tidak bergantung pada internet atau DNS. Browser tetap memakai alamat
publik, dan nama cookie sesi dihitung dari alamat publik (`lib/supabase/cookie-name.ts`) sehingga login tidak putus. Mulai ulang
`npm run dev`/`npm start` setelah mengubahnya.

Keamanan: API Supabase kini terbuka ke internet; yang menjaganya RLS dan kunci. `SERVICE_ROLE_KEY` tidak pernah masuk
`.env.local` klien (hanya server). Studio tidak ikut terbuka. Pertimbangkan Cloudflare Access bila ingin membatasi
`app.<domain>`.

## Server sekolah (mode D: semuanya sebagai kontainer, aplikasi di port 8111)

Untuk server yang dipasangi lewat SFTP (VS Code SFTP: `.vscode/sftp.json`, bagian `ignore` sudah mengecualikan `node_modules`, `.next`,
`.git`, data Postgres mentah, dan `KREDENSIAL.local.md`; berkas itu sendiri diabaikan git karena berisi kata sandi).

Yang ikut di-upload dan wajib ada di server: seluruh kode, `.env.local` (rahasia aplikasi), `deploy/supabase/stack/` (termasuk `stack/.env`
yang memuat kunci dan `TUNNEL_TOKEN`, tanpa `volumes/db/data`). Kirim hanya lewat SFTP.

Di server (perlu Docker + Compose dan internet keluar; tidak perlu Node di host, build terjadi di dalam image):

```bash
cd <folder proyek>/deploy/supabase
./10-up.sh --server     # Supabase + cloudflared + aplikasi (membangun image, pertama kali beberapa menit)
./10-up.sh logs         # ikuti log
./10-up.sh down         # hentikan
```

- Aplikasi: `http://172.16.27.38:8111` (HTTP biasa di LAN; kamera butuh HTTPS, jadi pemakai membuka `https://app.<domain>` lewat tunnel).
- Ubah route Cloudflare `app.<domain>` menjadi `http://classmeet-app:3000` (sebelumnya `host.docker.internal:3000` untuk `npm run dev` di laptop).
  Matikan tunnel di laptop lebih dulu (`./10-up.sh down`): token yang sama di dua mesin membuat trafik terbagi.
- `NEXT_PUBLIC_*` dipanggang saat build dari `stack/.env` (`SUPABASE_PUBLIC_URL`, `ANON_KEY`); rahasia server dibaca lewat `env_file: .env.local`
  dan tidak masuk image. Ubah `.env.local` atau `stack/.env` lalu `./10-up.sh --server` ulang untuk membangun ulang.
- **DNS baru menyebar pelan.** Setelah nameserver domain diganti, sebagian resolver (Google 8.8.8.8, Quad9, DNS ISP/sekolah) masih menjawab NXDOMAIN
  untuk `api.<domain>` sampai 24 sampai 48 jam. Aplikasi di server memanggil `https://api.<domain>` dari sisi server juga, jadi bila resolver
  server masih basi, login dan `/display` gagal. Uji di server: `docker exec classmeet-app node -e "fetch('https://api.<domain>/auth/v1/health').then(r=>console.log(r.status))"`
  (401 = berhasil sampai API; `ENOTFOUND`/`EAI_AGAIN` = DNS belum menyebar, tunggu).
- **Database di server baru dimulai kosong; pindahkan skema dan akun dengan paket migrasi** (bukan menyalin `volumes/db/data`):
  1. Laptop (database Docker harus jalan): `./80-export-bundle.sh --roles admin,display` menulis `bundle/migrasi-<waktu>.sql` (skema public, job cron,
     tabel Realtime, akun admin dan layar publik; tanpa tim, saldo, order, berita, aset). Berkas berisi hash kata sandi; izin 600; folder diabaikan git.
  2. Upload berkas itu lewat SFTP ke `deploy/supabase/bundle/` di server.
  3. Server, setelah `./10-up.sh --server` (tunggu auth selesai): `./85-import-bundle.sh bundle/migrasi-<waktu>.sql`, lalu
     `docker restart realtime-dev.supabase-realtime`. Impor menolak bila tabel `teams` sudah ada.
     Tim, pos, aset, dan berita dibuat menyusul (halaman admin, `npm run seed`, atau `npm run load-news`).

## Pencadangan dan pemulihan

```bash
./70-backup.sh          # dump/backup-<waktu>.sql (skema public + akun Auth)
```

Pulihkan: kosongkan database (lihat langkah 4), lalu `docker exec -i supabase-db psql -U supabase_admin -d postgres < dump/backup-….sql`
(job cron dan Realtime dibuat ulang dengan `./30-restore-local.sh` bagian akhir, atau jalankan ulang skrip itu pada DB kosong
dengan dump skema yang sama). Salinan `stack/volumes/db/data` juga cukup bila Docker dihentikan dulu.

## Kembali ke cloud

Cloud tidak disentuh oleh skrip ini. Kembalikan `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` di
`.env.local` ke nilai cloud, build ulang.

## Hal yang berubah dibanding cloud

- **Kunci baru:** `JWT_SECRET`, anon key, dan service-role key dibuat baru. Sesi login lama tidak berlaku.
- **Tanggung jawab di tanganmu:** cadangan, pembaruan image (versi di `stack/versions.md`), firewall (port 80/443/3443
  hanya di jaringan acara; `5432` tidak dipublikasikan), dan penyimpanan `stack/.env`.
- **pg_safeupdate:** di cloud, `UPDATE` tanpa `WHERE` ditolak. Di Docker pengaturan ini bisa berbeda; semua kode proyek
  sudah memakai `WHERE`, jadi tidak berpengaruh.
- **Studio** (dasbor) ada di mode B pada `https://<IP>` dengan kata sandi `DASHBOARD_PASSWORD`; jangan dibuka ke internet.
- **Tidak ada email:** pembuatan akun hanya lewat seed (service role); tidak ada surel konfirmasi atau reset kata sandi.

## Yang belum teruji

Seluruh alur di atas belum dijalankan sungguhan: unduhan image, `./10-up.sh`, restore, `pg_cron` di image
`supabase/postgres`, Realtime terhadap tabel hasil restore, restore `auth.users` dengan `--column-inserts` antar versi
GoTrue, HTTPS Caddy + CA di ponsel, dan aplikasi di atas Supabase Docker. Jalankan `./40-verify.sh` dan uji login tiap
peran (admin, penjaga, display, tim lewat kartu QR) sebelum dipakai.
