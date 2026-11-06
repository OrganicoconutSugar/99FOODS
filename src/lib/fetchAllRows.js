// Supabase membatasi jumlah baris per respons. Ambil seluruh halaman untuk
// rekap/ekspor; setiap query wajib punya urutan yang stabil.
export async function fetchAllRows(makeQuery, pageSize = 500) {
  const rows = []
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await makeQuery().range(offset, offset + pageSize - 1)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < pageSize) return rows
  }
}
