import assert from 'node:assert/strict'
import test from 'node:test'
import { createTransactionService } from '../src/lib/transactionService.js'

const sale = {
  requestId: '11111111-1111-4111-8111-111111111111',
  tanggal: '2026-10-26', channel: 'Tunai', namaCustomer: 'Rina',
  items: [{ menu_id: 'menu-1', qty: '2' }],
}

test('checkout memakai satu panggilan RPC untuk menyimpan dan menerima struk', async () => {
  const calls = []
  const client = { rpc: async (name, payload) => {
    calls.push({ name, payload })
    return { data: { transaksi: { kode: 'TRX-TEST' }, detail: [{ id: 'detail-id' }] }, error: null }
  } }
  const result = await createTransactionService(client)(sale)
  assert.equal(result.transaksi.kode, 'TRX-TEST')
  assert.equal(result.detail.length, 1)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].name, 'simpan_transaksi')
  assert.equal(calls[0].payload.p_request_id, sale.requestId)
  assert.deepEqual(calls[0].payload.p_items, [{ menu_id: 'menu-1', qty: 2 }])
})

test('jumlah tidak valid atau menu ganda ditolak sebelum RPC', async () => {
  let calls = 0
  const save = createTransactionService({ rpc: async () => { calls++ } })
  await assert.rejects(save({ ...sale, items: [{ menu_id: 'menu-1', qty: 0 }] }))
  await assert.rejects(save({ ...sale, items: [{ menu_id: 'menu-1', qty: 1 }, { menu_id: 'menu-1', qty: 2 }] }))
  assert.equal(calls, 0)
})

test('kegagalan RPC diteruskan tanpa panggilan lain', async () => {
  let calls = 0
  const save = createTransactionService({ rpc: async () => {
    calls++
    return { data: null, error: new Error('Stok tidak cukup') }
  } })
  await assert.rejects(save(sale), /Stok tidak cukup/)
  assert.equal(calls, 1)
})
