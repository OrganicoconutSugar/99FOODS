import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatRupiah } from '../utils/format'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Modal from '../components/ui/Modal'
import Badge from '../components/ui/Badge'
import ImageCropper from '../components/ui/ImageCropper'
import { Plus, Pencil, Trash2, Search, X, UtensilsCrossed, ImageOff } from 'lucide-react'
import toast from 'react-hot-toast'

const KATEGORI = ['Dimsum', 'Cireng', 'Minuman', 'Lainnya']

const emptyMenu = { nama: '', kategori: 'Dimsum', harga_jual: '', stok_menu: '', aktif: true }

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function StokHPP() {
  const [menus, setMenus]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [modal, setModal]         = useState(false)
  const [editing, setEditing]     = useState(null)
  const [form, setForm]           = useState(emptyMenu)
  const [gambarUrl, setGambarUrl] = useState(null)
  const [saving, setSaving]       = useState(false)

  useEffect(() => { fetchMenus() }, [])

  const fetchMenus = async () => {
    setLoading(true)
    const { data } = await supabase.from('menu').select('*').order('nama')
    setMenus(data || [])
    setLoading(false)
  }

  const openAdd = () => {
    setEditing(null)
    setForm(emptyMenu)
    setGambarUrl(null)
    setModal(true)
  }

  const openEdit = (m) => {
    setEditing(m)
    setForm({ nama: m.nama, kategori: m.kategori, harga_jual: m.harga_jual, stok_menu: m.stok_menu ?? '', aktif: m.aktif })
    setGambarUrl(m.gambar_url || null)
    setModal(true)
  }

  const handleSave = async () => {
    if (!form.nama || !form.harga_jual) return toast.error('Nama dan harga jual wajib diisi')
    setSaving(true)
    try {
      const payload = {
        nama:       form.nama,
        kategori:   form.kategori,
        harga_jual: parseFloat(form.harga_jual),
        stok_menu:  form.stok_menu !== '' ? parseInt(form.stok_menu) : null,
        gambar_url: gambarUrl || null,
        aktif:      form.aktif,
        updated_at: new Date().toISOString(),
      }
      if (editing) {
        const { error } = await supabase.from('menu').update(payload).eq('id', editing.id)
        if (error) throw error
        toast.success('Menu diperbarui')
      } else {
        const { error } = await supabase.from('menu').insert(payload)
        if (error) throw error
        toast.success('Menu ditambahkan')
      }
      setModal(false)
      fetchMenus()
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Hapus menu ini?')) return
    try {
      await supabase.from('transaksi_detail').delete().eq('menu_id', id)
      await supabase.from('resep').delete().eq('menu_id', id)
      const { error } = await supabase.from('menu').delete().eq('id', id)
      if (error) throw error
      toast.success('Menu dihapus')
      fetchMenus()
    } catch (err) { toast.error(err.message) }
  }

  const filtered = menus.filter(m => m.nama.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Stok Makanan</h1>
          <p className="text-sm text-gray-400">Kelola menu dan stok porsi</p>
        </div>
        <Button onClick={openAdd}><Plus size={14} /> Tambah Menu</Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
        <input
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-100 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-sage-300"
          placeholder="Cari menu..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* List */}
      {loading ? (
        <p className="text-center py-10 text-gray-300 text-sm">Memuat...</p>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-12">
          <UtensilsCrossed size={28} className="mx-auto text-gray-200 mb-2" />
          <p className="text-sm text-gray-300">Belum ada menu. Tambah menu pertama!</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(m => (
            <Card key={m.id} className="p-3 flex items-center gap-3">
              {/* Thumbnail */}
              <div className="w-12 h-12 rounded-lg bg-sage-50 flex-shrink-0 overflow-hidden">
                {m.gambar_url ? (
                  <img src={m.gambar_url} alt={m.nama} className="w-full h-full object-cover"
                    onError={e => { e.target.style.display = 'none' }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageOff size={15} className="text-sage-200" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-gray-700 truncate">{m.nama}</p>
                  <Badge variant="gray">{m.kategori}</Badge>
                  {!m.aktif && <Badge variant="red">Nonaktif</Badge>}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-400">
                  <span>Jual: <span className="text-gray-600 font-medium">{formatRupiah(m.harga_jual)}</span></span>
                  {m.stok_menu !== null && m.stok_menu !== undefined && (
                    <span>Stok: <span className={m.stok_menu <= 0 ? 'text-red-400 font-medium' : 'text-gray-600'}>{m.stok_menu} porsi</span></span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg hover:bg-sage-50 text-gray-300 hover:text-sage-500 transition-colors">
                  <Pencil size={13} />
                </button>
                <button onClick={() => handleDelete(m.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Modal Tambah / Edit Menu ── */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Menu' : 'Tambah Menu'}>
        <div className="space-y-4">
          <Input
            label="Nama Menu *"
            value={form.nama}
            onChange={e => setForm({ ...form, nama: e.target.value })}
            placeholder="Contoh: Dimsum Ayam (5pcs)"
          />
          <Select label="Kategori" value={form.kategori} onChange={e => setForm({ ...form, kategori: e.target.value })}>
            {KATEGORI.map(k => <option key={k} value={k}>{k}</option>)}
          </Select>
          <Input
            label="Harga Jual (Rp) *"
            type="number" min="0"
            value={form.harga_jual}
            onChange={e => setForm({ ...form, harga_jual: e.target.value })}
            placeholder="0"
          />
          <Input
            label="Stok Porsi (opsional — kosongkan jika tidak pakai stok)"
            type="number" min="0"
            value={form.stok_menu}
            onChange={e => setForm({ ...form, stok_menu: e.target.value })}
            placeholder="Kosongkan jika tidak perlu"
          />

          {/* Upload & crop foto */}
          <ImageCropper value={gambarUrl} onChange={setGambarUrl} />

          <div className="flex items-center gap-2.5">
            <input
              type="checkbox" id="aktif-modal"
              checked={form.aktif}
              onChange={e => setForm({ ...form, aktif: e.target.checked })}
              className="w-4 h-4 accent-sage-500"
            />
            <label htmlFor="aktif-modal" className="text-sm text-gray-600">Menu aktif dijual</label>
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setModal(false)}>Batal</Button>
            <Button className="flex-1" onClick={handleSave} loading={saving}>Simpan</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
