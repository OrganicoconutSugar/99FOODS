import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { formatRupiah, formatTanggal, toInputDate, generateKodeTransaksi } from '../utils/format'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Modal from '../components/ui/Modal'
import Badge from '../components/ui/Badge'
import StrukPrint from '../components/ui/StrukPrint'
import { Plus, Trash2, Receipt, Search, X, Printer } from 'lucide-react'
import toast from 'react-hot-toast'

const CHANNELS    = ['Tunai', 'QRIS', 'Ojek Online']
const channelColor = { Tunai: 'green', QRIS: 'blue', 'Ojek Online': 'orange' }

export default function Penjualan() {
  const [transaksi, setTransaksi]   = useState([])
  const [menus, setMenus]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [modal, setModal]           = useState(false)
  const [detailModal, setDetailModal] = useState(false)
  const [activeDetail, setActiveDetail] = useState([])
  const [activeTrx, setActiveTrx]   = useState(null)
  const [saving, setSaving]         = useState(false)
  const [search, setSearch]         = useState('')
  const [filterChannel, setFilterChannel] = useState('semua')
  const printRef = useRef()

  // Form
  const [namaCustomer, setNamaCustomer] = useState('')
  const [channel, setChannel]   = useState('Tunai')
  const [tanggal, setTanggal]   = useState(toInputDate())
  const [catatan, setCatatan]   = useState('')
  const [items, setItems]       = useState([{ menu_id: '', jumlah: 1 }])

  useEffect(() => {
    fetchTransaksi()
    fetchMenus()
    const ch = supabase.channel('penjualan-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transaksi' }, fetchTransaksi)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  const fetchTransaksi = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('transaksi').select('*')
      .order('tanggal', { ascending: false })
      .order('created_at', { ascending: false })
    setTransaksi(data || [])
    setLoading(false)
  }

  const fetchMenus = async () => {
    const { data } = await supabase.from('menu').select('id, nama, harga_jual, hpp').eq('aktif', true).order('nama')
    setMenus(data || [])
  }

  const openModal = () => {
    setNamaCustomer(''); setChannel('Tunai'); setTanggal(toInputDate()); setCatatan('')
    setItems([{ menu_id: menus[0]?.id || '', jumlah: 1 }])
    setModal(true)
  }

  const addItem    = () => setItems(p => [...p, { menu_id: menus[0]?.id || '', jumlah: 1 }])
  const removeItem = (i) => setItems(p => p.filter((_, idx) => idx !== i))
  const updateItem = (i, f, v) => setItems(p => p.map((it, idx) => idx === i ? { ...it, [f]: v } : it))

  const calcTotal = () => items.reduce((s, it) => {
    const m = menus.find(x => x.id === it.menu_id)
    return s + (m ? m.harga_jual * (parseInt(it.jumlah) || 0) : 0)
  }, 0)

  const calcModal = () => items.reduce((s, it) => {
    const m = menus.find(x => x.id === it.menu_id)
    return s + (m ? m.hpp * (parseInt(it.jumlah) || 0) : 0)
  }, 0)

  const handleSave = async () => {
    if (items.some(it => !it.menu_id || !it.jumlah)) return toast.error('Lengkapi semua item')
    setSaving(true)
    try {
      const kode = generateKodeTransaksi()
      const { data: trxData, error: trxErr } = await supabase
        .from('transaksi')
        .insert({
          kode, tanggal, channel,
          nama_customer: namaCustomer.trim() || null,
          total_omset: 0, total_modal: 0,
          catatan: catatan || null,
        })
        .select().single()
      if (trxErr) throw trxErr

      const details = items.map(item => {
        const m = menus.find(x => x.id === item.menu_id)
        return { transaksi_id: trxData.id, menu_id: item.menu_id, nama_menu: m?.nama || '', jumlah_porsi: parseInt(item.jumlah), harga_jual: m?.harga_jual || 0, hpp: m?.hpp || 0 }
      })
      const { error: detErr } = await supabase.from('transaksi_detail').insert(details)
      if (detErr) throw detErr

      const { error: fnErr } = await supabase.rpc('proses_transaksi', { p_transaksi_id: trxData.id })
      if (fnErr) throw fnErr

      toast.success(`Transaksi ${kode} disimpan`)
      setModal(false)
      fetchTransaksi()
    } catch (err) {
      toast.error(err.message || 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  const openDetail = async (trx) => {
    setActiveTrx(trx)
    const { data } = await supabase.from('transaksi_detail').select('*').eq('transaksi_id', trx.id)
    setActiveDetail(data || [])
    setDetailModal(true)
  }

  const handlePrint = () => window.print()

  const filtered = transaksi
    .filter(t => {
      const q = search.toLowerCase()
      return t.kode?.toLowerCase().includes(q) || t.nama_customer?.toLowerCase().includes(q)
    })
    .filter(t => filterChannel === 'semua' || t.channel === filterChannel)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Transaksi Penjualan</h1>
          <p className="text-sm text-gray-400">Riwayat semua transaksi</p>
        </div>
        <Button onClick={openModal}><Plus size={14} /> Transaksi Manual</Button>
      </div>

      {/* Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-100 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-sage-300"
            placeholder="Cari kode atau nama customer..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="overflow-x-auto flex gap-1 bg-gray-100 rounded-lg p-1 flex-shrink-0 scrollbar-thin pb-1">
          {['semua', ...CHANNELS].map(ch => (
            <button
              key={ch}
              onClick={() => setFilterChannel(ch)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filterChannel === ch ? 'bg-white text-gray-800' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {ch}
            </button>
          ))}
        </div>
      </div>

      {/* Tabel */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Kode</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Tanggal</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Customer</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Channel</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Omset</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Modal</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Untung</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-10 text-gray-300 text-sm">Memuat...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <Receipt size={32} className="mx-auto text-gray-200 mb-2" />
                    <p className="text-sm text-gray-300">Belum ada transaksi</p>
                  </td>
                </tr>
              ) : filtered.map(t => (
                <tr key={t.id} className="hover:bg-gray-50/60 cursor-pointer" onClick={() => openDetail(t)}>
                  <td className="px-4 py-3 font-medium text-sage-600 text-xs">{t.kode}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{formatTanggal(t.tanggal)}</td>
                  <td className="px-4 py-3 text-gray-600">{t.nama_customer || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3"><Badge variant={channelColor[t.channel] || 'gray'}>{t.channel}</Badge></td>
                  <td className="px-4 py-3 text-right font-medium text-gray-700">{formatRupiah(t.total_omset)}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{formatRupiah(t.total_modal)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-sage-600">{formatRupiah(t.total_untung)}</td>
                  <td className="px-4 py-3 text-gray-300 text-xs text-right">Detail →</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Modal Input Manual ── */}
      <Modal open={modal} onClose={() => setModal(false)} title="Transaksi Manual" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nama Customer" value={namaCustomer} onChange={e => setNamaCustomer(e.target.value)} placeholder="Opsional" />
            <Input label="Tanggal" type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} />
          </div>
          <Select label="Channel Pembayaran" value={channel} onChange={e => setChannel(e.target.value)}>
            {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-600">Item Terjual</label>
              <Button size="sm" variant="secondary" onClick={addItem}><Plus size={12} /> Item</Button>
            </div>
            <div className="space-y-2">
              {items.map((item, i) => {
                const m = menus.find(x => x.id === item.menu_id)
                return (
                  <div key={i} className="flex items-end gap-2 bg-gray-50 rounded-lg p-3">
                    <div className="flex-1">
                      <Select label="Menu" value={item.menu_id} onChange={e => updateItem(i, 'menu_id', e.target.value)}>
                        <option value="">Pilih menu...</option>
                        {menus.map(x => <option key={x.id} value={x.id}>{x.nama} — {formatRupiah(x.harga_jual)}</option>)}
                      </Select>
                    </div>
                    <div className="w-20">
                      <Input label="Porsi" type="number" min="1" value={item.jumlah} onChange={e => updateItem(i, 'jumlah', e.target.value)} />
                    </div>
                    <div className="pb-1 flex flex-col items-end gap-1">
                      {m && <span className="text-xs text-gray-400">{formatRupiah(m.harga_jual * (parseInt(item.jumlah) || 0))}</span>}
                      {items.length > 1 && (
                        <button onClick={() => removeItem(i)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400">
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-sage-50 rounded-xl p-4 grid grid-cols-3 gap-3 text-center">
            <div><p className="text-xs text-gray-400">Omset</p><p className="font-bold text-gray-800">{formatRupiah(calcTotal())}</p></div>
            <div><p className="text-xs text-gray-400">Modal</p><p className="font-bold text-gray-600">{formatRupiah(calcModal())}</p></div>
            <div><p className="text-xs text-gray-400">Untung</p><p className="font-bold text-sage-600">{formatRupiah(calcTotal() - calcModal())}</p></div>
          </div>

          <Input label="Catatan (opsional)" value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Pre-order, dll" />

          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setModal(false)}>Batal</Button>
            <Button className="flex-1" onClick={handleSave} loading={saving}>Simpan Transaksi</Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal Detail + Cetak ── */}
      <Modal open={detailModal} onClose={() => setDetailModal(false)} title={`Detail — ${activeTrx?.kode}`} size="md">
        <div className="space-y-4">
          {/* Info header */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm bg-gray-50 rounded-xl p-4">
            <div>
              <p className="text-xs text-gray-400">Tanggal</p>
              <p className="font-medium text-gray-700">{formatTanggal(activeTrx?.tanggal)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Channel</p>
              <Badge variant={channelColor[activeTrx?.channel] || 'gray'}>{activeTrx?.channel}</Badge>
            </div>
            {activeTrx?.nama_customer && (
              <div className="col-span-2">
                <p className="text-xs text-gray-400">Customer</p>
                <p className="font-medium text-gray-700">{activeTrx.nama_customer}</p>
              </div>
            )}
          </div>

          {/* Tabel item */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Menu</th>
                <th className="text-center py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Porsi</th>
                <th className="text-right py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Subtotal</th>
                <th className="text-right py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Untung</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {activeDetail.map(d => (
                <tr key={d.id}>
                  <td className="py-2.5 text-gray-700">{d.nama_menu}</td>
                  <td className="py-2.5 text-center text-gray-500">{d.jumlah_porsi}×</td>
                  <td className="py-2.5 text-right text-gray-700">{formatRupiah(d.subtotal_omset)}</td>
                  <td className="py-2.5 text-right text-sage-600 font-medium">{formatRupiah(d.subtotal_omset - d.subtotal_modal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Total */}
          <div className="flex items-center justify-between border-t border-gray-100 pt-3">
            <div className="text-sm text-gray-500">
              Total Untung: <span className="font-semibold text-sage-600">{formatRupiah(activeTrx?.total_untung)}</span>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Total Omset</p>
              <p className="text-lg font-bold text-gray-800">{formatRupiah(activeTrx?.total_omset)}</p>
            </div>
          </div>

          {/* Tombol cetak */}
          <Button className="w-full" onClick={handlePrint}>
            <Printer size={14} /> Cetak Struk
          </Button>
        </div>
      </Modal>

      {/* Area struk untuk print — hidden di layar, muncul saat print */}
      <StrukPrint ref={printRef} transaksi={activeTrx} detail={activeDetail} />
    </div>
  )
}
