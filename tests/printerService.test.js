import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReceiptBytes } from '../src/lib/printerService.js'

test('struk 58 mm berisi transaksi dan perintah ESC/POS', () => {
  const bytes = buildReceiptBytes({
    kode: 'TRX-123', tanggal: '2026-10-26', channel: 'QRIS',
    nama_customer: 'Ani', total_omset: 25000,
  }, [{ nama_menu: 'Dimsum Ayam', jumlah_porsi: 2, harga_jual: 12500, subtotal_omset: 25000 }])
  assert.deepEqual([...bytes.slice(0, 2)], [0x1b, 0x40])
  assert.deepEqual([...bytes.slice(-3)], [0x1d, 0x56, 0x00])
  const content = String.fromCharCode(...bytes.slice(2, -3))
  assert.match(content, /TRX-123/)
  assert.match(content, /Dimsum Ayam/)
  assert.match(content, /TOTAL\s+Rp25\.000/)
  assert.ok(content.split('\n').every(line => line.length <= 32))
})
