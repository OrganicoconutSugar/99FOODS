export const DEMO_EMAIL = 'demo@99foods.test'
export const DEMO_PASSWORD = '99Foods-Coba2026!'
export const DEMO_SESSION_KEY = '99foods-demo-session'

const DATA_KEY = '99foods-demo-data-v1'
const MEDIA_KEY = '99foods-demo-media-v1'
const PROFILE_KEY = '99foods-demo-profile-v1'
const TABLES = ['menu', 'bahan_baku', 'pembelian_bahan', 'pengeluaran_operasional', 'transaksi', 'transaksi_detail', 'transaksi_events']
const listeners = new Set()

export function isDemoSession() {
  return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(DEMO_SESSION_KEY) === '1'
}

export function getDemoProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}') } catch { return {} }
}

export function saveDemoProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}

export function resetDemoData() {
  localStorage.removeItem(DATA_KEY)
  localStorage.removeItem(MEDIA_KEY)
  localStorage.removeItem(PROFILE_KEY)
}

const dateOffset = days => {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' })
}

function seedData() {
  const now = new Date().toISOString()
  const menus = [
    ['Dimsum Mentai', 'Dimsum', 25000, 9000, 24],
    ['Dimsum Original', 'Dimsum', 20000, 7000, 18],
    ['Cireng Isi Ayam', 'Camilan', 15000, 5500, 12],
    ['Kentang Keju', 'Camilan', 20000, 8000, 8],
    ['Es Teh Lemon', 'Minuman', 10000, 3000, 30],
    ['Es Kopi Susu', 'Minuman', 18000, 6000, 3],
  ].map(([nama, kategori, harga_jual, hpp, stok_menu], i) => ({
    id: `demo-menu-${i + 1}`, nama, kategori, harga_jual, hpp, stok_menu, aktif: true,
    gambar_url: null, created_at: now,
  }))
  const transaksi = []
  const transaksi_detail = []
  const transaksi_events = []
  for (let i = 0; i < 12; i++) {
    const a = menus[i % menus.length]
    const b = menus[(i + 2) % menus.length]
    const tanggal = dateOffset(Math.floor(i / 2))
    const id = `demo-trx-seed-${i + 1}`
    const channel = ['Tunai', 'QRIS', 'Ojek Online'][i % 3]
    const order_status = i === 0 ? 'baru' : i === 1 ? 'diproses' : i === 2 ? 'siap' : 'diserahkan'
    const total_omset = a.harga_jual * 2 + b.harga_jual
    const total_modal = a.hpp * 2 + b.hpp
    transaksi.push({ id, request_id: `seed-${i + 1}`, kode: `DEMO-${String(i + 1).padStart(3, '0')}`,
      tanggal, created_at: now, channel, nama_customer: i % 2 ? 'Pelanggan Contoh' : null,
      catatan: null, total_omset, total_modal, total_untung: total_omset - total_modal,
      payment_status: 'lunas', order_status, refunded_at: null, refund_reason: null,
      cancel_reason: null, stock_restore_requested: false })
    transaksi_detail.push(
      { id: `${id}-1`, transaksi_id: id, menu_id: a.id, nama_menu: a.nama, jumlah_porsi: 2,
        harga_jual: a.harga_jual, hpp: a.hpp, subtotal_omset: a.harga_jual * 2, subtotal_modal: a.hpp * 2 },
      { id: `${id}-2`, transaksi_id: id, menu_id: b.id, nama_menu: b.nama, jumlah_porsi: 1,
        harga_jual: b.harga_jual, hpp: b.hpp, subtotal_omset: b.harga_jual, subtotal_modal: b.hpp },
    )
  }
  return {
    menu: menus,
    bahan_baku: [{ id: 'demo-bahan-1', nama: 'Kemasan', stok: 14, stok_minimum: 20 }],
    pembelian_bahan: [{ id: 'demo-beli-1', nama_bahan: 'Tepung', jumlah: 2, satuan: 'kg',
      harga_per_satuan: 18000, total: 36000, tanggal: dateOffset(1), catatan: null, created_at: now }],
    pengeluaran_operasional: [{ id: 'demo-ops-1', keterangan: 'Gas dapur', kategori: 'Gas',
      jumlah: 30000, tanggal: dateOffset(1), catatan: null, created_at: now }],
    transaksi, transaksi_detail, transaksi_events,
  }
}

function readData() {
  try {
    const saved = JSON.parse(localStorage.getItem(DATA_KEY) || 'null')
    if (saved && TABLES.every(table => Array.isArray(saved[table]))) return saved
  } catch { /* seed fresh data below */ }
  const seeded = seedData()
  localStorage.setItem(DATA_KEY, JSON.stringify(seeded))
  return seeded
}

function writeData(data, table, event, row) {
  localStorage.setItem(DATA_KEY, JSON.stringify(data))
  for (const entry of listeners) {
    const targetId = entry.filter?.match(/^id=eq\.(.+)$/)?.[1]
    if ((entry.table === table || entry.table === '*')
      && (entry.event === '*' || entry.event === event)
      && (!targetId || targetId === row?.id)) {
      queueMicrotask(() => entry.callback({ eventType: event, new: row }))
    }
  }
}

function valueAt(row, key) {
  return key.split('.').reduce((value, part) => value?.[part], row)
}

function matches(row, filters) {
  return filters.every(({ type, key, value }) => {
    if (type === 'or') {
      const term = value.match(/%([^%]+)%/)?.[1]?.toLowerCase() || ''
      return [row.kode, row.nama_customer].some(text => String(text || '').toLowerCase().includes(term))
    }
    const current = valueAt(row, key)
    if (type === 'eq') return String(current) === String(value)
    if (type === 'in') return value.some(item => String(current) === String(item))
    if (type === 'gte') return current >= value
    if (type === 'lte') return current <= value
    if (type === 'lt') return current < value
    if (type === 'not-null') return current !== null && current !== undefined
    return true
  })
}

function decorate(row, table, select, data) {
  const result = { ...row }
  if (table === 'transaksi_detail' && /transaksi!inner/.test(select)) {
    result.transaksi = data.transaksi.find(item => item.id === row.transaksi_id) || null
  }
  if (table === 'transaksi' && /transaksi_detail\(/.test(select)) {
    result.transaksi_detail = data.transaksi_detail.filter(item => item.transaksi_id === row.id)
  }
  return result
}

class DemoQuery {
  constructor(table) {
    this.table = table
    this.action = 'select'
    this.columns = '*'
    this.filters = []
    this.orders = []
    this.offset = 0
    this.maxRows = Infinity
    this.wantCount = false
    this.wantSingle = false
  }
  select(columns = '*', options = {}) { this.columns = columns; this.wantCount = options.count === 'exact'; return this }
  eq(key, value) { this.filters.push({ type: 'eq', key, value }); return this }
  in(key, value) { this.filters.push({ type: 'in', key, value }); return this }
  gte(key, value) { this.filters.push({ type: 'gte', key, value }); return this }
  lte(key, value) { this.filters.push({ type: 'lte', key, value }); return this }
  lt(key, value) { this.filters.push({ type: 'lt', key, value }); return this }
  not(key, operator, value) { if (operator === 'is' && value === null) this.filters.push({ type: 'not-null', key }); return this }
  or(value) { this.filters.push({ type: 'or', value }); return this }
  order(key, options = {}) { this.orders.push({ key, ascending: options.ascending !== false }); return this }
  limit(count) { this.maxRows = count; return this }
  range(from, through) { this.offset = from; this.maxRows = through - from + 1; return this }
  single() { this.wantSingle = true; return this }
  insert(value) { this.action = 'insert'; this.payload = value; return this }
  update(value) { this.action = 'update'; this.payload = value; return this }
  delete() { this.action = 'delete'; return this }
  then(resolve, reject) { return Promise.resolve().then(() => this.execute()).then(resolve, reject) }
  execute() {
    try {
      if (!TABLES.includes(this.table)) throw new Error(`Tabel demo tidak dikenal: ${this.table}`)
      const data = readData()
      const table = data[this.table]
      if (this.action === 'insert') {
        const payloads = Array.isArray(this.payload) ? this.payload : [this.payload]
        const rows = payloads.map(value => {
          const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...value }
          if (this.table === 'menu') {
            row.harga_jual = Number(row.harga_jual || 0)
            row.hpp = Number(row.hpp || 0)
            row.stok_menu = row.stok_menu == null ? null : Number(row.stok_menu)
          }
          if (this.table === 'pembelian_bahan') row.total = Number(row.jumlah) * Number(row.harga_per_satuan)
          table.push(row)
          return row
        })
        writeData(data, this.table, 'INSERT', rows[0])
        return { data: rows, error: null }
      }
      if (this.action === 'update' || this.action === 'delete') {
        const selected = table.filter(row => matches(row, this.filters))
        for (const row of selected) {
          if (this.action === 'update') Object.assign(row, this.payload)
          else table.splice(table.indexOf(row), 1)
        }
        if (this.table === 'menu' && this.action === 'delete') {
          for (const detail of data.transaksi_detail) {
            if (selected.some(menu => menu.id === detail.menu_id)) detail.menu_id = null
          }
        }
        writeData(data, this.table, this.action === 'update' ? 'UPDATE' : 'DELETE', selected[0])
        return { data: selected, error: null }
      }
      let rows = table.map(row => decorate(row, this.table, this.columns, data))
      rows = rows.filter(row => matches(row, this.filters))
      for (let i = this.orders.length - 1; i >= 0; i--) {
        const { key, ascending } = this.orders[i]
        rows.sort((a, b) => String(valueAt(a, key) ?? '').localeCompare(String(valueAt(b, key) ?? ''), 'id', { numeric: true }) * (ascending ? 1 : -1))
      }
      const count = rows.length
      rows = rows.slice(this.offset, this.offset + this.maxRows)
      if (this.wantSingle) {
        if (rows.length !== 1) return { data: null, error: new Error('Data tidak ditemukan') }
        return { data: rows[0], error: null }
      }
      return { data: rows, count: this.wantCount ? count : null, error: null }
    } catch (error) {
      return { data: null, count: null, error }
    }
  }
}

function event(data, id, kind, from, to, reason = null) {
  data.transaksi_events.push({ id: crypto.randomUUID(), transaksi_id: id, event_type: kind,
    from_status: from, to_status: to, reason, created_at: new Date().toISOString() })
}

function createOrder(data, name, args) {
  const existing = data.transaksi.find(row => row.request_id === args.p_request_id)
  if (existing) return { transaksi: existing, detail: data.transaksi_detail.filter(row => row.transaksi_id === existing.id) }
  const items = args.p_items || []
  if (!items.length) throw new Error('Tambahkan setidaknya satu menu')
  const seen = new Set()
  const details = items.map(item => {
    const qty = Number(item.qty)
    if (!Number.isSafeInteger(qty) || qty < 1 || seen.has(item.menu_id)) throw new Error('Jumlah porsi tidak valid atau menu ganda')
    seen.add(item.menu_id)
    const menu = data.menu.find(row => row.id === item.menu_id && row.aktif)
    if (!menu) throw new Error('Menu tidak tersedia')
    if (menu.stok_menu !== null && menu.stok_menu < qty && name !== 'buat_pesanan_qris') throw new Error(`Stok ${menu.nama} tidak cukup`)
    return { id: crypto.randomUUID(), menu_id: menu.id, nama_menu: menu.nama, jumlah_porsi: qty,
      harga_jual: menu.harga_jual, hpp: menu.hpp || 0, subtotal_omset: menu.harga_jual * qty,
      subtotal_modal: (menu.hpp || 0) * qty }
  })
  const id = crypto.randomUUID()
  const total_omset = details.reduce((sum, item) => sum + item.subtotal_omset, 0)
  const total_modal = details.reduce((sum, item) => sum + item.subtotal_modal, 0)
  const pending = name === 'buat_pesanan_qris'
  const row = { id, request_id: args.p_request_id, kode: `DEMO-${String(data.transaksi.length + 1).padStart(3, '0')}`,
    tanggal: args.p_tanggal, created_at: new Date().toISOString(), channel: pending ? 'QRIS' : args.p_channel,
    nama_customer: args.p_nama_customer, catatan: args.p_catatan, total_omset, total_modal,
    total_untung: total_omset - total_modal, payment_status: pending ? 'menunggu' : 'lunas',
    order_status: pending ? 'menunggu' : 'baru', refunded_at: null, refund_reason: null,
    cancel_reason: null, stock_restore_requested: false }
  data.transaksi.push(row)
  for (const detail of details) { detail.transaksi_id = id; data.transaksi_detail.push(detail) }
  if (!pending) {
    for (const detail of details) {
      const menu = data.menu.find(item => item.id === detail.menu_id)
      if (menu.stok_menu !== null) menu.stok_menu -= detail.jumlah_porsi
    }
  }
  event(data, id, 'pembayaran', null, row.payment_status)
  writeData(data, 'transaksi', 'INSERT', row)
  if (!pending) for (const detail of details) {
    writeData(data, 'menu', 'UPDATE', data.menu.find(item => item.id === detail.menu_id))
  }
  return { transaksi: row, detail: details }
}

function runRpc(name, args) {
  try {
    const data = readData()
    if (name === 'simpan_transaksi' || name === 'buat_pesanan_qris') return { data: createOrder(data, name, args), error: null }
    const row = data.transaksi.find(item => item.id === args.p_transaksi_id)
    if (!row) throw new Error('Transaksi tidak ditemukan')
    const details = data.transaksi_detail.filter(item => item.transaksi_id === row.id)
    if (name === 'konfirmasi_pembayaran_qris') {
      if (row.payment_status !== 'menunggu') throw new Error('Pesanan tidak menunggu pembayaran')
      for (const detail of details) {
        const menu = data.menu.find(item => item.id === detail.menu_id)
        if (!menu) throw new Error(`Menu ${detail.nama_menu} tidak tersedia`)
        if (menu.stok_menu !== null && menu.stok_menu < detail.jumlah_porsi) throw new Error(`Stok ${detail.nama_menu} tidak cukup`)
      }
      for (const detail of details) {
        const menu = data.menu.find(item => item.id === detail.menu_id)
        if (menu.stok_menu !== null) menu.stok_menu -= detail.jumlah_porsi
      }
      row.payment_status = 'lunas'; row.order_status = 'baru'; row.payment_reference = args.p_reference
      event(data, row.id, 'pembayaran', 'menunggu', 'lunas')
      for (const detail of details) writeData(data, 'menu', 'UPDATE', data.menu.find(item => item.id === detail.menu_id))
    } else if (name === 'batalkan_pesanan_qris') {
      if (row.payment_status !== 'menunggu') throw new Error('Hanya pesanan menunggu yang dapat dibatalkan')
      row.payment_status = 'dibatalkan'; row.order_status = 'dibatalkan'; row.cancel_reason = args.p_reason
      event(data, row.id, 'pembayaran', 'menunggu', 'dibatalkan', args.p_reason)
    } else if (name === 'refund_transaksi') {
      if (row.payment_status !== 'lunas') throw new Error('Hanya transaksi lunas yang dapat direfund')
      row.payment_status = 'refund'; row.refunded_at = new Date().toISOString(); row.refund_reason = args.p_reason
      row.stock_restore_requested = Boolean(args.p_restore_stock)
      if (row.stock_restore_requested) {
        for (const detail of details) {
          const menu = data.menu.find(item => item.id === detail.menu_id)
          if (menu?.stok_menu !== null) menu.stok_menu += detail.jumlah_porsi
        }
        for (const detail of details) {
          const menu = data.menu.find(item => item.id === detail.menu_id)
          if (menu) writeData(data, 'menu', 'UPDATE', menu)
        }
      }
      event(data, row.id, 'pembayaran', 'lunas', 'refund', args.p_reason)
    } else if (name === 'ubah_status_pesanan') {
      const next = { baru: 'diproses', diproses: 'siap', siap: 'diserahkan' }[row.order_status]
      if (row.payment_status !== 'lunas' || next !== args.p_next_status) throw new Error('Perubahan status pesanan tidak valid')
      const old = row.order_status
      row.order_status = next
      event(data, row.id, 'pesanan', old, next)
    } else throw new Error(`Fungsi demo tidak dikenal: ${name}`)
    writeData(data, 'transaksi', 'UPDATE', row)
    return { data: { transaksi: row, detail: details }, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

function readMedia() {
  try { return JSON.parse(localStorage.getItem(MEDIA_KEY) || '{}') } catch { return {} }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Gagal membaca foto'))
    reader.readAsDataURL(blob)
  })
}

const demoStorage = {
  from: () => ({
    async upload(path, blob) {
      try {
        if (blob.size > 1_500_000) throw new Error('Foto demo maksimal 1,5 MB')
        const media = readMedia()
        media[path] = await blobToDataUrl(blob)
        localStorage.setItem(MEDIA_KEY, JSON.stringify(media))
        return { data: { path }, error: null }
      } catch (error) { return { data: null, error } }
    },
    getPublicUrl(path) { return { data: { publicUrl: readMedia()[path] || '' } } },
    async remove(paths) {
      const media = readMedia()
      for (const path of paths) delete media[path]
      localStorage.setItem(MEDIA_KEY, JSON.stringify(media))
      return { data: paths, error: null }
    },
  }),
}

export const demoSupabase = {
  from(table) { return new DemoQuery(table) },
  rpc(name, args) { return Promise.resolve(runRpc(name, args)) },
  storage: demoStorage,
  channel() {
    const channelListeners = []
    return {
      on(_event, filter, callback) { channelListeners.push({ table: filter.table || '*', event: filter.event || '*', filter: filter.filter, callback }); return this },
      subscribe() { channelListeners.forEach(entry => listeners.add(entry)); return this },
      unsubscribe() { channelListeners.forEach(entry => listeners.delete(entry)) },
    }
  },
  removeChannel(channel) { channel.unsubscribe(); return Promise.resolve('ok') },
}
