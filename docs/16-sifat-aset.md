# 16. Kamus sifat aset (petunjuk di berita)

Berita harga **tidak menyebut nama perusahaan**. Aset yang terdampak hanya bisa ditebak dari ciri yang disebut di paragraf kedua berita
("Perusahaan yang memproduksi mi instan dalam jumlah besar … berpeluang menguat"). Berkas sumbernya `scripts/data/asset-traits.ts`;
ubah di sana, lalu `npm run generate-news`. Dokumen ini ringkasannya untuk ditinjau panitia (dan bahan briefing tim).

- **Frasa ciri**: satu dipilih per aset per berita (deterministik menurut judul). Berita menyebut maksimal 2 aset yang naik dan 2 yang turun
  (yang efeknya terbesar, minimal 1 %); aset berefek kecil tidak disebut.
- **Kata kunci**: khas satu aset, tidak dipakai aset lain, dan **tidak boleh** muncul di kalimat pengecoh (diperiksa tes `scripts/news-pool-lib.test.ts`).
- Berita event (bangkrut, suspensi, dividen) tetap menyebut nama perusahaan subjeknya di paragraf pertama; petunjuk di paragraf kedua tidak menyebut subjek itu lagi.

| Aset | Sektor | Frasa ciri | Kata kunci |
|------|--------|------------|------------|
| Apple (AP) | Teknologi | menjual perangkat premium dengan ekosistem aplikasi sendiri; rutin meluncurkan produk baru yang dinanti pelanggan setia; mengandalkan toko aplikasi serta layanan musik dan video bawaan; membidik pelanggan berdaya beli tinggi | perangkat premium, ekosistem aplikasi, meluncurkan produk, toko aplikasi |
| Microsoft (MI) | Teknologi | menyediakan layanan komputasi awan untuk perusahaan; menjual perangkat lunak perkantoran dengan sistem berlangganan; mengembangkan kecerdasan buatan untuk kebutuhan bisnis; memegang kontrak teknologi jangka panjang dengan korporasi besar | komputasi awan, perangkat lunak, kecerdasan buatan, berlangganan |
| Samsung (SA) | Teknologi | memproduksi chip memori di pabrik berskala besar; menjual elektronik seperti televisi dan lemari es; memasok komponen layar untuk banyak merek perangkat | chip memori, pabrik berskala besar, televisi, komponen layar |
| Xiaomi (XI) | Teknologi | menjual ponsel terjangkau dalam volume besar; menyasar pembeli di negara berkembang; bersaing lewat harga murah dengan margin tipis; melengkapi ponselnya dengan perangkat rumah pintar yang murah | ponsel terjangkau, negara berkembang, harga murah, rumah pintar |
| Telkom Indonesia (TE) | Teknologi | mengoperasikan jaringan internet dan menara seluler; melayani jutaan pelanggan seluler dengan paket data; menggelar kabel serat optik sampai ke rumah; menyewakan pusat data dan layanan jaringan untuk perusahaan | jaringan internet, menara seluler, paket data, serat optik |
| Nestlé (NE) | Pangan | memproduksi makanan bayi dan susu formula; menjual cokelat dan sereal sarapan bermerek global; mengandalkan merek global yang sudah lama dipercaya keluarga | makanan bayi, cokelat, sereal, susu formula |
| Kraft Heinz (KH) | Pangan | membuat saus dan makanan kalengan bermerek; bergantung pada pasokan tomat dan bahan baku impor; memasok produk awet untuk restoran cepat saji; mengelola rantai pasok bahan baku lintas negara | saus, makanan kalengan, tomat, restoran cepat saji, rantai pasok bahan baku |
| Danone (DA) | Pangan | memproduksi yoghurt dan produk susu segar; menjual air minum kemasan; memasarkan produk untuk gaya hidup sehat | yoghurt, produk susu, air minum kemasan, gaya hidup sehat |
| Mayora (MA) | Pangan | membuat biskuit dan permen untuk pasar massal; menjual kopi sachet lewat warung dan toko kecil; mengekspor camilan ke negara-negara Asia | biskuit, permen, kopi sachet, warung |
| Indofood (IN) | Pangan | memproduksi mi instan dalam jumlah besar; mengolah tepung dan minyak goreng; mengelola perkebunan sendiri sebagai sumber bahan baku | mi instan, tepung, minyak goreng, perkebunan |
| BCA (BC) | Keuangan | melayani nasabah menengah ke atas lewat tabungan dan kartu; unggul dalam transaksi nontunai di dalam negeri; memiliki simpanan murah dalam jumlah besar | nasabah menengah ke atas, kartu, nontunai, simpanan murah |
| Visa (VI) | Keuangan | mengelola jaringan pembayaran kartu lintas negara; memungut biaya dari belanja daring dan perjalanan ke luar negeri; menghubungkan bank dan pedagang di seluruh dunia | pembayaran kartu, lintas negara, belanja daring, perjalanan ke luar negeri |
| Mandiri (MD) | Keuangan | menyalurkan kredit korporasi dalam jumlah besar; membiayai proyek infrastruktur dan program pemerintah; dimiliki negara dan menjadi bank rujukan BUMN | kredit korporasi, infrastruktur, dimiliki negara, proyek pemerintah |
| BRI (BR) | Keuangan | menyalurkan kredit usaha kecil sampai ke desa; memiliki unit pembiayaan mikro di pelosok; membiayai pedagang pasar dan petani kecil | usaha kecil, desa, pembiayaan mikro, pedagang pasar |
| PayPal (PA) | Keuangan | menyediakan dompet digital dan pembayaran daring; memfasilitasi transfer uang antar pengguna; melayani penjual daring kecil lintas negara | dompet digital, pembayaran daring, transfer uang, penjual daring |
| Airbus (AI) | Transportasi | membuat pesawat penumpang di pabrik perakitan besar; memegang buku pesanan pesawat yang panjang; mengirim pesawat baru ke maskapai di berbagai negara | pesawat penumpang, pesanan pesawat, pabrik perakitan, mengirim pesawat |
| Toyota (TO) | Transportasi | menjual mobil keluarga lewat dealer resmi; memproduksi kendaraan hibrida dan listrik; memiliki jaringan dealer dan layanan purnajual yang luas | mobil, hibrida, dealer, purnajual |
| Honda (HO) | Transportasi | memproduksi sepeda motor untuk kebutuhan harian; menjual suku cadang lewat bengkel resmi; mengoperasikan pabrik otomotif di banyak negara | sepeda motor, suku cadang, bengkel resmi, pabrik otomotif |
| Grab (GR) | Transportasi | menjalankan aplikasi ojek dan taksi daring; mengantar makanan pesanan ke rumah pelanggan; mengandalkan jutaan mitra pengemudi | ojek, taksi daring, mengantar makanan, pengemudi |
| Garuda Indonesia (GA) | Transportasi | menerbangkan penumpang di rute domestik dan internasional; menjual tiket penerbangan dalam jumlah besar; membeli bahan bakar avtur dalam jumlah besar | penumpang, tiket penerbangan, rute penerbangan, avtur |
| L'Oréal (LO) | Konsumen dan kesehatan | menjual kosmetik dan produk perawatan kulit; mengikuti tren kecantikan yang cepat berganti; memasarkan produknya lewat gerai kecantikan dan influencer | kosmetik, perawatan kulit, tren kecantikan, gerai kecantikan |
| Pfizer (PF) | Konsumen dan kesehatan | mengembangkan obat resep dan vaksin; menanggung riset medis berbiaya besar; menunggu izin edar dari regulator kesehatan | obat resep, vaksin, riset medis, izin edar |
| Unilever (UN) | Konsumen dan kesehatan | memproduksi sabun, sampo, dan deterjen; menjual produk rumah tangga lewat pasar swalayan; memasarkan perawatan pribadi untuk pemakaian harian | sabun, sampo, deterjen, produk rumah tangga |
| Kalbe Farma (KA) | Konsumen dan kesehatan | menjual obat bebas dan minuman kesehatan; memasok apotek lewat jaringan distribusi yang luas; membuat vitamin dan produk nutrisi | obat bebas, minuman kesehatan, apotek, vitamin |
| Sido Muncul (SM) | Konsumen dan kesehatan | memproduksi jamu dan produk herbal; menjual suplemen untuk kesehatan sehari-hari; memanfaatkan rempah dan bahan alami | jamu, herbal, suplemen, rempah |
| Chevron (CV) | Energi | mengebor minyak dan gas di ladang lepas pantai; mengelola fasilitas pengolahan berskala global; menjual minyak mentah ke pasar dunia | lepas pantai, berskala global, minyak mentah |
| Shell (SL) | Energi | mendistribusikan bahan bakar lewat jaringan pom bensin; memperdagangkan gas alam cair; berinvestasi pada energi terbarukan | pom bensin, gas alam cair, energi terbarukan |
| Pertamina (PE) | Energi | menyalurkan bahan bakar subsidi ke seluruh pelosok; dimiliki negara dan memasok kebutuhan energi nasional; mengelola stasiun pengisian dan pengolahan minyak di dalam negeri | bahan bakar subsidi, energi nasional, stasiun pengisian |
| PLN (PN) | Energi | memasok listrik ke rumah dan pabrik; mengoperasikan pembangkit dan jaringan transmisi; menjual tenaga listrik dengan tarif yang diatur pemerintah | listrik, pembangkit, jaringan transmisi |
| Adaro (AD) | Energi | menambang batu bara dan menjualnya ke pembangkit; mengekspor batu bara ke negara-negara Asia; mengoperasikan tambang terbuka berskala besar | batu bara, tambang |
