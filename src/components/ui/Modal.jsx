import { useId } from 'react'
import { X } from 'lucide-react'
import { useDialogFocus } from './useDialogFocus'

export default function Modal({ open, onClose, title, children, size = 'md' }) {
  const titleId = useId()
  const dialogRef = useDialogFocus(open, onClose)

  if (!open) return null

  const sizeClass = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }[size]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 sm:bg-black/20" onClick={onClose} aria-hidden="true" />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={`relative w-full ${sizeClass} bg-white rounded-t-2xl sm:rounded-xl border border-gray-100 flex flex-col max-h-[92vh] sm:max-h-[90vh]`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 id={titleId} className="text-base font-semibold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Tutup dialog"
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 scrollbar-thin">
          {children}
        </div>
      </div>
    </div>
  )
}
