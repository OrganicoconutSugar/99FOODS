<div align="center">

# 🍔 99Foods Dashboard

### Sistem Manajemen Kasir & Keuangan untuk Usaha Kuliner

<img src="https://raw.githubusercontent.com/OrganicoconutSugar/99FOODS/main/src/assets/element/logosidebar.png" alt="99Foods Logo" width="180" />

**Kasir modern, stok real-time, laporan keuangan otomatis.**

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-Private-FF6B6B)](LICENSE)

[Demo](#-demo) • [Fitur](#-fitur-utama) • [Tech Stack](#-tech-stack) • [Setup](#-setup--deployment) • [Database](#-database-schema)

</div>

---

## 📋 Tentang Project

**99Foods Dashboard** adalah aplikasi Point-of-Sale (POS) + manajemen inventori + laporan keuangan, dirancang khusus untuk usaha kuliner kecil-menengah. Owner bisa:

- 🛒 **Catat pesanan** dari menu makanan (Dimsum, Cireng, Minuman, dll)
- 📊 **Pantau penjualan** real-time via Dashboard
- 💰 **Hitung Profit otomatis** (Omset − Belanja Bahan)
- 🖨️ **Cetak struk thermal** 80mm ke Bluetooth printer
- 📈 **Export laporan Excel** untuk pembukuan

Cocok untuk: warung Dimsum, Cireng, snack, minuman, atau usaha kuliner dengan katalog menu ≤ 100 item.

---

## 🎯 Alur Aplikasi (Flowchart)

```
┌─────────────────────────────────────────────────────────────┐
│                    🚪  AUTHENTICATION                         │
│              Email + Password via Supabase Auth               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  🏠  DASHBOARD  (Home)                          │
│  ┌──────────┬──────────┬──────────┬──────────┐               │
│  │ 💰 Omset │ 📦 Modal │ 💎 Profit│ 🧾 Trans │               │
│  │ (omset)  │ (belanja)│ (omset-  │ (count)  │               │
│  │          │  bahan   │  modal)  │          │               │
│  └──────────┴──────────┴──────────┴──────────┘               │
│  ┌─────────────────────────┬───────────────────┐            │
│  │ 📈 Tren Omset & Profit  │ ⚠️ Stok < 5       │            │
│  │ (AreaChart customizable) │ (realtime)        │            │
│  └─────────────────────────┴───────────────────┘            │
│  ┌─────────────────────────┬───────────────────┐            │
│  │ 🏆 Menu Terlaris         │ 🕒 Transaksi Baru │            │
│  └─────────────────────────┴───────────────────┘            │
└────────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┬──────────────┐
        ▼            ▼            ▼              ▼
┌─────────────┐ ┌──────────┐ ┌────────────┐ ┌──────────┐
│ 🛒  KASIR    │ │ 📦 STOK   │ │ 💸 PEMBELIAN│ │ 🧾 PENJUAL│
│  (Menu)      │ │ (Stok     │ │   BAHAN     │ │  AN      │
│              │ │  Makanan) │ │             │ │          │
├─────────────┤ ├──────────┤ ├────────────┤ ├──────────┤
│ • Grid menu  │ │ • CRUD    │ │ • Tab Bahan │ │ • Tabel  │
│   + foto     │ │   menu   │ │   Baku     │ │   history│
│ • Cart       │ │ • Upload │ │ • Tab Ops   │ │ • Filter │
│   floating   │ │   foto   │ │ • Hapus     │ │   channel│
│ • Checkout   │ │ • Stok    │ │   catatan  │ │ • Detail │
│   modal      │ │   porsi  │ │             │ │   modal  │
│ • Cetak struk│ │          │ │             │ │ • Manual │
│   thermal    │ │          │ │             │ │   trans  │
└──────┬──────┘ └──────────┘ └────────────┘ └──────────┘
       │
       ▼
┌──────────────────────────────┐
│   🖨️  CETAK STRUK (80mm)       │
│   • Preview struk di modal     │
│   • Tombol "Cetak Struk"      │
│   • window.print() → thermal   │
│   • Logo + Kode + Item + Total │
└──────────────┬───────────────┘
              │
              ▼
┌──────────────────────────────┐
│    📊  LAPORAN & ANALITIK      │
│  ┌──────────────────────────┐ │
│  │ Filter: Dari – Sampai    │ │
│  │ Shortcut: Bulan Ini/Lalu│ │
│  └──────────────────────────┘ │
│  ┌──────┬──────┬──────┬─────┐│
│  │Omset │Modal │Profit│Exp ││
│  └──────┴──────┴──────┴─────┘│
│  ┌──────────────────────────┐ │
│  │ 📈 Chart Customize:      │ │
│  │   • Bar / Line / Area     │ │
│  │   • 4 Tema warna          │ │
│  │   • Series toggle         │ │
│  │   • LocalStorage persist  │ │
│  └──────────────────────────┘ │
│  ┌──────────┬───────────────┐│
│  │🥧Channel │🏆Performa Menu││
│  │  Pie     │   Table       ││
│  └──────────┴───────────────┘│
│  ┌──────────────────────────┐ │
│  │  📥 Export Excel (3 sheet) │ │
│  │  • Ringkasan              │ │
│  │  • Transaksi              │ │
│  │  • Menu Terlaris          │ │
│  └──────────────────────────┘ │
└──────────────────────────────┘
```

---

## ✨ Fitur Utama

### 🛒 Kasir (Menu)
- Grid kartu menu dengan foto, harga, badge stok
- Filter kategori (Dimsum, Cireng, Minuman, Lainnya) + search
- Klik menu → popup qty dengan validasi stok realtime
- **Cart floating**: desktop box / mobile bottom-bar + bottom-sheet
- Checkout modal: input nama customer, channel bayar (Tunai/QRIS/Ojek Online)
- **Cetak struk thermal 80mm** via `window.print()`

### 📦 Stok Makanan
- CRUD menu (nama, kategori, harga, stok porsi, aktif)
- Upload foto dengan drag & crop (react-easy-crop)
- Image sudah otomatis dikompres (logo bubble 79 KB, sidebar 146 KB)

### 💸 Pembelian Bahan & Operasional
- Tab **Bahan Baku**: input nama bebas, jumlah, satuan, harga
- Tab **Operasional**: Gas, Kemasan, Listrik, Transportasi, dll
- Hapus catatan (muncul saat hover)

### 🧾 Penjualan
- Tabel riwayat: kode, tanggal, customer, channel, omset, modal, untung
- Search by kode/nama customer, filter per channel
- Modal detail transaksi + cetak struk ulang
- **Transaksi Manual** (input langsung tanpa kasir)

### 📈 Dashboard Real-time
- Periode: Hari Ini / 7 Hari / Bulan Ini
- 4 stat card custom dengan logo khusus per metrik
- Chart tren Omset & Profit (customizable: tipe/tema/series/tinggi)
- Panel warning **Stok < 5** (realtime dari `menu.stok_menu`)
- Top 5 menu terlaris + 5 transaksi terbaru

### 📊 Laporan & Analitik
- Filter tanggal (Dari–Sampai) + shortcut Bulan Ini/Bulan Lalu
- Stat card Omset, Modal Terpakai (pembelian bahan), Profit Bersih, Pengeluaran
- Bar/Pie chart dengan **customization**:
  - **4 Tema Warna**: Sage 🌿, Ocean 🌊, Sunset 🌅, Mono 🖤
  - **3 Tipe Chart**: Bar / Line / Area
  - **Series Toggle**: Omset / Profit (minimal 1 aktif)
  - **Tinggi Chart**: Pendek / Sedang / Tinggi / Sangat Tinggi
  - **LocalStorage persistence** per user
- **Export Excel** 3 sheet: Ringkasan, Transaksi, Menu Terlaris

### 👤 Profil & Autentikasi
- Login email + password (Supabase Auth)
- Avatar upload: drag & crop, simpan ke Storage `menu-images/avatars/{userId}.jpg`
- Avatar sync via `user_metadata.avatar_url` (no extra table needed)

### 📱 Mobile Responsive
- Sidebar jadi drawer di mobile
- Cart jadi bottom-bar dengan expand
- Semua modal jadi bottom-sheet di mobile
- Print CSS pakai `visibility: hidden` (bukan `display: none`) supaya struk print aman

---

## 🛠️ Tech Stack

### Frontend
| Tech | Kegunaan |
|------|----------|
| **React 18** | UI library dengan hooks + StrictMode |
| **Vite 5** | Build tool (HMR super cepat) |
| **React Router 6** | SPA routing (`/login`, `/`, `/menu`, dst) |
| **Tailwind CSS 3** | Utility-first CSS (sage green palette) |
| **Recharts 2** | Chart (Area, Bar, Line, Pie) |
| **Lucide React** | Icon (TrendingUp, ShoppingBag, dll) |
| **React Easy Crop** | Image crop modal (avatar & menu) |
| **React Hot Toast** | Notifikasi |
| **date-fns** | Date formatting (id-ID locale) |
| **xlsx** | Export Excel |

### Backend (Supabase)
| Service | Kegunaan |
|---------|----------|
| **PostgreSQL** | Database (8 tabel) |
| **Auth** | Email + password login |
| **Storage** | Bucket `menu-images` (foto menu + avatar) |
| **Realtime** | Subscribe perubahan data (stok, transaksi) |
| **RPC Functions** | `hitung_hpp()`, `proses_transaksi()` |

---

## 💾 Database Schema

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│    menu      │       │    resep     │       │  bahan_baku  │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id           │←──┐   │ id           │   ┌──→│ id           │
│ nama         │   │   │ menu_id      │───┘   │ nama         │
│ kategori     │   │   │ nama_bahan   │       │ satuan       │
│ harga_jual   │   │   │ jumlah       │       │ stok         │
│ hpp (auto)   │   │   │ satuan       │       │ stok_minimum │
│ stok_menu    │   │   │ harga_per_   │       │ harga_per_   │
│ gambar_url   │   │   │   satuan     │       │   satuan     │
│ aktif        │   │   └──────────────┘       └──────┬───────┘
└──────┬───────┘   │                                  │
       │           │                                  │
       │           │   ┌──────────────────┐           │
       │           │   │ pembelian_bahan    │←─────────┘
       │           │   ├──────────────────┤
       │           │   │ nama_bahan         │
       │           │   │ jumlah, satuan     │
       │           │   │ harga_per_satuan   │
       │           │   │ total (generated)  │
       │           │   │ tanggal             │
       │           │   └──────────────────┘
       │           │
       │           │   ┌──────────────────────┐
       │           │   │pengeluaran_operasional│
       │           │   ├──────────────────────┤
       │           │   │ keterangan, kategori  │
       │           │   │ jumlah, tanggal       │
       │           │   └──────────────────────┘
       │           │
       │           │   ┌──────────────┐
       │           │   │  transaksi    │
       │           │   ├──────────────┤
       │           │   │ kode (unik)   │
       │           │   │ tanggal       │
       │           │   │ channel       │
       │           │   │ nama_customer │
       │           │   │ total_omset   │  ←──┐
       │           │   │ total_modal   │←───┤
       │           │   │ total_untung  │←───┤
       │           │   └──────┬───────┘    │
       │           │          │            │
       │           │          ▼            │
       │           │   ┌──────────────────┐  │
       └───────────┴──→│transaksi_detail   │  │
                       ├──────────────────┤  │
                       │ menu_id (FK)     │  │
                       │ nama_menu        │  │
                       │ jumlah_porsi     │  │
                       │ harga_jual       │──┘
                       │ hpp              │
                       │ subtotal_omset   │  (generated)
                       │ subtotal_modal   │  (generated)
                       └──────────────────┘
```

**Trigger & Function penting:**
- `hitung_hpp(menu_id)` → Σ `resep.jumlah × resep.harga_per_satuan`
- `trigger_update_hpp_on_resep_change` → auto-update `menu.hpp` saat resep berubah
- `proses_transaksi(transaksi_id)` → potong `menu.stok_menu` + hitung total omset/modal

---

## 🎨 Branding & Logo

| File | Ukuran | Kegunaan |
|------|--------|----------|
| ![Logo](https://raw.githubusercontent.com/OrganicoconutSugar/99FOODS/main/src/assets/element/logo.png) `logo.png` | 242×256 | Favicon + Login page |
| ![Sidebar](https://raw.githubusercontent.com/OrganicoconutSugar/99FOODS/main/src/assets/element/logosidebar.png) `logosidebar.png` | 512×640 | Sidebar header |
| ![Omset](https://raw.githubusercontent.com/OrganicoconutSugar/99FOODS/main/src/assets/element/omsetlogo.png) `omsetlogo.png` | – | Stat card Omset |
| ![Profit](https://raw.githubusercontent.com/OrganicoconutSugar/99FOODS/main/src/assets/element/profitlogo.png) `profitlogo.png` | – | Stat card Profit |
| ![Modal](https://raw.githubusercontent.com/OrganicoconutSugar/99FOODS/main/src/assets/element/modallogo.png) `modallogo.png` | – | Stat card Modal |
| ![Transaksi](https://raw.githubusercontent.com/OrganicoconutSugar/99FOODS/main/src/assets/element/transaksilogo.png) `transaksilogo.png` | – | Stat card Transaksi |

**Palette Warna:**
- Primary: `#5c835c` (Sage Green 500)
- Background: `#fafaf9` (Stone 50)
- Light: `#f4f7f4` (Sage 50)
- Dark: `#324532` (Sage 800)

---

## 🚀 Setup & Deployment

### Prerequisites
- Node.js 18+
- npm / pnpm / yarn
- Akun Supabase (free tier OK)

### Local Development
```bash
# 1. Clone
git clone https://github.com/OrganicoconutSugar/99FOODS.git
cd 99FOODS

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env
# Edit .env — isi VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY

# 4. Run database migration di Supabase SQL Editor
#    (paste isi supabase_migration.sql)

# 5. Create bucket 'menu-images' di Supabase Storage (Public)

# 6. Run dev server
npm run dev
# → http://localhost:5173
```

### Production Build
```bash
npm run build      # → dist/
npm run preview    # preview production build
```

### Deploy ke Vercel
1. Buka https://vercel.com/new
2. Import repo `OrganicoconutSugar/99FOODS`
3. Framework preset: **Vite** (auto-detect)
4. **Environment Variables** (WAJIB):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy → dapat domain `*.vercel.app`

---

## 📁 Struktur Project

```
99FOODS/
├── .env.example              ← Template env vars (JANGAN commit .env!)
├── .gitignore
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js        ← Palette custom: sage
├── vite.config.js            ← Port 5173 fix
│
├── supabase_schema.sql       ← Schema awal (referensi)
├── supabase_migration.sql    ← ALTER/TRIGGER/RPC after schema awal
├── supabase_reset.sql        ← TRUNCATE data uji coba (akun aman)
├── session.md                ← Catatan teknis & progres project
│
└── src/
    ├── App.jsx               ← Routing + AuthProvider + ErrorBoundary
    ├── main.jsx              ← Global error handlers
    ├── index.css             ← Tailwind + print CSS + animasi
    │
    ├── lib/
    │   └── supabase.js       ← Supabase client
    │
    ├── context/
    │   └── AuthContext.jsx   ← login/uploadAvatar/removeAvatar
    │
    ├── utils/
    │   └── format.js         ← formatRupiah, formatTanggal, generateKodeTransaksi
    │
    ├── components/
    │   ├── layout/
    │   │   ├── AppLayout.jsx
    │   │   ├── Sidebar.jsx
    │   │   └── Navbar.jsx
    │   │
    │   └── ui/
    │       ├── AvatarUploader.jsx
    │       ├── Badge.jsx
    │       ├── Button.jsx
    │       ├── Card.jsx
    │       ├── ChartSettings.jsx    ← 4 tema, 3 tipe chart
    │       ├── ErrorBoundary.jsx
    │       ├── ImageCropper.jsx
    │       ├── Input.jsx
    │       ├── Modal.jsx
    │       ├── Select.jsx
    │       ├── StatCard.jsx
    │       └── StrukPrint.jsx      ← Cetak thermal 80mm
    │
    └── pages/
        ├── Login.jsx
        ├── Dashboard.jsx
        ├── KasirMenu.jsx
        ├── StokHPP.jsx        ← "Stok Makanan"
        ├── PembelianBahan.jsx
        ├── Penjualan.jsx
        └── Laporan.jsx
```

---

## 📐 Routing

| Path | Page | Deskripsi |
|------|------|-----------|
| `/login` | `Login` | Login owner |
| `/` | `Dashboard` | Ringkasan keuangan + chart + stok |
| `/menu` | `KasirMenu` | Kasir board (pilih menu → cart → struk) |
| `/stok` | `StokHPP` | Manajemen menu & stok |
| `/pembelian` | `PembelianBahan` | Catat beli bahan & operasional |
| `/penjualan` | `Penjualan` | Riwayat transaksi + cetak struk |
| `/laporan` | `Laporan` | Laporan periodik + export Excel |

---

## 📜 Scripts

| Command | Fungsi |
|---------|--------|
| `npm run dev` | Jalankan dev server (port 5173) |
| `npm run build` | Build production → `dist/` |
| `npm run preview` | Preview production build |

---

## 🧮 Logika Bisnis

### Profit Bersih (Cash Basis)
```
Profit Bersih = Total Omset − Total Pembelian Bahan
```
Bukan akrual (tidak hitung inventory), tapi cocok untuk usaha kecil yang ingin tahu cash flow harian.

### Modal Terpakai
```
Modal Terpakai = SUM(pembelian_bahan.total) — dalam periode
```
Total belanja bahan baku (cash basis), bukan HPP per porsi.

### HPP (di tabel)
```
HPP per menu = SUM(resep.jumlah × resep.harga_per_satuan)
```
Auto-update via trigger saat resep INSERT/UPDATE/DELETE.

### Stok Menu Berkurang Otomatis
Saat checkout → `proses_transaksi()` kurangi `menu.stok_menu` per `jumlah_porsi`.

---

## 🐛 Known Issues / Future Work

- [ ] Aktivasi potongan komisi ojek online (GoFood/GrabFood)
- [ ] Notifikasi stok via WhatsApp/Telegram bot
- [ ] Manajemen pre-order terintegrasi
- [ ] Upload foto via kamera HP (mobile)
- [ ] Paging/infinite scroll untuk tabel transaksi banyak data
- [ ] Edit transaksi yang sudah dibuat
- [ ] Hapus transaksi di Penjualan

---

## 📝 Catatan Pengembang

Lihat [`session.md`](./session.md) untuk catatan teknis lengkap:
- Sejarah perubahan
- Bug fixes & refactoring
- Logic changes (Modal Terpakai, Profit Bersih)
- Cara pakai `supabase_reset.sql` (TRUNCATE data, akun aman)
- Cara pakai `reset_storage.js` (hapus foto via browser console)

---

<div align="center">

### ⭐ Kalau project ini membantu, kasih star di GitHub ya!

**BUMC 99Foods** — *Sistem khusus untuk pemilik 99Foods*

[🐛 Report Bug](https://github.com/OrganicoconutSugar/99FOODS/issues) · [✨ Request Feature](https://github.com/OrganicoconutSugar/99FOODS/issues) · [📖 Baca session.md](./session.md)

</div>
