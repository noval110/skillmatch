# Login dan registrasi dengan Google

Halaman `/login` dan `/register` memakai Google Identity Services. Pengguna baru
otomatis dibuatkan akun dan langsung masuk ke dashboard. Nama dan email diambil
dari identitas Google yang diverifikasi backend. Registrasi Google menggunakan
experience level yang dipilih di formulir; login pengguna baru memakai `beginner`.
Experience level bisa diubah dari profil.

## Buat Client ID

1. Buka [Google Cloud Console](https://console.cloud.google.com/) dan pilih atau
   buat project untuk SkillMatch.
2. Buka **Google Auth Platform**. Pada **Branding**, isi nama aplikasi, email
   dukungan, dan kontak pengembang. Pilih **Audience** yang sesuai; untuk aplikasi
   publik pilih **External**. Jika aplikasi masih dalam mode **Testing**, tambahkan
   akun Google yang akan mencoba aplikasi sebagai test user.
3. Pada **Clients**, pilih **Create client**, lalu tipe **Web application**.
4. Tambahkan **Authorized JavaScript origins** yang benar-benar dipakai:
   - `http://localhost` dan `http://localhost:5173` untuk pengembangan lokal.
   - `http://127.0.0.1:5173` bila memakai alamat tersebut.
   - Origin produksi frontend, misalnya `https://skillmatch.vercel.app`.
   Jangan tambahkan path `/login`, `/register`, atau `/api`. Port harus cocok.
5. Simpan dan salin **Client ID**, yang berakhiran `.apps.googleusercontent.com`.
   Integrasi ini memakai popup dan callback JavaScript, sehingga tidak memerlukan
   redirect URI atau Client Secret.

Lihat [panduan konfigurasi Google](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)
dan [panduan tombol Google](https://developers.google.com/identity/gsi/web/guides/display-button).

## Pasang konfigurasi

Isi Client ID yang sama pada kedua layanan:

```dotenv
# frontend/.env (lokal) atau environment Vercel
VITE_GOOGLE_CLIENT_ID=CLIENT_ID_ANDA.apps.googleusercontent.com

# backend/.env (lokal) atau environment Render/Railway
GOOGLE_CLIENT_ID=CLIENT_ID_ANDA.apps.googleusercontent.com
```

Pertahankan `VITE_API_URL`, `DATABASE_URL`, `JWT_SECRET`, dan `FRONTEND_URL` yang
sudah ada. Restart frontend dan backend setelah mengganti konfigurasi lokal.
Di hosting, rebuild/redeploy frontend karena variabel `VITE_` dipasang saat build,
dan redeploy backend. Client ID bersifat publik; jangan masukkan Client Secret
ke frontend.

Backend otomatis menjalankan migrasi `008_google_auth.sql` saat startup.
Migrasi menambah kolom `google_subject` dan unique index tanpa menghapus akun.
Tanpa Client ID, tombol Google tampil nonaktif dan email/password tetap tersedia.

## Perilaku akun dan verifikasi

- `POST /api/auth/google` menerima JSON `credential` dan opsional
  `experience_level`, lalu mengembalikan token sesi SkillMatch seperti login biasa.
- Backend memverifikasi signature RS256 menggunakan public key Google yang
  di-cache, audience Client ID, issuer, masa berlaku, subject, dan email terverifikasi.
- Akun Google dikenali berdasarkan `sub` yang stabil, bukan alamat email yang
  bisa berubah. Login berikutnya mempertahankan profil, tim, dan experience level.
- Email akun password yang cocok dapat dihubungkan otomatis hanya ketika Google
  berwenang atas email itu: Gmail atau Google Workspace terverifikasi. Password
  lama tetap berfungsi. Akun pihak ketiga yang sudah ada, subject berbeda, dan
  email ambigu ditolak agar tidak menghubungkan akun yang salah.
- Akun baru khusus Google tidak memiliki password yang dapat digunakan untuk
  login biasa. Token Google tidak disimpan di browser atau database aplikasi.
- Endpoint hanya menerima JSON; formulir lintas situs ditolak. CORS tetap memakai
  daftar origin aplikasi yang sudah dikonfigurasi.

Aturan identitas mengikuti [dokumentasi verifikasi Google](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

## Uji setelah Client ID tersedia

1. Buka `/register`, pilih experience level, lalu **Daftar dengan Google**.
   Pastikan masuk ke dashboard dan profil berisi nama serta email Google.
2. Logout, lalu masuk melalui **Masuk dengan Google** di `/login`. Pastikan akun,
   profil, dan tim tetap sama, tanpa akun duplikat.
3. Coba akun Gmail yang sebelumnya terdaftar menggunakan password. Pastikan
   Google masuk ke akun yang sama dan password sebelumnya masih dapat dipakai.
4. Batalkan popup dan uji jaringan gagal; formulir email/password harus tetap bisa
   dipakai. Untuk `origin_mismatch`, periksa origin dan port pada Google Console.

Uji lokal tanpa akun Google asli:

```powershell
cd backend
go test ./...
# Opsional: database pengembangan; test membuat schema sementara sendiri.
$env:SKILLMATCH_INTEGRATION='1'
go test ./handlers -run TestGoogleAuthIntegration -count=1
```

Uji browser memakai Chrome yang sudah terpasang, dengan identitas dan API simulasi:

```powershell
cd frontend
node tests/google-auth.browser.mjs
```

Hasil screenshot tersimpan di `artifacts/google-auth/`. Test ini tidak memerlukan
Client ID asli dan tidak menggantikan uji akun Google setelah konfigurasi tersedia.
