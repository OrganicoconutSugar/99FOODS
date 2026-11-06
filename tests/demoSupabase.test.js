import test from 'node:test'
import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { demoSupabase, resetDemoData } from '../src/lib/demoSupabase.js'

globalThis.crypto ||= webcrypto

function resetStorage() {
  const values = new Map()
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  }
}

test('akun demo bisa membaca dan mengubah menu tanpa koneksi backend', async () => {
  resetStorage()
  const initial = await demoSupabase.from('menu').select('*')
  assert.ok(initial.data.length >= 5)

  const inserted = await demoSupabase.from('menu').insert({ nama: 'Menu Uji', kategori: 'Camilan', harga_jual: 17000, stok_menu: 8, aktif: true })
  assert.equal(inserted.error, null)
  const id = inserted.data[0].id
  await demoSupabase.from('menu').update({ stok_menu: 5 }).eq('id', id)
  const updated = await demoSupabase.from('menu').select('*').eq('id', id).single()
  assert.equal(updated.data.stok_menu, 5)
  await demoSupabase.from('menu').delete().eq('id', id)
  const removed = await demoSupabase.from('menu').select('*').eq('id', id)
  assert.equal(removed.data.length, 0)
})

test('checkout, dapur, refund, dan rekap demo mengikuti perubahan stok', async () => {
  resetStorage()
  const menu = (await demoSupabase.from('menu').select('*').eq('nama', 'Dimsum Mentai').single()).data
  const before = menu.stok_menu
  const saved = await demoSupabase.rpc('simpan_transaksi', {
    p_request_id: 'uji-checkout', p_tanggal: '2026-11-06', p_channel: 'Tunai',
    p_nama_customer: 'Tester', p_catatan: null, p_items: [{ menu_id: menu.id, qty: 2 }],
  })
  assert.equal(saved.error, null)
  assert.equal(saved.data.transaksi.total_omset, menu.harga_jual * 2)
  assert.equal((await demoSupabase.from('menu').select('*').eq('id', menu.id).single()).data.stok_menu, before - 2)

  const duplicate = await demoSupabase.rpc('simpan_transaksi', {
    p_request_id: 'uji-checkout', p_tanggal: '2026-11-06', p_channel: 'Tunai',
    p_items: [{ menu_id: menu.id, qty: 2 }],
  })
  assert.equal(duplicate.data.transaksi.id, saved.data.transaksi.id)

  const advanced = await demoSupabase.rpc('ubah_status_pesanan', { p_transaksi_id: saved.data.transaksi.id, p_next_status: 'diproses' })
  assert.equal(advanced.data.transaksi.order_status, 'diproses')
  const refunded = await demoSupabase.rpc('refund_transaksi', { p_transaksi_id: saved.data.transaksi.id, p_reason: 'Uji demo', p_restore_stock: true })
  assert.equal(refunded.data.transaksi.payment_status, 'refund')
  assert.equal((await demoSupabase.from('menu').select('*').eq('id', menu.id).single()).data.stok_menu, before)
  const joined = await demoSupabase.from('transaksi').select('id, transaksi_detail(nama_menu, jumlah_porsi)').eq('id', saved.data.transaksi.id).single()
  assert.equal(joined.data.transaksi_detail[0].nama_menu, menu.nama)
})

test('QRIS demo menunggu pembayaran sebelum stok berkurang', async () => {
  resetStorage()
  const menu = (await demoSupabase.from('menu').select('*').eq('nama', 'Dimsum Original').single()).data
  const pending = await demoSupabase.rpc('buat_pesanan_qris', {
    p_request_id: 'uji-qris', p_tanggal: '2026-11-06', p_items: [{ menu_id: menu.id, qty: 1 }],
  })
  assert.equal(pending.data.transaksi.payment_status, 'menunggu')
  assert.equal((await demoSupabase.from('menu').select('*').eq('id', menu.id).single()).data.stok_menu, menu.stok_menu)
  const paid = await demoSupabase.rpc('konfirmasi_pembayaran_qris', { p_transaksi_id: pending.data.transaksi.id, p_reference: 'DEMO' })
  assert.equal(paid.data.transaksi.payment_status, 'lunas')
  assert.equal((await demoSupabase.from('menu').select('*').eq('id', menu.id).single()).data.stok_menu, menu.stok_menu - 1)
})

test('riwayat dan laporan demo mendukung filter, join, paginasi, dan reset', async () => {
  resetStorage()
  const page = await demoSupabase.from('transaksi').select('*', { count: 'exact' })
    .order('tanggal', { ascending: false }).range(0, 4)
  assert.equal(page.count, 12)
  assert.equal(page.data.length, 5)
  const search = await demoSupabase.from('transaksi').select('*').or('kode.ilike.%DEMO-001%,nama_customer.ilike.%DEMO-001%')
  assert.equal(search.data.length, 1)
  const joined = await demoSupabase.from('transaksi_detail')
    .select('id, nama_menu, transaksi!inner(tanggal, payment_status)')
    .gte('transaksi.tanggal', '2000-01-01').in('transaksi.payment_status', ['lunas'])
  assert.ok(joined.data.length > 0)
  assert.ok(joined.data.every(row => row.transaksi.payment_status === 'lunas'))
  resetDemoData()
  assert.equal(localStorage.getItem('99foods-demo-data-v1'), null)
  assert.equal((await demoSupabase.from('menu').select('*')).data.length, 6)
})
