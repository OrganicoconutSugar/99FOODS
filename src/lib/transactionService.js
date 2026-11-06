import { createRequestId } from '../utils/requestId.js'

export function createTransactionService(client) {
  return async function saveTransaction({ requestId = createRequestId(), tanggal, channel, namaCustomer, catatan = '', items }) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Tambahkan setidaknya satu menu')
    }
    const normalized = items.map(item => ({
      menu_id: item.menu_id,
      qty: Number(item.qty),
    }))
    if (normalized.some(item => !item.menu_id || !Number.isSafeInteger(item.qty) || item.qty < 1)) {
      throw new Error('Jumlah porsi harus bilangan bulat positif')
    }
    if (new Set(normalized.map(item => item.menu_id)).size !== normalized.length) {
      throw new Error('Menu yang sama hanya boleh muncul sekali')
    }

    const { data, error } = await client.rpc('simpan_transaksi', {
      p_request_id: requestId,
      p_tanggal: tanggal,
      p_channel: channel,
      p_nama_customer: namaCustomer?.trim() || null,
      p_catatan: catatan?.trim() || null,
      p_items: normalized,
    })
    if (error) throw error
    if (!data?.transaksi || !Array.isArray(data.detail)) {
      throw new Error('Respons transaksi tidak lengkap; periksa riwayat sebelum mencoba lagi')
    }
    return data
  }
}
