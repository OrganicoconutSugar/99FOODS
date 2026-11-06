// Aplikasi lama belum memiliki kolom status POS. Halaman laporan tetap dapat
// memakai data historis, sementara fitur yang memerlukan status dinonaktifkan.
export function isMissingPosSchema(error) {
  const message = String(error?.message || '')
  return (error?.code === '42703' || error?.code === 'PGRST204')
    && /payment_status|order_status/i.test(message)
}

export async function hasPosWorkflowSchema(client) {
  const { error } = await client.from('transaksi').select('payment_status,order_status').limit(1)
  if (!error) return true
  if (isMissingPosSchema(error)) return false
  throw error
}
