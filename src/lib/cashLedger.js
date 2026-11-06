export function refundTimeRange(fromDate, toDate) {
  const from = new Date(`${fromDate}T00:00:00+07:00`)
  const through = new Date(new Date(`${toDate}T00:00:00+07:00`).getTime() + 24 * 60 * 60 * 1000)
  return { from: from.toISOString(), through: through.toISOString() }
}

export function jakartaDate(timestamp) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(timestamp))
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

export function netOmset(sales, refunds) {
  return sales.reduce((sum, row) => sum + Number(row.total_omset || 0), 0)
    - refunds.reduce((sum, row) => sum + Number(row.total_omset || 0), 0)
}
