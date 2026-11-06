-- Jalankan setelah supabase_schema.sql dan supabase_migration.sql.
-- Backup database terlebih dahulu. Jika sudah ada lebih dari satu akun Auth,
-- tentukan owner secara manual sebelum menjalankan migrasi ini (lihat README).
BEGIN;

CREATE TABLE IF NOT EXISTS public.app_owners (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);
ALTER TABLE public.app_owners ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_owners FROM PUBLIC, anon, authenticated;

-- Proyek ini awalnya hanya memiliki satu akun owner. Jangan otomatis memberi
-- hak owner ke semua akun ketika akun lain sudah dibuat.
DO $$
DECLARE
  account_count INTEGER;
BEGIN
  SELECT count(*) INTO account_count FROM auth.users;
  IF account_count > 1 AND NOT EXISTS (SELECT 1 FROM public.app_owners) THEN
    RAISE EXCEPTION 'Ada lebih dari satu akun Auth. Isi public.app_owners dengan UUID owner melalui SQL Editor, lalu jalankan ulang migrasi.';
  END IF;
  IF account_count = 1 THEN
    INSERT INTO public.app_owners(user_id)
    SELECT id FROM auth.users ON CONFLICT DO NOTHING;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.is_99foods_owner()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_owners WHERE user_id = (SELECT auth.uid())
  );
$$;
REVOKE ALL ON FUNCTION public.is_99foods_owner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_99foods_owner() TO authenticated;

-- Hanya owner yang boleh mengubah data. Header/detail transaksi hanya dapat
-- ditulis melalui RPC atomik di bawah agar stok dan total selalu konsisten.
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'bahan_baku', 'menu', 'resep', 'pembelian_bahan',
    'pengeluaran_operasional', 'transaksi', 'transaksi_detail',
    'riwayat_harga_bahan'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS authenticated_full_access ON public.%I', table_name);
    EXECUTE format('DROP POLICY IF EXISTS owner_access ON public.%I', table_name);
    IF table_name IN ('transaksi', 'transaksi_detail') THEN
      EXECUTE format(
        'CREATE POLICY owner_access ON public.%I FOR SELECT TO authenticated USING ((SELECT public.is_99foods_owner()))',
        table_name
      );
    ELSE
      EXECUTE format(
        'CREATE POLICY owner_access ON public.%I FOR ALL TO authenticated USING ((SELECT public.is_99foods_owner())) WITH CHECK ((SELECT public.is_99foods_owner()))',
        table_name
      );
    END IF;
  END LOOP;
END $$;

REVOKE INSERT, UPDATE, DELETE ON public.transaksi, public.transaksi_detail
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.transaksi, public.transaksi_detail TO authenticated;

-- Hapus menu tanpa menghapus snapshot penjualan yang sudah terjadi.
ALTER TABLE public.transaksi_detail ALTER COLUMN menu_id DROP NOT NULL;
ALTER TABLE public.transaksi_detail
  DROP CONSTRAINT IF EXISTS transaksi_detail_menu_id_fkey;
ALTER TABLE public.transaksi_detail
  ADD CONSTRAINT transaksi_detail_menu_id_fkey
  FOREIGN KEY (menu_id) REFERENCES public.menu(id) ON DELETE SET NULL;

ALTER TABLE public.transaksi ADD COLUMN IF NOT EXISTS client_request_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS transaksi_client_request_id_key
  ON public.transaksi(client_request_id);

DROP POLICY IF EXISTS "authenticated can upload menu images" ON storage.objects;
DROP POLICY IF EXISTS "authenticated can delete menu images" ON storage.objects;
DROP POLICY IF EXISTS "owner can upload menu images" ON storage.objects;
DROP POLICY IF EXISTS "owner can update menu images" ON storage.objects;
DROP POLICY IF EXISTS "owner can delete menu images" ON storage.objects;
CREATE POLICY "owner can upload menu images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'menu-images' AND (SELECT public.is_99foods_owner()));
CREATE POLICY "owner can update menu images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'menu-images' AND (SELECT public.is_99foods_owner()))
  WITH CHECK (bucket_id = 'menu-images' AND (SELECT public.is_99foods_owner()));
CREATE POLICY "owner can delete menu images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'menu-images' AND (SELECT public.is_99foods_owner()));

-- Satu panggilan RPC = satu transaksi PostgreSQL. Harga/HPP diambil dari menu
-- saat checkout, bukan dari browser. Baris menu dikunci sebelum stok dicek.
CREATE OR REPLACE FUNCTION public.simpan_transaksi(
  p_request_id UUID,
  p_tanggal DATE,
  p_channel TEXT,
  p_nama_customer TEXT,
  p_catatan TEXT,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  item JSONB;
  menu_row public.menu%ROWTYPE;
  menu_id UUID;
  qty_text TEXT;
  qty INTEGER;
  seen_menu_ids UUID[] := ARRAY[]::UUID[];
  transaction_id UUID;
  transaction_code TEXT;
  result JSONB;
BEGIN
  IF NOT public.is_99foods_owner() THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;
  IF p_tanggal IS NULL OR p_channel NOT IN ('Tunai', 'QRIS', 'Ojek Online') THEN
    RAISE EXCEPTION 'Tanggal atau channel tidak valid';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'ID permintaan wajib diisi';
  END IF;

  -- Ulangi permintaan yang responsnya hilang tanpa membuat penjualan kedua.
  SELECT id INTO transaction_id FROM public.transaksi
  WHERE client_request_id = p_request_id;
  IF FOUND THEN
    SELECT jsonb_build_object(
      'transaksi', to_jsonb(t),
      'detail', coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.created_at, d.id)
                          FROM public.transaksi_detail d WHERE d.transaksi_id = t.id), '[]'::jsonb)
    ) INTO result FROM public.transaksi t WHERE t.id = transaction_id;
    RETURN result;
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Transaksi harus berisi 1 sampai 100 item';
  END IF;

  transaction_code := 'TRX-' || to_char(p_tanggal, 'YYYYMMDD') || '-'
    || upper(substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 12));
  INSERT INTO public.transaksi (kode, tanggal, channel, nama_customer, catatan, client_request_id)
  VALUES (transaction_code, p_tanggal, p_channel,
          nullif(trim(p_nama_customer), ''), nullif(trim(p_catatan), ''), p_request_id)
  RETURNING id INTO transaction_id;

  FOR item IN
    SELECT value FROM jsonb_array_elements(p_items) ORDER BY value->>'menu_id'
  LOOP
    IF jsonb_typeof(item) <> 'object' OR item->>'menu_id' IS NULL THEN
      RAISE EXCEPTION 'Item transaksi tidak valid';
    END IF;
    menu_id := (item->>'menu_id')::UUID;
    qty_text := item->>'qty';
    IF qty_text IS NULL OR qty_text !~ '^[1-9][0-9]*$' THEN
      RAISE EXCEPTION 'Jumlah porsi harus bilangan bulat positif';
    END IF;
    qty := qty_text::INTEGER;
    IF menu_id = ANY(seen_menu_ids) THEN
      RAISE EXCEPTION 'Menu yang sama hanya boleh muncul sekali';
    END IF;
    seen_menu_ids := array_append(seen_menu_ids, menu_id);

    SELECT * INTO menu_row FROM public.menu WHERE id = menu_id FOR UPDATE;
    IF NOT FOUND OR NOT menu_row.aktif THEN
      RAISE EXCEPTION 'Menu tidak tersedia';
    END IF;
    IF menu_row.stok_menu IS NOT NULL AND menu_row.stok_menu < qty THEN
      RAISE EXCEPTION 'Stok % tidak cukup (tersisa %)', menu_row.nama, menu_row.stok_menu;
    END IF;

    INSERT INTO public.transaksi_detail
      (transaksi_id, menu_id, nama_menu, jumlah_porsi, harga_jual, hpp)
    VALUES
      (transaction_id, menu_id, menu_row.nama, qty, menu_row.harga_jual, menu_row.hpp);
    IF menu_row.stok_menu IS NOT NULL THEN
      UPDATE public.menu SET stok_menu = stok_menu - qty, updated_at = now()
      WHERE id = menu_id;
    END IF;
  END LOOP;

  UPDATE public.transaksi SET
    total_omset = (SELECT coalesce(sum(subtotal_omset), 0)
                   FROM public.transaksi_detail WHERE transaksi_id = transaction_id),
    total_modal = (SELECT coalesce(sum(subtotal_modal), 0)
                   FROM public.transaksi_detail WHERE transaksi_id = transaction_id)
  WHERE id = transaction_id;
  SELECT jsonb_build_object(
    'transaksi', to_jsonb(t),
    'detail', coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.created_at, d.id)
                        FROM public.transaksi_detail d WHERE d.transaksi_id = t.id), '[]'::jsonb)
  ) INTO result FROM public.transaksi t WHERE t.id = transaction_id;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.simpan_transaksi(UUID, DATE, TEXT, TEXT, TEXT, JSONB)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.simpan_transaksi(UUID, DATE, TEXT, TEXT, TEXT, JSONB)
  TO authenticated;
REVOKE ALL ON FUNCTION public.proses_transaksi(UUID) FROM PUBLIC, anon, authenticated;

COMMIT;
