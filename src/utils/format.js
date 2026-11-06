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
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? `${dateStr}T00:00:00` : dateStr
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

/**
 * Format tanggal ke YYYY-MM-DD untuk input date
 */
export function toInputDate(date = new Date()) {
  const pad = n => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
