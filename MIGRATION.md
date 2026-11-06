# Penerapan perbaikan database 99Foods

Perubahan frontend checkout membutuhkan fungsi `simpan_transaksi` dari `supabase_hardening.sql` dan alur QRIS, dapur, serta refund dari `supabase_pos_workflow.sql`. Terapkan perubahan database dan frontend dalam satu jendela pemeliharaan.

Jika Dashboard menampilkan `column transaksi.payment_status does not exist`, berarti `supabase_pos_workflow.sql` belum diterapkan pada proyek Supabase yang dipakai aplikasi. Frontend akan menampilkan data lama pada Dashboard dan Laporan, tetapi antrean dapur, QRIS menunggu, serta refund baru aktif setelah migrasi berhasil.

## Sebelum menjalankan SQL

1. Cadangkan database Supabase dan hentikan sementara checkout.
2. Pastikan schema lama dan `supabase_migration.sql` sudah pernah diterapkan. **Jangan jalankan ulang `supabase_migration.sql` pada database berisi data** karena file itu menghapus dan membuat ulang tabel `resep`.
3. Periksa akun Auth lewat SQL Editor: `SELECT id, email FROM auth.users;`.
4. Bila hanya ada satu akun, `supabase_hardening.sql` otomatis menetapkannya sebagai owner. Bila ada lebih dari satu, tentukan UUID owner terlebih dahulu. Jalankan blok berikut di SQL Editor, lalu jalankan `supabase_hardening.sql`:

   ```sql
   CREATE TABLE IF NOT EXISTS public.app_owners (
     user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
   );
   ALTER TABLE public.app_owners ENABLE ROW LEVEL SECURITY;
   REVOKE ALL ON public.app_owners FROM PUBLIC, anon, authenticated;
   INSERT INTO public.app_owners(user_id)
   VALUES ('GANTI_DENGAN_UUID_OWNER')
   ON CONFLICT DO NOTHING;
   ```

   UUID owner berasal dari hasil langkah 3. Setelah migrasi, tinjau isi `public.app_owners`; hanya akun di tabel ini yang dapat memakai aplikasi. Tabel ini dikelola melalui SQL Editor, bukan dari browser.

5. Jalankan seluruh `supabase_hardening.sql` di SQL Editor. Script dibungkus `BEGIN`/`COMMIT`, sehingga kegagalan membatalkan perubahannya.
6. Jalankan `supabase_pos_workflow.sql` di SQL Editor **setelah** `supabase_hardening.sql`. Migrasi ini memberi status historis `lunas` dan `diserahkan`, membuat RPC QRIS/refund/dapur, serta menambahkan tabel riwayat status. Jangan menerapkan frontend baru sebelum kedua SQL berhasil.
7. Bangun dan terapkan frontend versi baru. Setelah itu buka kembali checkout.

Untuk database baru yang kosong, jalankan `supabase_schema.sql`, lalu `supabase_migration.sql`, buat satu akun owner di Supabase Auth, lalu jalankan `supabase_hardening.sql` dan `supabase_pos_workflow.sql`. Bucket Storage publik `menu-images` tetap perlu dibuat.

## Pemeriksaan setelah migrasi

- Masuk sebagai owner; buat satu transaksi dan pastikan struk, total, serta stok porsi sesuai.
- Coba jumlah lebih besar dari stok. RPC harus menolak seluruh transaksi; tidak boleh ada header atau detail baru.
- Ulangi RPC dengan `p_request_id` yang sama. Hasilnya harus menunjuk transaksi yang sama tanpa mengurangi stok lagi.
- Hapus menu yang pernah terjual. Detail transaksi lama harus tetap ada dengan `menu_id` menjadi `NULL`.
- Akun Auth yang bukan owner tidak boleh membaca/mengubah tabel aplikasi. Cek juga akses Storage dan fungsi RPC dari akun tersebut.
- Periksa contoh laporan: omset Rp100.000, belanja bahan Rp30.000, operasional Rp10.000 menghasilkan Laba Bersih (Kas) Rp60.000.
- Pilih QRIS pada Menu maupun Transaksi Manual. Gambar QRIS 99 FOODS harus tampak utuh. Simpan pesanan menunggu: stok dan omzet belum berubah, pesanan belum muncul di Dapur.
- Pesanan QRIS menunggu tidak memesan stok. Jika stok habis sebelum pembayaran dikonfirmasi, RPC menolak konfirmasi. Selesaikan pembayaran yang sudah diterima secara manual sesuai kebijakan toko sebelum membatalkan pesanan.
- Periksa notifikasi di BNI Merchant, tandai pembayaran diterima, lalu pastikan stok berkurang satu kali dan pesanan muncul sebagai **Baru** di Dapur. QRIS ini statis dan konfirmasinya manual; gambar saja tidak memverifikasi dana masuk.
- Dari Dapur, jalankan Baru → Diproses → Siap → Diserahkan. Pesanan historis sebelum migrasi tidak masuk antrean.
- Batalkan pesanan QRIS yang belum dibayar: omzet dan stok tetap. Refund transaksi lunas: catatan dan alasan terlihat, penjualan tetap tercatat pada tanggal awal dan nilai refund menjadi pengurang pada tanggal refund. Stok kembali hanya jika opsi dipilih.
- Cetak struk dari modal dan riwayat memakai Web Serial (Bluetooth Classic/SPP) atau Web Bluetooth (BLE). Kedua API memerlukan HTTPS atau localhost dan dukungan browser. Printer RPP02N harus diuji pada perangkat fisik; bila koneksi gagal, gunakan Cetak Browser.

## Printer Bluetooth

Pasangkan printer RPP02N di pengaturan Bluetooth perangkat sebelum memilih **Cetak Bluetooth Classic**. Tombol ini memakai Web Serial untuk profil SPP; browser akan meminta pengguna memilih port printer. Untuk varian yang menyediakan BLE/GATT, gunakan **Coba koneksi BLE**. Kode mendukung beberapa profil BLE yang umum, tetapi UUID perangkat WOYA belum terverifikasi pada printer fisik. Pengujian pada Chrome/Edge dan perangkat target tetap diperlukan. Situs yang dibuka melalui `http://192.168.x.x` tidak memiliki konteks aman untuk Web Serial/Web Bluetooth; gunakan deployment HTTPS. **Cetak Browser** tetap tersedia sebagai cadangan.

Tes otomatis frontend: `npm test`. Build produksi: `npm run build`. Tes SQL dan akses role perlu dijalankan pada proyek Supabase yang memakai schema sebenarnya.
