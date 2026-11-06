import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllRows } from '../lib/fetchAllRows'
import { hasPosWorkflowSchema } from '../lib/posSchema'
import { useAuth } from '../context/AuthContext'
import { refundTimeRange, jakartaDate, netOmset } from '../lib/cashLedger'
import { formatRupiah, formatTanggal } from '../utils/format'
import StatCard from '../components/ui/StatCard'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import DashboardIcon from '../components/ui/DashboardIcon'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'
import { subDays, format, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { useChartSettings, ChartSettingsPanel, ChartToggleButton, CHART_THEMES } from '../components/ui/ChartSettings'
import './Dashboard.css'

const PERIODS = [
  { label: 'Hari Ini', value: 'today' },
  { label: '7 Hari',   value: 'week' },
  { label: 'Bulan Ini', value: 'month' },
]

function getRange(period) {
  const now = new Date()
  const start = period === 'today' ? startOfDay(now) : period === 'week' ? startOfDay(subDays(now, 6)) : startOfMonth(now)
  const end = period === 'month' ? endOfMonth(now) : endOfDay(now)
  return { fromDate: format(start, 'yyyy-MM-dd'), toDate: format(end, 'yyyy-MM-dd') }
}

function chartThemeColors(theme) {
  return CHART_THEMES[theme] || CHART_THEMES.sage
}

export default function Dashboard() {
  const { isDemo } = useAuth()
  const [period, setPeriod] = useState('week')
  const [stats, setStats] = useState({ omset: 0, modal: 0, operasional: 0, untung: 0, transaksi: 0 })
  const [chartData, setChartData] = useState([])
  const [topMenu, setTopMenu] = useState([])
  const [lowStock, setLowStock] = useState([])
  const [recentTrx, setRecentTrx] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [legacySchema, setLegacySchema] = useState(false)
  const latestFetch = useRef(0)

  const chartSettings = useChartSettings('dashboard')

  useEffect(() => {
    fetchAll()
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transaksi' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pembelian_bahan' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pengeluaran_operasional' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu' }, () => fetchLowStock())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [period])

  const fetchAll = async () => {
    const request = ++latestFetch.current
    setLoading(true)
    setFetchError('')
    try {
      const workflowReady = await hasPosWorkflowSchema(supabase)
      if (request === latestFetch.current) setLegacySchema(!workflowReady)
      await Promise.all([
        fetchStats(request, workflowReady), fetchChart(request, workflowReady),
        fetchTopMenu(request, workflowReady), fetchLowStock(request), fetchRecentTrx(request, workflowReady),
      ])
    } catch (error) {
      if (request === latestFetch.current) setFetchError(error.message || 'Gagal memuat dashboard')
    } finally {
      if (request === latestFetch.current) setLoading(false)
    }
  }

  const fetchStats = async (request, workflowReady) => {
    const { fromDate, toDate } = getRange(period)
    const refundRange = refundTimeRange(fromDate, toDate)
    const [trx, refunds, bahan, ops] = await Promise.all([
      fetchAllRows(() => {
        let query = supabase.from('transaksi').select('id, total_omset')
          .gte('tanggal', fromDate).lte('tanggal', toDate)
        if (workflowReady) query = query.in('payment_status', ['lunas', 'refund'])
        return query.order('id')
      }),
      workflowReady ? fetchAllRows(() => supabase.from('transaksi').select('id, total_omset')
        .eq('payment_status', 'refund').gte('refunded_at', refundRange.from).lt('refunded_at', refundRange.through).order('id')) : Promise.resolve([]),
      fetchAllRows(() => supabase.from('pembelian_bahan').select('id, total')
        .gte('tanggal', fromDate).lte('tanggal', toDate).order('id')),
      fetchAllRows(() => supabase.from('pengeluaran_operasional').select('id, jumlah')
        .gte('tanggal', fromDate).lte('tanggal', toDate).order('id')),
    ])
    const totalOmset = netOmset(trx, refunds)
    const totalBeli = bahan.reduce((s, r) => s + Number(r.total || 0), 0)
    const totalOps = ops.reduce((s, r) => s + Number(r.jumlah || 0), 0)
    if (request === latestFetch.current) setStats({ omset: totalOmset, modal: totalBeli, operasional: totalOps,
      untung: totalOmset - totalBeli - totalOps, transaksi: trx.length })
  }

  const fetchChart = async (request, workflowReady) => {
    const days = period === 'today' ? 1 : period === 'week' ? 7 : new Date().getDate()
    const { fromDate, toDate } = getRange(period)
    const refundRange = refundTimeRange(fromDate, toDate)
    const [trx, refunds, beli, ops] = await Promise.all([
      fetchAllRows(() => {
        let query = supabase.from('transaksi').select('id, tanggal, total_omset')
          .gte('tanggal', fromDate).lte('tanggal', toDate)
        if (workflowReady) query = query.in('payment_status', ['lunas', 'refund'])
        return query.order('id')
      }),
      workflowReady ? fetchAllRows(() => supabase.from('transaksi').select('id, refunded_at, total_omset')
        .eq('payment_status', 'refund').gte('refunded_at', refundRange.from).lt('refunded_at', refundRange.through).order('id')) : Promise.resolve([]),
      fetchAllRows(() => supabase.from('pembelian_bahan').select('id, tanggal, total')
        .gte('tanggal', fromDate).lte('tanggal', toDate).order('id')),
      fetchAllRows(() => supabase.from('pengeluaran_operasional').select('id, tanggal, jumlah')
        .gte('tanggal', fromDate).lte('tanggal', toDate).order('id')),
    ])

    const map = {}
    for (let i = days - 1; i >= 0; i--) {
      const d = format(subDays(new Date(), i), 'yyyy-MM-dd')
      map[d] = { tanggal: d, omset: 0, modal: 0, operasional: 0 }
    }
    trx?.forEach(r => {
      if (map[r.tanggal]) map[r.tanggal].omset += Number(r.total_omset || 0)
    })
    refunds.forEach(r => {
      const date = jakartaDate(r.refunded_at)
      if (map[date]) map[date].omset -= Number(r.total_omset || 0)
    })
    beli?.forEach(r => {
      if (map[r.tanggal]) map[r.tanggal].modal += Number(r.total || 0)
    })
    ops.forEach(r => {
      if (map[r.tanggal]) map[r.tanggal].operasional += Number(r.jumlah || 0)
    })

    const colors = chartThemeColors(chartSettings.settings.theme)
    if (request === latestFetch.current) setChartData(Object.values(map).map(d => ({
      ...d,
      label: format(new Date(d.tanggal + 'T00:00:00'), 'd MMM', { locale: localeId }),
      untung: d.omset - d.modal - d.operasional,
      colors,
    })))
  }

  const fetchTopMenu = async (request, workflowReady) => {
    const { fromDate, toDate } = getRange(period)
    const data = await fetchAllRows(() => {
      let query = supabase.from('transaksi_detail')
        .select(`id, nama_menu, jumlah_porsi, subtotal_omset, transaksi!inner(tanggal${workflowReady ? ', payment_status' : ''})`)
        .gte('transaksi.tanggal', fromDate).lte('transaksi.tanggal', toDate)
      if (workflowReady) query = query.in('transaksi.payment_status', ['lunas', 'refund'])
      return query.order('id')
    })
    const map = {}
    data.forEach(d => {
      if (!map[d.nama_menu]) map[d.nama_menu] = { nama: d.nama_menu, porsi: 0, omset: 0 }
      map[d.nama_menu].porsi += d.jumlah_porsi
      map[d.nama_menu].omset += Number(d.subtotal_omset || 0)
    })
    if (request === latestFetch.current) setTopMenu(Object.values(map).sort((a, b) => b.porsi - a.porsi).slice(0, 5))
  }

  const fetchLowStock = async (request) => {
    const { data, error } = await supabase
      .from('menu')
      .select('id, nama, stok_menu')
      .not('stok_menu', 'is', null)
      .lt('stok_menu', 5)
    if (error) throw error
    if (request == null || request === latestFetch.current) setLowStock(data || [])
  }

  const fetchRecentTrx = async (request, workflowReady) => {
    let query = supabase
      .from('transaksi')
      .select('id, kode, tanggal, channel, total_omset, total_untung')
    if (workflowReady) query = query.eq('payment_status', 'lunas')
    const { data, error } = await query.order('created_at', { ascending: false }).limit(5)
    if (error) throw error
    if (request === latestFetch.current) setRecentTrx(data || [])
  }

  const channelColor = { Tunai: 'green', QRIS: 'blue', 'Ojek Online': 'orange' }

  const colors = chartThemeColors(chartSettings.settings.theme)
  const showOmset = chartSettings.settings.series.omset
  const showUntung = chartSettings.settings.series.untung

  return (
    <div className="dashboard-page">
      {/* Header */}
      <div className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <p className="dashboard-eyebrow">99FOODS / RINGKASAN USAHA</p>
          <h1>DASH<br />BOARD<span>.</span></h1>
          <p className="dashboard-intro">Ringkasan keuangan dan performa usaha dalam satu pandangan.</p>
          {isDemo && <p className="dashboard-demo-note" role="status">MODE DEMO — Semua angka di halaman ini adalah data contoh.</p>}
        </div>
        <div className="dashboard-hero-side">
          <span className="dashboard-hero-number" aria-hidden="true">99</span>
          <p>PERIODE LAPORAN</p>
          <div className="dashboard-periods" aria-label="Pilih periode laporan">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              aria-pressed={period === p.value}
              className={period === p.value ? 'is-active' : ''}
            >
              {p.label}
            </button>
          ))}
          </div>
        </div>
      </div>

      {fetchError && (
        <Card className="text-sm text-red-600" role="alert">
          Gagal memuat dashboard: {fetchError}. Angka yang tampil mungkin berasal dari pemuatan sebelumnya. <button className="underline" onClick={fetchAll}>Coba lagi</button>
        </Card>
      )}
      {legacySchema && !fetchError && (
        <Card className="text-sm text-amber-700" role="status">Dashboard menampilkan data lama. Fitur status pembayaran dan refund aktif setelah database POS diperbarui.</Card>
      )}
      {loading && <p className="text-sm text-gray-400" role="status">Memuat dashboard...</p>}

      {/* Stats */}
      <div className="dashboard-kpis">
        <StatCard label="Total Omset" value={formatRupiah(stats.omset)} icon={<DashboardIcon name="revenue" size={54} />} />
        <StatCard label="Modal Terpakai" value={formatRupiah(stats.modal)} icon={<DashboardIcon name="expense" size={54} />} />
        <StatCard label="Laba Bersih (Kas)" value={formatRupiah(stats.untung)} icon={<DashboardIcon name="profit" size={54} />} sub="omset - bahan - operasional" />
        <StatCard label="Transaksi" value={stats.transaksi} icon={<DashboardIcon name="transactions" size={54} />} sub="total transaksi" />
      </div>

      {/* Chart + Low Stock */}
      <div className="dashboard-main-grid">
        <Card className="dashboard-chart-panel relative">
          <div className="relative flex items-center justify-between mb-4">
            <div><span className="dashboard-panel-kicker">01 / PERFORMA</span><h2>Tren Omset & Laba Kas</h2></div>
            <div className="relative">
              <ChartToggleButton bind={chartSettings} />
              <ChartSettingsPanel bind={chartSettings} />
            </div>
          </div>
          <ResponsiveContainer width="100%" height={chartSettings.settings.height}>
            {chartSettings.settings.type === 'bar' ? (
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={v => formatRupiah(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {showOmset && <Bar dataKey="omset" name="Omset" fill={colors.omset} radius={[4, 4, 0, 0]} />}
                {showUntung && <Bar dataKey="untung" name="Laba Kas" fill={colors.untung} radius={[4, 4, 0, 0]} />}
              </BarChart>
            ) : chartSettings.settings.type === 'line' ? (
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={v => formatRupiah(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {showOmset && <Line type="monotone" dataKey="omset" name="Omset" stroke={colors.omset} strokeWidth={2} dot={{ r: 3 }} />}
                {showUntung && <Line type="monotone" dataKey="untung" name="Laba Kas" stroke={colors.untung} strokeWidth={2} dot={{ r: 3 }} />}
              </LineChart>
            ) : (
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  {showOmset && (
                    <linearGradient id="gOmset" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={colors.omset} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={colors.omset} stopOpacity={0} />
                    </linearGradient>
                  )}
                  {showUntung && (
                    <linearGradient id="gUntung" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={colors.untung} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={colors.untung} stopOpacity={0} />
                    </linearGradient>
                  )}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={v => formatRupiah(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {showOmset && <Area type="monotone" dataKey="omset" name="Omset" stroke={colors.omset} fill="url(#gOmset)" strokeWidth={1.5} />}
                {showUntung && <Area type="monotone" dataKey="untung" name="Laba Kas" stroke={colors.untung} fill="url(#gUntung)" strokeWidth={1.5} />}
              </AreaChart>
            )}
          </ResponsiveContainer>
        </Card>

        <Card className="dashboard-stock-panel">
          <div className="flex items-center gap-2 mb-3">
            <DashboardIcon name="warning" size={34} />
            <div><span className="dashboard-panel-kicker">02 / PERHATIAN</span><h2>Stok Menipis</h2></div>
            {lowStock.length > 0 && (
              <span className="ml-auto text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full font-medium">
                {lowStock.length} item
              </span>
            )}
          </div>
          {lowStock.length === 0 ? (
            <p className="text-sm text-gray-300 text-center py-6">Semua stok aman ✓</p>
          ) : (
            <div className="space-y-2.5">
              {lowStock.map(b => (
                <div key={b.id} className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{b.nama}</p>
                    <p className="text-xs text-gray-400">Stok: {b.stok_menu} porsi</p>
                  </div>
                  <Badge variant={b.stok_menu <= 0 ? 'red' : 'yellow'}>
                    {b.stok_menu}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Top Menu + Recent Transactions */}
      <div className="dashboard-bottom-grid">
        <Card className="dashboard-list-panel">
          <span className="dashboard-panel-kicker">03 / FAVORIT PELANGGAN</span><h2>Menu Terlaris</h2>
          {topMenu.length === 0 ? (
            <p className="text-sm text-gray-300 text-center py-6">Belum ada data penjualan</p>
          ) : (
            <div className="space-y-3">
              {topMenu.map((m, i) => (
                <div key={m.nama} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-sage-100 text-sage-600 text-xs font-semibold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{m.nama}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-sage-400 rounded-full"
                          style={{ width: `${Math.min(100, (m.porsi / topMenu[0].porsi) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400">{m.porsi} porsi</span>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-sage-600 flex-shrink-0">
                    {formatRupiah(m.omset)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="dashboard-list-panel">
          <span className="dashboard-panel-kicker">04 / AKTIVITAS</span><h2>Transaksi Terbaru</h2>
          {recentTrx.length === 0 ? (
            <p className="text-sm text-gray-300 text-center py-6">Belum ada transaksi</p>
          ) : (
            <div className="space-y-3">
              {recentTrx.map(t => (
                <div key={t.id} className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700">{t.kode}</p>
                    <p className="text-xs text-gray-400">{formatTanggal(t.tanggal)}</p>
                  </div>
                  <Badge variant={channelColor[t.channel] || 'gray'}>{t.channel}</Badge>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-medium text-gray-700">{formatRupiah(t.total_omset)}</p>
                    <p className="text-xs text-sage-600">+{formatRupiah(t.total_untung)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
