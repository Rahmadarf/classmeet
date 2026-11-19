/**
 * Bahan penyusun kumpulan berita (dibaca `news-pool-lib.ts`). TEKS FIKSI untuk permainan; nama perusahaan di berita
 * event memakai nama aset yang dipilih panitia, dan semua peristiwanya rekaan.
 *
 * Sektor: EN Energi, TR Transportasi, TE Teknologi, KE Keuangan, PA Pangan, KO Konsumen dan kesehatan.
 * Bobot sektor pada versi "pos"; versi "neg" membaliknya. Tiap tema menghasilkan 2 arah x 2 varian = 4 berita harga
 * (varian a dan b memakai judul berbeda, himpunan aset berbeda, dan kalimat tambahan berbeda).
 */
export type SectorKey = "EN" | "TR" | "TE" | "KE" | "PA" | "KO";

export const SECTOR_NAMES: Record<SectorKey, string> = {
  EN: "Energi",
  TR: "Transportasi",
  TE: "Teknologi",
  KE: "Keuangan",
  PA: "Pangan",
  KO: "Konsumen dan kesehatan",
};

export type Theme = {
  w: Partial<Record<SectorKey, number>>;
  pos: { t: [string, string]; b: string };
  neg: { t: [string, string]; b: string };
};

export const THEMES: Theme[] = [
  {
    w: { EN: 2, TR: -2, PA: -1 },
    pos: {
      t: ["Harga minyak dunia melonjak", "Minyak mentah menembus level tertinggi tahun ini"],
      b: "Harga minyak mentah naik tajam setelah pasokan negara pengekspor dipangkas. Produsen energi menikmati margin lebar, sementara biaya bahan bakar maskapai dan pengangkut ikut naik.",
    },
    neg: {
      t: ["Harga minyak dunia merosot", "Minyak mentah jatuh ke level terendah beberapa bulan"],
      b: "Harga minyak mentah turun tajam setelah stok dunia menumpuk. Produsen energi tertekan, sementara biaya bahan bakar pengangkut dan distributor pangan mereda.",
    },
  },
  {
    w: { TE: 2, KO: 1, TR: 1, KE: 1 },
    pos: {
      t: [
        "Bank sentral turunkan suku bunga acuan",
        "Suku bunga acuan dipangkas, kredit diperkirakan bergairah",
      ],
      b: "Bank sentral memangkas suku bunga acuan untuk mendorong pertumbuhan. Biaya pinjaman turun sehingga perusahaan teknologi dan sektor konsumsi lebih leluasa berekspansi.",
    },
    neg: {
      t: ["Bank sentral naikkan suku bunga acuan", "Suku bunga acuan naik, biaya pinjaman membengkak"],
      b: "Bank sentral menaikkan suku bunga acuan demi menahan inflasi. Perusahaan yang bergantung pada pinjaman, terutama teknologi dan konsumsi, menghadapi biaya yang lebih berat.",
    },
  },
  {
    w: { TR: 2, KO: 1, PA: 1, EN: 1 },
    pos: {
      t: ["Libur panjang dorong lonjakan perjalanan", "Tiket libur panjang ludes terjual"],
      b: "Libur panjang membuat tiket pesawat, kereta, dan bus terjual habis. Pengangkut, hotel, dan pedagang makanan di jalur wisata panen pelanggan.",
    },
    neg: {
      t: ["Pembatasan perjalanan diperketat", "Rencana libur batal, penumpang berkurang drastis"],
      b: "Aturan pembatasan perjalanan kembali diperketat dan banyak rencana libur dibatalkan. Pengangkut dan pedagang di jalur wisata melaporkan penurunan pelanggan.",
    },
  },
  {
    w: { PA: 2, KO: 1 },
    pos: {
      t: ["Panen raya turunkan harga bahan baku pangan", "Hasil panen melimpah, pasokan bahan pangan aman"],
      b: "Panen raya di berbagai daerah membuat pasokan bahan baku pangan melimpah dan harganya turun. Produsen makanan dan minuman menikmati biaya produksi yang lebih rendah.",
    },
    neg: {
      t: ["Gagal panen guncang pasokan pangan", "Kemarau panjang tekan hasil panen"],
      b: "Hasil panen di sejumlah sentra turun tajam akibat cuaca. Harga bahan baku naik dan produsen makanan serta minuman harus menanggung biaya produksi yang lebih mahal.",
    },
  },
  {
    w: { TE: 2, TR: 1, KO: 1 },
    pos: {
      t: ["Pasokan chip kembali lancar", "Pabrik semikonduktor tambah kapasitas produksi"],
      b: "Pasokan chip semikonduktor kembali lancar setelah pabrik menambah kapasitas. Produsen perangkat dan kendaraan bisa mempercepat produksi yang tertunda.",
    },
    neg: {
      t: ["Kelangkaan chip global kembali terjadi", "Pabrik chip kurangi produksi, pengiriman tertunda"],
      b: "Kelangkaan chip semikonduktor kembali menghambat produksi perangkat dan kendaraan. Perusahaan teknologi mengumumkan pengiriman yang mundur beberapa pekan.",
    },
  },
  {
    w: { TE: 1, TR: 1, KE: 1, KO: 1, PA: 1 },
    pos: {
      t: ["Belanja daring tembus rekor", "Transaksi toko daring melampaui target"],
      b: "Nilai belanja daring mencetak rekor baru. Penyedia platform, jasa pengiriman, pembayaran digital, dan produsen barang konsumsi sama-sama diuntungkan.",
    },
    neg: {
      t: ["Belanja daring melambat", "Transaksi toko daring turun dari bulan lalu"],
      b: "Pertumbuhan belanja daring melambat karena konsumen menahan pengeluaran. Platform, pengiriman, dan produsen barang konsumsi melaporkan permintaan yang lebih sepi.",
    },
  },
  {
    w: { KE: 1, TR: 1, TE: 1, EN: -1 },
    pos: {
      t: ["Rupiah menguat terhadap dolar", "Nilai tukar rupiah menguat tiga hari berturut-turut"],
      b: "Rupiah menguat sehingga biaya impor komponen dan bahan bakar turun. Perbankan, pengangkut, dan perusahaan teknologi yang banyak mengimpor merasakan manfaatnya.",
    },
    neg: {
      t: ["Rupiah melemah terhadap dolar", "Nilai tukar rupiah tertekan arus modal keluar"],
      b: "Rupiah melemah sehingga biaya impor komponen dan bahan bakar naik. Perbankan, pengangkut, dan perusahaan teknologi yang banyak mengimpor menghadapi tekanan biaya.",
    },
  },
  {
    w: { EN: 2, TE: 1, TR: 1 },
    pos: {
      t: ["Pemerintah perluas insentif energi bersih", "Insentif pembangkit energi terbarukan diumumkan"],
      b: "Pemerintah memperluas insentif pajak untuk energi bersih. Perusahaan energi, teknologi pendukung, dan pengangkut berbahan bakar alternatif menyambutnya.",
    },
    neg: {
      t: ["Insentif energi bersih dipangkas", "Anggaran proyek energi terbarukan dikurangi"],
      b: "Pemerintah memangkas insentif energi bersih untuk menutup defisit. Perusahaan energi dan teknologi pendukung menunda sejumlah proyek.",
    },
  },
  {
    w: { KO: 2, PA: 1, TR: -1 },
    pos: {
      t: ["Wabah musiman dorong permintaan obat dan suplemen", "Apotek kewalahan melayani lonjakan pembeli"],
      b: "Wabah penyakit musiman membuat permintaan obat, vitamin, dan suplemen melonjak. Produsen kesehatan menambah produksi sementara aktivitas perjalanan sedikit berkurang.",
    },
    neg: {
      t: ["Musim sehat, penjualan obat dan suplemen turun", "Permintaan obat bebas melemah"],
      b: "Penjualan obat dan suplemen turun karena sedikitnya kasus penyakit musiman. Produsen kesehatan melaporkan stok menumpuk di gudang distributor.",
    },
  },
  {
    w: { TE: 2, KE: 1 },
    pos: {
      t: ["Investasi keamanan siber melonjak", "Perusahaan berlomba perkuat pertahanan siber"],
      b: "Perusahaan besar menaikkan anggaran keamanan siber setelah ancaman peretasan meningkat. Penyedia teknologi dan lembaga keuangan ikut memperkuat sistem mereka.",
    },
    neg: {
      t: ["Serangan siber lumpuhkan layanan daring", "Peretasan besar bocorkan data pelanggan"],
      b: "Serangan siber besar melumpuhkan sejumlah layanan daring dan membocorkan data pelanggan. Kepercayaan terhadap penyedia teknologi dan lembaga keuangan merosot.",
    },
  },
  {
    w: { KE: 2 },
    pos: {
      t: ["Aturan modal bank dilonggarkan", "Regulator beri ruang bank salurkan lebih banyak kredit"],
      b: "Regulator melonggarkan aturan modal minimum sehingga bank punya ruang lebih besar menyalurkan kredit. Laba perbankan diperkirakan membaik.",
    },
    neg: {
      t: ["Aturan modal bank diperketat", "Regulator minta bank tambah cadangan modal"],
      b: "Regulator memperketat aturan modal sehingga bank harus menambah cadangan. Ruang penyaluran kredit menyempit dan laba perbankan diperkirakan tertahan.",
    },
  },
  {
    w: { PA: 2, KO: 1 },
    pos: {
      t: ["Harga gandum dunia turun", "Pasokan gandum melimpah, harga di pasar global melemah"],
      b: "Harga gandum dunia turun karena pasokan melimpah. Produsen mi, roti, dan makanan olahan mendapat bahan baku yang lebih murah.",
    },
    neg: {
      t: ["Harga gandum dunia naik", "Pasokan gandum terbatas, harga di pasar global melonjak"],
      b: "Harga gandum dunia naik karena pasokan terbatas. Produsen mi, roti, dan makanan olahan menghadapi biaya bahan baku yang lebih tinggi.",
    },
  },
  {
    w: { TR: 2, PA: 1, KO: 1 },
    pos: {
      t: ["Antrean kapal di pelabuhan terurai", "Bongkar muat pelabuhan kembali lancar"],
      b: "Antrean kapal di pelabuhan utama terurai setelah sistem bongkar muat diperbaiki. Pengangkut, pedagang pangan, dan produsen barang konsumsi menerima kiriman tepat waktu.",
    },
    neg: {
      t: ["Pelabuhan tersendat, kiriman barang menumpuk", "Mogok pekerja pelabuhan hambat bongkar muat"],
      b: "Bongkar muat di pelabuhan utama tersendat sehingga kiriman menumpuk. Pengangkut, pedagang pangan, dan produsen barang konsumsi mengalami keterlambatan.",
    },
  },
  {
    w: { TR: 1, PA: 1, EN: -1 },
    pos: {
      t: ["Cuaca cerah dukung pasokan dan perjalanan", "Prakiraan cuaca baik sepanjang pekan"],
      b: "Cuaca cerah mendukung distribusi pangan dan perjalanan. Permintaan bahan bakar untuk pemanas dan listrik cadangan sedikit menurun.",
    },
    neg: {
      t: ["Badai besar ganggu pasokan dan penerbangan", "Cuaca buruk batalkan banyak perjalanan"],
      b: "Badai besar mengganggu distribusi pangan dan membatalkan banyak penerbangan. Permintaan energi untuk pembangkit cadangan justru meningkat.",
    },
  },
  {
    w: { TE: 2, KE: 1, EN: 1 },
    pos: {
      t: [
        "Layanan komputasi awan dan kecerdasan buatan melonjak pesat",
        "Perusahaan besar ramai berlangganan layanan AI",
      ],
      b: "Perusahaan besar beramai-ramai berlangganan layanan komputasi awan dan perangkat lunak berbasis kecerdasan buatan. Pusat data menambah kapasitas dan kebutuhan listriknya naik.",
    },
    neg: {
      t: ["Gelembung kecerdasan buatan mulai meredup", "Investor pertanyakan keuntungan proyek AI"],
      b: "Sejumlah investor mulai mempertanyakan keuntungan proyek kecerdasan buatan. Anggaran pusat data dipangkas dan kebutuhan listrik ikut turun.",
    },
  },
  {
    w: { TR: 1, TE: 2, EN: -1 },
    pos: {
      t: ["Penjualan kendaraan listrik melonjak", "Pabrikan kendaraan listrik catat pesanan rekor"],
      b: "Penjualan kendaraan listrik naik pesat. Produsen perangkat lunak dan baterai diuntungkan, sementara permintaan bahan bakar minyak sedikit menurun.",
    },
    neg: {
      t: ["Penjualan kendaraan listrik melemah", "Pembeli kendaraan listrik menunda pesanan"],
      b: "Penjualan kendaraan listrik melemah karena harga yang masih tinggi. Produsen perangkat lunak dan baterai menurunkan target, dan permintaan bahan bakar minyak bertahan.",
    },
  },
  {
    w: { KO: 2, PA: 1 },
    pos: {
      t: ["Tren gaya hidup sehat naik daun", "Konsumen beralih ke produk sehat dan alami"],
      b: "Konsumen beralih ke produk sehat dan alami. Produsen suplemen, perawatan, dan makanan bergizi melaporkan penjualan yang menguat.",
    },
    neg: {
      t: ["Konsumen kembali ke produk murah", "Penjualan produk premium tersendat"],
      b: "Konsumen kembali memilih produk murah dan menahan pembelian produk premium. Produsen suplemen, perawatan, dan makanan bergizi melaporkan penjualan yang melemah.",
    },
  },
  {
    w: { KO: 2, PA: 1, TR: 1, KE: 1 },
    pos: {
      t: ["Daya beli masyarakat menguat", "Survei: keyakinan konsumen naik ke level tertinggi"],
      b: "Survei menunjukkan daya beli masyarakat menguat. Pengeluaran untuk makanan, perjalanan, dan barang konsumsi meningkat, begitu pula penyaluran kredit.",
    },
    neg: {
      t: ["Daya beli masyarakat melemah", "Survei: keyakinan konsumen turun tajam"],
      b: "Survei menunjukkan daya beli masyarakat melemah. Pengeluaran untuk makanan, perjalanan, dan barang konsumsi menurun, begitu pula permintaan kredit.",
    },
  },
  {
    w: { KO: 1, PA: 1, KE: 1 },
    pos: {
      t: [
        "Upah minimum naik, konsumsi diperkirakan terdongkrak",
        "Kenaikan upah minimum disambut pelaku usaha ritel",
      ],
      b: "Kenaikan upah minimum diperkirakan mendorong konsumsi rumah tangga. Pedagang makanan, produk konsumen, dan bank ritel menyambut kabar ini.",
    },
    neg: {
      t: ["Gelombang PHK landa beberapa industri", "Perusahaan umumkan pengurangan karyawan"],
      b: "Sejumlah industri mengumumkan pengurangan karyawan. Pedagang makanan, produk konsumen, dan bank ritel khawatir permintaan akan menurun.",
    },
  },
  {
    w: { TE: 2, TR: 1, KO: 1, EN: 1 },
    pos: {
      t: ["Perundingan dagang capai kesepakatan", "Tarif impor diturunkan setelah perundingan"],
      b: "Perundingan dagang antarnegara mencapai kesepakatan dan tarif impor diturunkan. Perdagangan komponen, kendaraan, dan barang konsumsi diperkirakan meningkat.",
    },
    neg: {
      t: ["Perang tarif antarnegara memanas", "Tarif impor baru diberlakukan mendadak"],
      b: "Tarif impor baru diberlakukan setelah perundingan dagang buntu. Rantai pasok komponen, kendaraan, dan barang konsumsi terganggu.",
    },
  },
  {
    w: { EN: 2, KO: -1, TE: -1 },
    pos: {
      t: ["Harga gas alam naik tajam", "Pasokan gas alam ketat jelang musim dingin"],
      b: "Harga gas alam naik tajam karena pasokan yang ketat. Produsen energi diuntungkan, sedangkan pabrik konsumen dan pusat data menghadapi biaya listrik lebih tinggi.",
    },
    neg: {
      t: ["Harga gas alam turun tajam", "Stok gas alam penuh, harga melemah"],
      b: "Harga gas alam turun karena stok yang penuh. Produsen energi tertekan, sementara pabrik konsumen dan pusat data menikmati biaya listrik lebih rendah.",
    },
  },
  {
    w: { KE: 1, TE: 1, KO: 1 },
    pos: {
      t: ["Dompet digital dipakai makin luas", "Pembayaran nontunai tumbuh dua kali lipat"],
      b: "Dompet digital dan pembayaran nontunai dipakai makin luas. Lembaga keuangan, penyedia teknologi, dan pedagang ritel mencatat transaksi yang meningkat.",
    },
    neg: {
      t: ["Gangguan sistem pembayaran nasional", "Dompet digital sempat tak bisa dipakai"],
      b: "Sistem pembayaran nasional sempat terganggu dan dompet digital tak bisa dipakai beberapa jam. Lembaga keuangan, penyedia teknologi, dan pedagang ritel mencatat kerugian transaksi.",
    },
  },
  {
    w: { EN: 1, TR: 1, TE: 1, KE: 1, PA: 1, KO: 1 },
    pos: {
      t: ["Pertumbuhan ekonomi melampaui perkiraan", "Data resmi: ekonomi tumbuh lebih cepat dari dugaan"],
      b: "Data resmi menunjukkan pertumbuhan ekonomi melampaui perkiraan para analis. Hampir semua sektor menyambutnya dengan optimisme.",
    },
    neg: {
      t: ["Pertumbuhan ekonomi di bawah perkiraan", "Data resmi: ekonomi tumbuh lebih lambat dari dugaan"],
      b: "Data resmi menunjukkan pertumbuhan ekonomi di bawah perkiraan para analis. Hampir semua sektor menyambutnya dengan kekhawatiran.",
    },
  },
  {
    w: { PA: 1, KO: 1, KE: 1, TR: 1 },
    pos: {
      t: ["Inflasi terkendali di bawah target", "Harga barang kebutuhan stabil sepanjang bulan"],
      b: "Inflasi bulan ini terkendali di bawah target pemerintah. Harga barang kebutuhan stabil sehingga pelaku usaha lebih mudah merencanakan produksi.",
    },
    neg: {
      t: ["Inflasi melonjak melampaui target", "Harga barang kebutuhan naik serentak"],
      b: "Inflasi bulan ini melonjak melampaui target pemerintah. Harga barang kebutuhan naik serentak dan pelaku usaha sulit merencanakan produksi.",
    },
  },
  {
    w: { KO: 2, TR: 1, KE: 1 },
    pos: {
      t: ["Festival belanja nasional dibuka", "Diskon besar-besaran tarik jutaan pembeli"],
      b: "Festival belanja nasional dibuka dengan diskon besar di pusat perbelanjaan dan toko daring. Produsen barang konsumsi, pengangkut, dan penyedia pembayaran ikut ramai.",
    },
    neg: {
      t: ["Festival belanja nasional sepi pengunjung", "Diskon besar tak mampu tarik pembeli"],
      b: "Festival belanja nasional sepi pengunjung meski diskon besar ditawarkan. Produsen barang konsumsi, pengangkut, dan penyedia pembayaran mencatat penjualan di bawah target.",
    },
  },
  {
    w: { TE: 2, KO: 1 },
    pos: {
      t: ["Jaringan 5G meluas ke kota kecil", "Operator percepat pembangunan menara 5G"],
      b: "Operator seluler mempercepat pembangunan jaringan 5G hingga ke kota kecil. Produsen perangkat dan layanan digital mendapat pasar baru.",
    },
    neg: {
      t: ["Peluncuran jaringan 5G tertunda", "Izin frekuensi 5G belum juga keluar"],
      b: "Peluncuran jaringan 5G tertunda karena izin frekuensi belum keluar. Produsen perangkat dan layanan digital menunda rencana penjualan.",
    },
  },
  {
    w: { PA: 2, KO: 1 },
    pos: {
      t: ["Impor bahan baku pangan dipermudah", "Pemerintah longgarkan kuota impor bahan pangan"],
      b: "Pemerintah melonggarkan kuota impor bahan baku pangan. Produsen makanan dan minuman mendapat pasokan lebih murah dan lebih stabil.",
    },
    neg: {
      t: ["Impor bahan baku pangan dibatasi", "Pemerintah kurangi kuota impor bahan pangan"],
      b: "Pemerintah mengurangi kuota impor bahan baku pangan. Produsen makanan dan minuman menghadapi pasokan yang lebih mahal dan tidak menentu.",
    },
  },
  {
    w: { KE: 2, KO: 1, TR: 1 },
    pos: {
      t: ["Kredit konsumsi tumbuh dua digit", "Permintaan kredit kendaraan dan rumah meningkat"],
      b: "Penyaluran kredit konsumsi tumbuh dua digit karena permintaan kendaraan dan rumah meningkat. Perbankan mencatat laba bunga yang membaik.",
    },
    neg: {
      t: ["Kredit macet naik di perbankan", "Rasio kredit bermasalah melonjak"],
      b: "Rasio kredit bermasalah naik di sejumlah bank karena debitur kesulitan membayar cicilan. Perbankan menambah cadangan dan menahan penyaluran kredit.",
    },
  },
  {
    w: { TR: 1, TE: 1 },
    pos: {
      t: ["Harga logam industri turun", "Pasokan tembaga dan aluminium melimpah"],
      b: "Harga logam industri turun karena pasokan melimpah. Pabrikan kendaraan dan perangkat elektronik menikmati biaya produksi yang lebih rendah.",
    },
    neg: {
      t: ["Harga logam industri naik", "Pasokan tembaga dan aluminium menipis"],
      b: "Harga logam industri naik karena pasokan menipis. Pabrikan kendaraan dan perangkat elektronik menghadapi biaya produksi yang lebih tinggi.",
    },
  },
  {
    w: { TE: 1, KE: 1 },
    pos: {
      t: ["Aturan data pribadi rampung dan jelas", "Regulasi data pribadi beri kepastian bagi perusahaan"],
      b: "Aturan perlindungan data pribadi akhirnya rampung dan dinilai jelas oleh pelaku usaha. Perusahaan teknologi dan keuangan bisa merencanakan kepatuhan dengan tenang.",
    },
    neg: {
      t: ["Aturan data pribadi baru bebani perusahaan", "Denda data pribadi diumumkan, pelaku usaha waswas"],
      b: "Aturan perlindungan data pribadi yang baru membebani perusahaan dengan biaya kepatuhan dan denda besar. Perusahaan teknologi dan keuangan menyiapkan penyesuaian.",
    },
  },
  {
    w: { TR: 2, PA: 1, KO: 1, EN: -1 },
    pos: {
      t: ["Subsidi bahan bakar ditambah", "Harga bahan bakar bersubsidi ditahan"],
      b: "Pemerintah menambah subsidi dan menahan harga bahan bakar. Pengangkut dan distributor pangan menikmati biaya operasional yang stabil.",
    },
    neg: {
      t: ["Subsidi bahan bakar dikurangi", "Harga bahan bakar bersubsidi naik"],
      b: "Pemerintah mengurangi subsidi sehingga harga bahan bakar naik. Pengangkut dan distributor pangan menghadapi biaya operasional yang lebih tinggi.",
    },
  },
  {
    w: { KE: 2, TE: 1, EN: 1, KO: 1 },
    pos: {
      t: ["Dana asing mengalir deras ke pasar saham", "Investor asing catat pembelian bersih tertinggi"],
      b: "Investor asing mencatat pembelian bersih saham terbesar dalam beberapa bulan. Perbankan, teknologi, energi, dan konsumsi menjadi incaran.",
    },
    neg: {
      t: ["Dana asing keluar dari pasar saham", "Investor asing catat penjualan bersih terbesar"],
      b: "Investor asing mencatat penjualan bersih saham terbesar dalam beberapa bulan. Perbankan, teknologi, energi, dan konsumsi ikut tertekan.",
    },
  },
  {
    w: { TR: 2, KO: 1 },
    pos: {
      t: ["Rute penerbangan baru dibuka", "Maskapai tambah frekuensi ke kota tujuan wisata"],
      b: "Maskapai membuka rute dan menambah frekuensi penerbangan ke kota tujuan wisata. Pengangkut dan pelaku usaha pariwisata optimistis dengan lonjakan penumpang.",
    },
    neg: {
      t: ["Banyak penerbangan dibatalkan", "Maskapai kurangi rute karena penumpang sepi"],
      b: "Maskapai membatalkan banyak penerbangan dan mengurangi rute karena penumpang sepi. Pengangkut dan pelaku usaha pariwisata menurunkan target pendapatan.",
    },
  },
  {
    w: { KO: 2 },
    pos: {
      t: ["Penjualan produk perawatan pribadi tinggi", "Produk kecantikan dan perawatan diri laris manis"],
      b: "Penjualan produk perawatan pribadi dan kecantikan naik tinggi. Produsen konsumen melaporkan stok cepat habis di toko dan platform daring.",
    },
    neg: {
      t: ["Penjualan produk perawatan pribadi lesu", "Produk kecantikan dan perawatan diri sepi peminat"],
      b: "Penjualan produk perawatan pribadi dan kecantikan lesu. Produsen konsumen melaporkan stok menumpuk di toko dan platform daring.",
    },
  },
  {
    w: { PA: 2, KO: 1 },
    pos: {
      t: ["Makanan kemasan naik daun", "Konsumen muda gemar camilan dan makanan siap saji"],
      b: "Makanan kemasan dan siap saji makin digemari konsumen muda. Produsen makanan mencatat penjualan yang naik dan menambah lini produk.",
    },
    neg: {
      t: ["Isu keamanan makanan kemasan merebak", "Konsumen ragu membeli makanan siap saji"],
      b: "Isu keamanan makanan kemasan merebak di media sosial. Konsumen menunda pembelian dan produsen makanan menarik sebagian produk dari rak toko.",
    },
  },
  {
    w: { EN: 1, TE: 1, PA: 1, KO: 1 },
    pos: {
      t: ["Pasokan listrik nasional stabil", "Pembangkit baru perkuat jaringan listrik"],
      b: "Pasokan listrik nasional stabil setelah pembangkit baru beroperasi. Pabrik, pusat data, dan pedagang tak lagi khawatir pemadaman.",
    },
    neg: {
      t: ["Pemadaman listrik bergilir terjadi", "Gangguan pembangkit picu pemadaman di banyak kota"],
      b: "Pemadaman listrik bergilir terjadi di banyak kota karena gangguan pembangkit. Pabrik, pusat data, dan pedagang kehilangan jam produksi.",
    },
  },
  {
    w: { TR: 2, TE: 1, KO: 1 },
    pos: {
      t: ["Volume pengiriman paket naik pesat", "Jasa kurir tambah armada karena pesanan membludak"],
      b: "Volume pengiriman paket naik pesat. Jasa kurir menambah armada, dan platform serta produsen barang konsumsi menikmati penjualan yang melaju.",
    },
    neg: {
      t: ["Pengiriman paket tersendat", "Jasa kurir kewalahan, paket menumpuk di gudang"],
      b: "Pengiriman paket tersendat dan paket menumpuk di gudang. Platform dan produsen barang konsumsi menerima keluhan pelanggan.",
    },
  },
  {
    w: { PA: 1, KO: 2 },
    pos: {
      t: ["Harga bahan kemasan turun", "Pasokan plastik dan kardus melimpah"],
      b: "Harga bahan kemasan turun karena pasokan melimpah. Produsen makanan dan barang konsumsi mendapat biaya produksi yang lebih ringan.",
    },
    neg: {
      t: ["Harga bahan kemasan naik", "Pasokan plastik dan kardus menipis"],
      b: "Harga bahan kemasan naik karena pasokan menipis. Produsen makanan dan barang konsumsi menghadapi biaya produksi yang lebih berat.",
    },
  },
  {
    w: { TR: 2, EN: 1, KE: 1 },
    pos: {
      t: [
        "Proyek infrastruktur baru diumumkan",
        "Pemerintah luncurkan paket pembangunan jalan dan pelabuhan",
      ],
      b: "Pemerintah meluncurkan paket proyek jalan, pelabuhan, dan pembangkit. Pengangkut, penyedia energi, dan pemberi pembiayaan menyambut peluang baru.",
    },
    neg: {
      t: ["Proyek infrastruktur ditunda", "Anggaran pembangunan jalan dan pelabuhan dipangkas"],
      b: "Pemerintah menunda sejumlah proyek jalan, pelabuhan, dan pembangkit karena anggaran dipangkas. Pengangkut, penyedia energi, dan pemberi pembiayaan menyesuaikan rencana.",
    },
  },
  {
    w: { TE: 2, KO: 1 },
    pos: {
      t: ["Aplikasi belajar daring dipakai jutaan siswa", "Platform pendidikan digital catat pengguna baru"],
      b: "Aplikasi belajar daring dipakai jutaan siswa dan guru. Penyedia teknologi dan produsen perangkat menikmati permintaan yang meningkat.",
    },
    neg: {
      t: ["Pengguna aplikasi belajar daring menurun", "Sekolah kembali ke pembelajaran tatap muka"],
      b: "Pengguna aplikasi belajar daring menurun karena sekolah kembali ke pembelajaran tatap muka. Penyedia teknologi dan produsen perangkat menurunkan target.",
    },
  },
  {
    w: { PA: 2, TR: 1, KE: 1 },
    pos: {
      t: ["Ekspor pangan olahan tumbuh", "Pesanan luar negeri untuk makanan olahan meningkat"],
      b: "Ekspor pangan olahan tumbuh karena pesanan luar negeri meningkat. Produsen makanan, pengangkut, dan pembiayaan perdagangan ikut diuntungkan.",
    },
    neg: {
      t: ["Ekspor pangan olahan turun", "Pembeli luar negeri kurangi pesanan makanan olahan"],
      b: "Ekspor pangan olahan turun karena pembeli luar negeri mengurangi pesanan. Produsen makanan, pengangkut, dan pembiayaan perdagangan ikut tertekan.",
    },
  },
  {
    w: { KO: 2, TE: 1 },
    pos: {
      t: [
        "Layanan kesehatan digital berkembang pesat",
        "Konsultasi dokter daring dipakai lebih banyak orang",
      ],
      b: "Layanan kesehatan digital berkembang pesat dan konsultasi dokter daring dipakai lebih banyak orang. Produsen obat dan penyedia teknologi menikmati permintaan baru.",
    },
    neg: {
      t: [
        "Aplikasi layanan kesehatan dikritik soal privasi",
        "Regulator periksa data pasien di aplikasi kesehatan",
      ],
      b: "Aplikasi layanan kesehatan dikritik karena soal privasi data pasien. Regulator memeriksa dan sebagian pengguna berhenti memakai layanan tersebut.",
    },
  },
  {
    w: { KE: 2, PA: 1, KO: 1 },
    pos: {
      t: ["Kredit usaha mikro disalurkan lebih luas", "Bank perluas pembiayaan untuk pedagang kecil"],
      b: "Bank memperluas pembiayaan untuk pelaku usaha mikro dan pedagang kecil. Pemasok makanan dan barang konsumsi menikmati pesanan yang naik.",
    },
    neg: {
      t: ["Kredit usaha mikro seret", "Bank perketat pembiayaan untuk pedagang kecil"],
      b: "Bank memperketat pembiayaan untuk pelaku usaha mikro dan pedagang kecil. Pemasok makanan dan barang konsumsi melaporkan pesanan yang turun.",
    },
  },
  {
    w: { TR: 2, TE: 1 },
    pos: {
      t: [
        "Layanan transportasi daring tambah pengguna",
        "Aplikasi ojek dan taksi daring catat pesanan rekor",
      ],
      b: "Layanan transportasi daring menambah pengguna dan mencatat pesanan rekor. Penyedia aplikasi dan operator armada menikmati pendapatan yang naik.",
    },
    neg: {
      t: ["Tarif transportasi daring dibatasi", "Aturan baru tekan pendapatan pengemudi dan aplikasi"],
      b: "Pemerintah membatasi tarif transportasi daring. Penyedia aplikasi dan operator armada menghadapi pendapatan yang tertekan.",
    },
  },
  {
    w: { EN: 1, TE: 1 },
    pos: {
      t: ["Pembangkit surya baru mulai beroperasi", "Ladang panel surya terbesar resmi dinyalakan"],
      b: "Pembangkit tenaga surya baru mulai beroperasi. Perusahaan energi dan penyedia teknologi pendukung mencatat kontrak yang bertambah.",
    },
    neg: {
      t: ["Proyek pembangkit surya molor", "Pembangunan ladang panel surya terkendala izin"],
      b: "Proyek pembangkit tenaga surya molor karena kendala izin. Perusahaan energi dan penyedia teknologi pendukung menunda penerimaan kontrak.",
    },
  },
  {
    w: { KO: 2, PA: 1, TR: 1, KE: 1 },
    pos: {
      t: ["Belanja akhir tahun lebih ramai dari perkiraan", "Pusat perbelanjaan penuh jelang akhir tahun"],
      b: "Belanja akhir tahun lebih ramai dari perkiraan. Produsen barang konsumsi, pedagang makanan, pengangkut, dan penyedia pembayaran menikmati lonjakan transaksi.",
    },
    neg: {
      t: ["Belanja akhir tahun sepi", "Pusat perbelanjaan lengang jelang akhir tahun"],
      b: "Belanja akhir tahun sepi dari perkiraan. Produsen barang konsumsi, pedagang makanan, pengangkut, dan penyedia pembayaran mencatat transaksi yang lesu.",
    },
  },
  {
    w: { KE: 2, TE: 1 },
    pos: {
      t: ["Aturan pasar modal dipermudah", "Regulator sederhanakan proses penawaran saham"],
      b: "Regulator menyederhanakan aturan penawaran saham dan perdagangan. Lembaga keuangan dan perusahaan teknologi melihat peluang pendanaan yang lebih mudah.",
    },
    neg: {
      t: ["Pasar modal diawasi lebih ketat", "Regulator tambah syarat laporan perusahaan terbuka"],
      b: "Regulator menambah syarat laporan dan pengawasan bagi perusahaan terbuka. Lembaga keuangan dan perusahaan teknologi menyiapkan biaya kepatuhan yang lebih besar.",
    },
  },
  {
    w: { PA: 2, KO: 1 },
    pos: {
      t: ["Harga kakao dan kopi dunia turun", "Pasokan biji kakao dan kopi melimpah"],
      b: "Harga kakao dan kopi dunia turun karena panen yang melimpah. Produsen makanan, minuman, dan cokelat menikmati bahan baku yang lebih murah.",
    },
    neg: {
      t: ["Harga kakao dan kopi dunia naik", "Pasokan biji kakao dan kopi menipis"],
      b: "Harga kakao dan kopi dunia naik karena panen yang menurun. Produsen makanan, minuman, dan cokelat menghadapi bahan baku yang lebih mahal.",
    },
  },
  {
    w: { TR: 1, PA: 1, KO: 1 },
    pos: {
      t: ["Perbaikan jalur distribusi selesai lebih cepat", "Jalan lintas provinsi kembali dibuka penuh"],
      b: "Perbaikan jalur distribusi utama selesai lebih cepat dari jadwal. Pengangkut, pedagang pangan, dan produsen barang konsumsi bisa mengirim barang tanpa hambatan.",
    },
    neg: {
      t: ["Banjir besar putus jalur distribusi", "Jalan lintas provinsi terendam, truk tertahan"],
      b: "Banjir besar memutus jalur distribusi utama dan truk tertahan berhari-hari. Pengangkut, pedagang pangan, dan produsen barang konsumsi menunda pengiriman.",
    },
  },
  {
    w: { KO: 2, TR: 1 },
    pos: {
      t: ["Pajak barang mewah diturunkan", "Insentif pajak dorong penjualan barang bermerek"],
      b: "Pemerintah menurunkan pajak barang mewah untuk mendorong belanja. Produsen barang konsumsi dan penyedia perjalanan premium melihat peluang penjualan.",
    },
    neg: {
      t: ["Pajak barang mewah dinaikkan", "Tarif pajak baru bebani penjualan barang bermerek"],
      b: "Pemerintah menaikkan pajak barang mewah untuk menambah penerimaan negara. Produsen barang konsumsi dan penyedia perjalanan premium memperkirakan penjualan turun.",
    },
  },
  {
    w: { EN: 2, TR: 1 },
    pos: {
      t: ["Kilang minyak baru rampung dibangun", "Kapasitas pengolahan bahan bakar dalam negeri bertambah"],
      b: "Kilang minyak baru rampung dibangun sehingga kapasitas pengolahan bahan bakar dalam negeri bertambah. Produsen energi dan pengangkut menikmati pasokan yang lebih pasti.",
    },
    neg: {
      t: ["Kilang minyak berhenti beroperasi sementara", "Kebakaran kecil hentikan produksi kilang utama"],
      b: "Kilang minyak utama berhenti beroperasi sementara setelah insiden kebakaran kecil. Produsen energi dan pengangkut menghadapi pasokan bahan bakar yang seret.",
    },
  },
  {
    w: { TE: 2, KO: 1 },
    pos: {
      t: ["Gim buatan lokal mendunia", "Pengunduh gim lokal tembus puluhan juta"],
      b: "Gim buatan lokal mendunia dan diunduh puluhan juta kali. Penyedia platform dan produsen perangkat menikmati kenaikan pengguna.",
    },
    neg: {
      t: ["Platform gim daring diblokir regulator", "Pemblokiran layanan gim pukul pengembang dan platform"],
      b: "Regulator memblokir sejumlah platform gim daring. Pengembang dan produsen perangkat kehilangan sebagian pengguna dan pendapatan.",
    },
  },
  {
    w: { KE: 2, TE: 1 },
    pos: {
      t: ["Bank digital tumbuh pesat", "Jutaan nasabah baru buka rekening lewat ponsel"],
      b: "Bank digital tumbuh pesat dan jutaan nasabah baru membuka rekening lewat ponsel. Lembaga keuangan dan penyedia teknologi perbankan mencatat pertumbuhan.",
    },
    neg: {
      t: ["Bank digital kena sanksi regulator", "Regulator batasi pembukaan rekening baru bank digital"],
      b: "Regulator menjatuhkan sanksi kepada bank digital dan membatasi pembukaan rekening baru. Lembaga keuangan dan penyedia teknologi perbankan menunda ekspansi.",
    },
  },
  {
    w: { TR: 2, PA: 1 },
    pos: {
      t: ["Tarif tol diturunkan", "Biaya jalan tol turun di jalur utama"],
      b: "Tarif jalan tol diturunkan di jalur utama. Pengangkut barang dan distributor pangan menghemat biaya perjalanan.",
    },
    neg: {
      t: ["Tarif tol dinaikkan", "Biaya jalan tol naik di jalur utama"],
      b: "Tarif jalan tol dinaikkan di jalur utama. Pengangkut barang dan distributor pangan menanggung biaya perjalanan yang lebih tinggi.",
    },
  },
  {
    w: { KO: 2 },
    pos: {
      t: ["Obat baru disetujui regulator", "Izin edar obat inovatif akhirnya keluar"],
      b: "Regulator menyetujui izin edar obat baru yang dinanti banyak pasien. Produsen kesehatan bersiap menaikkan produksi dan penjualan.",
    },
    neg: {
      t: ["Uji klinis obat baru gagal", "Hasil uji klinis obat andalan mengecewakan"],
      b: "Uji klinis obat baru gagal memenuhi target. Produsen kesehatan menunda peluncuran dan menahan rencana produksi.",
    },
  },
  {
    w: { PA: 2, KO: 1 },
    pos: {
      t: ["Subsidi pupuk diperluas", "Petani terima pupuk bersubsidi lebih banyak"],
      b: "Pemerintah memperluas subsidi pupuk sehingga hasil panen diperkirakan naik. Produsen pangan dan barang konsumsi berharap pasokan bahan baku lebih aman.",
    },
    neg: {
      t: ["Subsidi pupuk dihapus", "Petani kesulitan membeli pupuk setelah subsidi dicabut"],
      b: "Subsidi pupuk dihapus dan petani kesulitan membeli pupuk. Produsen pangan dan barang konsumsi khawatir pasokan bahan baku menurun.",
    },
  },
  {
    w: { TR: 2, KO: 1, KE: 1 },
    pos: {
      t: ["Kunjungan wisatawan asing tembus rekor", "Wisatawan mancanegara padati kota tujuan wisata"],
      b: "Kunjungan wisatawan asing tembus rekor. Pengangkut, pedagang barang konsumsi, dan penyedia penukaran uang menikmati lonjakan transaksi.",
    },
    neg: {
      t: ["Kunjungan wisatawan asing anjlok", "Wisatawan mancanegara batalkan rencana liburan"],
      b: "Kunjungan wisatawan asing anjlok karena banyak rencana liburan dibatalkan. Pengangkut, pedagang barang konsumsi, dan penyedia penukaran uang mencatat transaksi yang menurun.",
    },
  },
  {
    w: { TE: 1, PA: 1, KO: 1, TR: 1, EN: -1 },
    pos: {
      t: ["Tarif listrik industri diturunkan", "Pabrik menikmati biaya listrik lebih murah"],
      b: "Tarif listrik industri diturunkan sehingga biaya produksi pabrik berkurang. Penyedia energi sedikit tertekan, sementara teknologi, pangan, dan barang konsumsi diuntungkan.",
    },
    neg: {
      t: ["Tarif listrik industri dinaikkan", "Pabrik menanggung biaya listrik lebih mahal"],
      b: "Tarif listrik industri dinaikkan sehingga biaya produksi pabrik bertambah. Penyedia energi diuntungkan, sementara teknologi, pangan, dan barang konsumsi tertekan.",
    },
  },
  {
    w: { TE: 2, KE: 1 },
    pos: {
      t: ["Startup lokal raih pendanaan besar", "Investor tanam modal baru di perusahaan rintisan"],
      b: "Perusahaan rintisan lokal meraih pendanaan besar dari investor. Penyedia teknologi dan lembaga pembiayaan melihat prospek pertumbuhan yang lebih cerah.",
    },
    neg: {
      t: ["Pendanaan startup mengering", "Investor tahan suntikan modal ke perusahaan rintisan"],
      b: "Investor menahan suntikan modal ke perusahaan rintisan. Penyedia teknologi dan lembaga pembiayaan menurunkan target pertumbuhan.",
    },
  },
  {
    w: { KO: 2, PA: 2, KE: 1 },
    pos: {
      t: ["Bantuan sosial tunai dicairkan serentak", "Jutaan keluarga terima bantuan tunai"],
      b: "Bantuan sosial tunai dicairkan serentak kepada jutaan keluarga. Penjualan makanan dan barang kebutuhan naik, begitu pula transaksi di perbankan.",
    },
    neg: {
      t: ["Pencairan bantuan sosial tertunda", "Bantuan tunai belum juga sampai ke keluarga penerima"],
      b: "Pencairan bantuan sosial tertunda sehingga belanja keluarga menurun. Penjualan makanan dan barang kebutuhan melambat, begitu pula transaksi di perbankan.",
    },
  },
  {
    w: { TR: 1, EN: 1 },
    pos: {
      t: ["Aturan emisi kendaraan dilonggarkan", "Standar emisi baru diundur setahun"],
      b: "Aturan emisi kendaraan dilonggarkan dan standar baru diundur. Pengangkut menghemat biaya penyesuaian, sementara permintaan bahan bakar bertahan.",
    },
    neg: {
      t: ["Aturan emisi kendaraan diperketat", "Standar emisi baru berlaku bulan depan"],
      b: "Aturan emisi kendaraan diperketat dan standar baru berlaku bulan depan. Pengangkut menanggung biaya penyesuaian dan permintaan bahan bakar tertekan.",
    },
  },
  {
    w: { PA: 1, KO: 1 },
    pos: {
      t: [
        "Insentif daur ulang kemasan diberikan",
        "Produsen kemasan ramah lingkungan dapat keringanan pajak",
      ],
      b: "Pemerintah memberi insentif bagi produsen yang mendaur ulang kemasan. Produsen makanan dan barang konsumsi menyambut biaya yang lebih ringan.",
    },
    neg: {
      t: ["Pajak kemasan plastik diberlakukan", "Produsen wajib bayar cukai kemasan sekali pakai"],
      b: "Pemerintah memberlakukan pajak kemasan plastik sekali pakai. Produsen makanan dan barang konsumsi menanggung biaya produksi yang lebih tinggi.",
    },
  },
  {
    w: { TE: 2, KO: 1 },
    pos: {
      t: ["Layanan hiburan streaming tambah pelanggan", "Pelanggan layanan streaming tembus rekor baru"],
      b: "Layanan hiburan streaming menambah pelanggan dan mencetak rekor baru. Penyedia platform dan produsen perangkat menikmati permintaan yang meningkat.",
    },
    neg: {
      t: [
        "Pelanggan layanan streaming berhenti berlangganan",
        "Layanan hiburan streaming kehilangan penonton",
      ],
      b: "Pelanggan layanan hiburan streaming berhenti berlangganan dalam jumlah besar. Penyedia platform dan produsen perangkat menurunkan target pendapatan.",
    },
  },
];

/** Kalimat tambahan yang tidak berpengaruh pada harga (gaya yang sama dengan berita contoh). */
export const NOISE: string[] = [
  "Sebuah lomba cipta puisi digelar di perpustakaan kota.",
  "Kelompok pecinta kucing menggelar kontes tahunan.",
  "Sebuah seminar tentang desain antarmuka digelar di beberapa kampus.",
  "Komunitas hobi fotografi mengumumkan acara kumpul bulanan.",
  "Sebuah pertandingan bola voli persahabatan digelar akhir pekan ini.",
  "Kelompok pecinta tanaman mengadakan tukar bibit di taman kota.",
  "Sebuah festival layang-layang akan digelar di lapangan kota.",
  "Klub catur setempat membuka pendaftaran turnamen terbuka.",
  "Sebuah pameran lukisan anak sekolah dibuka di balai warga.",
  "Komunitas pelari mengadakan lari pagi bersama setiap hari Minggu.",
  "Sebuah bazar buku bekas digelar di halaman gedung pertemuan.",
  "Kelompok teater remaja menyiapkan pementasan akhir tahun.",
];

/** Kalimat penutup umum per sektor untuk varian b (konteks yang tidak menyebut perusahaan tertentu). */
export const SECTOR_CONTEXT: Record<SectorKey, string> = {
  EN: "Pelaku sektor energi menyebut dampaknya baru akan terlihat dalam beberapa pekan.",
  TR: "Pelaku sektor transportasi memantau perkembangan ini sebelum menyesuaikan jadwal dan tarif.",
  TE: "Pelaku sektor teknologi memperkirakan dampaknya terasa pada pesanan kuartal berikutnya.",
  KE: "Pelaku sektor keuangan menyebut dampaknya akan tercermin pada penyaluran kredit dan pembiayaan.",
  PA: "Pelaku sektor pangan menyebut dampaknya langsung terasa pada biaya dan pasokan.",
  KO: "Pelaku sektor konsumen dan kesehatan menyebut dampaknya terlihat pada angka penjualan bulan ini.",
};

/** Penyebab per jenis event. `{n}` nama perusahaan, `{x}` angka (menit / persen). */
export type Cause = { title: string; body: string };

export const BANKRUPT_CAUSES: Cause[] = [
  {
    title: "Kasus korupsi jerat petinggi {n}, perusahaan dinyatakan bangkrut",
    body: "Penyidik menetapkan sejumlah petinggi {n} sebagai tersangka korupsi dan membekukan rekening perusahaan. Pengadilan menyatakan {n} pailit dan asetnya dilikuidasi; pemegang saham hanya menerima sekitar {x} % dari harga terakhir.",
  },
  {
    title: "Perebutan kepemilikan berlarut, {n} dinyatakan pailit",
    body: "Dua kelompok pemegang saham {n} saling menggugat kepemilikan sampai operasional perusahaan terhenti. Pengadilan menyatakan {n} pailit dan pemegang saham hanya menerima sekitar {x} % dari harga terakhir.",
  },
  {
    title: "Konflik direksi lumpuhkan {n}, perusahaan bangkrut",
    body: "Konflik terbuka antara direksi dan komisaris {n} membuat keputusan penting tak bisa diambil. Kreditur menarik pinjaman dan perusahaan dinyatakan bangkrut; pemegang saham menerima sekitar {x} % dari harga terakhir.",
  },
  {
    title: "{n} gagal bayar utang jatuh tempo, dinyatakan bangkrut",
    body: "{n} tidak sanggup membayar utang yang jatuh tempo dan kreditur mengajukan pailit. Setelah penjualan aset, pemegang saham hanya menerima sekitar {x} % dari harga terakhir.",
  },
  {
    title: "Skandal laporan keuangan rontokkan {n}",
    body: "Auditor menemukan laporan keuangan {n} dimanipulasi selama bertahun-tahun. Kepercayaan kreditur runtuh dan perusahaan dinyatakan bangkrut; pemegang saham menerima sekitar {x} % dari harga terakhir.",
  },
  {
    title: "Gugatan hukum besar-besaran kandaskan {n}",
    body: "Rangkaian gugatan pelanggan dan mitra usaha menguras kas {n}. Pengadilan memutus ganti rugi di luar kemampuan perusahaan dan {n} dinyatakan bangkrut; pemegang saham menerima sekitar {x} % dari harga terakhir.",
  },
  {
    title: "Izin usaha {n} dicabut, perusahaan bangkrut",
    body: "Regulator mencabut izin usaha {n} setelah pelanggaran berulang. Tanpa izin, seluruh kegiatan berhenti dan perusahaan dinyatakan bangkrut; pemegang saham menerima sekitar {x} % dari harga terakhir.",
  },
  {
    title: "Produk gagal dan penarikan massal bawa {n} ke kebangkrutan",
    body: "Produk andalan {n} ditarik dari pasar secara massal karena cacat serius. Biaya penarikan dan ganti rugi menghabiskan kas, dan perusahaan dinyatakan bangkrut; pemegang saham menerima sekitar {x} % dari harga terakhir.",
  },
  {
    title: "Krisis kas dan penipuan mitra usaha, {n} bangkrut",
    body: "Mitra usaha utama {n} menghilang membawa dana pembayaran. Perusahaan kehabisan kas, tidak menemukan penyelamat, dan dinyatakan bangkrut; pemegang saham menerima sekitar {x} % dari harga terakhir.",
  },
  {
    title: "Perang harga dan utang menumpuk, {n} menyerah",
    body: "Perang harga bertahun-tahun dan utang yang menumpuk membuat {n} tidak lagi sanggup beroperasi. Perusahaan dinyatakan bangkrut dan pemegang saham menerima sekitar {x} % dari harga terakhir.",
  },
];

export const SUSPEND_CAUSES: Cause[] = [
  {
    title: "Perdagangan saham {n} dihentikan sementara karena pemeriksaan",
    body: "Regulator memeriksa dugaan penyimpangan di {n}. Perdagangan sahamnya dihentikan sementara selama {x} menit sampai pemeriksaan awal selesai.",
  },
  {
    title: "Rumor akuisisi guncang {n}, perdagangan dihentikan",
    body: "Beredar rumor bahwa {n} akan diakuisisi perusahaan lain dan harga saham bergerak liar. Bursa menghentikan perdagangan {n} selama {x} menit sampai ada penjelasan resmi.",
  },
  {
    title: "Gangguan sistem di {n}, bursa jeda perdagangan",
    body: "Sistem {n} mengalami gangguan sehingga data transaksi tidak sinkron. Bursa menghentikan perdagangan saham {n} selama {x} menit untuk pemulihan data.",
  },
  {
    title: "{n} terlambat lapor keuangan, perdagangan disuspensi",
    body: "{n} belum menyerahkan laporan keuangan pada waktunya. Bursa mengenakan suspensi sementara selama {x} menit sampai perusahaan memberi penjelasan.",
  },
  {
    title: "Pergerakan harga tak wajar, saham {n} dibekukan sementara",
    body: "Harga saham {n} bergerak tidak wajar dalam waktu singkat. Bursa membekukan perdagangan selama {x} menit untuk menelaah kemungkinan manipulasi.",
  },
  {
    title: "Audit mendadak di {n}, perdagangan dijeda",
    body: "Regulator melakukan audit mendadak pada {n}. Selama {x} menit perdagangan sahamnya dijeda sambil menunggu hasil pemeriksaan awal.",
  },
  {
    title: "Pergantian direksi mendadak, saham {n} disuspensi",
    body: "Seluruh direksi {n} mengundurkan diri tanpa pemberitahuan lebih dulu. Bursa menyuspensi perdagangan selama {x} menit sampai perusahaan menjelaskan susunan pengurus.",
  },
  {
    title: "Sengketa paten seret {n}, perdagangan dihentikan",
    body: "Pesaing menggugat {n} atas dugaan pelanggaran paten dan meminta penetapan sementara. Bursa menghentikan perdagangan saham {n} selama {x} menit.",
  },
  {
    title: "Kebocoran data pelanggan {n}, saham disuspensi",
    body: "Data pelanggan {n} bocor dan beredar di internet. Bursa menyuspensi perdagangan selama {x} menit sambil menunggu penjelasan dan langkah penanganan perusahaan.",
  },
  {
    title: "Investigasi lingkungan menimpa {n}, perdagangan dijeda",
    body: "Otoritas lingkungan menyelidiki dugaan pencemaran oleh {n}. Perdagangan saham dijeda selama {x} menit sampai perusahaan memberi keterangan.",
  },
];

export const DIVIDEND_CAUSES: Cause[] = [
  {
    title: "Laba {n} melonjak, dividen dibagikan ke pemegang saham",
    body: "{n} melaporkan laba yang melonjak dan membagikan dividen sekitar {x} % dari harga sahamnya kepada pemegang saham.",
  },
  {
    title: "Kontrak besar tuntaskan, {n} umumkan dividen",
    body: "{n} menuntaskan kontrak besar yang menambah kas perusahaan. Sebagai balasan untuk pemegang saham, perusahaan membagikan dividen sekitar {x} % dari harga sahamnya.",
  },
  {
    title: "Efisiensi biaya angkat laba {n}, dividen disetujui",
    body: "Program efisiensi biaya mengangkat laba {n}. Rapat pemegang saham menyetujui dividen sekitar {x} % dari harga sahamnya.",
  },
  {
    title: "Penjualan {n} melampaui target, dividen dibagikan",
    body: "Penjualan {n} melampaui target tahunan. Perusahaan membagikan dividen sekitar {x} % dari harga sahamnya kepada pemegang saham.",
  },
  {
    title: "Utang lunas, {n} kembali bagikan dividen",
    body: "{n} melunasi utang besar lebih cepat dari jadwal. Kas yang longgar dipakai untuk membagikan dividen sekitar {x} % dari harga sahamnya.",
  },
  {
    title: "Penjualan aset non-inti beri {n} tambahan kas untuk dividen",
    body: "{n} menjual aset non-inti dengan harga baik. Sebagian hasilnya dibagikan sebagai dividen sekitar {x} % dari harga sahamnya.",
  },
  {
    title: "Produk baru laris, {n} umumkan dividen",
    body: "Produk terbaru {n} laris di pasar dan menambah laba. Perusahaan mengumumkan dividen sekitar {x} % dari harga sahamnya.",
  },
  {
    title: "Kas berlimpah, {n} bagikan dividen khusus",
    body: "Dengan kas yang berlimpah, {n} membagikan dividen khusus sekitar {x} % dari harga sahamnya kepada pemegang saham.",
  },
  {
    title: "{n} perluas pasar dan bagikan dividen interim",
    body: "Setelah memperluas pasar ke wilayah baru, {n} membagikan dividen interim sekitar {x} % dari harga sahamnya.",
  },
  {
    title: "Rekor pendapatan kuartal, {n} naikkan dividen",
    body: "{n} mencatat rekor pendapatan kuartal ini dan menaikkan dividen menjadi sekitar {x} % dari harga sahamnya.",
  },
  {
    title: "{n} umumkan dividen setelah restrukturisasi rampung",
    body: "Restrukturisasi usaha {n} rampung dan arus kas pulih. Perusahaan membagikan dividen sekitar {x} % dari harga sahamnya kepada pemegang saham.",
  },
  {
    title: "Pangsa pasar {n} naik, dividen dibagikan",
    body: "Pangsa pasar {n} naik dalam beberapa kuartal terakhir dan laba ikut naik. Perusahaan membagikan dividen sekitar {x} % dari harga sahamnya.",
  },
];
