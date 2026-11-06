import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { advanceOrder } from '../lib/posWorkflow'
import { hasPosWorkflowSchema } from '../lib/posSchema'
import { formatRupiah } from '../utils/format'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import toast from 'react-hot-toast'

const COLUMNS = [
  { status: 'baru', label: 'Baru', next: 'diproses', action: 'Mulai Proses', color: 'bg-sky-50 text-sky-800' },
  { status: 'diproses', label: 'Diproses', next: 'siap', action: 'Tandai Siap', color: 'bg-amber-50 text-amber-800' },
  { status: 'siap', label: 'Siap', next: 'diserahkan', action: 'Sudah Diserahkan', color: 'bg-sage-50 text-sage-800' },
]

export default function PesananDapur() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [schemaMissing, setSchemaMissing] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const latestFetch = useRef(0)

  const fetchOrders = async () => {
    const request = ++latestFetch.current
    setLoading(true)
    try {
      const workflowReady = await hasPosWorkflowSchema(supabase)
      if (request !== latestFetch.current) return
      setSchemaMissing(!workflowReady)
      if (!workflowReady) {
        setOrders([])
        setError('')
        return
      }
      const { data, error: fetchError } = await supabase.from('transaksi')
        .select('id, kode, created_at, channel, nama_customer, catatan, total_omset, order_status, transaksi_detail(id, nama_menu, jumlah_porsi)')
        .eq('payment_status', 'lunas')
        .in('order_status', COLUMNS.map(column => column.status))
        .order('created_at', { ascending: true })
        .limit(100)
      if (request !== latestFetch.current) return
      if (fetchError) setError(fetchError.message)
      else { setOrders(data || []); setError('') }
    } catch (fetchError) {
      if (request === latestFetch.current) setError(fetchError.message || 'Gagal memuat pesanan')
    } finally {
      if (request === latestFetch.current) setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
    const channel = supabase.channel('pesanan-dapur-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transaksi' }, fetchOrders)
      .subscribe()
    return () => { latestFetch.current++; supabase.removeChannel(channel) }
  }, [])

  const handleAdvance = async (order, nextStatus) => {
    if (busyId) return
    setBusyId(order.id)
    try {
      await advanceOrder(order.id, nextStatus)
      await fetchOrders()
      toast.success(`Pesanan ${order.kode} diperbarui`)
    } catch (err) {
      toast.error(err.message || 'Gagal memperbarui pesanan')
      await fetchOrders()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Pesanan Dapur</h1>
          <p className="text-sm text-gray-400">Hanya pesanan dengan pembayaran lunas yang masuk antrean.</p>
        </div>
        <Button size="sm" variant="outline" onClick={fetchOrders}>Muat Ulang</Button>
      </div>
      {loading && <p role="status" className="text-sm text-gray-400">Memuat pesanan...</p>}
      {schemaMissing && !loading && <Card role="status" className="text-sm text-amber-800">Antrean dapur belum aktif karena database POS belum diperbarui. Setelah migrasi database dijalankan, tekan Muat Ulang.</Card>}
      {error && <Card role="alert" className="text-sm text-red-600">Gagal memuat pesanan: {error}</Card>}
      {!schemaMissing && <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map(column => {
          const items = orders.filter(order => order.order_status === column.status)
          return (
            <section key={column.status} aria-label={column.label} className="space-y-3">
              <div className={`flex items-center justify-between rounded-xl px-4 py-3 ${column.color}`}>
                <h2 className="font-semibold">{column.label}</h2><span className="text-sm font-bold">{items.length}</span>
              </div>
              {items.length === 0 && !loading && <p className="rounded-xl border border-dashed border-gray-200 p-5 text-center text-sm text-gray-400">Belum ada pesanan</p>}
              {items.map(order => (
                <Card key={order.id} className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-800">{order.kode}</p>
                      <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })} · {order.channel}</p>
                    </div>
                    <span className="text-xs font-medium text-sage-700">{formatRupiah(order.total_omset)}</span>
                  </div>
                  {order.nama_customer && <p className="text-sm text-gray-600">Customer: {order.nama_customer}</p>}
                  <ul className="space-y-1 border-y border-gray-100 py-3">
                    {order.transaksi_detail?.map(detail => <li key={detail.id} className="flex justify-between gap-3 text-sm text-gray-700"><span>{detail.nama_menu}</span><strong>{detail.jumlah_porsi}×</strong></li>)}
                  </ul>
                  {order.catatan && <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-800">Catatan: {order.catatan}</p>}
                  <Button className="w-full" loading={busyId === order.id} disabled={Boolean(busyId)} onClick={() => handleAdvance(order, column.next)}>{column.action}</Button>
                </Card>
              ))}
            </section>
          )
        })}
      </div>}
    </div>
  )
}
