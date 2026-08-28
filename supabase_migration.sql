-- ============================================================
-- Migration: Ubah struktur tabel resep dan pembelian_bahan
-- Jalankan file ini di Supabase SQL Editor
-- ============================================================

-- 1. Drop tabel resep lama dan buat ulang dengan struktur baru
--    (bahan_id dihilangkan, diganti nama_bahan teks bebas + harga_per_satuan)
DROP TABLE IF EXISTS resep CASCADE;

CREATE TABLE resep (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id          UUID NOT NULL REFERENCES menu(id) ON DELETE CASCADE,
  nama_bahan       TEXT NOT NULL,
  jumlah           NUMERIC(12,3) NOT NULL,
  satuan           TEXT NOT NULL,
  harga_per_satuan NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- RLS untuk tabel resep baru
ALTER TABLE resep ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_full_access" ON resep FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Buat ulang function hitung_hpp (pakai harga di resep, bukan dari bahan_baku)
CREATE OR REPLACE FUNCTION hitung_hpp(p_menu_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_hpp NUMERIC := 0;
BEGIN
  SELECT COALESCE(SUM(r.jumlah * r.harga_per_satuan), 0)
  INTO v_hpp
  FROM resep r
  WHERE r.menu_id = p_menu_id;
  RETURN v_hpp;
END;
$$ LANGUAGE plpgsql;

-- 3. Hapus trigger lama yang tidak relevan
DROP TRIGGER IF EXISTS trg_update_hpp_bahan ON bahan_baku;
DROP FUNCTION IF EXISTS trigger_update_hpp_on_bahan_change CASCADE;
DROP FUNCTION IF EXISTS update_hpp_menu_by_bahan CASCADE;

-- 4. Buat ulang trigger update HPP saat resep berubah
CREATE OR REPLACE FUNCTION trigger_update_hpp_on_resep_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE menu SET hpp = hitung_hpp(OLD.menu_id), updated_at = NOW() WHERE id = OLD.menu_id;
  ELSE
    UPDATE menu SET hpp = hitung_hpp(NEW.menu_id), updated_at = NOW() WHERE id = NEW.menu_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_hpp_resep ON resep;
CREATE TRIGGER trg_update_hpp_resep
  AFTER INSERT OR UPDATE OR DELETE ON resep
  FOR EACH ROW EXECUTE FUNCTION trigger_update_hpp_on_resep_change();

-- 5. Ubah kolom bahan_id di pembelian_bahan jadi nullable
ALTER TABLE pembelian_bahan ALTER COLUMN bahan_id DROP NOT NULL;

-- 6. Update trigger pembelian_bahan (hanya update stok jika bahan_id diisi)
CREATE OR REPLACE FUNCTION trigger_pembelian_bahan_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.bahan_id IS NOT NULL THEN
    UPDATE bahan_baku
      SET stok = stok + NEW.jumlah,
          harga_per_satuan = NEW.harga_per_satuan,
          updated_at = NOW()
      WHERE id = NEW.bahan_id;
    INSERT INTO riwayat_harga_bahan (bahan_id, harga_per_satuan, tanggal)
    VALUES (NEW.bahan_id, NEW.harga_per_satuan, NEW.tanggal);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FIX: Hapus menu gagal karena ada referensi di transaksi_detail
-- Tambahkan ON DELETE SET NULL agar hapus menu tidak terblokir
-- ============================================================

-- Cek apakah ada foreign key dari transaksi_detail ke menu
-- Jika ada, ubah jadi SET NULL supaya hapus menu tidak terblokir

ALTER TABLE transaksi_detail
  DROP CONSTRAINT IF EXISTS transaksi_detail_menu_id_fkey;

ALTER TABLE transaksi_detail
  ADD CONSTRAINT transaksi_detail_menu_id_fkey
  FOREIGN KEY (menu_id) REFERENCES menu(id) ON DELETE SET NULL;

-- ============================================================
-- Tambah kolom stok_menu dan gambar_url ke tabel menu
-- (stok_menu = stok porsi yang tersedia, nullable = tidak dipakai)
-- ============================================================
ALTER TABLE menu ADD COLUMN IF NOT EXISTS stok_menu INTEGER DEFAULT NULL;
ALTER TABLE menu ADD COLUMN IF NOT EXISTS gambar_url TEXT DEFAULT NULL;

-- ============================================================
-- Storage Policy: izinkan user authenticated upload/baca foto menu
-- ============================================================

-- Hapus policy lama kalau sudah ada (agar bisa dijalankan ulang)
DROP POLICY IF EXISTS "authenticated can upload menu images" ON storage.objects;
DROP POLICY IF EXISTS "public can read menu images"          ON storage.objects;
DROP POLICY IF EXISTS "authenticated can delete menu images" ON storage.objects;

-- Upload: hanya user yang sudah login
CREATE POLICY "authenticated can upload menu images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'menu-images');

-- Baca: semua orang boleh (public bucket)
CREATE POLICY "public can read menu images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'menu-images');

-- Hapus: hanya user yang sudah login
CREATE POLICY "authenticated can delete menu images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'menu-images');

-- ============================================================
-- Tambah kolom nama_customer ke tabel transaksi
-- ============================================================
ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS nama_customer TEXT DEFAULT NULL;

-- ============================================================
-- Fix: Update function proses_transaksi
-- Karena resep tidak punya bahan_id lagi, ganti logic:
--   - Potong menu.stok_menu untuk setiap item yang dibeli
--   - Hitung total_omset & total_modal dari subtotal
-- ============================================================
CREATE OR REPLACE FUNCTION proses_transaksi(p_transaksi_id UUID)
RETURNS VOID AS $$
DECLARE
  v_detail RECORD;
BEGIN
  -- Kurangi stok_menu untuk tiap detail transaksi
  FOR v_detail IN
    SELECT menu_id, jumlah_porsi FROM transaksi_detail WHERE transaksi_id = p_transaksi_id
  LOOP
    UPDATE menu
      SET stok_menu = CASE
        WHEN stok_menu IS NULL THEN NULL
        ELSE GREATEST(stok_menu - v_detail.jumlah_porsi, 0)
      END,
      updated_at = NOW()
    WHERE id = v_detail.menu_id;
  END LOOP;

  -- Update total omset & modal di header transaksi
  UPDATE transaksi SET
    total_omset = COALESCE((SELECT SUM(subtotal_omset) FROM transaksi_detail WHERE transaksi_id = p_transaksi_id), 0),
    total_modal = COALESCE((SELECT SUM(subtotal_modal) FROM transaksi_detail WHERE transaksi_id = p_transaksi_id), 0)
  WHERE id = p_transaksi_id;
END;
$$ LANGUAGE plpgsql;
