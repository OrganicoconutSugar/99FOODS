/**
 * ImageCropper
 * Drop-zone → pilih file → modal crop (drag + zoom) → upload ke Supabase Storage
 *
 * Props:
 *   value     : string | null   — URL foto yang sudah tersimpan
 *   onChange  : (url|null) => void
 */
import { useState, useRef, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { supabase } from '../../lib/supabase'
import { Upload, X, ZoomIn, ZoomOut, Check, RotateCw } from 'lucide-react'
import toast from 'react-hot-toast'

// ── helper: crop canvas ──────────────────────────────────────────────────────
async function getCroppedBlob(imageSrc, pixelCrop) {
  const image = await new Promise((res, rej) => {
    const img = new Image()
    img.addEventListener('load', () => res(img))
    img.addEventListener('error', rej)
    img.src = imageSrc
  })

  const canvas  = document.createElement('canvas')
  const ctx     = canvas.getContext('2d')
  canvas.width  = pixelCrop.width
  canvas.height = pixelCrop.height

  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y,
    pixelCrop.width, pixelCrop.height,
    0, 0,
    pixelCrop.width, pixelCrop.height,
  )

  return new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.88))
}

// ── CropModal ────────────────────────────────────────────────────────────────
function CropModal({ src, onConfirm, onCancel, uploading }) {
  const [crop,     setCrop]    = useState({ x: 0, y: 0 })
  const [zoom,     setZoom]    = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)

  const onCropComplete = useCallback((_, pixels) => {
    setCroppedAreaPixels(pixels)
  }, [])

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return
    const blob = await getCroppedBlob(src, croppedAreaPixels)
    onConfirm(blob)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60">
      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">Atur Foto</p>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        {/* Crop area */}
        <div className="relative w-full bg-gray-900" style={{ height: 300 }}>
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={1}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
            showGrid={false}
            style={{
              containerStyle: { borderRadius: 0 },
              cropAreaStyle: { border: '2px solid rgba(255,255,255,0.7)', borderRadius: 8 },
            }}
          />
        </div>

        {/* Controls */}
        <div className="px-4 py-3 space-y-3">
          {/* Zoom slider */}
          <div className="flex items-center gap-2">
            <ZoomOut size={14} className="text-gray-400 flex-shrink-0" />
            <input
              type="range"
              min={1} max={3} step={0.05}
              value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              className="flex-1 h-1.5 rounded-full accent-sage-500 cursor-pointer"
            />
            <ZoomIn size={14} className="text-gray-400 flex-shrink-0" />
          </div>

          {/* Rotation */}
          <div className="flex items-center gap-2">
            <RotateCw size={14} className="text-gray-400 flex-shrink-0" />
            <input
              type="range"
              min={-180} max={180} step={1}
              value={rotation}
              onChange={e => setRotation(Number(e.target.value))}
              className="flex-1 h-1.5 rounded-full accent-sage-500 cursor-pointer"
            />
            <span className="text-xs text-gray-400 w-8 text-right">{rotation}°</span>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onCancel}
              className="flex-1 py-2 rounded-lg text-sm text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleConfirm}
              disabled={uploading}
              className="flex-1 py-2 rounded-lg text-sm font-medium bg-sage-500 hover:bg-sage-600 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {uploading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Mengupload...
                </>
              ) : (
                <>
                  <Check size={14} />
                  Simpan Foto
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function ImageCropper({ value, onChange }) {
  const inputRef    = useRef()
  const [drag, setDrag]         = useState(false)
  const [rawSrc, setRawSrc]     = useState(null)   // src sebelum crop
  const [cropOpen, setCropOpen] = useState(false)
  const [uploading, setUploading] = useState(false)

  const openFile = (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('File harus berupa gambar'); return }
    if (file.size > 10 * 1024 * 1024)   { toast.error('Ukuran file maksimal 10 MB'); return }

    const reader = new FileReader()
    reader.onload = () => { setRawSrc(reader.result); setCropOpen(true) }
    reader.readAsDataURL(file)
  }

  const onFileChange = (e) => { openFile(e.target.files?.[0]); e.target.value = '' }

  const onDrop = (e) => {
    e.preventDefault(); setDrag(false)
    openFile(e.dataTransfer.files?.[0])
  }

  const handleCropConfirm = async (blob) => {
    setUploading(true)
    try {
      const path = `menu/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
      const { data: upData, error: upErr } = await supabase.storage
        .from('menu-images')
        .upload(path, blob, { contentType: 'image/jpeg', cacheControl: '3600', upsert: false })

      if (upErr) throw upErr

      const { data: urlData } = supabase.storage
        .from('menu-images')
        .getPublicUrl(upData?.path || path)

      onChange(urlData.publicUrl)
      setCropOpen(false)
      setRawSrc(null)
      toast.success('Foto berhasil disimpan')
    } catch (err) {
      console.error('Upload error:', err)
      toast.error(`Upload gagal: ${err.message}`)
    } finally {
      setUploading(false)
    }
  }

  const handleCropCancel = () => { setCropOpen(false); setRawSrc(null) }
  const removeImage = () => onChange(null)

  return (
    <>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-600">Foto Menu</label>

        {value ? (
          /* Preview foto yang sudah ada */
          <div className="relative w-full h-36 rounded-lg overflow-hidden border border-gray-100 group">
            <img src={value} alt="preview" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg bg-white/90 text-xs font-medium text-gray-700 hover:bg-white transition-colors"
              >
                Ganti
              </button>
              <button
                type="button"
                onClick={removeImage}
                className="px-3 py-1.5 rounded-lg bg-red-500/90 text-xs font-medium text-white hover:bg-red-500 transition-colors"
              >
                Hapus
              </button>
            </div>
          </div>
        ) : (
          /* Drop zone */
          <div
            onDragOver={e => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`
              w-full h-28 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1.5
              cursor-pointer transition-colors select-none
              ${drag ? 'border-sage-400 bg-sage-50' : 'border-gray-200 hover:border-sage-300 hover:bg-gray-50'}
            `}
          >
            <Upload size={18} className="text-gray-300" />
            <p className="text-xs text-gray-400">
              Drag & drop, atau{' '}
              <span className="text-sage-500 font-medium">pilih dari folder</span>
            </p>
            <p className="text-[10px] text-gray-300">JPG · PNG · WEBP — maks 10 MB</p>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileChange}
        />
      </div>

      {/* Crop modal */}
      {cropOpen && rawSrc && (
        <CropModal
          src={rawSrc}
          uploading={uploading}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </>
  )
}
