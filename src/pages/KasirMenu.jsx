import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { saveTransaction } from '../lib/transactions'
import { createPendingQris, confirmQris } from '../lib/posWorkflow'
import { hasPosWorkflowSchema } from '../lib/posSchema'
import { formatRupiah, toInputDate } from '../utils/format'
import { createRequestId } from '../utils/requestId'
import { Search, ShoppingCart, X, Plus, Minus, ImageOff, Printer, User, CreditCard } from 'lucide-react'
import Button from '../components/ui/Button'
import Select from '../components/ui/Select'
import Input from '../components/ui/Input'
import StrukPrint from '../components/ui/StrukPrint'
import BluetoothPrintButton from '../components/ui/BluetoothPrintButton'
import { useDialogFocus } from '../components/ui/useDialogFocus'
import qrisImage from '../assets/qris-99foods.png'
import toast from 'react-hot-toast'

const CHANNELS = ['Tunai', 'QRIS', 'Ojek Online']

// ─── Popup: pilih jumlah per item ───────────────────────────────────────────
function ItemPopup({ menu, onClose, onAddToCart }) {
  const [qty, setQty] = useState(1)
  const [stok, setStok] = useState(menu.stok_menu ?? null)
  const dialogRef = useDialogFocus(true, onClose)

  useEffect(() => {
    setStok(menu.stok_menu ?? null)
    const ch = supabase
      .channel(`stok-${menu.id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'menu', filter: `id=eq.${menu.id}` },
        p => setStok(p.new.stok_menu ?? null))
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [menu.id])

  const habis = stok !== null && stok <= 0

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/25" onClick={onClose} aria-hidden="true" />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={`Tambah ${menu.nama}`} tabIndex={-1} className="relative w-full sm:max-w-xs bg-white rounded-t-2xl sm:rounded-xl overflow-hidden">
        {menu.gambar_url
          ? <img src={menu.gambar_url} alt={menu.nama} className="w-full h-40 object-cover" onError={e => e.target.style.display = 'none'} />
          : <div className="w-full h-28 bg-sage-50 flex items-center justify-center"><ImageOff size={28} className="text-sage-200" /></div>
        }
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h2 className="text-base font-semibold text-gray-800">{menu.nama}</h2>
            <button onClick={onClose} aria-label="Tutup pilihan menu" className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X size={15} /></button>
          </div>
          <p className="text-sage-600 font-medium text-sm mb-4">{formatRupiah(menu.harga_jual)}</p>

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
              <button onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="Kurangi porsi" className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-gray-200 text-gray-500">
                <Minus size={13} />
              </button>
              <span className="text-sm font-bold text-gray-800 w-5 text-center">{qty}</span>
              <button
                onClick={() => setQty(q => stok !== null ? Math.min(stok, q + 1) : q + 1)}
                aria-label="Tambah porsi"
                disabled={habis}
                className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-gray-200 text-gray-500 disabled:opacity-30"
              >
                <Plus size={13} />
              </button>
            </div>
            {stok !== null && (
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                stok <= 0 ? 'bg-red-50 text-red-500' : stok <= 5 ? 'bg-amber-50 text-amber-600' : 'bg-sage-50 text-sage-600'
              }`}>
                Stok: {stok}
              </span>
            )}
          </div>

          <Button className="w-full" onClick={() => { onAddToCart(menu, qty); onClose() }} disabled={habis}>
            <ShoppingCart size={14} />
            {habis ? 'Stok Habis' : `Tambah — ${formatRupiah(menu.harga_jual * qty)}`}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Cart panel (floating kanan bawah) ──────────────────────────────────────
function CartPanel({ items, onRemove, onChangeQty, onClear, onCheckout }) {
  const total = items.reduce((s, i) => s + i.harga_jual * i.qty, 0)
  const [expanded, setExpanded] = useState(false)
  if (items.length === 0) return null
  return (
    <>
      {/* ── Desktop: floating box (md+) ── */}
      <div className="hidden md:block fixed bottom-4 right-4 z-40 w-72 bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
          <div className="flex items-center gap-2">
            <ShoppingCart size={14} className="text-sage-500" />
            <span className="text-sm font-semibold text-gray-700">Pesanan</span>
            <span className="text-[11px] bg-sage-100 text-sage-600 px-1.5 py-0.5 rounded-full font-medium">{items.length} item</span>
          </div>
          <button onClick={onClear} className="text-xs text-gray-400 hover:text-red-400 transition-colors">Kosongkan</button>
        </div>

        <div className="max-h-48 overflow-y-auto divide-y divide-gray-50 scrollbar-thin">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-2 px-4 py-2.5">
              <span className="flex-1 text-xs text-gray-700 truncate">{item.nama}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => onChangeQty(item.id, item.qty - 1)} aria-label={`Kurangi ${item.nama}`} className="w-5 h-5 rounded flex items-center justify-center hover:bg-gray-100 text-gray-400"><Minus size={10} /></button>
                <span className="text-xs font-medium text-gray-700 w-4 text-center">{item.qty}</span>
                <button onClick={() => onChangeQty(item.id, item.qty + 1)} aria-label={`Tambah ${item.nama}`} className="w-5 h-5 rounded flex items-center justify-center hover:bg-gray-100 text-gray-400"><Plus size={10} /></button>
              </div>
              <span className="text-xs text-sage-600 font-medium w-16 text-right">{formatRupiah(item.harga_jual * item.qty)}</span>
              <button onClick={() => onRemove(item.id)} aria-label={`Hapus ${item.nama}`} className="text-gray-300 hover:text-red-400"><X size={12} /></button>
            </div>
          ))}
        </div>

        <div className="px-4 py-3 border-t border-gray-50 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Total</p>
            <p className="text-sm font-bold text-gray-800">{formatRupiah(total)}</p>
          </div>
          <Button size="sm" onClick={onCheckout}>
            <ShoppingCart size={13} /> Checkout
          </Button>
        </div>
      </div>

      {/* ── Mobile: bottom bar (collapsed) + expandable bottom-sheet ── */}
      <div className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-white border-t border-gray-100 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        {expanded && (
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-50 scrollbar-thin border-b border-gray-100">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-50">
              <span className="text-xs font-semibold text-gray-600">{items.length} item</span>
              <div className="flex gap-3">
                <button onClick={() => setExpanded(false)} className="text-xs text-gray-400 hover:text-gray-600">Tutup</button>
                <button onClick={onClear} className="text-xs text-red-400 hover:text-red-500">Kosongkan</button>
              </div>
            </div>
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-2 px-4 py-3">
                <span className="flex-1 text-sm text-gray-700 truncate">{item.nama}</span>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => onChangeQty(item.id, item.qty - 1)} aria-label={`Kurangi ${item.nama}`} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-gray-100 text-gray-500 border border-gray-200"><Minus size={12} /></button>
                  <span className="text-sm font-semibold text-gray-800 w-6 text-center">{item.qty}</span>
                  <button onClick={() => onChangeQty(item.id, item.qty + 1)} aria-label={`Tambah ${item.nama}`} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-gray-100 text-gray-500 border border-gray-200"><Plus size={12} /></button>
                </div>
                <span className="text-sm text-sage-600 font-semibold w-20 text-right">{formatRupiah(item.harga_jual * item.qty)}</span>
                <button onClick={() => onRemove(item.id)} aria-label={`Hapus ${item.nama}`} className="p-1.5 text-gray-300 hover:text-red-400"><X size={14} /></button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button onClick={() => setExpanded(e => !e)} className="flex items-center gap-2">
            <ShoppingCart size={16} className="text-sage-500" />
            <span className="text-sm font-semibold text-gray-700">{items.length} item</span>
            <span className="text-sm font-bold text-gray-800 ml-1">{formatRupiah(total)}</span>
          </button>
          <Button size="sm" onClick={onCheckout}>
            <ShoppingCart size={13} /> Checkout
          </Button>
        </div>
      </div>
    </>
  )
}

// ─── Checkout Modal ──────────────────────────────────────────────────────────
function CheckoutModal({ items, requestId, onClose, onSuccess, onPending, workflowReady }) {
  const [namaCustomer, setNamaCustomer] = useState('')
  const [catatan, setCatatan] = useState('')
  const [channel, setChannel] = useState('Tunai')
  const [saving, setSaving] = useState(false)
  const [pendingOrder, setPendingOrder] = useState(null)
  const [paymentVerified, setPaymentVerified] = useState(false)
  const closeCheckout = () => {
    if (saving) return
    if (pendingOrder) onPending(pendingOrder)
    else onClose()
  }
  const dialogRef = useDialogFocus(true, closeCheckout)
  const tanggal = toInputDate() // realtime hari ini

  const total = items.reduce((s, i) => s + i.harga_jual * i.qty, 0)
  const modal = items.reduce((s, i) => s + (i.hpp || 0) * i.qty, 0)

  const orderItems = items.map(item => ({ menu_id: item.id, qty: item.qty }))

  const ensurePendingQris = async () => {
    if (pendingOrder) return pendingOrder
    const result = await createPendingQris({ requestId, tanggal, namaCustomer, catatan, items: orderItems })
    setPendingOrder(result)
    return result
  }

  const handleSimpan = async (waitForPayment = false) => {
    if (items.length === 0 || saving) return
    setSaving(true)
    try {
      if (channel === 'QRIS') {
        const pending = await ensurePendingQris()
        if (waitForPayment) {
          onPending(pending)
          return
        }
        const paid = await confirmQris(pending.transaksi.id)
        toast.success(`Pembayaran ${paid.transaksi.kode} dikonfirmasi`)
        onSuccess(paid)
      } else {
        const result = await saveTransaction({
          requestId, tanggal, channel, namaCustomer, catatan, items: orderItems,
        })
        toast.success(`Transaksi ${result.transaksi.kode} disimpan`)
        onSuccess(result)
      }
    } catch (err) {
      console.error('Checkout error:', err)
      toast.error(err.message || 'Gagal menyimpan transaksi')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/25" onClick={closeCheckout} aria-hidden="true" />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Konfirmasi Pesanan" tabIndex={-1} className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Konfirmasi Pesanan</h2>
            <p className="text-xs text-gray-400 mt-0.5">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          <button onClick={closeCheckout} disabled={saving} aria-label="Tutup konfirmasi" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4 scrollbar-thin">
          {/* Nama customer */}
          <div className="flex flex-col gap-1">
            <label htmlFor="checkout-customer" className="text-sm font-medium text-gray-600 flex items-center gap-1.5">
              <User size={13} className="text-gray-400" /> Nama Customer
            </label>
            <input
              id="checkout-customer"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-sage-400"
              placeholder="Opsional — kosongkan jika tidak perlu"
              value={namaCustomer}
              onChange={e => setNamaCustomer(e.target.value)}
              disabled={Boolean(pendingOrder)}
            />
          </div>

          {/* Channel */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-600 flex items-center gap-1.5">
              <CreditCard size={13} className="text-gray-400" /> Metode Pembayaran
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CHANNELS.map(c => (
                <button
                  key={c}
                  onClick={() => { setChannel(c); setPaymentVerified(false) }}
                  disabled={Boolean(pendingOrder) || (c === 'QRIS' && workflowReady !== true)}
                  className={`py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                    channel === c
                      ? 'bg-sage-500 border-sage-500 text-white'
                      : 'border-gray-200 text-gray-500 hover:border-sage-300 hover:text-sage-600'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {channel === 'QRIS' && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-center">
              <p className="text-sm font-semibold text-sky-900">Pindai QRIS 99 FOODS QR</p>
              <img src={qrisImage} alt="QRIS statis 99 FOODS QR untuk pembayaran" className="mx-auto mt-2 max-h-80 w-auto max-w-full object-contain bg-white" />
              <p className="mt-2 text-sm font-semibold text-sky-900">Masukkan nominal {formatRupiah(total)}</p>
              <p className="mt-1 text-xs text-sky-700">Periksa notifikasi dan nominal di BNI Merchant sebelum menekan Pembayaran Diterima. Gambar QRIS ini tidak mengonfirmasi pembayaran otomatis. Stok diperiksa ulang saat konfirmasi.</p>
              {pendingOrder && <p className="mt-2 text-xs font-medium text-amber-700">Pesanan {pendingOrder.transaksi.kode} tersimpan dan menunggu pembayaran.</p>}
              <label className="mt-3 flex items-start gap-2 text-left text-xs text-sky-900">
                <input type="checkbox" checked={paymentVerified} onChange={e => setPaymentVerified(e.target.checked)} />
                Saya sudah melihat notifikasi BNI Merchant dan nominalnya sesuai.
              </label>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label htmlFor="checkout-note" className="text-sm font-medium text-gray-600">Catatan untuk dapur (opsional)</label>
            <input id="checkout-note" value={catatan} onChange={e => setCatatan(e.target.value)} disabled={Boolean(pendingOrder)}
              placeholder="Contoh: tanpa sambal" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
          </div>

          {/* Daftar item */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Item Pesanan</p>
            <div className="space-y-1.5 rounded-lg overflow-hidden border border-gray-100">
              {items.map(item => (
                <div key={item.id} className="flex items-center justify-between gap-3 px-3 py-2.5 bg-gray-50">
                  <span className="text-sm text-gray-700 flex-1 truncate">{item.nama}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0">{item.qty}×</span>
                  <span className="text-sm font-medium text-gray-700 flex-shrink-0">{formatRupiah(item.harga_jual * item.qty)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Ringkasan total */}
          <div className="bg-sage-50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal</span>
              <span>{formatRupiah(total)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>Modal</span>
              <span>{formatRupiah(modal)}</span>
            </div>
            <div className="border-t border-sage-200 pt-2 flex justify-between text-base font-bold text-gray-800">
              <span>Total</span>
              <span>{formatRupiah(total)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={closeCheckout} disabled={saving}>{pendingOrder ? 'Tutup' : 'Batal'}</Button>
          {channel === 'QRIS' ? (
            <div className="flex-1 flex flex-col gap-2">
              {!pendingOrder && <Button variant="outline" onClick={() => handleSimpan(true)} disabled={saving}>Simpan Menunggu</Button>}
              <Button onClick={() => handleSimpan(false)} loading={saving} disabled={!paymentVerified}>Pembayaran Diterima</Button>
            </div>
          ) : (
            <Button className="flex-1" onClick={() => handleSimpan(false)} loading={saving}>
              <Printer size={14} /> Simpan & Cetak
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Struk Modal (preview + print) ──────────────────────────────────────────
function StrukModal({ transaksi, detail, onClose }) {
  const printRef = useRef()
  const dialogRef = useDialogFocus(true, onClose)

  const handlePrint = () => {
    // Semua elemen disembunyikan via CSS @media print kecuali .struk-print-area
    window.print()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/25" onClick={onClose} aria-hidden="true" />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Struk Transaksi" tabIndex={-1} className="relative w-full sm:max-w-xs bg-white rounded-t-2xl sm:rounded-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Struk Transaksi</h2>
          <button onClick={onClose} aria-label="Tutup struk" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={15} /></button>
        </div>

        {/* Preview struk di layar */}
        <div className="p-4 overflow-y-auto max-h-96 scrollbar-thin">
          <div className="border border-gray-100 rounded-lg p-4 font-mono text-xs text-gray-700 bg-gray-50">
            <div className="text-center mb-3">
              <div className="font-bold text-base">99Foods</div>
              <div>Dimsum &amp; Cireng</div>
              <div className="border-t border-dashed border-gray-300 my-2" />
            </div>
            <div className="space-y-0.5 mb-2">
              <div className="flex justify-between"><span>No.</span><span className="font-semibold">{transaksi?.kode}</span></div>
              <div className="flex justify-between"><span>Tgl</span><span>{transaksi?.tanggal}</span></div>
              {transaksi?.nama_customer && <div className="flex justify-between"><span>Customer</span><span>{transaksi.nama_customer}</span></div>}
              <div className="flex justify-between"><span>Bayar</span><span>{transaksi?.channel}</span></div>
            </div>
            <div className="border-t border-dashed border-gray-300 my-2" />
            <div className="space-y-1 mb-2">
              {detail.map((d, i) => (
                <div key={i}>
                  <div className="font-semibold">{d.nama_menu}</div>
                  <div className="flex justify-between pl-2 text-gray-500">
                    <span>{d.jumlah_porsi}x {formatRupiah(d.harga_jual)}</span>
                    <span>{formatRupiah(d.subtotal_omset)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-dashed border-gray-300 my-2" />
            <div className="flex justify-between font-bold text-sm">
              <span>TOTAL</span>
              <span>{formatRupiah(transaksi?.total_omset)}</span>
            </div>
            <div className="text-center mt-3 text-gray-400">
              <div>Terima kasih!</div>
              <div>Selamat menikmati</div>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-gray-100 space-y-2">
          <BluetoothPrintButton transaksi={transaksi} detail={detail} />
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>Tutup</Button>
            <Button className="flex-1" onClick={handlePrint}>
              <Printer size={14} /> Cetak Browser
            </Button>
          </div>
        </div>
      </div>

      {/* Area hidden yang benar-benar di-print */}
      <StrukPrint ref={printRef} transaksi={transaksi} detail={detail} />
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────
const KATEGORI_ALL = 'Semua'

export default function KasirMenu() {
  const [menus, setMenus]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [workflowReady, setWorkflowReady] = useState(null)
  const [search, setSearch]         = useState('')
  const [activeKat, setActiveKat]   = useState(KATEGORI_ALL)
  const [popup, setPopup]           = useState(null)
  const [cart, setCart]             = useState([])
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [struk, setStruk]           = useState(null)   // { transaksi, detail }
  const checkoutRequestId = useRef(null)
  if (checkoutRequestId.current === null) checkoutRequestId.current = createRequestId()

  useEffect(() => {
    fetchMenus()
    hasPosWorkflowSchema(supabase).then(setWorkflowReady).catch(error => {
      console.error('Gagal memeriksa skema POS:', error)
    })
    const ch = supabase.channel('kasir-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu' }, fetchMenus)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  const fetchMenus = async () => {
    setLoading(true)
    setFetchError('')
    const { data, error } = await supabase.from('menu').select('*').eq('aktif', true).order('kategori').order('nama')
    if (error) setFetchError(error.message)
    else setMenus(data || [])
    setLoading(false)
  }

  const kategoriList = [KATEGORI_ALL, ...new Set(menus.map(m => m.kategori))]
  const filtered = menus
    .filter(m => activeKat === KATEGORI_ALL || m.kategori === activeKat)
    .filter(m => m.nama.toLowerCase().includes(search.toLowerCase()))

  const addToCart = (menu, qty) => {
    const existing = cart.find(item => item.id === menu.id)
    if (existing && menu.stok_menu != null && existing.qty + qty > menu.stok_menu) {
      toast.error(`Stok ${menu.nama} hanya ${menu.stok_menu} porsi`)
      return
    }
    checkoutRequestId.current = createRequestId()
    setCart(prev => {
      const ex = prev.find(i => i.id === menu.id)
      if (ex) return prev.map(i => i.id === menu.id ? { ...i, qty: i.qty + qty } : i)
      return [...prev, { ...menu, qty }]
    })
    toast.success(`${menu.nama} ×${qty} ditambahkan`)
  }

  const removeFromCart = (id) => {
    checkoutRequestId.current = createRequestId()
    setCart(prev => prev.filter(i => i.id !== id))
  }
  const changeQty = (id, qty) => {
    if (qty <= 0) return removeFromCart(id)
    const menu = menus.find(item => item.id === id)
    if (menu?.stok_menu != null && qty > menu.stok_menu) {
      toast.error(`Stok ${menu.nama} hanya ${menu.stok_menu} porsi`)
      return
    }
    checkoutRequestId.current = createRequestId()
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty } : i))
  }
  const clearCart = () => {
    checkoutRequestId.current = createRequestId()
    setCart([])
  }

  const handleCheckoutSuccess = (data) => {
    setStruk(data)
    setCheckoutOpen(false)
    clearCart()
  }

  const handleCheckoutPending = (data) => {
    toast.success(`Pesanan ${data.transaksi.kode} menunggu pembayaran`)
    setCheckoutOpen(false)
    clearCart()
  }

  const stokLabel = (m) => {
    if (m.stok_menu == null) return null
    if (m.stok_menu <= 0)   return { text: 'Habis',          cls: 'bg-red-50 text-red-400' }
    if (m.stok_menu <= 5)   return { text: `Sisa ${m.stok_menu}`, cls: 'bg-amber-50 text-amber-500' }
    return                         { text: `Stok ${m.stok_menu}`, cls: 'bg-sage-50 text-sage-500' }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">Menu</h1>
        <p className="text-sm text-gray-400">Pilih menu yang dipesan</p>
      </div>
      {workflowReady === false && <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="status">QRIS menunggu pembayaran belum tersedia sampai database POS diperbarui.</div>}

      {/* Search + Filter kategori */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-100 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-sage-300"
            placeholder="Cari menu..."
            aria-label="Cari menu"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {kategoriList.map(k => (
            <button
              key={k}
              onClick={() => setActiveKat(k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                activeKat === k
                  ? 'bg-sage-500 text-white'
                  : 'bg-white border border-gray-100 text-gray-500 hover:bg-sage-50 hover:text-sage-600'
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {/* Grid kartu menu */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-xl overflow-hidden animate-pulse">
              <div className="h-44 bg-gray-100" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-gray-100 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : fetchError ? (
        <div className="text-center py-12 text-sm text-red-600" role="alert">
          Gagal memuat menu: {fetchError} <button className="underline" onClick={fetchMenus}>Coba lagi</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-300 text-sm">Tidak ada menu ditemukan</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(m => {
            const stok  = stokLabel(m)
            const habis = m.stok_menu != null && m.stok_menu <= 0
            return (
              <button
                key={m.id}
                onClick={() => !habis && setPopup(m)}
                disabled={habis}
                className={`group text-left bg-white border border-gray-100 rounded-xl overflow-hidden transition-all duration-150
                  ${habis ? 'opacity-50 cursor-not-allowed' : 'hover:border-sage-200 active:scale-[0.98]'}`}
              >
                <div className="relative h-44 bg-sage-50 overflow-hidden">
                  {m.gambar_url ? (
                    <img
                      src={m.gambar_url} alt={m.nama}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={e => { e.target.style.display = 'none' }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageOff size={28} className="text-sage-200" />
                    </div>
                  )}
                  {stok && (
                    <span className={`absolute bottom-2 right-2 text-[10px] px-2 py-0.5 rounded-full font-medium ${stok.cls}`}>
                      {stok.text}
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-gray-700 leading-tight line-clamp-2 mb-1">{m.nama}</p>
                  <p className="text-sm font-semibold text-sage-600">{formatRupiah(m.harga_jual)}</p>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Popup pilih qty */}
      {popup && (
        <ItemPopup menu={popup} onClose={() => setPopup(null)} onAddToCart={addToCart} />
      )}

      {/* Cart floating */}
      <CartPanel
        items={cart}
        onRemove={removeFromCart}
        onChangeQty={changeQty}
        onClear={clearCart}
        onCheckout={() => setCheckoutOpen(true)}
      />

      {/* Checkout modal */}
      {checkoutOpen && (
        <CheckoutModal
          items={cart}
          requestId={checkoutRequestId.current}
          onClose={() => setCheckoutOpen(false)}
          onSuccess={handleCheckoutSuccess}
          onPending={handleCheckoutPending}
          workflowReady={workflowReady}
        />
      )}

      {/* Struk modal (muncul setelah transaksi berhasil) */}
      {struk && (
        <StrukModal
          transaksi={struk.transaksi}
          detail={struk.detail}
          onClose={() => setStruk(null)}
        />
      )}
    </div>
  )
}
