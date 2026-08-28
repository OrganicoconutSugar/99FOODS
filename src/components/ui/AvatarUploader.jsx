/**
 * AvatarUploader
 * Modal untuk upload / ganti / hapus foto profile.
 * Pakai react-easy-crop (sama dengan ImageCropper) untuk konsistensi UX.
 * Hasil crop → uploadAvatar() / removeAvatar() dari AuthContext.
 */
import { useRef, useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { X, Check, ZoomIn, ZoomOut, RotateCw, Trash2, Camera } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

async function getCroppedBlob(imageSrc, pixelCrop, rotation) {
  const image = await new Promise((res, rej) => {
    const img = new Image()
    img.addEventListener('load', () => res(img))
    img.addEventListener('error', rej)
    img.src = imageSrc
  })

  const rad = (rotation * Math.PI) / 180
  const sin = Math.abs(Math.sin(rad))
  const cos = Math.abs(Math.cos(rad))
  const w = image.naturalWidth
  const h = image.naturalHeight
  const outW = Math.floor(w * cos + h * sin)
  const outH = Math.floor(w * sin + h * cos)

  const tmp = document.createElement('canvas')
  tmp.width  = outW
  tmp.height = outH
  const tctx = tmp.getContext('2d')
  tctx.translate(outW / 2, outH / 2)
  tctx.rotate(rad)
  tctx.drawImage(image, -w / 2, -h / 2)

  const canvas = document.createElement('canvas')
  canvas.width  = pixelCrop.width
  canvas.height = pixelCrop.height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(
    tmp,
    pixelCrop.x, pixelCrop.y,
    pixelCrop.width, pixelCrop.height,
    0, 0,
    pixelCrop.width, pixelCrop.height,
  )
  return new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9))
}

function CropModal({ src, onConfirm, onCancel, uploading }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [pixels, setPixels] = useState(null)

  const onCropComplete = useCallback((_, px) => setPixels(px), [])

  const handleConfirm = async () => {
    if (!pixels) return
    const blob = await getCroppedBlob(src, pixels, rotation)
    onConfirm(blob)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60">
      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">Atur Foto Profile</p>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

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
              cropAreaStyle: { border: '2px solid rgba(255,255,255,0.7)', borderRadius: '50%' },
            }}
          />
        </div>

        <div className="px-4 py-3 space-y-3">
          <div className="flex items-center gap-2">
            <ZoomOut size={14} className="text-gray-400 flex-shrink-0" />
            <input type="range" min={1} max={3} step={0.05} value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              className="flex-1 h-1.5 rounded-full accent-sage-500 cursor-pointer" />
            <ZoomIn size={14} className="text-gray-400 flex-shrink-0" />
          </div>
          <div className="flex items-center gap-2">
            <RotateCw size={14} className="text-gray-400 flex-shrink-0" />
            <input type="range" min={-180} max={180} step={1} value={rotation}
              onChange={e => setRotation(Number(e.target.value))}
              className="flex-1 h-1.5 rounded-full accent-sage-500 cursor-pointer" />
            <span className="text-xs text-gray-400 w-8 text-right">{rotation}°</span>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={onCancel}
              className="flex-1 py-2 rounded-lg text-sm text-gray-500 border border-gray-200 hover:bg-gray-50">
              Batal
            </button>
            <button onClick={handleConfirm} disabled={uploading}
              className="flex-1 py-2 rounded-lg text-sm font-medium bg-sage-500 hover:bg-sage-600 text-white disabled:opacity-50 flex items-center justify-center gap-1.5">
              {uploading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Mengupload...
                </>
              ) : (
                <>
                  <Check size={14} />
                  Simpan
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AvatarUploader({ open, onClose }) {
  const { user, uploadAvatar, removeAvatar } = useAuth()
  const inputRef = useRef()
  const [rawSrc, setRawSrc] = useState(null)
  const [cropOpen, setCropOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)

  if (!open) return null

  const avatarUrl = user?.user_metadata?.avatar_url
  const email     = user?.email ?? ''
  const initial   = email[0]?.toUpperCase() ?? 'O'

  const openFile = (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('File harus gambar'); return }
    if (file.size > 10 * 1024 * 1024)   { toast.error('Maksimal 10 MB'); return }
    const reader = new FileReader()
    reader.onload = () => { setRawSrc(reader.result); setCropOpen(true) }
    reader.readAsDataURL(file)
  }

  const handleConfirm = async (blob) => {
    setUploading(true)
    try {
      await uploadAvatar(blob)
      toast.success('Foto profile diperbarui')
      setCropOpen(false)
      setRawSrc(null)
      onClose()
    } catch (err) {
      toast.error(`Gagal: ${err.message}`)
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = async () => {
    if (!confirm('Hapus foto profile?')) return
    setRemoving(true)
    try {
      await removeAvatar()
      toast.success('Foto profile dihapus')
      onClose()
    } catch (err) {
      toast.error(`Gagal: ${err.message}`)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40" onClick={onClose}>
        <div className="relative w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-xl overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-700">Foto Profile</p>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
              <X size={16} />
            </button>
          </div>

          <div className="p-6 flex flex-col items-center gap-3">
            <div className="w-28 h-28 rounded-full overflow-hidden bg-sage-100 flex items-center justify-center border-2 border-gray-100">
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-semibold text-sage-700">{initial}</span>
              )}
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">{email}</p>
              <p className="text-xs text-gray-400">JPG · PNG · WEBP — maks 10 MB</p>
            </div>
          </div>

          <div className="px-4 pb-4 flex gap-2">
            <button
              onClick={() => inputRef.current?.click()}
              className="flex-1 py-2 rounded-lg text-sm font-medium bg-sage-500 hover:bg-sage-600 text-white flex items-center justify-center gap-1.5"
            >
              <Camera size={14} />
              {avatarUrl ? 'Ganti Foto' : 'Pilih Foto'}
            </button>
            {avatarUrl && (
              <button
                onClick={handleRemove}
                disabled={removing}
                className="px-3 py-2 rounded-lg text-sm font-medium text-red-500 border border-red-200 hover:bg-red-50 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {removing
                  ? <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                  : <Trash2 size={14} />}
                Hapus
              </button>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { openFile(e.target.files?.[0]); e.target.value = '' }}
          />
        </div>
      </div>

      {cropOpen && rawSrc && (
        <CropModal
          src={rawSrc}
          uploading={uploading}
          onConfirm={handleConfirm}
          onCancel={() => { setCropOpen(false); setRawSrc(null) }}
        />
      )}
    </>
  )
}