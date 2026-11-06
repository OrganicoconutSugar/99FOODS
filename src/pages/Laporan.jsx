import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllRows } from '../lib/fetchAllRows'
import { hasPosWorkflowSchema } from '../lib/posSchema'
import { refundTimeRange, jakartaDate, netOmset } from '../lib/cashLedger'
import { formatRupiah, formatTanggal, toInputDate } from '../utils/format'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Badge from '../components/ui/Badge'
import { Download } from 'lucide-react'
import { BarChart, Bar, AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { useChartSettings, ChartSettingsPanel, ChartToggleButton, CHART_THEMES } from '../components/ui/ChartSettings'
import DashboardIcon from '../components/ui/DashboardIcon'

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
  const [fetchError, setFetchError] = useState('')
  const [legacySchema, setLegacySchema] = useState(false)
  const latestFetch = useRef(0)

  const chartSettings = useChartSettings('laporan')

  useEffect(() => {
    fetchAll()
    const channel = supabase.channel('laporan-transaksi-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transaksi' }, fetchAll)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [dateFrom, dateTo])

  const fetchAll = async () => {
    const request = ++latestFetch.current
    setLoading(true)
    setFetchError('')
    if (!dateFrom || !dateTo || dateFrom > dateTo) {
      setFetchError('Pilih rentang tanggal yang valid')
      setLoading(false)
      return
    }
    try {
      const workflowReady = await hasPosWorkflowSchema(supabase)
      if (request === latestFetch.current) setLegacySchema(!workflowReady)
      const refundRange = refundTimeRange(dateFrom, dateTo)
      const [trx, refunds, bahan, ops] = await Promise.all([
        fetchAllRows(() => {
          let query = supabase.from('transaksi')
            .select('id, kode, tanggal, channel, total_omset, total_modal, total_untung, catatan, transaksi_detail(nama_menu, jumlah_porsi, subtotal_omset)')
            .gte('tanggal', dateFrom).lte('tanggal', dateTo)
          if (workflowReady) query = query.in('payment_status', ['lunas', 'refund'])
          return query.order('id')
        }),
        workflowReady ? fetchAllRows(() => supabase.from('transaksi')
          .select('id, kode, channel, total_omset, refunded_at, refund_reason')
          .eq('payment_status', 'refund').gte('refunded_at', refundRange.from).lt('refunded_at', refundRange.through).order('id')) : Promise.resolve([]),
        fetchAllRows(() => supabase.from('pembelian_bahan')
          .select('id, tanggal, total').gte('tanggal', dateFrom).lte('tanggal', dateTo).order('id')),
        fetchAllRows(() => supabase.from('pengeluaran_operasional')
          .select('id, tanggal, jumlah').gte('tanggal', dateFrom).lte('tanggal', dateTo).order('id')),
      ])
      const totalOmset = netOmset(trx, refunds)
      const totalBahan = bahan.reduce((sum, row) => sum + Number(row.total || 0), 0)
      const totalOps = ops.reduce((sum, row) => sum + Number(row.jumlah || 0), 0)
      if (request !== latestFetch.current) return
      setSummary({ omset: totalOmset, modal: totalBahan, pengeluaran: totalOps,
        untung: totalOmset - totalBahan - totalOps, transaksi: trx.length })

      const menus = {}
      const channels = {}
      const days = {}
      const day = tanggal => (days[tanggal] ||= { tanggal, omset: 0, modal: 0, operasional: 0 })
      trx.forEach(row => {
        const omset = Number(row.total_omset || 0)
        day(row.tanggal).omset += omset
        const channel = (channels[row.channel] ||= { channel: row.channel, omset: 0, count: 0 })
        channel.omset += omset
        channel.count += 1
        row.transaksi_detail?.forEach(detail => {
          const menu = (menus[detail.nama_menu] ||= { nama: detail.nama_menu, porsi: 0, omset: 0 })
          menu.porsi += detail.jumlah_porsi
          menu.omset += Number(detail.subtotal_omset || 0)
        })
      })
      refunds.forEach(row => { day(jakartaDate(row.refunded_at)).omset -= Number(row.total_omset || 0) })
      bahan.forEach(row => { day(row.tanggal).modal += Number(row.total || 0) })
      ops.forEach(row => { day(row.tanggal).operasional += Number(row.jumlah || 0) })
      setTopMenu(Object.values(menus).sort((a, b) => b.porsi - a.porsi))
      setChannelData(Object.values(channels))
      setHarian(Object.values(days).sort((a, b) => a.tanggal.localeCompare(b.tanggal)).map(row => ({
        ...row,
        untung: row.omset - row.modal - row.operasional,
        label: format(new Date(row.tanggal + 'T00:00:00'), 'd/M', { locale: localeId }),
      })))
      setTransaksiList([
        ...trx.map(row => ({ ...row, recordDate: row.tanggal, isRefund: false })),
        ...refunds.map(row => ({ ...row, recordDate: jakartaDate(row.refunded_at), isRefund: true })),
      ].sort((a, b) => b.recordDate.localeCompare(a.recordDate)))
    } catch (error) {
      if (request === latestFetch.current) setFetchError(error.message || 'Gagal memuat laporan')
    } finally {
      if (request === latestFetch.current) setLoading(false)
    }
  }

  const handleExport = async () => {
    if (fetchError || loading) return
    setExporting(true)
    try {
      const XLSX = await import('xlsx')
      const ringkasan = [
        ['99Foods — Laporan Keuangan'],
        [`Periode: ${dateFrom} s/d ${dateTo}`],
        [],
        ['Total Omset', summary.omset],
        ['Modal Terpakai (Pembelian Bahan)', summary.modal],
        ['Laba Bersih (Kas)', summary.untung],
        ['Jumlah Transaksi', summary.transaksi],
        ['Total Pengeluaran (Operasional)', summary.pengeluaran],
      ]
      const trxRows = transaksiList.map(t => ({
        Tanggal: t.recordDate,
        Kode: t.kode,
        Channel: t.channel,
        Jenis: t.isRefund ? 'Refund' : 'Penjualan',
        'Omset (Rp)': (t.isRefund ? -1 : 1) * Number(t.total_omset || 0),
        Catatan: t.isRefund ? t.refund_reason || '' : t.catatan || '',
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
    { label: 'Total Omset', value: summary.omset, icon: 'revenue' },
    { label: 'Modal Terpakai', value: summary.modal, icon: 'expense' },
    { label: 'Laba Bersih (Kas)', value: summary.untung, icon: 'profit', sub: 'omset - bahan - operasional' },
    { label: 'Pengeluaran', value: summary.pengeluaran, icon: 'purchase' },
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
            {showUntung && <Line type="monotone" dataKey="untung" name="Laba Kas" stroke={colors.untung} strokeWidth={2} dot={{ r: 3 }} />}
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
            {showUntung && <Area type="monotone" dataKey="untung" name="Laba Kas" stroke={colors.untung} fill="url(#gUntung)" strokeWidth={1.5} />}
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
            {showUntung && <Bar dataKey="untung" name="Laba Kas" fill={colors.untung} radius={[4, 4, 0, 0]} />}
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
        <Button onClick={handleExport} loading={exporting} disabled={loading || Boolean(fetchError)} variant="outline">
          <Download size={16} /> Export Excel
        </Button>
      </div>

      {fetchError && (
        <Card className="text-sm text-red-600" role="alert">
          Gagal memuat laporan: {fetchError}. Angka yang tampil mungkin berasal dari pemuatan sebelumnya. <button className="underline" onClick={fetchAll}>Coba lagi</button>
        </Card>
      )}
      {legacySchema && !fetchError && (
        <Card className="text-sm text-amber-700" role="status">Laporan menampilkan data dari struktur database lama. Perhitungan refund per tanggal akan aktif setelah migrasi POS dijalankan.</Card>
      )}
      {loading && <p className="text-sm text-gray-400" role="status">Memuat laporan...</p>}

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
            <div className="flex-shrink-0">
              <DashboardIcon name={s.icon} size={44} />
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
          <h2 className="text-sm font-semibold text-gray-700">Omset & Laba Kas Harian</h2>
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
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Penjualan Bruto per Channel</h2>
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
