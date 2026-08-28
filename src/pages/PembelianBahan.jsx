import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatRupiah, formatTanggal, toInputDate } from '../utils/format'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Modal from '../components/ui/Modal'
import { Plus, Search, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const SATUAN     = ['gram', 'kg', 'ml', 'liter', 'pcs', 'butir', 'pack']
const KATEGORI_OPS = ['Gas', 'Kemasan', 'Listrik', 'Transportasi', 'Operasional Lainnya']

const emptyBahan = { nama_bahan: '', jumlah: '', satuan: 'gram', harga_per_satuan: '', tanggal: toInputDate(), catatan: '' }
const emptyOps   = { keterangan: '', kategori: 'Gas', jumlah: '', tanggal: toInputDate(), catatan: '' }

export default function PembelianBahan() {
  const [tab, setTab]           = useState('bahan')
  const [pembelian, setPembelian] = useState([])
  const [pengeluaran, setPengeluaran] = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [form, setForm]         = useState(emptyBahan)
  const [saving, setSaving]     = useState(false)
  const [search, setSearch]     = useState('')

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data: pb }, { data: po }] = await Promise.all([
      supabase.from('pembelian_bahan')
        .select('*')
        .order('tanggal', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('pengeluaran_operasional')
        .select('*')
        .order('tanggal', { ascending: false })
        .order('created_at', { ascending: false }),
    ])
    setPembelian(pb || [])
    setPengeluaran(po || [])
    setLoading(false)
  }

  const openModal = () => {
    setForm(tab === 'bahan' ? emptyBahan : emptyOps)
    setModal(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (tab === 'bahan') {
        if (!form.nama_bahan || !form.jumlah || !form.harga_per_satuan)
          throw new Error('Nama bahan, jumlah, dan harga wajib diisi')
        const { error } = await supabase.from('pembelian_bahan').insert({
          bahan_id:         null,
          nama_bahan:       form.nama_bahan,
          jumlah:           parseFloat(form.jumlah),
          satuan:           form.satuan,
          harga_per_satuan: parseFloat(form.harga_per_satuan),
          tanggal:          form.tanggal,
          catatan:          form.catatan || null,
        })
        if (error) throw error
        toast.success('Pembelian bahan dicatat')
      } else {
        if (!form.keterangan || !form.jumlah)
          throw new Error('Keterangan dan jumlah wajib diisi')
        const { error } = await supabase.from('pengeluaran_operasional').insert({
          keterangan: form.keterangan,
          kategori:   form.kategori,
          jumlah:     parseFloat(form.jumlah),
          tanggal:    form.tanggal,
          catatan:    form.catatan || null,
        })
        if (error) throw error
        toast.success('Pengeluaran operasional dicatat')
      }
      setModal(false)
      fetchAll()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteBahan = async (id) => {
    if (!confirm('Hapus catatan pembelian ini?')) return
    const { error } = await supabase.from('pembelian_bahan').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Catatan dihapus')
    fetchAll()
  }

  const handleDeleteOps = async (id) => {
    if (!confirm('Hapus catatan pengeluaran ini?')) return
    const { error } = await supabase.from('pengeluaran_operasional').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Catatan dihapus')
    fetchAll()
  }

  const totalBahan = pembelian.reduce((s, r) => s + (r.total || 0), 0)
  const totalOps   = pengeluaran.reduce((s, r) => s + (r.jumlah || 0), 0)

  const filteredPembelian = pembelian.filter(p =>
    p.nama_bahan?.toLowerCase().includes(search.toLowerCase())
  )
  const filteredOps = pengeluaran.filter(p =>
    p.keterangan?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Pengeluaran</h1>
          <p className="text-sm text-gray-400">Catat pembelian bahan baku & biaya operasional</p>
        </div>
        <Button onClick={openModal}><Plus size={14} /> Catat Pengeluaran</Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center py-4">
          <p className="text-xs text-gray-400 mb-1">Total Bahan Baku</p>
          <p className="text-lg font-bold text-gray-800">{formatRupiah(totalBahan)}</p>
        </Card>
        <Card className="text-center py-4">
          <p className="text-xs text-gray-400 mb-1">Total Operasional</p>
          <p className="text-lg font-bold text-gray-800">{formatRupiah(totalOps)}</p>
        </Card>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 flex-shrink-0">
          <button
            onClick={() => setTab('bahan')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === 'bahan' ? 'bg-white text-gray-800' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Bahan Baku
          </button>
          <button
            onClick={() => setTab('ops')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === 'ops' ? 'bg-white text-gray-800' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Operasional
          </button>
        </div>
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-100 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-sage-300"
            placeholder="Cari..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          {tab === 'bahan' ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Tanggal</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Nama Bahan</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Jumlah</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Harga/Satuan</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Total</th>
                  <th className="px-4 py-2.5 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-300 text-sm">Memuat...</td></tr>
                ) : filteredPembelian.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-300 text-sm">Belum ada data</td></tr>
                ) : filteredPembelian.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50/60 group">
                    <td className="px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap">{formatTanggal(p.tanggal)}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-700">{p.nama_bahan}</td>
                    <td className="px-4 py-2.5 text-gray-500">{p.jumlah} {p.satuan}</td>
                    <td className="px-4 py-2.5 text-gray-500">{formatRupiah(p.harga_per_satuan)}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-gray-700">{formatRupiah(p.total)}</td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => handleDeleteBahan(p.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-all"
                        title="Hapus catatan ini"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Tanggal</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Keterangan</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Kategori</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Jumlah</th>
                  <th className="px-4 py-2.5 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-10 text-gray-300 text-sm">Memuat...</td></tr>
                ) : filteredOps.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-10 text-gray-300 text-sm">Belum ada data</td></tr>
                ) : filteredOps.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50/60 group">
                    <td className="px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap">{formatTanggal(p.tanggal)}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-700">{p.keterangan}</td>
                    <td className="px-4 py-2.5 text-gray-500">{p.kategori}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-red-400">{formatRupiah(p.jumlah)}</td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => handleDeleteOps(p.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-all"
                        title="Hapus catatan ini"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Modal input */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={tab === 'bahan' ? 'Catat Pembelian Bahan Baku' : 'Catat Pengeluaran Operasional'}
      >
        <div className="space-y-4">
          {tab === 'bahan' ? (
            <>
              <Input
                label="Nama Bahan *"
                value={form.nama_bahan}
                onChange={e => setForm({ ...form, nama_bahan: e.target.value })}
                placeholder="Contoh: Tepung terigu, Daging ayam..."
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Jumlah *" type="number" min="0.001" step="0.001"
                  value={form.jumlah}
                  onChange={e => setForm({ ...form, jumlah: e.target.value })}
                  placeholder="0"
                />
                <Select label="Satuan" value={form.satuan} onChange={e => setForm({ ...form, satuan: e.target.value })}>
                  {SATUAN.map(s => <option key={s} value={s}>{s}</option>)}
                </Select>
              </div>
              <Input
                label="Harga per Satuan (Rp) *" type="number" min="0"
                value={form.harga_per_satuan}
                onChange={e => setForm({ ...form, harga_per_satuan: e.target.value })}
                placeholder="0"
              />
              <Input label="Tanggal" type="date" value={form.tanggal} onChange={e => setForm({ ...form, tanggal: e.target.value })} />
              <Input label="Catatan" value={form.catatan} onChange={e => setForm({ ...form, catatan: e.target.value })} placeholder="Opsional" />
            </>
          ) : (
            <>
              <Input
                label="Keterangan *"
                value={form.keterangan}
                onChange={e => setForm({ ...form, keterangan: e.target.value })}
                placeholder="Contoh: Beli gas 3kg"
              />
              <Select label="Kategori" value={form.kategori} onChange={e => setForm({ ...form, kategori: e.target.value })}>
                {KATEGORI_OPS.map(k => <option key={k} value={k}>{k}</option>)}
              </Select>
              <Input
                label="Jumlah (Rp) *" type="number" min="0"
                value={form.jumlah}
                onChange={e => setForm({ ...form, jumlah: e.target.value })}
                placeholder="0"
              />
              <Input label="Tanggal" type="date" value={form.tanggal} onChange={e => setForm({ ...form, tanggal: e.target.value })} />
              <Input label="Catatan" value={form.catatan} onChange={e => setForm({ ...form, catatan: e.target.value })} placeholder="Opsional" />
            </>
          )}
          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setModal(false)}>Batal</Button>
            <Button className="flex-1" onClick={handleSave} loading={saving}>Simpan</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
