# NESITE CDN — FULL AUDIT & IMPLEMENTATION

Kamu bertindak sebagai senior full-stack developer, API integration engineer, dan UI/UX designer.

TUGAS:
Audit 10 provider CDN berikut, lalu langsung bangun frontend Nesite CDN beserta logic upload yang sesuai untuk setiap provider yang terbukti dapat digunakan.

Jangan berhenti pada perencanaan. Implementasikan, tes, perbaiki, dan dokumentasikan hasilnya.

## 1. PROVIDER

1. https://cdn.nekohime.site/
2. https://catbox.moe/
3. https://cp.senxc.my.id/
4. https://x.xcute.workers.dev/
5. https://i.8upload.com/
6. https://kappa.lol/
7. https://cdn.zass.in/
8. https://s7.vltcs.my.id/
9. https://cdn.cmnty.web.id/
10. https://athars.space/

Semua provider merupakan kandidat yang dipercaya pemilik project, tetapi status API, keamanan, batas upload, dan masa simpannya tetap harus diverifikasi.

## 2. TARGET PROJECT

Nama: NESITE CDN
Domain target: cdn.nesite.my.id
Deployment: Vercel

Tujuan:
- Satu frontend untuk berbagai provider upload.
- Prioritaskan upload tanpa akun, API key, atau token.
- Setiap provider menggunakan adapter dan logic masing-masing.
- Tidak menyimpan file pengguna secara permanen di server Nesite.
- Hasil upload menampilkan URL yang benar-benar dikembalikan provider.
- Jangan pernah membuat fake upload atau URL palsu.
- Jangan mengklaim provider berfungsi sebelum ada bukti.

Periksa direktori project terlebih dahulu. Pertahankan file yang masih relevan dan jangan menghapus pekerjaan sebelumnya tanpa alasan.

## 3. AUDIT PROVIDER

Periksa:
- Dokumentasi dan endpoint API upload.
- HTTP method dan nama field file.
- Parameter wajib.
- Format respons sukses dan gagal.
- Cara mendapatkan direct URL.
- Kebutuhan token, akun, cookie, session, CAPTCHA, atau CSRF.
- CORS dan kompatibilitas upload dari browser.
- Batas ukuran dan tipe file.
- Expiration, retensi, dan kebijakan penghapusan.
- Batas penggunaan serta aturan integrasi pihak ketiga.

Gunakan dokumentasi publik, source JavaScript publik, dan HTTP request yang wajar jika tersedia.

Jangan menganggap halaman utama sebagai endpoint API.

Jika menguji upload nyata, gunakan satu file teks kecil yang tidak sensitif dan hanya lakukan jika diizinkan layanan. Jangan melakukan upload massal, melewati autentikasi, mengakali CAPTCHA, atau menghindari rate limit.

Jika tidak bisa mengakses jaringan, jangan mengarang hasil. Tandai sebagai belum terverifikasi.

Gunakan status:
- READY: endpoint upload publik sudah terverifikasi.
- PARTIAL: dapat digunakan dengan keterbatasan.
- UNVERIFIED: bukti belum cukup.
- UNSUPPORTED: tidak ditemukan metode integrasi yang layak.

Buat `docs/provider-audit.md` dengan tabel:

Provider | Upload Endpoint | Method | File Field | Auth | CORS | Response Format | Direct URL | Expiration | Max Size | Test Status | Notes

Sertakan sumber dan bukti. Bedakan hasil pengujian nyata dari asumsi atau hasil mock.

## 4. FRONTEND

Buat UI minimalis tetapi berani, premium, modern, dan responsif.

Arah desain:
- Dark mode.
- Background charcoal/near-black.
- Aksen ungu dan biru neon.
- Tipografi tegas.
- Border tipis dan card bersih.
- Animasi ringan.
- Tidak terlalu ramai.
- Mobile-first untuk Android.
- Tetap terlihat bagus di desktop.

Brand: NESITE CDN

Headline:
"Upload Once. Share Everywhere."

Subheadline:
"One interface. Multiple file hosts."

Urutan interaksi WAJIB:

1. Pengguna memilih atau drop file.
2. Tampilkan nama file, ukuran, dan tipe.
3. Di bawah area file, pengguna memilih provider.
4. Pengguna menekan tombol Upload.
5. Tampilkan status/progress upload yang akurat.
6. Setelah berhasil, tampilkan URL hasil upload.
7. Sediakan tombol Copy URL.

Provider selector menggunakan radio cards yang menampilkan:
- Nama provider.
- Deskripsi singkat.
- Status integrasi.
- Expiration jika diketahui.
- Batas ukuran jika diketahui.
- Badge "No API Key" hanya jika sudah diverifikasi.
- Badge "Belum Diverifikasi" jika belum siap.

Jangan menjanjikan file permanen, NEVER, atau unlimited tanpa bukti.

Tambahkan:
- Loading state.
- Empty state.
- Success state.
- Error state.
- Validasi file.
- Pencegahan double submission.
- Pesan kesalahan yang jelas.

Pilih framework yang paling sesuai dengan project yang sudah ada. Jika project masih kosong, gunakan stack yang ringan, maintainable, dan kompatibel dengan Vercel.

## 5. ADAPTER ARCHITECTURE

Buat adapter terpisah untuk setiap provider.

Gunakan struktur yang sesuai dengan framework, misalnya:

src/
  components/
    Header
    FileDropzone
    ProviderSelector
    UploadProgress
    UploadResult
  lib/
    providers/
      types
      registry
      catbox
      nekohime
      senxc
      xcute
      upload8
      kappa
      zass
      vltcs
      cmnty
      athars
    upload/
      validation
      errors

Jangan membuat file kosong hanya untuk memenuhi struktur contoh.

Setiap adapter sebaiknya memiliki:
- id
- name
- description
- supportedFileTypes
- maxFileSize jika diketahui
- expirationInfo
- requiresAuth
- upload(file, options)
- response normalization

Setiap adapter wajib:
- Menggunakan endpoint dan request format yang terverifikasi.
- Memeriksa HTTP status.
- Memvalidasi respons.
- Mengambil URL asli dari respons.
- Menangani timeout dan kegagalan jaringan.
- Menghasilkan error yang konsisten.
- Tidak mengarang URL saat gagal.

Jangan menggunakan satu request generik untuk semua provider.

Jika suatu provider hanya mempunyai halaman upload tanpa API publik yang dapat digunakan secara sah, tandai sebagai unavailable dan jelaskan alasannya.

## 6. BROWSER, CORS, DAN VERCEL

Prioritaskan upload langsung dari browser jika provider mendukungnya.

Jika CORS menghalangi:
- Evaluasi apakah proxy serverless Vercel layak digunakan.
- Periksa kebijakan provider terlebih dahulu.
- Gunakan allowlist endpoint yang tetap.
- Jangan membuat open proxy.
- Jangan menerima hostname arbitrer.
- Batasi ukuran request dan timeout.
- Jangan menyimpan file permanen.
- Jangan mencatat isi file atau data sensitif ke log.

Jangan melewati autentikasi, CAPTCHA, rate limit, atau pembatasan provider.

Jangan menaruh API key atau secret di frontend.

Jika credential wajib, dokumentasikan kebutuhan environment variable dan tandai keterbatasannya.

## 7. KEAMANAN

Implementasikan:
- Validasi ukuran dan nama file.
- Validasi tipe file jika diperlukan.
- Timeout request.
- Error handling HTTP 4xx/5xx.
- Pencegahan double submission.
- Pembatasan endpoint tujuan untuk proxy.
- Tidak menyimpan file pengguna secara diam-diam.
- Tidak mengunggah file tanpa tindakan pengguna.
- Tidak mengekspos credential.

Berikan peringatan bahwa file dapat menjadi publik sesuai kebijakan provider.

## 8. TESTING

Jalankan sesuai kemampuan lingkungan:
- Build.
- Type checking.
- Lint.
- Unit test untuk registry dan response parser.
- Test validasi file.
- Test error handling.
- Mock test jika provider belum bisa diuji nyata.
- Smoke test untuk integrasi yang dapat diuji dengan aman.
- Pemeriksaan kompatibilitas Vercel.

Jangan menyatakan mock sebagai upload nyata.

Jangan menyatakan integrasi berhasil hanya karena build sukses.

## 9. DOKUMENTASI

Buat atau perbarui:
- README.md
- docs/provider-audit.md
- .env.example jika diperlukan
- Petunjuk deployment Vercel
- Daftar provider READY, PARTIAL, UNVERIFIED, dan UNSUPPORTED
- Penjelasan keterbatasan setiap provider

Target domain:
cdn.nesite.my.id

Jangan melakukan deployment atau mengubah DNS tanpa izin eksplisit.

Jangan commit credential atau file rahasia.

## 10. WORKFLOW

Kerjakan berurutan:

1. Periksa project dan tools yang tersedia.
2. Audit seluruh provider.
3. Simpan hasil audit.
4. Bangun frontend.
5. Implementasikan adapter yang benar-benar didukung.
6. Tampilkan status unavailable untuk provider yang belum siap.
7. Jalankan build dan test.
8. Perbaiki error.
9. Perbarui dokumentasi.
10. Laporkan hasil akhir dan cara menjalankan project.

Jangan berhenti hanya untuk meminta persetujuan setelah membuat rencana. Lanjutkan implementasi secara mandiri dalam batas tugas ini.

Jika sebagian audit tidak bisa dilakukan karena keterbatasan jaringan, kerjakan bagian lain yang dapat diselesaikan dan dokumentasikan hambatannya.

Jangan mengklaim semua provider berfungsi jika kenyataannya tidak demikian.

## DEFINITION OF DONE

- Frontend responsif dan sesuai desain.
- Urutan file -> provider -> upload diterapkan.
- Adapter tiap provider terpisah.
- Provider yang digunakan memiliki endpoint terverifikasi.
- Provider yang belum terverifikasi ditandai dengan jelas.
- Upload sukses menghasilkan URL nyata.
- Tombol Copy berfungsi.
- Progress dan error ditampilkan dengan benar.
- Build dan test berhasil sejauh didukung lingkungan.
- Dokumentasi audit dan deployment tersedia.

Mulai dengan memeriksa direktori kerja saat ini, lalu kerjakan seluruh tahapan di atas.
