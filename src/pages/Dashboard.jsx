import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatRupiah, formatTanggal } from '../utils/format'
import StatCard from '../components/ui/StatCard'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import { AlertTriangle } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'
import { subDays, format, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { useChartSettings, ChartSettingsPanel, ChartToggleButton, CHART_THEMES } from '../components/ui/ChartSettings'
import omsetLogo from '../assets/element/omsetlogo.png'
import profitLogo from '../assets/element/profitlogo.png'
import modalLogo from '../assets/element/modallogo.png'
import transaksiLogo from '../assets/element/transaksilogo.png'

const PERIODS = [
  { label: 'Hari Ini', value: 'today' },
  { label: '7 Hari',   value: 'week' },
  { label: 'Bulan Ini', value: 'month' },
]

function getRange(period) {
  const now = new Date()
  if (period === 'today') return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() }
  if (period === 'week')  return { from: startOfDay(subDays(now, 6)).toISOString(), to: endOfDay(now).toISOString() }
  return { from: startOfMonth(now).toISOString(), to: endOfMonth(now).toISOString() }
}

function chartThemeColors(theme) {
  return CHART_THEMES[theme] || CHART_THEMES.sage
}

export default function Dashboard() {
  const [period, setPeriod] = useState('week')
  const [stats, setStats] = useState({ omset: 0, modal: 0, untung: 0, transaksi: 0 })
  const [chartData, setChartData] = useState([])
  const [topMenu, setTopMenu] = useState([])
  const [lowStock, setLowStock] = useState([])
  const [recentTrx, setRecentTrx] = useState([])
  const [loading, setLoading] = useState(true)

  const chartSettings = useChartSettings('dashboard')

  useEffect(() => {
    fetchAll()
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transaksi' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu' }, fetchLowStock)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [period])

  const fetchAll = async () => {
    setLoading(true)
    await Promise.all([fetchStats(), fetchChart(), fetchTopMenu(), fetchLowStock(), fetchRecentTrx()])
    setLoading(false)
  }

  const fetchStats = async () => {
    const { from, to } = getRange(period)
    const fromDate = from.split('T')[0]
    const toDate   = to.split('T')[0]
    const [{ data: trx }, { data: bahan }] = await Promise.all([
      supabase
        .from('transaksi')
        .select('total_omset, total_modal, total_untung')
        .gte('created_at', from).lte('created_at', to),
      supabase
        .from('pembelian_bahan')
        .select('total')
        .gte('tanggal', fromDate).lte('tanggal', toDate),
    ])
    if (trx) {
      const totalOmset = trx.reduce((s, r) => s + (r.total_omset || 0), 0)
      const totalBeli  = bahan?.reduce((s, r) => s + (r.total || 0), 0) || 0
      setStats({
        omset:     totalOmset,
        modal:     totalBeli,
        untung:    totalOmset - totalBeli,
        transaksi: trx.length,
      })
    }
  }

  const fetchChart = async () => {
    const days = period === 'today' ? 1 : period === 'week' ? 7 : 30
    const { from, to } = getRange(period)
    const fromDate = from.split('T')[0]
    const toDate   = to.split('T')[0]
    const [{ data: trx }, { data: beli }] = await Promise.all([
      supabase
        .from('transaksi')
        .select('tanggal, total_omset')
        .gte('tanggal', fromDate).lte('tanggal', toDate)
        .order('tanggal'),
      supabase
        .from('pembelian_bahan')
        .select('tanggal, total')
        .gte('tanggal', fromDate).lte('tanggal', toDate)
        .order('tanggal'),
    ])

    const map = {}
    for (let i = days - 1; i >= 0; i--) {
      const d = format(subDays(new Date(), i), 'yyyy-MM-dd')
      map[d] = { tanggal: d, omset: 0, modal: 0 }
    }
    trx?.forEach(r => {
      if (map[r.tanggal]) map[r.tanggal].omset += r.total_omset || 0
    })
    beli?.forEach(r => {
      if (map[r.tanggal]) map[r.tanggal].modal += r.total || 0
    })

    const colors = chartThemeColors(chartSettings.settings.theme)
    setChartData(Object.values(map).map(d => ({
      ...d,
      label: format(new Date(d.tanggal + 'T00:00:00'), 'd MMM', { locale: localeId }),
      untung: d.omset - d.modal,
      colors,
    })))
  }

  const fetchTopMenu = async () => {
    const { from, to } = getRange(period)
    const { data } = await supabase
      .from('transaksi_detail')
      .select('nama_menu, jumlah_porsi, subtotal_omset')
      .gte('created_at', from).lte('created_at', to)
    if (data) {
      const map = {}
      data.forEach(d => {
        if (!map[d.nama_menu]) map[d.nama_menu] = { nama: d.nama_menu, porsi: 0, omset: 0 }
        map[d.nama_menu].porsi  += d.jumlah_porsi
        map[d.nama_menu].omset  += d.subtotal_omset || 0
      })
      setTopMenu(Object.values(map).sort((a, b) => b.porsi - a.porsi).slice(0, 5))
    }
  }

  const fetchLowStock = async () => {
    const { data } = await supabase
      .from('menu')
      .select('id, nama, stok_menu')
      .not('stok_menu', 'is', null)
      .lt('stok_menu', 5)
    if (data) setLowStock(data)
  }

  const fetchRecentTrx = async () => {
    const { data } = await supabase
      .from('transaksi')
      .select('id, kode, tanggal, channel, total_omset, total_untung')
      .order('created_at', { ascending: false }).limit(5)
    if (data) setRecentTrx(data)
  }

  const channelColor = { Tunai: 'green', QRIS: 'blue', 'Ojek Online': 'orange' }

  const colors = chartThemeColors(chartSettings.settings.theme)
  const showOmset = chartSettings.settings.series.omset
  const showUntung = chartSettings.settings.series.untung

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Dashboard</h1>
          <p className="text-sm text-gray-400">Ringkasan keuangan & performa usaha</p>
        </div>
        <div className="overflow-x-auto flex gap-1 bg-gray-100 rounded-lg p-1 scrollbar-thin pb-1">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                period === p.value ? 'bg-white text-gray-800' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Omset"    value={formatRupiah(stats.omset)}  icon={omsetLogo}       color="blue" />
        <StatCard label="Modal Terpakai" value={formatRupiah(stats.modal)}  icon={modalLogo}       color="orange" />
        <StatCard label="Profit Bersih"  value={formatRupiah(stats.untung)} icon={profitLogo}      color="sage" sub="omset - belanja bahan" />
        <StatCard label="Transaksi"      value={stats.transaksi}            icon={transaksiLogo}   color="purple" sub="total transaksi" />
      </div>

      {/* Chart + Low Stock */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2 relative">
          <div className="relative flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-gray-600">Tren Omset & Profit</h2>
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
                {showUntung && <Bar dataKey="untung" name="Profit" fill={colors.untung} radius={[4, 4, 0, 0]} />}
              </BarChart>
            ) : chartSettings.settings.type === 'line' ? (
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={v => formatRupiah(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {showOmset && <Line type="monotone" dataKey="omset" name="Omset" stroke={colors.omset} strokeWidth={2} dot={{ r: 3 }} />}
                {showUntung && <Line type="monotone" dataKey="untung" name="Profit" stroke={colors.untung} strokeWidth={2} dot={{ r: 3 }} />}
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
                {showUntung && <Area type="monotone" dataKey="untung" name="Profit" stroke={colors.untung} fill="url(#gUntung)" strokeWidth={1.5} />}
              </AreaChart>
            )}
          </ResponsiveContainer>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={15} className="text-amber-400" />
            <h2 className="text-sm font-medium text-gray-600">Stok Makanan kurang dari 5</h2>
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
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <h2 className="text-sm font-medium text-gray-600 mb-4">Menu Terlaris</h2>
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

        <Card>
          <h2 className="text-sm font-medium text-gray-600 mb-4">Transaksi Terbaru</h2>
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