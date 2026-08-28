-- ============================================================
-- 99Foods Dashboard — RESET DATA UJI COBA
-- Akun login TETAP AMAN (hanya data transaksional yang dihapus)
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- Urutan: hapus child dulu, baru parent (untuk avoid FK error)
TRUNCATE TABLE transaksi_detail      RESTART IDENTITY CASCADE;
TRUNCATE TABLE transaksi             RESTART IDENTITY CASCADE;
TRUNCATE TABLE pembelian_bahan       RESTART IDENTITY CASCADE;
TRUNCATE TABLE pengeluaran_operasional RESTART IDENTITY CASCADE;
TRUNCATE TABLE resep                 RESTART IDENTITY CASCADE;
TRUNCATE TABLE menu                  RESTART IDENTITY CASCADE;
TRUNCATE TABLE bahan_baku            RESTART IDENTITY CASCADE;
TRUNCATE TABLE riwayat_harga_bahan   RESTART IDENTITY CASCADE;

-- Reset stok_menu (NULL = tidak pakai sistem stok)
UPDATE menu SET stok_menu = NULL;

-- ============================================================
-- Storage: tidak bisa dihapus lewat SQL (Supabase policy).
-- Hapus lewat dashboard:
--   1. Storage → menu-images → pilih semua file → Delete
--   2. Authentication → Users → klik user → User Metadata → hapus key "avatar_url"
-- ============================================================
