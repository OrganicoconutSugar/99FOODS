/**
 * Format angka ke format Rupiah
 */
export function formatRupiah(amount) {
  if (amount == null) return 'Rp 0'
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Format tanggal ke format Indonesia (DD MMM YYYY)
 */
export function formatTanggal(dateStr) {
  if (!dateStr) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateStr))
}

/**
 * Format tanggal ke YYYY-MM-DD untuk input date
 */
export function toInputDate(date = new Date()) {
  return date.toISOString().split('T')[0]
}

/**
 * Generate kode transaksi unik
 */
export function generateKodeTransaksi() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `TRX-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${Date.now().toString().slice(-5)}`
}
