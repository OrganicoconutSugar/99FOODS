# Session Progress — 99Foods Dashboard

> File ini dibuat sebagai referensi konteks proyek agar tidak perlu mengulang dari awal di setiap sesi baru.

---

## Identitas Proyek

| | |
|---|---|
| Nama Proyek | 99Foods Dashboard |
| Root Folder | `Kasir (Claude)/99foods-dashboard/` |
| Stack | React + Vite + Tailwind CSS + Supabase |
| Hosting (rencana) | Vercel (frontend) + Supabase (DB + Storage + Auth) |
| GitHub Repo | https://github.com/OrganicoconutSugar/99FOODS (public, main branch) — sudah di-push |
| Warna UI | Putih + Hijau Sage (`sage-500` = `#5c835c`) |
| Mode | Light only (dark mode dihapus) |
| Logo title/favicon | `src/assets/element/logo.png` (icon bubble 99 Food, RGBA transparan, 242×256px, 79 KB) — dipakai di `index.html` favicon & halaman Login (`Login.jsx` import via `useState` + `<img>`) |
| Logo sidebar | `src/assets/element/logosidebar.png` (full branding portrait, RGBA transparan, 512×640px, 146 KB) — dipakai di `Sidebar.jsx` header, teks "99Foods" dihapus |
| Logo stat cards | `src/assets/element/omsetlogo.png`, `profitlogo.png`, `modallogo.png`, `transaksilogo.png` — dipakai di StatCard Dashboard & Laporan mengganti lucide icon |
| Reset Data Script | `supabase_reset.sql` — TRUNCATE semua tabel transaksional + DELETE storage.objects |
| Stok Page | Label: "Stok Makanan" (bukan "Stok & HPP") — hanya CRUD menu + stok porsi, fitur Resep/HPP dihapus |
| Chart Customization | `src/components/ui/ChartSettings.jsx` — 4 tema, 3 tipe chart, series toggle, persist di localStorage |

---

## Struktur File Lengkap

```
99foods-dashboard/
├── .env                          ← Supabase URL + Anon Key (sudah diisi owner)
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js            ← palet custom: `sage` (hijau sage)
├── vite.config.js                     ← port 5173 fix, host true
├── supabase_schema.sql           ← schema awal (referensi)
├── supabase_migration.sql        ← semua ALTER/DROP/CREATE setelah schema awal
├── supabase_reset.sql            ← TRUNCATE semua data uji coba (akun aman)
├── reset_storage.js              ← hapus foto storage via browser console (opsional)
├── session.md                    ← file ini
│
└── src/
    ├── App.jsx                   ← routing utama, AuthProvider, ErrorBoundary
    ├── main.jsx                  ← global error handlers (blank screen fix)
    ├── index.css                 ← Tailwind + print styles (struk) + animasi slide-up
    │
    ├── lib/
    │   └── supabase.js           ← Supabase client
    │
    ├── context/
    │   └── AuthContext.jsx       ← login/logout/session/uploadAvatar/removeAvatar
    │
    ├── utils/
    │   └── format.js             ← formatRupiah, formatTanggal, generateKodeTransaksi, toInputDate
    │
    ├── components/
    │   ├── layout/
    │   │   ├── AppLayout.jsx     ← wrapper sidebar + navbar + <Outlet>
    │   │   ├── Sidebar.jsx       ← navigasi kiri, collapse toggle, logo portrait
    │   │   └── Navbar.jsx        ← header atas, bell stok low, avatar upload button
    │   │
    │   └── ui/
    │       ├── AvatarUploader.jsx← modal upload/crop/hapus foto profile (bottom-sheet)
    │       ├── Badge.jsx
    │       ├── Button.jsx
    │       ├── Card.jsx
    │       ├── ChartSettings.jsx ← dialog custom chart: 4 tema, 3 tipe, series toggle, tinggi
    │       ├── ErrorBoundary.jsx ← tangkap runtime error, tampilkan pesan (bukan blank)
    │       ├── ImageCropper.jsx  ← drag&drop + crop foto (react-easy-crop) + upload ke Supabase Storage
    │       ├── Input.jsx
    │       ├── Modal.jsx
    │       ├── Select.jsx
    │       ├── StatCard.jsx
    │       └── StrukPrint.jsx    ← komponen struk thermal 80mm, hidden di layar, muncul saat print
    │
    └── pages/
        ├── Login.jsx             ← halaman login owner
        ├── Dashboard.jsx         ← ringkasan keuangan + grafik customize + stok makanan <5
        ├── KasirMenu.jsx         ← [AKTIF] grid menu, cart, checkout modal, struk modal
        ├── StokHPP.jsx           ← [AKTIF] "Stok Makanan" — CRUD menu + stok porsi + upload foto
        ├── PembelianBahan.jsx    ← catat beli bahan & operasional + hapus catatan
        ├── Penjualan.jsx         ← riwayat transaksi + detail + cetak struk
        ├── Laporan.jsx           ← grafik customize + export Excel
        └── ~~MenuResep.jsx~~     ← (dihapus, diganti KasirMenu + StokHPP)
        └── ~~StokBahan.jsx~~     ← (dihapus, diganti StokHPP)
```

---

## Routing Aktif (`App.jsx`)

| Path | Komponen | Deskripsi |
|---|---|---|
| `/login` | `Login` | Halaman login owner |
| `/` | `Dashboard` | Ringkasan keuangan harian/mingguan/bulanan |
| `/menu` | `KasirMenu` | Kasir board — pilih menu, cart, checkout, cetak struk |
| `/stok` | `StokHPP` | Manajemen menu + HPP + upload foto menu |
| `/pembelian` | `PembelianBahan` | Catat pembelian bahan & pengeluaran operasional |
| `/penjualan` | `Penjualan` | Riwayat transaksi + detail + cetak struk |
| `/laporan` | `Laporan` | Laporan periodik + export Excel |

---

## Database Schema (Supabase)

### Tabel Utama

| Tabel | Keterangan |
|---|---|
| `menu` | Data menu: nama, kategori, harga_jual, hpp (auto), stok_menu (nullable), gambar_url, aktif |
| `resep` | Komposisi bahan per menu: nama_bahan (teks bebas), jumlah, satuan, harga_per_satuan |
| `bahan_baku` | Stok bahan baku: nama, satuan, stok, stok_minimum, harga_per_satuan |
| `pembelian_bahan` | Log pembelian bahan: nama_bahan (teks bebas, bahan_id nullable), jumlah, harga, total (generated) |
| `pengeluaran_operasional` | Log pengeluaran operasional: keterangan, kategori, jumlah |
| `transaksi` | Header transaksi: kode, tanggal, channel, nama_customer, total_omset, total_modal, total_untung |
| `transaksi_detail` | Detail per item: menu_id (SET NULL on delete), nama_menu, jumlah_porsi, harga_jual, hpp, subtotal (generated) |
| `riwayat_harga_bahan` | Log perubahan harga bahan baku |

### Kolom Tambahan (via migration)
- `menu.stok_menu` — INTEGER nullable, stok porsi yang tersedia
- `menu.gambar_url` — TEXT nullable, URL foto dari Supabase Storage
- `transaksi.nama_customer` — TEXT nullable, nama customer saat checkout

### Functions & Triggers
- `hitung_hpp(menu_id)` — hitung total HPP dari tabel resep (jumlah × harga_per_satuan)
- `trigger_update_hpp_on_resep_change` — auto-update HPP menu saat resep INSERT/UPDATE/DELETE
- `proses_transaksi(transaksi_id)` — potong stok menu + hitung total omset/modal
- `trigger_pembelian_bahan_insert` — update stok & riwayat harga jika bahan_id diisi (opsional)

### Supabase Storage
- Bucket: `menu-images` (Public)
- Policy diperlukan:
  - INSERT: `authenticated` only
  - SELECT: public (semua)
  - DELETE: `authenticated` only
- SQL policy yang benar (`supabase_migration.sql` bagian storage):
  ```sql
  CREATE POLICY "authenticated can upload menu images"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'menu-images');
  ```

---

## Fitur yang Sudah Selesai

### Laman Menu (KasirMenu)
- [x] Grid kartu menu dengan foto, nama, harga, badge stok
- [x] Filter per kategori (Dimsum, Cireng, dll)
- [x] Search menu
- [x] Klik menu → popup qty (+ stok realtime)
- [x] Cart floating kanan bawah
- [x] Tombol **"Cetak"** di cart → buka CheckoutModal
- [x] CheckoutModal: input nama customer, pilih channel (Tunai/QRIS/Ojek Online), tanggal realtime, ringkasan item + total
- [x] Submit → simpan transaksi ke DB + potong stok via `proses_transaksi()`
- [x] Setelah berhasil → StrukModal muncul (preview struk + tombol Cetak Struk)
- [x] `window.print()` → CSS print hanya tampilkan `.struk-print-area`

### Laman Stok & HPP (StokHPP)
- [x] List semua menu dengan thumbnail, info HPP, margin, stok porsi
- [x] Tambah/Edit menu: nama, kategori, harga jual, stok porsi, aktif
- [x] Upload foto: drag & drop / pilih file → modal crop (react-easy-crop) → upload ke Supabase Storage `menu-images`
- [x] Modal Resep & HPP: tambah/hapus bahan (nama bebas, jumlah, satuan, harga) → HPP otomatis via trigger
- [x] Hapus menu: hapus transaksi_detail → resep → menu

### Laman Pembelian Bahan (PembelianBahan)
- [x] Tab Bahan Baku: input nama bahan (teks bebas), jumlah, satuan (termasuk pack), harga
- [x] Tab Operasional: keterangan, kategori (Gas/Kemasan/Listrik/dll), jumlah
- [x] Tombol hapus (muncul saat hover) di kedua tabel

### Laman Transaksi Penjualan (Penjualan)
- [x] Tabel riwayat: kode, tanggal, customer, channel, omset, modal, untung
- [x] Search by kode atau nama customer
- [x] Filter per channel
- [x] Modal detail: info header + tabel item + tombol "Cetak Struk"
- [x] Transaksi Manual (input langsung, bukan dari kasir menu)

### Dashboard
- [x] Selector periode: Hari Ini / 7 Hari / Bulan Ini
- [x] Stat cards: omset, modal, untung, jumlah transaksi
- [x] Area chart tren omset & untung (Recharts)
- [x] Panel stok hampir habis (realtime)
- [x] Menu terlaris (top 5, bar chart)
- [x] Transaksi terbaru (5 terakhir)

### Laporan
- [x] Filter tanggal dari-sampai + shortcut Bulan Ini/Bulan Lalu
- [x] Stat cards periodik
- [x] Bar chart omset & untung harian
- [x] Pie chart omset per channel
- [x] Tabel performa menu
- [x] Export Excel (3 sheet: Ringkasan, Transaksi, Menu Terlaris)

### Login
- [x] Login dengan email + password (Supabase Auth)
- [x] Protected route — redirect ke `/login` jika belum auth
- [x] Logo login pakai `logo.png` dari `src/assets/element/logo.png` (RGBA transparan)
- [x] Tulisan "99Foods" di bawah logo dihapus
- [x] "Sistem khusus untuk pemilik 99Foods" → "BUMC 99Foods"

### Foto Profile
- [x] Klik avatar di pojok kanan atas Navbar → buka `AvatarUploader` modal
- [x] Pilih foto → drag&crop (react-easy-crop, aspect 1:1, crop area lingkaran) → upload ke `menu-images/avatars/{userId}.jpg` (overwrite)
- [x] URL disimpan di `user.user_metadata.avatar_url` via `supabase.auth.updateUser()` — tidak butuh tabel/RLS baru
- [x] Hapus foto: hapus object di storage + set metadata `avatar_url = null`
- [x] Navbar render `<img>` dari metadata, fallback ke inisial email

### Bug Fixes & Features
- [x] Fix `proses_transaksi` RPC — tabel `resep` baru tidak punya `bahan_id` → update untuk potong `menu.stok_menu` bukan `bahan_baku.stok`
- [x] Fix stok menu berkurang saat checkout — `proses_transaksi` sekarang update `menu.stok_menu` per `jumlah_porsi`
- [x] `supabase_migration.sql` sudah diupdate (tambah `CREATE OR REPLACE FUNCTION proses_transaksi` di akhir)

### Perubahan Logic Profit (Cash Basis)
- Label "Keuntungan Bersih" → **"Profit Bersih"** (di Laporan & Dashboard)
- Hitungan baru: **Profit Bersih = Omset - Pembelian Bahan** (HPP dari resep tidak dipakai untuk profit)
- Card Profit Bersih menampilkan sub-text: "omset - belanja bahan"
- Excel export Laporan: "Total Keuntungan Bersih" → "Profit Bersih"
- **Chart Tren (Dashboard & Laporan) pakai logic baru**: omset dari transaksi, modal dari pembelian_bahan, profit = omset - modal
- Dashboard realtime: `fetchStats()` fetch `pembelian_bahan` + kalkulasi baru
- Warning Stok: dari `menu.stok_menu < 5` (bukan `bahan_baku`)

### Stok Page
- Label: "Stok Makanan" (bukan "Stok & HPP") — hanya CRUD menu + stok porsi, fitur Resep/HPP dihapus
- Sidebar label: "Stok Makanan"

### StatCard Icons
- StatCard: `icon` prop sekarang accept string (path gambar `<img>`) atau function (lucide icon)
- Dashboard: Omset = `omsetlogo.png`, Modal = `modallogo.png`, Profit = `profitlogo.png`, Transaksi = `transaksilogo.png`
- Laporan: stat card custom pakai `<img>` langsung dengan path yang sama + `whitespace-nowrap` untuk angka

### Chart Customization
- Komponen baru: `src/components/ui/ChartSettings.jsx` (hook `useChartSettings`, panel settings inline, toggle button)
- Dashboard & Laporan: gear icon di pojok chart → buka panel dropdown (bukan portal overlay):
  - Tipe chart: Bar / Line / Area
  - Series toggle: Omset / Profit
  - Tema warna: Sage / Ocean / Sunset / Mono (4 tema)
  - Tinggi chart: 180 / 220 / 280 / 350 px
- Preferensi disimpan di localStorage (`charts:dashboard`, `charts:laporan`)
- Tombol reset ke default
- **Fix**: Hapus portal overlay `fixed inset-0` yang nge-block klik & bikin lag — panel sekarang inline dropdown di card (relative positioning), tidak pakai `createPortal` / overlay full-screen

### Mobile Responsive
- [x] Sidebar: `md:hidden` drawer + overlay (sudah ada)
- [x] CartPanel (KasirMenu): desktop floating box (`w-72`), mobile bottom bar + expandable bottom-sheet
- [x] ItemPopup / CheckoutModal / StrukModal: sudah bottom-sheet di mobile (`items-end sm:items-center`)
- [x] Modal component: semua modal jadi bottom-sheet di mobile (`items-end sm:items-center`, `rounded-t-2xl sm:rounded-xl`)
- [x] AvatarUploader & ImageCropper: bottom-sheet di mobile
- [x] Print CSS fix: `visibility: hidden` pada `body > *` + `visibility: visible` pada `.struk-print-area`
- [x] Filter tabs (Dashboard, Penjualan): `overflow-x-auto` + `scrollbar-thin` untuk horizontal scroll aman
- [x] Asset kompresi: `logo.png` 242×256 (79 KB), `logosidebar.png` 512×640 (146 KB)

---

## Hal yang Perlu Diperhatikan

### GitHub & Deploy
- **Repo**: https://github.com/OrganicoconutSugar/99FOODS (public)
- Push pertama berhasil: 49 files (1 commit "test push" + 1 commit "Initial commit: 99Foods Dashboard")
- **Deploy ke Vercel** (selanjutnya):
  1. Buka https://vercel.com/new
  2. Import `OrganicoconutSugar/99FOODS`
  3. Framework: Vite (auto-detect)
  4. **Environment Variables** (WAJIB untuk production):
     - `VITE_SUPABASE_URL` = URL project Supabase baru (bukan project test)
     - `VITE_SUPABASE_ANON_KEY` = Anon key project Supabase baru
  5. Deploy

### Supabase SQL yang WAJIB dijalankan
Jalankan `supabase_migration.sql` lengkap di SQL Editor sebelum pertama kali pakai. Mencakup:
1. Restruktur tabel `resep` (drop & recreate)
2. ALTER `pembelian_bahan.bahan_id` jadi nullable
3. ADD COLUMN `transaksi.nama_customer`
4. ADD COLUMN `menu.stok_menu`
5. CREATE OR REPLACE `hitung_hpp()`, `trigger_update_hpp_on_resep_change()`, `proses_transaksi()` (fix: potong stok_menu, tidak pakai bahan_id)
6. Storage policies untuk bucket `menu-images`
7. CREATE OR REPLACE `trigger_pembelian_bahan_insert()` (hanya update jika bahan_id diisi)

### Supabase Storage
- Buat bucket `menu-images` dengan Public = true
- Tambahkan 3 policy (INSERT/SELECT/DELETE) via SQL atau UI dashboard

### File Mati (sudah dihapus)
- `MenuResep.jsx`, `StokBahan.jsx` — diganti `KasirMenu.jsx` + `StokHPP.jsx`
- `ThemeContext.jsx` — dark mode sudah dihapus
- `Chatbot.jsx` — chatbot tidak berfungsi, file sudah dihapus dari `src/components/`
- `App.css` — CSS template Vite tidak dipakai
- `src/hooks/` — direktori kosong
- `public/favicon.svg`, `public/icons.svg` — tidak di-reference
- `src/assets/hero.png`, `src/assets/react.svg`, `src/assets/vite.svg` — tidak dipakai
- `src/assets/logo.png` — duplikat dari `src/assets/element/logo.png`
- `utils/format.js` — `formatAngka` & `konversiSatuan` tidak terpakai

---

## Yang Belum / Bisa Dikembangkan

- [ ] Aktivasi potongan komisi ojek online (GoFood/GrabFood) saat 99Foods sudah terdaftar
- [ ] Notifikasi stok via WhatsApp/Telegram bot
- [ ] Manajemen pre-order terintegrasi
- [ ] Upload foto via kamera HP (mobile)
- [ ] Paging/infinite scroll untuk tabel transaksi banyak data
- [ ] Edit transaksi yang sudah dibuat
- [ ] Hapus transaksi (saat ini tidak ada tombol hapus di Penjualan)

---

## Catatan Penting

- **Satuan pembelian bahan** tersedia: gram, kg, ml, liter, pcs, butir, pack
- **HPP dihitung otomatis** dari resep via PostgreSQL trigger — tidak perlu hitung manual
- **Stok porsi menu** (`stok_menu`) adalah stok manual yang diisi owner — berbeda dengan stok bahan baku
- **Nama customer** bersifat opsional di semua form transaksi
- **Cetak struk** menggunakan `window.print()` dengan CSS `@media print` — cocok untuk thermal printer 80mm
- **Build production** sudah diverifikasi berjalan tanpa error (`npm run build`)
- **Blank screen fix**: ErrorBoundary + global handlers, fixed port 5173, verified headless Chrome render OK

### GitHub & Vercel
- Repo: https://github.com/OrganicoconutSugar/99FOODS
- Push pertama (commit `d8fe274`): 49 files
- Push README (commit `08851a3`): README.md lengkap dengan flowchart ASCII, branding logo, schema DB
- Classic PAT `ghp_mkoNeGac...` berhasil (fine-grained PAT sebelumnya ditolak 403 karena tidak ada scope `Contents: Write`)
- **Deploy Vercel** (sedang dilakukan user): import repo, framework Vite, env vars `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`

### README.md (GitHub)
- Hero section dengan logo sidebar embedded dari raw GitHub URL
- 5 badge tech stack (React, Vite, Tailwind, Supabase, License)
- Flowchart ASCII alur aplikasi lengkap
- Tabel 6 logo file branding (logo, logosidebar, omset, profit, modal, transaksi)
- Schema DB diagram ASCII untuk 8 tabel
- Setup section: local dev, build production, deploy Vercel
- Logic bisnis: Profit Bersih (cash basis), Modal Terpakai, HPP auto, Stok auto-decrement
- Known issues / future work roadmap
- Footer link ke `session.md`
