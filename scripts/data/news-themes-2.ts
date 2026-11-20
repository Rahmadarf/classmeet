/**
 * Tema berita harga tambahan (kumpulan 1000 berita, 19 Nov). Format dan arti sama dengan `news-themes.ts`
 * (EN Energi, TR Transportasi, TE Teknologi, KE Keuangan, PA Pangan, KO Konsumen dan kesehatan; versi "neg"
 * membalik bobot). Teks fiksi.
 */
import type { Theme } from "./news-themes";

export const THEMES_2: Theme[] = [
  {
    w: { EN: 2, TR: -1, KO: -1 },
    pos: {
      t: ["Harga batu bara melonjak", "Permintaan batu bara dari luar negeri naik tajam"],
      b: "Harga batu bara melonjak karena permintaan pembangkit luar negeri naik. Produsen energi menikmati pendapatan lebih besar, sementara biaya listrik bagi pabrik dan pengangkut ikut naik.",
    },
    neg: {
      t: ["Harga batu bara anjlok", "Pembeli luar negeri kurangi pesanan batu bara"],
      b: "Harga batu bara anjlok karena pembeli luar negeri mengurangi pesanan. Produsen energi tertekan, sementara biaya listrik bagi pabrik dan pengangkut mereda.",
    },
  },
  {
    w: { PA: 2, KO: 1 },
    pos: {
      t: ["Harga minyak goreng turun", "Pasokan minyak sawit melimpah, harga di pasar turun"],
      b: "Harga minyak goreng turun karena pasokan minyak sawit melimpah. Produsen makanan olahan dan pedagang kebutuhan harian menikmati biaya bahan baku yang lebih ringan.",
    },
    neg: {
      t: ["Harga minyak goreng naik", "Pasokan minyak sawit menipis, harga di pasar naik"],
      b: "Harga minyak goreng naik karena pasokan minyak sawit menipis. Produsen makanan olahan dan pedagang kebutuhan harian menanggung biaya bahan baku yang lebih berat.",
    },
  },
  {
    w: { PA: 2 },
    pos: {
      t: ["Harga daging ayam stabil di semua daerah", "Peternak pasok ayam cukup untuk kebutuhan nasional"],
      b: "Harga daging ayam stabil di semua daerah karena peternak memasok cukup unggas. Produsen makanan olahan dan pengolah daging menikmati margin yang terjaga.",
    },
    neg: {
      t: ["Harga daging ayam melonjak", "Wabah penyakit unggas kurangi pasokan ayam"],
      b: "Harga daging ayam melonjak karena wabah penyakit unggas mengurangi pasokan. Produsen makanan olahan dan pengolah daging menanggung biaya yang lebih tinggi.",
    },
  },
  {
    w: { PA: 1, KO: 1 },
    pos: {
      t: ["Konsumsi susu dan produk olahan meningkat", "Penjualan yoghurt dan keju tembus rekor"],
      b: "Konsumsi susu dan produk olahannya meningkat setelah kampanye gizi nasional. Produsen makanan dan minuman mencatat penjualan yang naik.",
    },
    neg: {
      t: ["Konsumsi susu dan produk olahan menurun", "Penjualan yoghurt dan keju lesu"],
      b: "Konsumsi susu dan produk olahannya menurun karena konsumen berhemat. Produsen makanan dan minuman mencatat penjualan yang turun.",
    },
  },
  {
    w: { PA: 2 },
    pos: {
      t: ["Harga gula turun setelah panen tebu melimpah", "Stok gula nasional aman hingga akhir tahun"],
      b: "Harga gula turun setelah panen tebu melimpah dan stok nasional aman. Produsen minuman dan kembang gula menikmati bahan baku yang lebih murah.",
    },
    neg: {
      t: ["Harga gula naik karena panen tebu menurun", "Stok gula nasional menipis"],
      b: "Harga gula naik karena panen tebu menurun dan stok nasional menipis. Produsen minuman dan kembang gula menanggung bahan baku yang lebih mahal.",
    },
  },
  {
    w: { PA: 2, TR: 1 },
    pos: {
      t: ["Musim hujan datang tepat waktu", "Curah hujan merata, petani mulai menanam"],
      b: "Musim hujan datang tepat waktu dan curah hujan merata. Petani mulai menanam dan jalur distribusi pangan berjalan lancar.",
    },
    neg: {
      t: ["Musim hujan terlambat datang", "Kemarau berkepanjangan tunda masa tanam"],
      b: "Musim hujan terlambat datang dan kemarau berkepanjangan menunda masa tanam. Pasokan pangan terancam dan distribusi lebih mahal.",
    },
  },
  {
    w: { TR: 2 },
    pos: {
      t: ["Tarif kereta komuter diturunkan", "Penumpang kereta komuter bertambah dua kali lipat"],
      b: "Tarif kereta komuter diturunkan dan jumlah penumpang bertambah. Operator transportasi mencatat pendapatan yang meningkat dari volume penumpang.",
    },
    neg: {
      t: ["Tarif kereta komuter dinaikkan", "Penumpang kereta komuter berkurang setelah tarif naik"],
      b: "Tarif kereta komuter dinaikkan dan jumlah penumpang berkurang. Operator transportasi mencatat pendapatan yang tertekan.",
    },
  },
  {
    w: { TR: 1, PA: 1, KO: 1, TE: 1 },
    pos: {
      t: ["Tarif kontainer laut turun", "Biaya pengiriman barang lintas negara melandai"],
      b: "Tarif pengiriman kontainer laut turun. Pengangkut, pedagang pangan, produsen barang konsumsi, dan perusahaan teknologi menikmati biaya logistik yang lebih ringan.",
    },
    neg: {
      t: ["Tarif kontainer laut melonjak", "Biaya pengiriman barang lintas negara membengkak"],
      b: "Tarif pengiriman kontainer laut melonjak. Pengangkut, pedagang pangan, produsen barang konsumsi, dan perusahaan teknologi menanggung biaya logistik yang lebih berat.",
    },
  },
  {
    w: { TR: 2, KO: 1 },
    pos: {
      t: [
        "Bandara baru dibuka untuk penerbangan komersial",
        "Terminal baru bandara kota besar mulai beroperasi",
      ],
      b: "Bandara baru dibuka untuk penerbangan komersial. Maskapai dan pelaku usaha di sekitar bandara melihat lonjakan penumpang.",
    },
    neg: {
      t: ["Pembukaan bandara baru ditunda", "Terminal baru bandara belum lolos uji kelayakan"],
      b: "Pembukaan bandara baru ditunda karena belum lolos uji kelayakan. Maskapai dan pelaku usaha di sekitar bandara menunda rencana ekspansi.",
    },
  },
  {
    w: { TR: 1, TE: 1, EN: -1 },
    pos: {
      t: ["Armada bus listrik bertambah di kota besar", "Pemerintah kota beli ratusan bus listrik"],
      b: "Armada bus listrik bertambah di kota besar. Operator transportasi dan penyedia teknologi pengisian daya menikmati kontrak baru, sementara permintaan solar sedikit menurun.",
    },
    neg: {
      t: ["Pengadaan bus listrik dibatalkan", "Pemerintah kota tunda pembelian bus listrik"],
      b: "Pengadaan bus listrik dibatalkan karena anggaran terbatas. Operator transportasi dan penyedia teknologi pengisian daya kehilangan kontrak, sementara permintaan solar bertahan.",
    },
  },
  {
    w: { TE: 2, EN: 1 },
    pos: {
      t: ["Pusat data lokal baru dibangun", "Perusahaan komputasi awan buka pusat data di dalam negeri"],
      b: "Perusahaan komputasi awan membangun pusat data lokal baru. Penyedia teknologi mendapat pesanan, dan kebutuhan listrik di wilayah sekitar naik.",
    },
    neg: {
      t: ["Proyek pusat data lokal dibatalkan", "Pembangunan pusat data tertunda karena izin"],
      b: "Proyek pusat data lokal dibatalkan karena izin tertunda. Penyedia teknologi kehilangan pesanan, dan kebutuhan listrik yang direncanakan tidak jadi naik.",
    },
  },
  {
    w: { TE: 2, KO: 1 },
    pos: {
      t: ["Layanan internet satelit menjangkau pelosok", "Pelanggan internet satelit melonjak"],
      b: "Layanan internet satelit menjangkau daerah pelosok dan pelanggannya melonjak. Penyedia teknologi dan produsen perangkat menikmati permintaan baru.",
    },
    neg: {
      t: ["Peluncuran satelit internet gagal", "Layanan internet satelit tertunda berbulan-bulan"],
      b: "Peluncuran satelit internet gagal sehingga layanan tertunda berbulan-bulan. Penyedia teknologi dan produsen perangkat menurunkan target penjualan.",
    },
  },
  {
    w: { TE: 2, TR: 1, PA: 1 },
    pos: {
      t: ["Otomasi pabrik dipercepat", "Pabrik pasang lini robot untuk tingkatkan produksi"],
      b: "Pabrik mempercepat otomasi dengan memasang lini robot. Penyedia teknologi mendapat pesanan, sementara pabrikan kendaraan dan makanan menaikkan produksinya.",
    },
    neg: {
      t: ["Biaya otomasi pabrik membengkak", "Pabrik tunda pemasangan lini robot"],
      b: "Biaya otomasi pabrik membengkak sehingga pemasangan lini robot ditunda. Penyedia teknologi kehilangan pesanan, dan pabrikan menunda peningkatan produksi.",
    },
  },
  {
    w: { TE: 2, KO: 1 },
    pos: {
      t: ["Penjualan perangkat wearable melonjak", "Jam pintar dan gelang kebugaran laris di pasar"],
      b: "Penjualan jam pintar dan gelang kebugaran melonjak. Produsen perangkat dan penyedia aplikasi kesehatan menikmati permintaan yang naik.",
    },
    neg: {
      t: ["Penjualan perangkat wearable lesu", "Jam pintar dan gelang kebugaran sepi pembeli"],
      b: "Penjualan jam pintar dan gelang kebugaran lesu. Produsen perangkat dan penyedia aplikasi kesehatan menurunkan target penjualan.",
    },
  },
  {
    w: { TE: 2 },
    pos: {
      t: ["Aplikasi pesan populer luncurkan fitur baru", "Pengguna aplikasi pesan bertambah puluhan juta"],
      b: "Aplikasi pesan populer meluncurkan fitur baru dan pengguna bertambah puluhan juta. Penyedia teknologi menikmati pertumbuhan pendapatan iklan dan layanan.",
    },
    neg: {
      t: ["Aplikasi pesan populer lumpuh seharian", "Gangguan server aplikasi pesan buat pengguna kecewa"],
      b: "Aplikasi pesan populer lumpuh seharian akibat gangguan server. Pengguna kecewa dan penyedia teknologi menanggung kerugian reputasi.",
    },
  },
  {
    w: { TE: 2, KO: 1 },
    pos: {
      t: ["Ponsel lipat generasi baru laris", "Pabrikan ponsel kehabisan stok model terbaru"],
      b: "Ponsel lipat generasi baru laris dan pabrikan kehabisan stok. Produsen perangkat dan pemasok komponen menikmati pesanan yang melonjak.",
    },
    neg: {
      t: ["Ponsel lipat generasi baru dikeluhkan pembeli", "Pabrikan tarik sebagian ponsel lipat dari pasar"],
      b: "Ponsel lipat generasi baru dikeluhkan pembeli karena cacat engsel. Pabrikan menarik sebagian unit dan pemasok komponen menurunkan pesanan.",
    },
  },
  {
    w: { TE: 2, KE: 1 },
    pos: {
      t: ["Pajak layanan digital diturunkan", "Pemerintah beri keringanan pajak bagi perusahaan teknologi"],
      b: "Pemerintah menurunkan pajak layanan digital. Perusahaan teknologi dan penyedia pembayaran menikmati margin yang lebih baik.",
    },
    neg: {
      t: ["Pajak layanan digital dinaikkan", "Pemerintah tambah beban pajak bagi perusahaan teknologi"],
      b: "Pemerintah menaikkan pajak layanan digital. Perusahaan teknologi dan penyedia pembayaran menanggung margin yang lebih tipis.",
    },
  },
  {
    w: { KE: 2, TE: 1 },
    pos: {
      t: ["Aturan teknologi keuangan diperjelas", "Regulator beri kepastian bagi layanan pembiayaan digital"],
      b: "Regulator memperjelas aturan teknologi keuangan sehingga layanan pembiayaan digital punya kepastian hukum. Lembaga keuangan dan penyedia teknologi bersiap berekspansi.",
    },
    neg: {
      t: [
        "Aturan teknologi keuangan diperketat mendadak",
        "Regulator hentikan izin baru layanan pembiayaan digital",
      ],
      b: "Regulator memperketat aturan teknologi keuangan dan menghentikan izin baru layanan pembiayaan digital. Lembaga keuangan dan penyedia teknologi menunda ekspansi.",
    },
  },
  {
    w: { KE: 1, KO: 2 },
    pos: {
      t: ["Kepesertaan asuransi kesehatan melonjak", "Jutaan warga daftar asuransi kesehatan baru"],
      b: "Kepesertaan asuransi kesehatan melonjak karena jutaan warga mendaftar. Perusahaan asuransi dan penyedia layanan kesehatan menikmati pendapatan yang naik.",
    },
    neg: {
      t: ["Klaim asuransi kesehatan membengkak", "Perusahaan asuransi tanggung klaim tak terduga"],
      b: "Klaim asuransi kesehatan membengkak melebihi perkiraan. Perusahaan asuransi menanggung beban besar dan penyedia layanan kesehatan menghadapi tunggakan pembayaran.",
    },
  },
  {
    w: { KE: 2 },
    pos: {
      t: ["Investor ritel baru memenuhi pasar saham", "Pembukaan rekening efek baru tembus rekor"],
      b: "Pembukaan rekening efek baru tembus rekor karena investor ritel muda masuk pasar. Perusahaan efek dan perbankan mencatat transaksi yang melonjak.",
    },
    neg: {
      t: ["Investor ritel menarik dana dari pasar saham", "Pembukaan rekening efek baru anjlok"],
      b: "Pembukaan rekening efek baru anjlok dan investor ritel menarik dana. Perusahaan efek dan perbankan mencatat transaksi yang menurun.",
    },
  },
  {
    w: { KE: 2 },
    pos: {
      t: ["Lelang obligasi pemerintah diminati besar", "Penawaran obligasi melebihi target tiga kali lipat"],
      b: "Lelang obligasi pemerintah diminati besar dan penawaran melebihi target. Lembaga keuangan menikmati likuiditas dan selera risiko yang tinggi.",
    },
    neg: {
      t: ["Lelang obligasi pemerintah sepi peminat", "Penawaran obligasi di bawah target"],
      b: "Lelang obligasi pemerintah sepi peminat dan penawaran di bawah target. Lembaga keuangan menghadapi likuiditas dan selera risiko yang menurun.",
    },
  },
  {
    w: { KE: 1, TR: 1, TE: 1 },
    pos: {
      t: ["Cadangan devisa naik ke level tertinggi", "Pasokan dolar di pasar valuta melimpah"],
      b: "Cadangan devisa naik ke level tertinggi sehingga pasokan dolar melimpah. Perbankan, pengangkut, dan perusahaan teknologi yang banyak mengimpor merasa lebih tenang.",
    },
    neg: {
      t: ["Cadangan devisa menyusut tajam", "Pasokan dolar di pasar valuta menipis"],
      b: "Cadangan devisa menyusut tajam sehingga pasokan dolar menipis. Perbankan, pengangkut, dan perusahaan teknologi yang banyak mengimpor khawatir.",
    },
  },
  {
    w: { KE: 2, KO: 1 },
    pos: {
      t: ["Penyaluran kredit rumah meningkat", "Permintaan KPR naik setelah uang muka diturunkan"],
      b: "Penyaluran kredit rumah meningkat setelah aturan uang muka dilonggarkan. Perbankan dan produsen barang rumah tangga menikmati permintaan yang naik.",
    },
    neg: {
      t: ["Penyaluran kredit rumah menurun", "Permintaan KPR turun setelah aturan uang muka diperketat"],
      b: "Penyaluran kredit rumah menurun setelah aturan uang muka diperketat. Perbankan dan produsen barang rumah tangga menghadapi permintaan yang turun.",
    },
  },
  {
    w: { KE: -1, TE: -1, EN: -1 },
    pos: {
      t: ["Harga emas melonjak, investor cari aman", "Investor pindahkan dana ke emas"],
      b: "Harga emas melonjak karena investor mencari aset aman. Saham perbankan, teknologi, dan energi kehilangan sebagian peminat.",
    },
    neg: {
      t: ["Harga emas turun, investor kembali ke saham", "Investor lepas emas dan beli saham"],
      b: "Harga emas turun karena investor kembali berani membeli saham. Saham perbankan, teknologi, dan energi mendapat tambahan peminat.",
    },
  },
  {
    w: { KO: 2, KE: 1, PA: 1 },
    pos: {
      t: ["Pajak penghasilan karyawan dipangkas", "Gaji bersih naik setelah tarif pajak turun"],
      b: "Pajak penghasilan karyawan dipangkas sehingga gaji bersih naik. Pengeluaran untuk barang konsumsi dan makanan diperkirakan meningkat, begitu pula tabungan di bank.",
    },
    neg: {
      t: ["Pajak penghasilan karyawan dinaikkan", "Gaji bersih turun setelah tarif pajak naik"],
      b: "Pajak penghasilan karyawan dinaikkan sehingga gaji bersih turun. Pengeluaran untuk barang konsumsi dan makanan diperkirakan menurun.",
    },
  },
  {
    w: { TE: 2, KO: 1 },
    pos: {
      t: ["Bea masuk perangkat elektronik diturunkan", "Harga laptop dan ponsel diperkirakan turun"],
      b: "Bea masuk perangkat elektronik diturunkan. Produsen dan pedagang perangkat menikmati permintaan yang naik karena harga lebih terjangkau.",
    },
    neg: {
      t: ["Bea masuk perangkat elektronik dinaikkan", "Harga laptop dan ponsel diperkirakan naik"],
      b: "Bea masuk perangkat elektronik dinaikkan. Produsen dan pedagang perangkat menghadapi permintaan yang turun karena harga lebih mahal.",
    },
  },
  {
    w: { PA: 1, KO: 1 },
    pos: {
      t: ["Sertifikasi produk dipercepat", "Izin edar makanan dan minuman selesai lebih cepat"],
      b: "Proses sertifikasi dan izin edar produk dipercepat. Produsen makanan, minuman, dan barang konsumsi bisa meluncurkan produk baru lebih cepat.",
    },
    neg: {
      t: ["Sertifikasi produk tersendat", "Izin edar makanan dan minuman menumpuk"],
      b: "Proses sertifikasi dan izin edar produk tersendat dan berkas menumpuk. Produsen makanan, minuman, dan barang konsumsi menunda peluncuran produk baru.",
    },
  },
  {
    w: { PA: 1, KO: 1, TR: 1 },
    pos: {
      t: ["Pelaku usaha kuliner kecil bangkit", "Wisata kuliner ramai di kota-kota besar"],
      b: "Pelaku usaha kuliner kecil bangkit dan wisata kuliner ramai di kota besar. Pemasok bahan makanan, produsen barang konsumsi, dan pengangkut ikut menikmati pesanan.",
    },
    neg: {
      t: ["Pelaku usaha kuliner kecil tertekan", "Wisata kuliner sepi di kota-kota besar"],
      b: "Pelaku usaha kuliner kecil tertekan dan wisata kuliner sepi di kota besar. Pemasok bahan makanan, produsen barang konsumsi, dan pengangkut mencatat pesanan yang turun.",
    },
  },
  {
    w: { EN: 2, TE: 1 },
    pos: {
      t: ["Pembangkit listrik tenaga gas baru beroperasi", "Kapasitas listrik nasional bertambah"],
      b: "Pembangkit listrik tenaga gas baru beroperasi dan menambah kapasitas listrik nasional. Perusahaan energi dan penyedia teknologi pembangkit mencatat kontrak yang naik.",
    },
    neg: {
      t: ["Pembangkit listrik tenaga gas terhenti", "Pasokan gas ke pembangkit terganggu"],
      b: "Pembangkit listrik tenaga gas terhenti karena pasokan gas terganggu. Perusahaan energi dan penyedia teknologi pembangkit menanggung kerugian kontrak.",
    },
  },
  {
    w: { TR: 2, PA: 1, EN: -1 },
    pos: {
      t: ["Harga solar industri turun", "Biaya bahan bakar truk dan kapal melandai"],
      b: "Harga solar industri turun sehingga biaya bahan bakar truk dan kapal melandai. Pengangkut dan distributor pangan menikmati margin yang lebih baik, sementara produsen energi sedikit tertekan.",
    },
    neg: {
      t: ["Harga solar industri naik", "Biaya bahan bakar truk dan kapal melonjak"],
      b: "Harga solar industri naik sehingga biaya bahan bakar truk dan kapal melonjak. Pengangkut dan distributor pangan menanggung margin yang lebih tipis, sementara produsen energi diuntungkan.",
    },
  },
  {
    w: { KO: 2, TR: 1, PA: 1, KE: 1, TE: 1 },
    pos: {
      t: [
        "Turnamen olahraga internasional digelar di dalam negeri",
        "Ribuan penonton dan atlet datang ke kota tuan rumah",
      ],
      b: "Turnamen olahraga internasional digelar di dalam negeri dan ribuan penonton datang. Pengangkut, pedagang makanan, penyedia pembayaran, dan produsen barang konsumsi menikmati lonjakan transaksi.",
    },
    neg: {
      t: ["Turnamen olahraga internasional batal digelar", "Kota tuan rumah kehilangan ribuan pengunjung"],
      b: "Turnamen olahraga internasional batal digelar dan ribuan pengunjung tidak jadi datang. Pengangkut, pedagang makanan, penyedia pembayaran, dan produsen barang konsumsi kehilangan transaksi.",
    },
  },
  {
    w: { KO: 1, TR: 1, TE: 1 },
    pos: {
      t: ["Konser musik besar dijual ludes", "Tiket festival musik habis dalam hitungan menit"],
      b: "Tiket konser dan festival musik besar habis dalam hitungan menit. Penyedia penjualan tiket, pengangkut, dan produsen barang konsumsi menikmati lonjakan permintaan.",
    },
    neg: {
      t: ["Konser musik besar dibatalkan", "Festival musik batal digelar mendadak"],
      b: "Konser dan festival musik besar dibatalkan mendadak. Penyedia penjualan tiket, pengangkut, dan produsen barang konsumsi kehilangan pendapatan yang diperkirakan.",
    },
  },
  {
    w: { EN: 1, TR: 1, TE: 1, KE: 1, PA: 1, KO: 1 },
    pos: {
      t: ["Situasi politik dalam negeri kondusif", "Pelaku usaha optimistis setelah proses politik damai"],
      b: "Situasi politik dalam negeri kondusif dan pelaku usaha optimistis. Hampir semua sektor menyambutnya dengan rencana investasi baru.",
    },
    neg: {
      t: ["Ketegangan politik dalam negeri meningkat", "Pelaku usaha menunda investasi di tengah ketegangan"],
      b: "Ketegangan politik dalam negeri meningkat dan pelaku usaha menunda investasi. Hampir semua sektor menyambutnya dengan kewaspadaan.",
    },
  },
  {
    w: { PA: 1, TR: 1 },
    pos: {
      t: ["Hambatan perdagangan antardaerah dihapus", "Pengiriman pangan antarpulau lebih murah"],
      b: "Hambatan perdagangan antardaerah dihapus sehingga pengiriman pangan antarpulau lebih murah. Produsen pangan dan pengangkut menikmati volume yang naik.",
    },
    neg: {
      t: ["Hambatan perdagangan antardaerah bertambah", "Pengiriman pangan antarpulau lebih mahal"],
      b: "Hambatan perdagangan antardaerah bertambah sehingga pengiriman pangan antarpulau lebih mahal. Produsen pangan dan pengangkut menghadapi volume yang turun.",
    },
  },
  {
    w: { KO: 2 },
    pos: {
      t: ["Program imunisasi massal dimulai", "Pemerintah sediakan vaksin gratis di seluruh daerah"],
      b: "Program imunisasi massal dimulai dengan vaksin gratis di seluruh daerah. Produsen obat dan vaksin menikmati pesanan besar dari pemerintah.",
    },
    neg: {
      t: ["Program imunisasi massal ditunda", "Pasokan vaksin terlambat tiba di daerah"],
      b: "Program imunisasi massal ditunda karena pasokan vaksin terlambat. Produsen obat dan vaksin menunda pengiriman pesanan pemerintah.",
    },
  },
  {
    w: { KO: 2, KE: 1 },
    pos: {
      t: ["Rumah sakit baru dibuka di banyak daerah", "Kapasitas layanan kesehatan bertambah"],
      b: "Rumah sakit baru dibuka di banyak daerah dan kapasitas layanan kesehatan bertambah. Produsen obat dan alat kesehatan serta pembiayaan kesehatan menikmati permintaan yang naik.",
    },
    neg: {
      t: ["Pembangunan rumah sakit baru terhenti", "Anggaran layanan kesehatan dipangkas"],
      b: "Pembangunan rumah sakit baru terhenti karena anggaran layanan kesehatan dipangkas. Produsen obat dan alat kesehatan serta pembiayaan kesehatan menurunkan target.",
    },
  },
  {
    w: { KO: 1, TE: 1 },
    pos: {
      t: ["Impor alat kesehatan dipermudah", "Peralatan medis canggih tiba lebih cepat"],
      b: "Impor alat kesehatan dipermudah sehingga peralatan medis canggih tiba lebih cepat. Penyedia layanan kesehatan dan teknologi medis menikmati peluang baru.",
    },
    neg: {
      t: ["Impor alat kesehatan dihambat", "Peralatan medis tertahan di pelabuhan"],
      b: "Impor alat kesehatan dihambat dan peralatan medis tertahan di pelabuhan. Penyedia layanan kesehatan dan teknologi medis menunda rencana pembelian.",
    },
  },
  {
    w: { PA: 2, EN: 1, KO: 1 },
    pos: {
      t: ["Pasokan air bersih terjaga sepanjang musim", "Waduk penuh, irigasi sawah berjalan lancar"],
      b: "Pasokan air bersih terjaga sepanjang musim dan waduk penuh. Irigasi sawah lancar, pembangkit air beroperasi penuh, dan pabrik minuman tak khawatir kekurangan.",
    },
    neg: {
      t: ["Kekeringan melanda sentra pangan", "Waduk menyusut, irigasi sawah terganggu"],
      b: "Kekeringan melanda sentra pangan dan waduk menyusut. Irigasi sawah terganggu, pembangkit air berkurang, dan pabrik minuman menghadapi kekurangan pasokan.",
    },
  },
  {
    w: { PA: 2, TE: 1 },
    pos: {
      t: ["Petani pakai drone dan sensor untuk tingkatkan panen", "Pertanian presisi menaikkan hasil panen"],
      b: "Petani memakai drone dan sensor tanah sehingga hasil panen naik. Produsen pangan menikmati pasokan lebih stabil dan penyedia teknologi mendapat pesanan.",
    },
    neg: {
      t: [
        "Teknologi pertanian presisi tak terjangkau petani",
        "Petani kembali ke cara lama karena biaya tinggi",
      ],
      b: "Teknologi pertanian presisi dinilai terlalu mahal sehingga petani kembali ke cara lama. Pasokan pangan tak membaik dan penyedia teknologi kehilangan pesanan.",
    },
  },
  {
    w: { PA: 2, TR: 1 },
    pos: {
      t: ["Tangkapan ikan melimpah di musim ini", "Ekspor hasil laut meningkat"],
      b: "Tangkapan ikan melimpah dan ekspor hasil laut meningkat. Produsen pangan olahan dan pengangkut berpendingin menikmati volume yang naik.",
    },
    neg: {
      t: ["Tangkapan ikan anjlok karena cuaca buruk", "Pasokan hasil laut menipis"],
      b: "Tangkapan ikan anjlok karena cuaca buruk dan pasokan hasil laut menipis. Produsen pangan olahan dan pengangkut berpendingin menghadapi volume yang turun.",
    },
  },
  {
    w: { PA: 2, TR: 1 },
    pos: {
      t: ["Gudang pendingin baru dibuka di pelabuhan", "Kapasitas rantai dingin pangan bertambah"],
      b: "Gudang pendingin baru dibuka di pelabuhan dan kapasitas rantai dingin pangan bertambah. Produsen pangan dan pengangkut menikmati kerugian susut yang lebih kecil.",
    },
    neg: {
      t: ["Gudang pendingin terhenti karena gangguan listrik", "Stok pangan beku rusak"],
      b: "Gudang pendingin terhenti karena gangguan listrik dan stok pangan beku rusak. Produsen pangan dan pengangkut menanggung kerugian.",
    },
  },
  {
    w: { PA: 1, KO: 1 },
    pos: {
      t: [
        "Standar mutu ekspor pangan dipenuhi lebih banyak produsen",
        "Pembeli luar negeri tambah pesanan produk lokal",
      ],
      b: "Lebih banyak produsen memenuhi standar mutu ekspor sehingga pembeli luar negeri menambah pesanan produk lokal. Produsen makanan dan barang konsumsi menikmati pasar yang lebih luas.",
    },
    neg: {
      t: ["Produk pangan lokal ditolak negara tujuan ekspor", "Standar mutu ekspor tak terpenuhi"],
      b: "Sejumlah produk pangan lokal ditolak negara tujuan karena standar mutu tak terpenuhi. Produsen makanan dan barang konsumsi kehilangan pesanan.",
    },
  },
  {
    w: { TE: 2, KO: 1 },
    pos: {
      t: ["Program tukar tambah perangkat laris", "Pembeli ramai menukar perangkat lama dengan yang baru"],
      b: "Program tukar tambah perangkat laris dan pembeli ramai menukar perangkat lama. Produsen perangkat dan pedagang elektronik menikmati penjualan yang naik.",
    },
    neg: {
      t: ["Program tukar tambah perangkat sepi peminat", "Pembeli menunda ganti perangkat lama"],
      b: "Program tukar tambah perangkat sepi peminat dan pembeli menunda mengganti perangkat. Produsen perangkat dan pedagang elektronik menurunkan target penjualan.",
    },
  },
  {
    w: { TE: 2, KE: 1 },
    pos: {
      t: ["Layanan publik daring diperluas", "Warga urus dokumen lewat aplikasi pemerintah"],
      b: "Layanan publik daring diperluas sehingga warga mengurus dokumen lewat aplikasi. Penyedia teknologi dan pembayaran digital mendapat kontrak pemerintah.",
    },
    neg: {
      t: ["Layanan publik daring terganggu peretasan", "Aplikasi pemerintah tak bisa diakses berhari-hari"],
      b: "Layanan publik daring terganggu peretasan dan aplikasi pemerintah tak bisa diakses berhari-hari. Penyedia teknologi dan pembayaran digital menanggung kerugian reputasi.",
    },
  },
  {
    w: { KE: 2, TE: 1, TR: 1 },
    pos: {
      t: ["Pembayaran QR lintas negara diluncurkan", "Wisatawan bisa bayar dengan kode QR di banyak negara"],
      b: "Pembayaran lintas negara dengan kode QR diluncurkan. Lembaga keuangan, penyedia teknologi, dan pelaku pariwisata menikmati transaksi yang meningkat.",
    },
    neg: {
      t: ["Pembayaran QR lintas negara ditunda", "Kesepakatan sistem pembayaran antarnegara belum rampung"],
      b: "Peluncuran pembayaran lintas negara dengan kode QR ditunda karena kesepakatan belum rampung. Lembaga keuangan, penyedia teknologi, dan pelaku pariwisata menunda rencana.",
    },
  },
  {
    w: { KE: 1, KO: 2, TE: 1 },
    pos: {
      t: [
        "Cicilan nol persen marak di toko dan toko daring",
        "Penjualan barang elektronik naik karena cicilan ringan",
      ],
      b: "Cicilan nol persen marak di toko dan toko daring. Penerbit kartu kredit, produsen barang konsumsi, dan pedagang elektronik menikmati penjualan yang naik.",
    },
    neg: {
      t: [
        "Cicilan nol persen dihentikan banyak bank",
        "Penjualan barang elektronik turun tanpa cicilan ringan",
      ],
      b: "Banyak bank menghentikan cicilan nol persen. Penerbit kartu kredit, produsen barang konsumsi, dan pedagang elektronik mencatat penjualan yang turun.",
    },
  },
  {
    w: { KE: -1, KO: 1, TE: 1 },
    pos: {
      t: ["Biaya transfer antarbank diturunkan", "Nasabah hemat biaya kirim uang antarbank"],
      b: "Biaya transfer antarbank diturunkan sehingga nasabah menghemat biaya. Pendapatan biaya perbankan menurun, sementara dompet digital dan konsumsi diuntungkan.",
    },
    neg: {
      t: ["Biaya transfer antarbank dinaikkan", "Nasabah dikenai biaya kirim uang lebih besar"],
      b: "Biaya transfer antarbank dinaikkan sehingga nasabah membayar lebih besar. Pendapatan biaya perbankan naik, sementara dompet digital dan konsumsi tertekan.",
    },
  },
  {
    w: { KE: 2, TE: 1 },
    pos: {
      t: ["Regulator berantas pinjaman daring ilegal", "Ratusan platform pinjaman ilegal diblokir"],
      b: "Regulator memblokir ratusan platform pinjaman daring ilegal. Lembaga keuangan resmi dan penyedia teknologi yang patuh menikmati pelanggan yang beralih.",
    },
    neg: {
      t: ["Pinjaman daring ilegal kian marak", "Korban pinjaman daring ilegal bertambah"],
      b: "Pinjaman daring ilegal kian marak dan korbannya bertambah. Lembaga keuangan resmi dan penyedia teknologi yang patuh kehilangan kepercayaan masyarakat.",
    },
  },
  {
    w: { TE: 2, EN: 1, TR: 1 },
    pos: {
      t: ["Pabrik baterai besar mulai berproduksi", "Industri baterai kendaraan listrik tumbuh"],
      b: "Pabrik baterai besar mulai berproduksi dan industri baterai kendaraan listrik tumbuh. Penyedia teknologi, energi, dan pabrikan kendaraan menikmati pasokan yang lebih pasti.",
    },
    neg: {
      t: ["Pabrik baterai besar tertunda beroperasi", "Pasokan baterai kendaraan listrik seret"],
      b: "Pabrik baterai besar tertunda beroperasi dan pasokan baterai kendaraan listrik seret. Penyedia teknologi, energi, dan pabrikan kendaraan menunda rencana produksi.",
    },
  },
  {
    w: { EN: 2, TR: 1 },
    pos: {
      t: ["Proyek energi hidrogen resmi dimulai", "Pemerintah dukung bahan bakar hidrogen"],
      b: "Proyek energi hidrogen resmi dimulai dengan dukungan pemerintah. Perusahaan energi dan pengangkut berat melihat peluang bahan bakar baru.",
    },
    neg: {
      t: ["Proyek energi hidrogen dibatalkan", "Biaya produksi hidrogen dinilai terlalu tinggi"],
      b: "Proyek energi hidrogen dibatalkan karena biaya produksi dinilai terlalu tinggi. Perusahaan energi dan pengangkut berat menunda rencana bahan bakar baru.",
    },
  },
  {
    w: { EN: -1, PA: 1, KO: 1, TE: 1 },
    pos: {
      t: ["Pabrik makin hemat energi", "Program efisiensi energi pabrik berhasil tekan biaya"],
      b: "Program efisiensi energi pabrik berhasil menekan biaya listrik. Produsen makanan, teknologi, dan barang konsumsi menikmati margin yang lebih baik, sementara permintaan energi sedikit menurun.",
    },
    neg: {
      t: ["Pabrik boros energi picu biaya melonjak", "Program efisiensi energi pabrik gagal capai target"],
      b: "Program efisiensi energi pabrik gagal mencapai target sehingga biaya listrik melonjak. Produsen makanan, teknologi, dan barang konsumsi menanggung margin yang lebih tipis, sementara permintaan energi naik.",
    },
  },
  {
    w: { TR: 1, PA: 1, TE: 1, EN: 1 },
    pos: {
      t: ["Kawasan industri baru diresmikan", "Pabrik-pabrik baru mulai beroperasi di kawasan industri"],
      b: "Kawasan industri baru diresmikan dan pabrik mulai beroperasi. Pengangkut, produsen pangan, penyedia teknologi, dan pemasok energi mendapat pelanggan baru.",
    },
    neg: {
      t: ["Kawasan industri baru terkendala pembebasan lahan", "Pabrik-pabrik baru tunda beroperasi"],
      b: "Kawasan industri baru terkendala pembebasan lahan dan pabrik menunda operasi. Pengangkut, produsen pangan, penyedia teknologi, dan pemasok energi kehilangan pelanggan yang diharapkan.",
    },
  },
  {
    w: { TE: 1, KO: 1 },
    pos: {
      t: [
        "Pelatihan keterampilan digital dibuka untuk jutaan peserta",
        "Tenaga kerja terampil bertambah di sektor teknologi",
      ],
      b: "Pelatihan keterampilan digital dibuka untuk jutaan peserta dan tenaga kerja terampil bertambah. Penyedia teknologi dan perusahaan layanan kesehatan digital menikmati pasokan talenta.",
    },
    neg: {
      t: ["Kekurangan tenaga ahli teknologi makin parah", "Perusahaan sulit cari insinyur dan analis data"],
      b: "Kekurangan tenaga ahli teknologi makin parah dan perusahaan sulit mencari insinyur dan analis data. Penyedia teknologi dan layanan kesehatan digital menunda proyek.",
    },
  },
  {
    w: { KO: 1, PA: 1, KE: 1, TR: 1 },
    pos: {
      t: ["Angka pengangguran turun", "Lapangan kerja baru bertambah di banyak sektor"],
      b: "Angka pengangguran turun dan lapangan kerja baru bertambah di banyak sektor. Pengeluaran rumah tangga, perjalanan, dan kredit diperkirakan meningkat.",
    },
    neg: {
      t: ["Angka pengangguran naik", "Lapangan kerja baru menyusut di banyak sektor"],
      b: "Angka pengangguran naik dan lapangan kerja baru menyusut di banyak sektor. Pengeluaran rumah tangga, perjalanan, dan kredit diperkirakan menurun.",
    },
  },
  {
    w: { PA: 2, KO: 1 },
    pos: {
      t: ["Cukai minuman manis dibatalkan", "Produsen minuman lega setelah rencana cukai dicabut"],
      b: "Rencana cukai minuman manis dibatalkan. Produsen minuman dan makanan ringan lega karena biaya produksi dan harga jual tak jadi naik.",
    },
    neg: {
      t: ["Cukai minuman manis resmi berlaku", "Harga minuman kemasan naik setelah cukai diterapkan"],
      b: "Cukai minuman manis resmi berlaku sehingga harga minuman kemasan naik. Produsen minuman dan makanan ringan menghadapi penjualan yang menurun.",
    },
  },
  {
    w: { PA: 1, KO: 1 },
    pos: {
      t: ["Kedai kopi dan minuman kekinian menjamur", "Konsumen muda gemar nongkrong di kedai baru"],
      b: "Kedai kopi dan minuman kekinian menjamur dan konsumen muda gemar nongkrong. Pemasok bahan baku dan produsen barang konsumsi menikmati pesanan yang naik.",
    },
    neg: {
      t: ["Banyak kedai kopi dan minuman kekinian gulung tikar", "Konsumen muda kurangi jajan di kedai"],
      b: "Banyak kedai kopi dan minuman kekinian gulung tikar karena konsumen muda mengurangi jajan. Pemasok bahan baku dan produsen barang konsumsi menghadapi pesanan yang turun.",
    },
  },
  {
    w: { KO: 2, PA: 1 },
    pos: {
      t: ["Tren olahraga lari dan sepeda meluas", "Penjualan perlengkapan olahraga melonjak"],
      b: "Tren olahraga lari dan sepeda meluas dan penjualan perlengkapan olahraga melonjak. Produsen barang konsumsi dan makanan sehat menikmati permintaan yang naik.",
    },
    neg: {
      t: ["Penjualan perlengkapan olahraga merosot", "Tren olahraga lari dan sepeda meredup"],
      b: "Tren olahraga lari dan sepeda meredup dan penjualan perlengkapan olahraga merosot. Produsen barang konsumsi dan makanan sehat menghadapi permintaan yang turun.",
    },
  },
  {
    w: { PA: 2, TE: 1 },
    pos: {
      t: ["Pangan nabati dan alternatif daging makin diminati", "Produsen makanan luncurkan lini nabati"],
      b: "Pangan nabati dan alternatif daging makin diminati dan produsen makanan meluncurkan lini nabati. Penyedia teknologi pangan mendapat peluang kerja sama.",
    },
    neg: {
      t: ["Konsumen kembali ke daging dan makanan biasa", "Penjualan pangan nabati melambat"],
      b: "Konsumen kembali ke daging dan makanan biasa dan penjualan pangan nabati melambat. Produsen makanan dan penyedia teknologi pangan menurunkan target.",
    },
  },
  {
    w: { PA: 1, TR: 1, TE: 1, KO: 1 },
    pos: {
      t: ["Pesan-antar makanan daring tumbuh pesat", "Pesanan makanan lewat aplikasi tembus rekor"],
      b: "Pesan-antar makanan lewat aplikasi tumbuh pesat dan pesanan tembus rekor. Produsen makanan, pengemudi pengantar, penyedia aplikasi, dan produsen kemasan menikmati lonjakan permintaan.",
    },
    neg: {
      t: ["Pesan-antar makanan daring melambat", "Pesanan makanan lewat aplikasi turun"],
      b: "Pesan-antar makanan lewat aplikasi melambat dan pesanan turun. Produsen makanan, pengemudi pengantar, penyedia aplikasi, dan produsen kemasan melihat permintaan yang menurun.",
    },
  },
  {
    w: { TR: 2, EN: 1 },
    pos: {
      t: [
        "Maskapai pesan pesawat baru dalam jumlah besar",
        "Armada pesawat bertambah untuk melayani rute baru",
      ],
      b: "Maskapai memesan pesawat baru dalam jumlah besar untuk melayani rute baru. Operator transportasi optimistis, dan permintaan bahan bakar penerbangan naik.",
    },
    neg: {
      t: ["Maskapai tunda pembelian pesawat baru", "Pesanan pesawat dikurangi karena penumpang sepi"],
      b: "Maskapai menunda pembelian pesawat baru dan mengurangi pesanan karena penumpang sepi. Operator transportasi berhati-hati, dan permintaan bahan bakar penerbangan menurun.",
    },
  },
  {
    w: { TR: 2, PA: 1, EN: 1 },
    pos: {
      t: ["Angkutan barang kereta api diperluas", "Kereta barang kurangi beban jalan raya"],
      b: "Angkutan barang kereta api diperluas dan mengurangi beban jalan raya. Operator transportasi, produsen pangan, dan pemasok energi menikmati pengiriman yang lebih murah.",
    },
    neg: {
      t: ["Angkutan barang kereta api terganggu", "Jalur kereta barang terputus longsor"],
      b: "Angkutan barang kereta api terganggu karena jalur terputus longsor. Operator transportasi, produsen pangan, dan pemasok energi menghadapi pengiriman yang lebih mahal.",
    },
  },
];
