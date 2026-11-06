import { supabase } from './supabase'

function unwrap(result) {
  if (result.error) throw result.error
  return result.data
}

export async function createPendingQris({ requestId, tanggal, namaCustomer, catatan, items }) {
  if (!items?.length) throw new Error('Tambahkan setidaknya satu menu')
  return unwrap(await supabase.rpc('buat_pesanan_qris', {
    p_request_id: requestId,
    p_tanggal: tanggal,
    p_nama_customer: namaCustomer?.trim() || null,
    p_catatan: catatan?.trim() || null,
    p_items: items.map(item => ({ menu_id: item.menu_id, qty: Number(item.qty) })),
  }))
}

export async function confirmQris(transactionId, reference = '') {
  return unwrap(await supabase.rpc('konfirmasi_pembayaran_qris', {
    p_transaksi_id: transactionId,
    p_reference: reference.trim() || null,
  }))
}

export async function cancelPendingQris(transactionId, reason) {
  return unwrap(await supabase.rpc('batalkan_pesanan_qris', {
    p_transaksi_id: transactionId,
    p_reason: reason.trim(),
  }))
}

export async function refundTransaction(transactionId, reason, restoreStock) {
  return unwrap(await supabase.rpc('refund_transaksi', {
    p_transaksi_id: transactionId,
    p_reason: reason.trim(),
    p_restore_stock: restoreStock,
  }))
}

export async function advanceOrder(transactionId, nextStatus) {
  return unwrap(await supabase.rpc('ubah_status_pesanan', {
    p_transaksi_id: transactionId,
    p_next_status: nextStatus,
  }))
}
