import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { saveTransaction } from '../lib/transactions'
import { createPendingQris, confirmQris, cancelPendingQris, refundTransaction } from '../lib/posWorkflow'
import { hasPosWorkflowSchema } from '../lib/posSchema'
import { formatRupiah, formatTanggal, toInputDate } from '../utils/format'
import { createRequestId } from '../utils/requestId'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Modal from '../components/ui/Modal'
import Badge from '../components/ui/Badge'
import StrukPrint from '../components/ui/StrukPrint'
import BluetoothPrintButton from '../components/ui/BluetoothPrintButton'
import { Plus, Trash2, Receipt, Search, X, Printer } from 'lucide-react'
import toast from 'react-hot-toast'
import qrisImage from '../assets/qris-99foods.png'

const CHANNELS    = ['Tunai', 'QRIS', 'Ojek Online']
const channelColor = { Tunai: 'green', QRIS: 'blue', 'Ojek Online': 'orange' }
const paymentLabels = { menunggu: 'Menunggu Bayar', lunas: 'Lunas', dibatalkan: 'Dibatalkan', refund: 'Refund' }
const paymentColors = { menunggu: 'yellow', lunas: 'green', dibatalkan: 'gray', refund: 'red' }
const orderLabels = { menunggu_pembayaran: 'Menunggu Bayar', baru: 'Baru', diproses: 'Diproses', siap: 'Siap', diserahkan: 'Diserahkan', dibatalkan: 'Dibatalkan' }
const PAGE_SIZE = 25

export default function Penjualan() {
  const [transaksi, setTransaksi]   = useState([])
  const [menus, setMenus]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [modal, setModal]           = useState(false)
  const [detailModal, setDetailModal] = useState(false)
  const [activeDetail, setActiveDetail] = useState([])
  const [activeEvents, setActiveEvents] = useState([])
  const [activeTrx, setActiveTrx]   = useState(null)
  const [saving, setSaving]         = useState(false)
  const [pendingManual, setPendingManual] = useState(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [actionReason, setActionReason] = useState('')
  const [restoreStock, setRestoreStock] = useState(false)
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentVerified, setPaymentVerified] = useState(false)
  const [search, setSearch]         = useState('')
  const [filterChannel, setFilterChannel] = useState('semua')
  const [filterPayment, setFilterPayment] = useState('semua')
  const [page, setPage]             = useState(0)
  const [totalRows, setTotalRows]   = useState(0)
  const [fetchError, setFetchError] = useState('')
  const [workflowReady, setWorkflowReady] = useState(null)
  const printRef = useRef()
  const manualRequestId = useRef(null)
  if (manualRequestId.current === null) manualRequestId.current = createRequestId()
  const latestFetch = useRef(0)

  // Form
  const [namaCustomer, setNamaCustomer] = useState('')
  const [channel, setChannel]   = useState('Tunai')
  const [tanggal, setTanggal]   = useState(toInputDate())
  const [catatan, setCatatan]   = useState('')
  const [items, setItems]       = useState([{ menu_id: '', jumlah: 1 }])

  useEffect(() => {
    fetchMenus()
  }, [])

  useEffect(() => {
    const timer = setTimeout(fetchTransaksi, search ? 250 : 0)
    const ch = supabase.channel('penjualan-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transaksi' }, () => fetchTransaksi())
      .subscribe()
    return () => {
      clearTimeout(timer)
      supabase.removeChannel(ch)
    }
  }, [page, search, filterChannel, filterPayment])

  const fetchTransaksi = async (currentPage = page) => {
    const request = ++latestFetch.current
    setLoading(true)
    setFetchError('')
    let ready
    try {
      ready = await hasPosWorkflowSchema(supabase)
    } catch (error) {
      if (request === latestFetch.current) {
        setFetchError(error.message || 'Gagal memeriksa database')
        setLoading(false)
      }
      return
    }
    if (request !== latestFetch.current) return
    setWorkflowReady(ready)
    let query = supabase
      .from('transaksi').select('*', { count: 'exact' })
      .order('tanggal', { ascending: false })
      .order('created_at', { ascending: false })
    if (filterChannel !== 'semua') query = query.eq('channel', filterChannel)
    if (ready && filterPayment !== 'semua') query = query.eq('payment_status', filterPayment)
    const term = search.trim().replace(/[^\p{L}\p{N} -]/gu, '').slice(0, 80)
    if (term) query = query.or(`kode.ilike.%${term}%,nama_customer.ilike.%${term}%`)
    const { data, count, error } = await query.range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1)
    if (request !== latestFetch.current) return
    if (error) {
      setFetchError(error.message)
    } else {
      setTransaksi(data || [])
      setTotalRows(count || 0)
    }
    setLoading(false)
  }

  const fetchMenus = async () => {
    const { data, error } = await supabase.from('menu').select('id, nama, harga_jual, hpp').eq('aktif', true).order('nama')
    if (error) return toast.error(`Gagal memuat menu: ${error.message}`)
    setMenus(data || [])
  }

  const openModal = () => {
    manualRequestId.current = createRequestId()
    setPendingManual(null)
    setPaymentVerified(false)
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

  const handleSave = async (waitForPayment = false) => {
    if (saving) return
    setSaving(true)
    try {
      const orderItems = items.map(item => ({ menu_id: item.menu_id, qty: item.jumlah }))
      let result
      if (channel === 'QRIS') {
        const pending = pendingManual || await createPendingQris({
          requestId: manualRequestId.current, tanggal, namaCustomer, catatan, items: orderItems,
        })
        setPendingManual(pending)
        result = waitForPayment ? pending : await confirmQris(pending.transaksi.id)
      } else {
        result = await saveTransaction({
          requestId: manualRequestId.current, tanggal, channel, namaCustomer, catatan, items: orderItems,
        })
      }
      toast.success(waitForPayment ? `Pesanan ${result.transaksi.kode} menunggu pembayaran` : `Transaksi ${result.transaksi.kode} disimpan`)
      manualRequestId.current = createRequestId()
      setPendingManual(null)
      setModal(false)
      setPage(0)
      fetchTransaksi(0)
    } catch (err) {
      toast.error(err.message || 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  const openDetail = async (trx) => {
    const [details, events] = await Promise.all([
      supabase.from('transaksi_detail').select('*').eq('transaksi_id', trx.id),
      workflowReady ? supabase.from('transaksi_events').select('*').eq('transaksi_id', trx.id).order('created_at', { ascending: true }) : Promise.resolve({ data: [], error: null }),
    ])
    if (details.error || events.error) return toast.error(`Gagal memuat detail: ${(details.error || events.error).message}`)
    setActiveTrx(trx)
    setActiveDetail(details.data || [])
    setActiveEvents(events.data || [])
    setActionReason('')
    setRestoreStock(false)
    setPaymentReference('')
    setPaymentVerified(false)
    setDetailModal(true)
  }

  const refreshActiveTransaction = async (id) => {
    const { data, error } = await supabase.from('transaksi').select('*').eq('id', id).single()
    if (error) throw error
    await openDetail(data)
    fetchTransaksi()
  }

  const handleStatusAction = async (action) => {
    if (!activeTrx || actionBusy) return
    if (action === 'refund' && !window.confirm(`Catat refund penuh ${formatRupiah(activeTrx.total_omset)} untuk ${activeTrx.kode}? Pastikan dana sudah dikembalikan kepada pelanggan.`)) return
    setActionBusy(true)
    try {
      if (action === 'confirm') await confirmQris(activeTrx.id, paymentReference)
      if (action === 'cancel') await cancelPendingQris(activeTrx.id, actionReason)
      if (action === 'refund') await refundTransaction(activeTrx.id, actionReason, restoreStock)
      await refreshActiveTransaction(activeTrx.id)
      toast.success(action === 'confirm' ? 'Pembayaran dikonfirmasi' : action === 'cancel' ? 'Pesanan dibatalkan' : 'Refund dicatat')
    } catch (error) {
      toast.error(error.message || 'Gagal mengubah transaksi')
    } finally {
      setActionBusy(false)
    }
  }

  const handlePrint = () => window.print()

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Transaksi Penjualan</h1>
          <p className="text-sm text-gray-400">Riwayat transaksi</p>
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
            aria-label="Cari kode atau nama customer"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
          />
        </div>
        <div className="overflow-x-auto flex gap-1 bg-gray-100 rounded-lg p-1 flex-shrink-0 scrollbar-thin pb-1">
          {['semua', ...CHANNELS].map(ch => (
            <button
              key={ch}
              onClick={() => { setFilterChannel(ch); setPage(0) }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filterChannel === ch ? 'bg-white text-gray-800' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {ch}
            </button>
          ))}
        </div>
      </div>
      {workflowReady === false && <Card className="text-sm text-amber-700" role="status">Riwayat lama tetap bisa dilihat. QRIS menunggu, refund, dan status dapur aktif setelah database POS diperbarui.</Card>}
      {workflowReady && <div className="flex gap-1 overflow-x-auto pb-1 text-xs">
        {[['semua', 'Semua Status'], ['menunggu', 'Menunggu Bayar'], ['lunas', 'Lunas'], ['refund', 'Refund'], ['dibatalkan', 'Dibatalkan']].map(([value, label]) => (
          <button key={value} onClick={() => { setFilterPayment(value); setPage(0) }}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 ${filterPayment === value ? 'bg-sage-500 text-white' : 'bg-white text-gray-500 border border-gray-100'}`}>{label}</button>
        ))}
      </div>}

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
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Nilai Pesanan</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Modal</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Margin Kotor</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={9} className="text-center py-10 text-gray-300 text-sm">Memuat...</td></tr>
              ) : fetchError ? (
                <tr><td colSpan={9} className="text-center py-10 text-red-500 text-sm">
                  Gagal memuat transaksi: {fetchError} <button className="underline" onClick={fetchTransaksi}>Coba lagi</button>
                </td></tr>
              ) : transaksi.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12">
                    <Receipt size={32} className="mx-auto text-gray-200 mb-2" />
                    <p className="text-sm text-gray-300">Belum ada transaksi</p>
                  </td>
                </tr>
              ) : transaksi.map(t => (
                <tr key={t.id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3 font-medium text-sage-600 text-xs">{t.kode}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{formatTanggal(t.tanggal)}</td>
                  <td className="px-4 py-3 text-gray-600">{t.nama_customer || <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3"><Badge variant={channelColor[t.channel] || 'gray'}>{t.channel}</Badge></td>
                  <td className="px-4 py-3"><Badge variant={paymentColors[t.payment_status] || 'gray'}>{workflowReady ? paymentLabels[t.payment_status] || t.payment_status : 'Riwayat Lama'}</Badge></td>
                  <td className="px-4 py-3 text-right font-medium text-gray-700">{formatRupiah(t.total_omset)}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{formatRupiah(t.total_modal)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-sage-600">{!workflowReady || t.payment_status === 'lunas' ? formatRupiah(t.total_untung) : '—'}</td>
                  <td className="px-4 py-3 text-xs text-right">
                    <button onClick={() => openDetail(t)} aria-label={`Lihat detail transaksi ${t.kode}`} className="text-sage-600 hover:underline">Detail →</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {!fetchError && totalRows > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalRows)} dari {totalRows} transaksi</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Sebelumnya</Button>
            <Button size="sm" variant="outline" disabled={(page + 1) * PAGE_SIZE >= totalRows} onClick={() => setPage(p => p + 1)}>Berikutnya</Button>
          </div>
        </div>
      )}

      {/* ── Modal Input Manual ── */}
      <Modal open={modal} onClose={() => { if (!saving) setModal(false) }} title="Transaksi Manual" size="lg">
        <div className="space-y-4">
          <fieldset disabled={Boolean(pendingManual)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nama Customer" value={namaCustomer} onChange={e => setNamaCustomer(e.target.value)} placeholder="Opsional" />
            <Input label="Tanggal" type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} />
          </div>
          <Select label="Channel Pembayaran" value={channel} onChange={e => { setChannel(e.target.value); setPaymentVerified(false) }}>
            {CHANNELS.map(c => <option key={c} value={c} disabled={c === 'QRIS' && workflowReady !== true}>{c}</option>)}
          </Select>
          </fieldset>
          {channel === 'QRIS' && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-center">
              <p className="text-sm font-semibold text-sky-900">Pindai QRIS 99 FOODS QR</p>
              <img src={qrisImage} alt="QRIS statis 99 FOODS QR" className="mx-auto mt-2 max-h-80 max-w-full object-contain bg-white" />
              <p className="mt-2 text-sm font-semibold text-sky-900">Masukkan nominal {formatRupiah(calcTotal())}</p>
              <p className="mt-1 text-xs text-sky-700">Periksa pembayaran di BNI Merchant sebelum konfirmasi. QRIS statis tidak mengonfirmasi pembayaran otomatis.</p>
              {pendingManual && <p className="mt-2 text-xs font-medium text-amber-700">Pesanan {pendingManual.transaksi.kode} tersimpan dan menunggu pembayaran.</p>}
              <label className="mt-2 flex items-start gap-2 text-left text-xs text-sky-900"><input type="checkbox" checked={paymentVerified} onChange={e => setPaymentVerified(e.target.checked)} /> Saya sudah memeriksa notifikasi BNI Merchant dan nominalnya sesuai.</label>
            </div>
          )}

          <fieldset disabled={Boolean(pendingManual)} className="space-y-4">
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
                        <button onClick={() => removeItem(i)} aria-label={`Hapus item ${i + 1}`} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400">
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
            <div><p className="text-xs text-gray-400">Nilai Pesanan</p><p className="font-bold text-gray-800">{formatRupiah(calcTotal())}</p></div>
            <div><p className="text-xs text-gray-400">Modal</p><p className="font-bold text-gray-600">{formatRupiah(calcModal())}</p></div>
            <div><p className="text-xs text-gray-400">Margin Kotor</p><p className="font-bold text-sage-600">{formatRupiah(calcTotal() - calcModal())}</p></div>
          </div>

          <Input label="Catatan (opsional)" value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Pre-order, dll" />
          </fieldset>

          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" disabled={saving} onClick={() => setModal(false)}>{pendingManual ? 'Tutup' : 'Batal'}</Button>
            {channel === 'QRIS' ? (
              <div className="flex-1 flex flex-col gap-2">
                {!pendingManual && <Button variant="outline" onClick={() => handleSave(true)} disabled={saving}>Simpan Menunggu</Button>}
                <Button onClick={() => handleSave(false)} loading={saving} disabled={!paymentVerified}>Pembayaran Diterima</Button>
              </div>
            ) : <Button className="flex-1" onClick={() => handleSave(false)} loading={saving}>Simpan Transaksi</Button>}
          </div>
        </div>
      </Modal>

      {/* ── Modal Detail + Cetak ── */}
      <Modal open={detailModal} onClose={() => { if (!actionBusy) setDetailModal(false) }} title={`Detail — ${activeTrx?.kode}`} size="md">
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
            <div>
              <p className="text-xs text-gray-400">Pembayaran</p>
              <Badge variant={paymentColors[activeTrx?.payment_status] || 'gray'}>{workflowReady ? paymentLabels[activeTrx?.payment_status] || '—' : 'Riwayat Lama'}</Badge>
            </div>
            <div>
              <p className="text-xs text-gray-400">Pesanan</p>
              <span className="font-medium text-gray-700">{workflowReady ? orderLabels[activeTrx?.order_status] || '—' : 'Belum tersedia'}</span>
            </div>
            {activeTrx?.nama_customer && (
              <div className="col-span-2">
                <p className="text-xs text-gray-400">Customer</p>
                <p className="font-medium text-gray-700">{activeTrx.nama_customer}</p>
              </div>
            )}
            {activeTrx?.payment_reference && (
              <div className="col-span-2">
                <p className="text-xs text-gray-400">Referensi pembayaran</p>
                <p className="font-medium text-gray-700">{activeTrx.payment_reference}</p>
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
                <th className="text-right py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Margin</th>
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
              Margin Kotor Awal: <span className="font-semibold text-sage-600">{formatRupiah(activeTrx?.total_untung)}</span>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Nilai Pesanan</p>
              <p className="text-lg font-bold text-gray-800">{formatRupiah(activeTrx?.total_omset)}</p>
            </div>
          </div>

          {activeTrx?.catatan && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Catatan dapur: {activeTrx.catatan}</p>}
          {(activeTrx?.refund_reason || activeTrx?.cancel_reason) && (
            <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">Alasan: {activeTrx.refund_reason || activeTrx.cancel_reason}{activeTrx.payment_status === 'refund' && <span className="block mt-1">Stok: {activeTrx.stock_restore_requested ? 'dikembalikan sesuai stok menu yang tersedia' : 'tidak dikembalikan'}</span>}</p>
          )}

          {activeTrx?.payment_status === 'menunggu' && (
            <div className="space-y-3 rounded-xl border border-sky-200 bg-sky-50 p-3">
              <img src={qrisImage} alt="QRIS statis 99 FOODS QR" className="mx-auto max-h-64 max-w-full object-contain bg-white" />
              <p className="text-center text-sm font-semibold text-sky-900">Nominal {formatRupiah(activeTrx.total_omset)}</p>
              <Input label="Referensi pembayaran (opsional)" value={paymentReference} onChange={e => setPaymentReference(e.target.value)} />
              <p className="text-xs text-sky-700">Konfirmasi hanya setelah notifikasi BNI Merchant dan nominal diperiksa.</p>
              <label className="flex items-start gap-2 text-xs text-sky-900"><input type="checkbox" checked={paymentVerified} onChange={e => setPaymentVerified(e.target.checked)} /> Saya sudah memeriksa notifikasi BNI Merchant dan nominalnya sesuai.</label>
              <Button className="w-full" loading={actionBusy} disabled={!paymentVerified} onClick={() => handleStatusAction('confirm')}>Pembayaran Diterima</Button>
              <Input label="Alasan pembatalan" value={actionReason} onChange={e => setActionReason(e.target.value)} placeholder="Minimal 3 karakter" />
              <Button className="w-full" variant="outline" disabled={actionBusy || actionReason.trim().length < 3} onClick={() => handleStatusAction('cancel')}>Batalkan Pesanan</Button>
            </div>
          )}

          {activeTrx?.payment_status === 'lunas' && (
            <div className="space-y-3 rounded-xl border border-red-100 bg-red-50 p-3">
              <p className="text-sm font-semibold text-red-800">Refund penuh</p>
              <p className="text-xs text-red-700">Kembalikan uang kepada pelanggan melalui metode pembayaran semula. Tombol ini mencatat refund di 99Foods; tidak mengirim uang otomatis.</p>
              <p className="text-xs text-red-700">Untuk memperbaiki jumlah atau item yang salah, catat refund penuh lalu buat transaksi baru yang benar.</p>
              <Input label="Alasan refund" value={actionReason} onChange={e => setActionReason(e.target.value)} placeholder="Minimal 3 karakter" />
              <label className="flex items-center gap-2 text-sm text-red-800"><input type="checkbox" checked={restoreStock} onChange={e => setRestoreStock(e.target.checked)} /> Kembalikan stok porsi yang masih bisa dijual</label>
              <Button variant="outline" className="w-full" disabled={actionBusy || actionReason.trim().length < 3} onClick={() => handleStatusAction('refund')}>Catat Refund {formatRupiah(activeTrx.total_omset)}</Button>
            </div>
          )}

          {activeEvents.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Riwayat Status</p>
              <div className="space-y-1 text-xs text-gray-500">
                {activeEvents.map(event => <p key={event.id}>{new Date(event.created_at).toLocaleString('id-ID')} · {event.event_type}: {event.from_status ? `${event.from_status} → ` : ''}{event.to_status}{event.reason ? ` · ${event.reason}` : ''}</p>)}
              </div>
            </div>
          )}

          {/* Tombol cetak */}
          {(workflowReady === false || activeTrx?.payment_status === 'lunas') && <BluetoothPrintButton transaksi={activeTrx} detail={activeDetail} />}
          <Button className="w-full" onClick={handlePrint} disabled={workflowReady !== false && activeTrx?.payment_status !== 'lunas'}>
            <Printer size={14} /> Cetak Browser
          </Button>
        </div>
      </Modal>

      {/* Area struk untuk print — hidden di layar, muncul saat print */}
      <StrukPrint ref={printRef} transaksi={activeTrx} detail={activeDetail} />
    </div>
  )
}
