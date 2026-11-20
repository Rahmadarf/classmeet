/**
 * Bahan kalimat PENGECOH berita: kabar kecil yang tidak memengaruhi harga dan tidak memuat kata kunci sifat aset mana pun
 * (diperiksa tes terhadap `ASSET_TRAITS[*].keys`). Berupa anak kalimat berawalan huruf kecil; pembuat berita merangkainya
 * menjadi "Di sisi lain, <a>." dan "Selain itu, <b>.".
 *
 * NOISE_BY_SECTOR sengaja berdekatan topiknya dengan sektor (seperti contoh panitia: seminar pendidikan kesehatan, pusat
 * kebugaran) supaya pengecoh terasa relevan tetapi tidak berarti apa-apa bagi harga.
 */
export const NOISE_GENERIC: string[] = [
  "sebuah komunitas seni mengumumkan penyelenggaraan lomba menggambar karakter",
  "kelompok pecinta kucing menggelar kontes tahunan",
  "sebuah seminar tentang desain antarmuka digelar di beberapa kampus",
  "komunitas hobi fotografi mengumumkan acara kumpul bulanan",
  "sebuah pertandingan bola voli persahabatan akan digelar akhir pekan ini",
  "kelompok pecinta tanaman mengadakan tukar bibit di taman kota",
  "sebuah festival layang-layang akan digelar di lapangan kota",
  "klub catur setempat membuka pendaftaran turnamen terbuka",
  "sebuah pameran lukisan anak sekolah dibuka di balai warga",
  "komunitas pelari mengadakan lari pagi bersama setiap hari Minggu",
  "sebuah bazar buku bekas digelar di halaman gedung pertemuan",
  "kelompok teater remaja menyiapkan pementasan akhir tahun",
  "pemerintah kota mengumumkan jadwal baru pelaksanaan bazar kewirausahaan",
  "sejumlah pusat perbelanjaan sedang menyiapkan area pertunjukan musik untuk akhir pekan",
  "sebuah sekolah dasar mengadakan lomba mewarnai tingkat kecamatan",
  "kelompok sepeda santai mengadakan konvoi keliling kota",
  "sebuah perpustakaan daerah menambah jam layanan pada akhir pekan",
  "komunitas peduli sungai menggelar kerja bakti di bantaran sungai",
  "sebuah paduan suara mahasiswa akan tampil dalam acara amal",
  "panitia kejuaraan bulu tangkis tingkat pelajar membuka pendaftaran peserta",
  "sebuah museum kota menggelar pameran foto sejarah",
  "sejumlah warga menyiapkan lomba tradisional untuk perayaan kemerdekaan",
  "kelompok relawan mengajar membuka kelas membaca untuk anak-anak",
  "sebuah klub astronomi mengundang warga mengamati bintang bersama",
  "komunitas origami menggelar pelatihan gratis di pusat kegiatan warga",
  "dinas pariwisata setempat merapikan papan petunjuk di beberapa objek wisata",
  "sebuah orkestra remaja menyiapkan konser musim liburan",
  "sebuah lomba mendongeng untuk anak digelar di taman bacaan",
];

export type SectorKey = "EN" | "TR" | "TE" | "KE" | "PA" | "KO";

export const NOISE_BY_SECTOR: Record<SectorKey, string[]> = {
  EN: [
    "sebuah universitas membuka program studi baru tentang tata kelola sumber daya alam",
    "kelompok pencinta alam membersihkan jalur pendakian di kawasan hutan",
    "sebuah pameran foto tentang kehidupan nelayan digelar di balai kota",
  ],
  TR: [
    "sebuah komunitas pengendara sepeda membuka jalur wisata baru di tepi kota",
    "sebuah museum menggelar pameran kereta api tua",
    "kelompok pecinta kereta api mengadakan kunjungan ke stasiun lama",
  ],
  TE: [
    "sebuah kampus mengadakan lomba merancang aplikasi untuk pelajar",
    "komunitas pemrogram muda menggelar malam berbagi kode di ruang kerja bersama",
    "sebuah pameran robot rakitan siswa dibuka di pusat kebudayaan",
  ],
  KE: [
    "sebuah lembaga pendidikan mengadakan seminar umum mengenai pengelolaan anggaran rumah tangga",
    "komunitas mahasiswa menggelar lomba cerdas cermat tentang ekonomi",
    "sebuah perpustakaan menggelar pelatihan menyusun catatan pengeluaran bulanan untuk pelajar",
  ],
  PA: [
    "sebuah komunitas warga menggelar festival kuliner tradisional di alun-alun",
    "kelompok petani muda mengadakan pelatihan menanam sayur di pekarangan",
    "sebuah sekolah memberi kelas memasak sederhana untuk siswa",
  ],
  KO: [
    "sebuah organisasi profesi merencanakan seminar mengenai perkembangan pendidikan kesehatan",
    "sejumlah pusat kebugaran memperkenalkan program keanggotaan baru untuk pelanggan",
    "sebuah klub senam lansia membuka kelas baru di taman kota",
  ],
};
