import { useEffect, useRef } from 'react'

export function useDialogFocus(open, onClose) {
  const dialogRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return undefined
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    const dialog = dialogRef.current
    document.body.style.overflow = 'hidden'
    const firstInput = dialog?.querySelector('input:not([disabled]), select:not([disabled]), textarea:not([disabled])')
    ;(firstInput || dialog)?.focus()

    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
      }
      if (event.key !== 'Tab') return
      const elements = [...(dialog?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]') || [])]
      if (!elements.length) {
        event.preventDefault()
        return
      }
      if (event.shiftKey && (document.activeElement === elements[0] || document.activeElement === dialog)) {
        event.preventDefault()
        elements[elements.length - 1].focus()
      } else if (!event.shiftKey && (document.activeElement === elements[elements.length - 1] || document.activeElement === dialog)) {
        event.preventDefault()
        elements[0].focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus?.()
    }
  }, [open])

  return dialogRef
}
