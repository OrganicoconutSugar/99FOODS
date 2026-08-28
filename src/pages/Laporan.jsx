import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatRupiah, formatTanggal, toInputDate } from '../utils/format'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Badge from '../components/ui/Badge'
import { Download } from 'lucide-react'
import { BarChart, Bar, AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'
import { useChartSettings, ChartSettingsPanel, ChartToggleButton, CHART_THEMES } from '../components/ui/ChartSettings'
import omsetLogo from '../assets/element/omsetlogo.png'
import profitLogo from '../assets/element/profitlogo.png'
import modalLogo from '../assets/element/modallogo.png'
import transaksiLogo from '../assets/element/transaksilogo.png'

const COLORS_CHANNEL = ['#f97316', '#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#ef4444']

function chartThemeColors(theme) {
  return CHART_THEMES[theme] || CHART_THEMES.sage
}

export default function Laporan() {
  const now = new Date()
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(now), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(format(endOfMonth(now), 'yyyy-MM-dd'))
  const [summary, setSummary] = useState({ omset: 0, modal: 0, untung: 0, transaksi: 0, pengeluaran: 0 })
  const [topMenu, setTopMenu] = useState([])
  const [channelData, setChannelData] = useState([])
  const [harian, setHarian] = useState([])
  const [transaksiList, setTransaksiList] = useState([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const chartSettings = useChartSettings('laporan')

  useEffect(() => { fetchAll() }, [dateFrom, dateTo])

  const fetchAll = async () => {
    setLoading(true)
    await Promise.all([fetchSummary(), fetchTopMenu(), fetchChannelData(), fetchHarian(), fetchTransaksiList()])
    setLoading(false)
  }

  const fetchSummary = async () => {
    const [{ data: trx }, { data: ops }, { data: bahan }] = await Promise.all([
      supabase.from('transaksi').select('total_omset, total_modal, total_untung').gte('tanggal', dateFrom).lte('tanggal', dateTo),
      supabase.from('pengeluaran_operasional').select('jumlah').gte('tanggal', dateFrom).lte('tanggal', dateTo),
      supabase.from('pembelian_bahan').select('total').gte('tanggal', dateFrom).lte('tanggal', dateTo),
    ])
    const totalOmset     = trx?.reduce((s, r) => s + (r.total_omset || 0), 0) || 0
    const totalBeliBahan = bahan?.reduce((s, r) => s + (r.total || 0), 0) || 0
    const totalOps       = ops?.reduce((s, r) => s + (r.jumlah || 0), 0) || 0
    setSummary({
      omset:       totalOmset,
      modal:       totalBeliBahan,
      untung:      totalOmset - totalBeliBahan,
      transaksi:   trx?.length || 0,
      pengeluaran: totalOps,
    })
  }

  const fetchTopMenu = async () => {
    const { data } = await supabase
      .from('transaksi_detail')
      .select('nama_menu, jumlah_porsi, subtotal_omset')
      .gte('created_at', dateFrom + 'T00:00:00')
      .lte('created_at', dateTo + 'T23:59:59')
    if (data) {
      const map = {}
      data.forEach(d => {
        if (!map[d.nama_menu]) map[d.nama_menu] = { nama: d.nama_menu, porsi: 0, omset: 0 }
        map[d.nama_menu].porsi += d.jumlah_porsi
        map[d.nama_menu].omset += d.subtotal_omset || 0
      })
      setTopMenu(Object.values(map).sort((a, b) => b.porsi - a.porsi))
    }
  }

  const fetchChannelData = async () => {
    const { data } = await supabase
      .from('transaksi')
      .select('channel, total_omset')
      .gte('tanggal', dateFrom)
      .lte('tanggal', dateTo)
    if (data) {
      const map = {}
      data.forEach(d => {
        if (!map[d.channel]) map[d.channel] = { channel: d.channel, omset: 0, count: 0 }
        map[d.channel].omset += d.total_omset || 0
        map[d.channel].count += 1
      })
      setChannelData(Object.values(map))
    }
  }

  const fetchHarian = async () => {
    const [{ data: trx }, { data: beli }] = await Promise.all([
      supabase
        .from('transaksi')
        .select('tanggal, total_omset')
        .gte('tanggal', dateFrom).lte('tanggal', dateTo)
        .order('tanggal'),
      supabase
        .from('pembelian_bahan')
        .select('tanggal, total')
        .gte('tanggal', dateFrom).lte('tanggal', dateTo)
        .order('tanggal'),
    ])
    const map = {}
    trx?.forEach(d => {
      if (!map[d.tanggal]) map[d.tanggal] = { tanggal: d.tanggal, omset: 0, modal: 0 }
      map[d.tanggal].omset += d.total_omset || 0
    })
    beli?.forEach(d => {
      if (!map[d.tanggal]) map[d.tanggal] = { tanggal: d.tanggal, omset: 0, modal: 0 }
      map[d.tanggal].modal += d.total || 0
    })
    setHarian(Object.values(map).map(d => ({
      ...d,
      untung: d.omset - d.modal,
      label: format(new Date(d.tanggal + 'T00:00:00'), 'd/M', { locale: localeId }),
    })))
  }

  const fetchTransaksiList = async () => {
    const { data } = await supabase
      .from('transaksi')
      .select('*, transaksi_detail(*)')
      .gte('tanggal', dateFrom)
      .lte('tanggal', dateTo)
      .order('tanggal', { ascending: false })
    setTransaksiList(data || [])
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const ringkasan = [
        ['99Foods — Laporan Keuangan'],
        [`Periode: ${dateFrom} s/d ${dateTo}`],
        [],
        ['Total Omset', summary.omset],
        ['Modal Terpakai (Pembelian Bahan)', summary.modal],
        ['Profit Bersih', summary.untung],
        ['Jumlah Transaksi', summary.transaksi],
        ['Total Pengeluaran (Operasional)', summary.pengeluaran],
      ]
      const trxRows = transaksiList.map(t => ({
        Tanggal: t.tanggal,
        Kode: t.kode,
        Channel: t.channel,
        'Omset (Rp)': t.total_omset,
        Catatan: t.catatan || '',
      }))
      const menuRows = topMenu.map((m, i) => ({
        Rank: i + 1,
        Menu: m.nama,
        'Total Porsi': m.porsi,
        'Omset (Rp)': m.omset,
      }))

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ringkasan), 'Ringkasan')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trxRows), 'Transaksi')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(menuRows), 'Menu Terlaris')
      XLSX.writeFile(wb, `99foods_laporan_${dateFrom}_${dateTo}.xlsx`)
      toast.success('Laporan berhasil diunduh')
    } catch (err) {
      toast.error('Gagal export: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  const statItems = [
    { label: 'Total Omset',    value: summary.omset,       icon: omsetLogo,     bg: 'bg-sky-50' },
    { label: 'Modal Terpakai', value: summary.modal,       icon: modalLogo,     bg: 'bg-amber-50' },
    { label: 'Profit Bersih',  value: summary.untung,      icon: profitLogo,    bg: 'bg-sage-50', sub: 'omset - belanja bahan' },
    { label: 'Pengeluaran',    value: summary.pengeluaran, icon: transaksiLogo, bg: 'bg-red-50' },
  ]

  const colors = chartThemeColors(chartSettings.settings.theme)
  const showOmset = chartSettings.settings.series.omset
  const showUntung = chartSettings.settings.series.untung

  const renderChartType = (data, height) => {
    const common = { data, margin: { top: 5, right: 10, left: 0, bottom: 0 } }
    switch (chartSettings.settings.type) {
      case 'line':
        return (
          <LineChart {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={v => formatRupiah(v)} />
            <Legend />
            {showOmset && <Line type="monotone" dataKey="omset" name="Omset" stroke={colors.omset} strokeWidth={2} dot={{ r: 3 }} />}
            {showUntung && <Line type="monotone" dataKey="untung" name="Profit" stroke={colors.untung} strokeWidth={2} dot={{ r: 3 }} />}
          </LineChart>
        )
      case 'area':
        return (
          <AreaChart {...common}>
            <defs>
              <linearGradient id="gOmset" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={colors.omset} stopOpacity={0.15} />
                <stop offset="95%" stopColor={colors.omset} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gUntung" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={colors.untung} stopOpacity={0.15} />
                <stop offset="95%" stopColor={colors.untung} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={v => formatRupiah(v)} />
            <Legend />
            {showOmset && <Area type="monotone" dataKey="omset" name="Omset" stroke={colors.omset} fill="url(#gOmset)" strokeWidth={1.5} />}
            {showUntung && <Area type="monotone" dataKey="untung" name="Profit" stroke={colors.untung} fill="url(#gUntung)" strokeWidth={1.5} />}
          </AreaChart>
        )
      default: // bar
        return (
          <BarChart {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={v => formatRupiah(v)} />
            <Legend />
            {showOmset && <Bar dataKey="omset" name="Omset" fill={colors.omset} radius={[4, 4, 0, 0]} />}
            {showUntung && <Bar dataKey="untung" name="Profit" fill={colors.untung} radius={[4, 4, 0, 0]} />}
          </BarChart>
        )
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Laporan & Analitik</h1>
          <p className="text-sm text-gray-500">Rekap keuangan dan performa menu</p>
        </div>
        <Button onClick={handleExport} loading={exporting} variant="outline">
          <Download size={16} /> Export Excel
        </Button>
      </div>

      {/* Date Range */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <Input label="Dari Tanggal" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <Input label="Sampai Tanggal" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          <div className="flex gap-2">
            {[
              { label: 'Bulan Ini', from: format(startOfMonth(now), 'yyyy-MM-dd'), to: format(endOfMonth(now), 'yyyy-MM-dd') },
              { label: 'Bulan Lalu', from: format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd'), to: format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd') },
            ].map(q => (
              <Button key={q.label} size="sm" variant="secondary" onClick={() => { setDateFrom(q.from); setDateTo(q.to) }}>
                {q.label}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statItems.map(s => (
          <Card key={s.label} className="flex items-start gap-3 min-w-0">
            <div className={`rounded-xl p-2.5 flex-shrink-0 ${s.bg}`}>
              <img src={s.icon} alt="" className="w-6 h-6 object-contain" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400">{s.label}</p>
              <p className="font-bold text-gray-900 text-sm whitespace-nowrap">{formatRupiah(s.value)}</p>
              {s.sub && <p className="text-[10px] text-gray-400 mt-0.5">{s.sub}</p>}
            </div>
          </Card>
        ))}
      </div>

      {/* Chart Harian */}
      <Card className="relative">
        <div className="relative flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">Omset & Profit Harian</h2>
          <div className="relative">
            <ChartToggleButton bind={chartSettings} />
            <ChartSettingsPanel bind={chartSettings} />
          </div>
        </div>
        {harian.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">Tidak ada data periode ini</p>
        ) : (
          <ResponsiveContainer width="100%" height={chartSettings.settings.height}>
            {renderChartType(harian)}
          </ResponsiveContainer>
        )}
      </Card>

      {/* Channel Pie + Top Menu */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Omset per Channel</h2>
          {channelData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">Tidak ada data</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={channelData} dataKey="omset" nameKey="channel" cx="50%" cy="50%" outerRadius={70} label={({ channel }) => channel}>
                    {channelData.map((_, i) => <Cell key={i} fill={COLORS_CHANNEL[i % COLORS_CHANNEL.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => formatRupiah(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {channelData.map((c, i) => (
                  <div key={c.channel} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: COLORS_CHANNEL[i % COLORS_CHANNEL.length] }} />
                      <span className="text-gray-700">{c.channel}</span>
                    </div>
                    <span className="font-medium text-gray-800">{formatRupiah(c.omset)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        <Card className="xl:col-span-2">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Performa Menu</h2>
          {topMenu.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Tidak ada data penjualan pada periode ini</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 pr-4 font-semibold text-gray-500">#</th>
                    <th className="text-left py-2 pr-4 font-semibold text-gray-500">Menu</th>
                    <th className="text-right py-2 pr-4 font-semibold text-gray-500">Porsi Terjual</th>
                    <th className="text-right py-2 font-semibold text-gray-500">Omset</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {topMenu.map((m, i) => (
                    <tr key={m.nama} className="hover:bg-gray-50">
                      <td className="py-2.5 pr-4 text-gray-400">{i + 1}</td>
                      <td className="py-2.5 pr-4 font-medium text-gray-800">{m.nama}</td>
                      <td className="py-2.5 pr-4 text-right text-gray-600">{m.porsi} porsi</td>
                      <td className="py-2.5 text-right text-gray-800">{formatRupiah(m.omset)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}