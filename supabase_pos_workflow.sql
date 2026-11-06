-- Jalankan setelah supabase_hardening.sql. Semua perubahan berada dalam satu transaksi.
BEGIN;

ALTER TABLE public.transaksi
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'lunas',
  ADD COLUMN IF NOT EXISTS order_status TEXT NOT NULL DEFAULT 'diserahkan',
  ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_reason TEXT,
  ADD COLUMN IF NOT EXISTS stock_restore_requested BOOLEAN NOT NULL DEFAULT FALSE;

-- Transaksi historis sudah lunas dan selesai sebelum fitur antrean tersedia.
UPDATE public.transaksi SET payment_confirmed_at = created_at
WHERE payment_status = 'lunas' AND payment_confirmed_at IS NULL;
ALTER TABLE public.transaksi ALTER COLUMN order_status SET DEFAULT 'baru';
ALTER TABLE public.transaksi ALTER COLUMN payment_confirmed_at SET DEFAULT now();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transaksi_payment_status_check') THEN
    ALTER TABLE public.transaksi ADD CONSTRAINT transaksi_payment_status_check
      CHECK (payment_status IN ('menunggu', 'lunas', 'dibatalkan', 'refund'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transaksi_order_status_check') THEN
    ALTER TABLE public.transaksi ADD CONSTRAINT transaksi_order_status_check
      CHECK (order_status IN ('menunggu_pembayaran', 'baru', 'diproses', 'siap', 'diserahkan', 'dibatalkan'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS transaksi_kitchen_queue_idx
  ON public.transaksi(order_status, created_at) WHERE payment_status = 'lunas';

-- Fungsi checkout lama tetap dipakai untuk Tunai/Ojek Online, tetapi QRIS
-- wajib melalui pesanan menunggu dan konfirmasi pembayaran yang terpisah.
CREATE OR REPLACE FUNCTION public.cegah_qris_lunas_langsung()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.channel = 'QRIS' AND NEW.payment_status = 'lunas' THEN
    RAISE EXCEPTION 'QRIS harus dibuat sebagai pesanan menunggu terlebih dahulu';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_cegah_qris_lunas_langsung ON public.transaksi;
CREATE TRIGGER trg_cegah_qris_lunas_langsung
  BEFORE INSERT ON public.transaksi FOR EACH ROW
  EXECUTE FUNCTION public.cegah_qris_lunas_langsung();

-- Halaman dapur dan kasir menerima perubahan transaksi tanpa muat ulang.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
                     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'transaksi') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transaksi;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.transaksi_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaksi_id UUID NOT NULL REFERENCES public.transaksi(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  reason TEXT,
  actor_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS transaksi_events_transaksi_idx
  ON public.transaksi_events(transaksi_id, created_at);
ALTER TABLE public.transaksi_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS owner_read_events ON public.transaksi_events;
CREATE POLICY owner_read_events ON public.transaksi_events FOR SELECT TO authenticated
  USING ((SELECT public.is_99foods_owner()));
REVOKE ALL ON public.transaksi_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.transaksi_events TO authenticated;

CREATE OR REPLACE FUNCTION public.catat_status_awal_transaksi()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.transaksi_events(transaksi_id, event_type, to_status, actor_id)
  VALUES (NEW.id, 'pembayaran', NEW.payment_status, auth.uid());
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_catat_status_awal_transaksi ON public.transaksi;
CREATE TRIGGER trg_catat_status_awal_transaksi
  AFTER INSERT ON public.transaksi FOR EACH ROW
  EXECUTE FUNCTION public.catat_status_awal_transaksi();

-- QRIS statis: simpan snapshot harga/item, tetapi jangan potong stok atau hitung omzet.
CREATE OR REPLACE FUNCTION public.buat_pesanan_qris(
  p_request_id UUID, p_tanggal DATE, p_nama_customer TEXT, p_catatan TEXT, p_items JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  item JSONB;
  menu_row public.menu%ROWTYPE;
  menu_id UUID;
  qty_text TEXT;
  qty INTEGER;
  seen UUID[] := ARRAY[]::UUID[];
  trx_id UUID;
  result JSONB;
BEGIN
  IF NOT public.is_99foods_owner() THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  IF p_request_id IS NULL OR p_tanggal IS NULL THEN RAISE EXCEPTION 'Permintaan tidak valid'; END IF;
  SELECT id INTO trx_id FROM public.transaksi WHERE client_request_id = p_request_id;
  IF NOT FOUND THEN
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
       OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 100 THEN
      RAISE EXCEPTION 'Pesanan harus berisi 1 sampai 100 item';
    END IF;
    INSERT INTO public.transaksi
      (kode, tanggal, channel, nama_customer, catatan, client_request_id,
       payment_status, order_status, payment_confirmed_at)
    VALUES
      ('TRX-' || to_char(p_tanggal, 'YYYYMMDD') || '-' ||
       upper(substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 12)),
       p_tanggal, 'QRIS', nullif(trim(p_nama_customer), ''),
       nullif(trim(p_catatan), ''), p_request_id, 'menunggu', 'menunggu_pembayaran', NULL)
    RETURNING id INTO trx_id;

    FOR item IN SELECT value FROM jsonb_array_elements(p_items) ORDER BY value->>'menu_id' LOOP
      IF jsonb_typeof(item) <> 'object' OR item->>'menu_id' IS NULL THEN
        RAISE EXCEPTION 'Item pesanan tidak valid';
      END IF;
      menu_id := (item->>'menu_id')::UUID;
      qty_text := item->>'qty';
      IF qty_text IS NULL OR qty_text !~ '^[1-9][0-9]*$' THEN
        RAISE EXCEPTION 'Jumlah porsi harus bilangan bulat positif';
      END IF;
      qty := qty_text::INTEGER;
      IF menu_id = ANY(seen) THEN RAISE EXCEPTION 'Menu yang sama hanya boleh muncul sekali'; END IF;
      seen := array_append(seen, menu_id);
      SELECT * INTO menu_row FROM public.menu WHERE id = menu_id FOR UPDATE;
      IF NOT FOUND OR NOT menu_row.aktif THEN RAISE EXCEPTION 'Menu tidak tersedia'; END IF;
      IF menu_row.stok_menu IS NOT NULL AND menu_row.stok_menu < qty THEN
        RAISE EXCEPTION 'Stok % tidak cukup (tersisa %)', menu_row.nama, menu_row.stok_menu;
      END IF;
      INSERT INTO public.transaksi_detail
        (transaksi_id, menu_id, nama_menu, jumlah_porsi, harga_jual, hpp)
      VALUES (trx_id, menu_id, menu_row.nama, qty, menu_row.harga_jual, menu_row.hpp);
    END LOOP;
    UPDATE public.transaksi SET
      total_omset = (SELECT coalesce(sum(subtotal_omset), 0) FROM public.transaksi_detail WHERE transaksi_id = trx_id),
      total_modal = (SELECT coalesce(sum(subtotal_modal), 0) FROM public.transaksi_detail WHERE transaksi_id = trx_id)
    WHERE id = trx_id;
  END IF;
  SELECT jsonb_build_object('transaksi', to_jsonb(t),
    'detail', coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.created_at, d.id)
      FROM public.transaksi_detail d WHERE d.transaksi_id = t.id), '[]'::jsonb))
  INTO result FROM public.transaksi t WHERE t.id = trx_id;
  RETURN result;
END;
$$;

-- Setelah notifikasi BNI Merchant dicek, stok divalidasi lagi dan dipotong atomik.
CREATE OR REPLACE FUNCTION public.konfirmasi_pembayaran_qris(
  p_transaksi_id UUID, p_reference TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  trx public.transaksi%ROWTYPE;
  detail_row RECORD;
  menu_row public.menu%ROWTYPE;
  result JSONB;
BEGIN
  IF NOT public.is_99foods_owner() THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  SELECT * INTO trx FROM public.transaksi WHERE id = p_transaksi_id FOR UPDATE;
  IF NOT FOUND OR trx.channel <> 'QRIS' THEN RAISE EXCEPTION 'Pesanan QRIS tidak ditemukan'; END IF;
  IF trx.payment_status NOT IN ('menunggu', 'lunas') THEN RAISE EXCEPTION 'Pesanan tidak dapat dikonfirmasi'; END IF;
  IF trx.payment_status = 'menunggu' THEN
    FOR detail_row IN SELECT menu_id, jumlah_porsi FROM public.transaksi_detail
      WHERE transaksi_id = trx.id ORDER BY menu_id LOOP
      SELECT * INTO menu_row FROM public.menu WHERE id = detail_row.menu_id FOR UPDATE;
      IF NOT FOUND OR NOT menu_row.aktif THEN RAISE EXCEPTION 'Menu pesanan tidak tersedia'; END IF;
      IF menu_row.stok_menu IS NOT NULL THEN
        IF menu_row.stok_menu < detail_row.jumlah_porsi THEN
          RAISE EXCEPTION 'Stok % tidak cukup (tersisa %)', menu_row.nama, menu_row.stok_menu;
        END IF;
        UPDATE public.menu SET stok_menu = stok_menu - detail_row.jumlah_porsi,
          updated_at = now() WHERE id = menu_row.id;
      END IF;
    END LOOP;
    UPDATE public.transaksi SET payment_status = 'lunas', order_status = 'baru',
      payment_confirmed_at = now(), payment_reference = nullif(left(trim(p_reference), 100), '')
    WHERE id = trx.id;
    INSERT INTO public.transaksi_events(transaksi_id, event_type, from_status, to_status, actor_id)
    VALUES (trx.id, 'pembayaran', 'menunggu', 'lunas', auth.uid());
  END IF;
  SELECT jsonb_build_object('transaksi', to_jsonb(t),
    'detail', coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.created_at, d.id)
      FROM public.transaksi_detail d WHERE d.transaksi_id = t.id), '[]'::jsonb))
  INTO result FROM public.transaksi t WHERE t.id = trx.id;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.batalkan_pesanan_qris(
  p_transaksi_id UUID, p_reason TEXT
) RETURNS public.transaksi
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE trx public.transaksi%ROWTYPE;
BEGIN
  IF NOT public.is_99foods_owner() THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  IF length(trim(coalesce(p_reason, ''))) < 3 THEN RAISE EXCEPTION 'Alasan minimal 3 karakter'; END IF;
  SELECT * INTO trx FROM public.transaksi WHERE id = p_transaksi_id FOR UPDATE;
  IF NOT FOUND OR trx.channel <> 'QRIS' THEN RAISE EXCEPTION 'Pesanan tidak ditemukan'; END IF;
  IF trx.payment_status = 'dibatalkan' THEN RETURN trx; END IF;
  IF trx.payment_status <> 'menunggu' THEN RAISE EXCEPTION 'Hanya pesanan menunggu yang dapat dibatalkan'; END IF;
  UPDATE public.transaksi SET payment_status = 'dibatalkan', order_status = 'dibatalkan',
    canceled_at = now(), cancel_reason = left(trim(p_reason), 500)
  WHERE id = trx.id RETURNING * INTO trx;
  INSERT INTO public.transaksi_events(transaksi_id, event_type, from_status, to_status, reason, actor_id)
  VALUES (trx.id, 'pembayaran', 'menunggu', 'dibatalkan', trx.cancel_reason, auth.uid());
  RETURN trx;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_transaksi(
  p_transaksi_id UUID, p_reason TEXT, p_restore_stock BOOLEAN DEFAULT FALSE
) RETURNS public.transaksi
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  trx public.transaksi%ROWTYPE;
  detail_row RECORD;
  menu_row public.menu%ROWTYPE;
BEGIN
  IF NOT public.is_99foods_owner() THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  IF length(trim(coalesce(p_reason, ''))) < 3 THEN RAISE EXCEPTION 'Alasan minimal 3 karakter'; END IF;
  SELECT * INTO trx FROM public.transaksi WHERE id = p_transaksi_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaksi tidak ditemukan'; END IF;
  IF trx.payment_status = 'refund' THEN RETURN trx; END IF;
  IF trx.payment_status <> 'lunas' THEN RAISE EXCEPTION 'Hanya transaksi lunas yang dapat direfund'; END IF;
  IF coalesce(p_restore_stock, FALSE) THEN
    IF EXISTS (SELECT 1 FROM public.transaksi_detail
               WHERE transaksi_id = trx.id AND menu_id IS NULL) THEN
      RAISE EXCEPTION 'Menu lama telah dihapus. Catat refund tanpa kembalikan stok.';
    END IF;
    FOR detail_row IN SELECT menu_id, jumlah_porsi FROM public.transaksi_detail
      WHERE transaksi_id = trx.id ORDER BY menu_id LOOP
      SELECT * INTO menu_row FROM public.menu WHERE id = detail_row.menu_id FOR UPDATE;
      IF FOUND AND menu_row.stok_menu IS NOT NULL THEN
        UPDATE public.menu SET stok_menu = stok_menu + detail_row.jumlah_porsi,
          updated_at = now() WHERE id = menu_row.id;
      END IF;
    END LOOP;
  END IF;
  UPDATE public.transaksi SET payment_status = 'refund', refunded_at = now(),
    refund_reason = left(trim(p_reason), 500), stock_restore_requested = coalesce(p_restore_stock, FALSE),
    order_status = CASE WHEN order_status = 'diserahkan' THEN 'diserahkan' ELSE 'dibatalkan' END
  WHERE id = trx.id RETURNING * INTO trx;
  INSERT INTO public.transaksi_events(transaksi_id, event_type, from_status, to_status, reason, actor_id)
  VALUES (trx.id, 'pembayaran', 'lunas', 'refund', trx.refund_reason, auth.uid());
  RETURN trx;
END;
$$;

CREATE OR REPLACE FUNCTION public.ubah_status_pesanan(
  p_transaksi_id UUID, p_next_status TEXT
) RETURNS public.transaksi
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE trx public.transaksi%ROWTYPE;
BEGIN
  IF NOT public.is_99foods_owner() THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  SELECT * INTO trx FROM public.transaksi WHERE id = p_transaksi_id FOR UPDATE;
  IF NOT FOUND OR trx.payment_status <> 'lunas' THEN RAISE EXCEPTION 'Pesanan lunas tidak ditemukan'; END IF;
  IF NOT ((trx.order_status = 'baru' AND p_next_status = 'diproses') OR
          (trx.order_status = 'diproses' AND p_next_status = 'siap') OR
          (trx.order_status = 'siap' AND p_next_status = 'diserahkan')) THEN
    RAISE EXCEPTION 'Perpindahan status pesanan tidak valid';
  END IF;
  UPDATE public.transaksi SET order_status = p_next_status WHERE id = trx.id RETURNING * INTO trx;
  INSERT INTO public.transaksi_events(transaksi_id, event_type, from_status, to_status, actor_id)
  VALUES (trx.id, 'pesanan', CASE p_next_status WHEN 'diproses' THEN 'baru' WHEN 'siap' THEN 'diproses' ELSE 'siap' END,
    p_next_status, auth.uid());
  RETURN trx;
END;
$$;

REVOKE ALL ON FUNCTION public.buat_pesanan_qris(UUID, DATE, TEXT, TEXT, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.konfirmasi_pembayaran_qris(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.batalkan_pesanan_qris(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.refund_transaksi(UUID, TEXT, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ubah_status_pesanan(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buat_pesanan_qris(UUID, DATE, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.konfirmasi_pembayaran_qris(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.batalkan_pesanan_qris(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_transaksi(UUID, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ubah_status_pesanan(UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
