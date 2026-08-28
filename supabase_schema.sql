-- ============================================================
-- 99Foods Dashboard — Supabase Schema
-- Jalankan file ini di Supabase SQL Editor
-- ============================================================

-- 1. BAHAN BAKU
CREATE TABLE IF NOT EXISTS bahan_baku (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama          TEXT NOT NULL,
  satuan        TEXT NOT NULL,          -- gram, kg, ml, liter, pcs
  stok          NUMERIC(12,3) NOT NULL DEFAULT 0,
  stok_minimum  NUMERIC(12,3) NOT NULL DEFAULT 0,
  harga_per_satuan NUMERIC(12,2) NOT NULL DEFAULT 0,  -- harga terbaru
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2. MENU
CREATE TABLE IF NOT EXISTS menu (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama          TEXT NOT NULL,
  kategori      TEXT NOT NULL DEFAULT 'Dimsum',
  harga_jual    NUMERIC(12,2) NOT NULL DEFAULT 0,
  hpp           NUMERIC(12,2) NOT NULL DEFAULT 0,   -- dihitung otomatis
  aktif         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RESEP (bahan per menu — nama bahan diketik bebas, tidak harus dari tabel bahan_baku)
CREATE TABLE IF NOT EXISTS resep (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id       UUID NOT NULL REFERENCES menu(id) ON DELETE CASCADE,
  nama_bahan    TEXT NOT NULL,           -- diketik bebas oleh owner
  jumlah        NUMERIC(12,3) NOT NULL,
  satuan        TEXT NOT NULL,
  harga_per_satuan NUMERIC(12,2) NOT NULL DEFAULT 0  -- untuk hitung HPP manual
);

-- 4. PEMBELIAN BAHAN BAKU (pengeluaran bahan)
CREATE TABLE IF NOT EXISTS pembelian_bahan (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bahan_id      UUID REFERENCES bahan_baku(id),   -- nullable, input bebas
  nama_bahan    TEXT NOT NULL,
  jumlah        NUMERIC(12,3) NOT NULL,
  satuan        TEXT NOT NULL,
  harga_per_satuan NUMERIC(12,2) NOT NULL,
  total         NUMERIC(12,2) GENERATED ALWAYS AS (jumlah * harga_per_satuan) STORED,
  tanggal       DATE NOT NULL DEFAULT CURRENT_DATE,
  catatan       TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PENGELUARAN OPERASIONAL (non-bahan: gas, kemasan, listrik, dll)
CREATE TABLE IF NOT EXISTS pengeluaran_operasional (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keterangan    TEXT NOT NULL,
  kategori      TEXT NOT NULL DEFAULT 'Operasional', -- Gas, Kemasan, Listrik, dll
  jumlah        NUMERIC(12,2) NOT NULL,
  tanggal       DATE NOT NULL DEFAULT CURRENT_DATE,
  catatan       TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TRANSAKSI PENJUALAN (header)
CREATE TABLE IF NOT EXISTS transaksi (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kode          TEXT UNIQUE NOT NULL,
  tanggal       DATE NOT NULL DEFAULT CURRENT_DATE,
  channel       TEXT NOT NULL DEFAULT 'Tunai',  -- Tunai, QRIS, Ojek Online
  total_omset   NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_modal   NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_untung  NUMERIC(12,2) GENERATED ALWAYS AS (total_omset - total_modal) STORED,
  catatan       TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 7. DETAIL TRANSAKSI PENJUALAN
CREATE TABLE IF NOT EXISTS transaksi_detail (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaksi_id  UUID NOT NULL REFERENCES transaksi(id) ON DELETE CASCADE,
  menu_id       UUID NOT NULL REFERENCES menu(id),
  nama_menu     TEXT NOT NULL,           -- denormalisasi
  jumlah_porsi  INTEGER NOT NULL,
  harga_jual    NUMERIC(12,2) NOT NULL,
  hpp           NUMERIC(12,2) NOT NULL,
  subtotal_omset NUMERIC(12,2) GENERATED ALWAYS AS (jumlah_porsi * harga_jual) STORED,
  subtotal_modal NUMERIC(12,2) GENERATED ALWAYS AS (jumlah_porsi * hpp) STORED,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 8. RIWAYAT HARGA BAHAN BAKU
CREATE TABLE IF NOT EXISTS riwayat_harga_bahan (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bahan_id      UUID NOT NULL REFERENCES bahan_baku(id),
  harga_per_satuan NUMERIC(12,2) NOT NULL,
  tanggal       DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Function: hitung HPP menu berdasarkan resep (harga per satuan di-input manual)
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

-- Function: update HPP menu (dipanggil setelah resep diubah)
CREATE OR REPLACE FUNCTION update_hpp_menu(p_menu_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE menu SET hpp = hitung_hpp(p_menu_id), updated_at = NOW()
  WHERE id = p_menu_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger: saat resep diubah → update HPP menu terkait
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

-- Function: proses transaksi penjualan (potong stok + catat modal)
CREATE OR REPLACE FUNCTION proses_transaksi(
  p_transaksi_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_detail RECORD;
  v_resep  RECORD;
BEGIN
  -- Loop tiap detail transaksi
  FOR v_detail IN
    SELECT * FROM transaksi_detail WHERE transaksi_id = p_transaksi_id
  LOOP
    -- Loop tiap bahan dalam resep menu
    FOR v_resep IN
      SELECT * FROM resep WHERE menu_id = v_detail.menu_id
    LOOP
      -- Kurangi stok bahan
      UPDATE bahan_baku
        SET stok = stok - (v_resep.jumlah * v_detail.jumlah_porsi),
            updated_at = NOW()
        WHERE id = v_resep.bahan_id;
    END LOOP;
  END LOOP;

  -- Update total omset & modal di header transaksi
  UPDATE transaksi SET
    total_omset = (SELECT SUM(subtotal_omset) FROM transaksi_detail WHERE transaksi_id = p_transaksi_id),
    total_modal = (SELECT SUM(subtotal_modal) FROM transaksi_detail WHERE transaksi_id = p_transaksi_id)
  WHERE id = p_transaksi_id;
END;
$$ LANGUAGE plpgsql;

-- Function: saat pembelian bahan → catat saja (tidak update stok bahan_baku karena input bebas)
-- Stok bahan_baku dikelola manual via halaman Stok Bahan Baku
CREATE OR REPLACE FUNCTION trigger_pembelian_bahan_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Jika bahan_id diisi (opsional), tambah stok dan simpan riwayat harga
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

DROP TRIGGER IF EXISTS trg_pembelian_bahan ON pembelian_bahan;
CREATE TRIGGER trg_pembelian_bahan
  AFTER INSERT ON pembelian_bahan
  FOR EACH ROW EXECUTE FUNCTION trigger_pembelian_bahan_insert();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE bahan_baku               ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE resep                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pembelian_bahan          ENABLE ROW LEVEL SECURITY;
ALTER TABLE pengeluaran_operasional  ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaksi                ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaksi_detail         ENABLE ROW LEVEL SECURITY;
ALTER TABLE riwayat_harga_bahan      ENABLE ROW LEVEL SECURITY;

-- Policy: hanya user yang login (authenticated) bisa akses semua
CREATE POLICY "authenticated_full_access" ON bahan_baku              FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON menu                    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON resep                   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON pembelian_bahan         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON pengeluaran_operasional FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON transaksi               FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON transaksi_detail        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON riwayat_harga_bahan     FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- SEED DATA CONTOH (opsional, hapus jika tidak perlu)
-- ============================================================
INSERT INTO bahan_baku (nama, satuan, stok, stok_minimum, harga_per_satuan) VALUES
  ('Kulit Dimsum', 'pcs', 500, 100, 250),
  ('Daging Ayam Cincang', 'gram', 2000, 500, 30),
  ('Udang Cincang', 'gram', 1000, 300, 60),
  ('Wortel', 'gram', 800, 200, 8),
  ('Tepung Tapioka', 'gram', 3000, 500, 10),
  ('Bumbu Cireng', 'gram', 500, 100, 15),
  ('Minyak Goreng', 'ml', 3000, 500, 20),
  ('Gas 3kg', 'pcs', 2, 1, 22000)
ON CONFLICT DO NOTHING;

INSERT INTO menu (nama, kategori, harga_jual) VALUES
  ('Dimsum Ayam (5pcs)', 'Dimsum', 15000),
  ('Dimsum Udang (5pcs)', 'Dimsum', 18000),
  ('Cireng Bumbu Rujak', 'Cireng', 10000),
  ('Cireng Original', 'Cireng', 8000)
ON CONFLICT DO NOTHING;
