import { useId } from 'react'

export default function Input({ label, error, className = '', ...props }) {
  const generatedId = useId()
  const { id, 'aria-describedby': describedBy, ...inputProps } = props
  const controlId = id || generatedId
  const errorId = `${controlId}-error`
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={controlId} className="text-sm font-medium text-gray-600">
          {label}
        </label>
      )}
      <input
        id={controlId}
        aria-invalid={error ? true : undefined}
        aria-describedby={[describedBy, error && errorId].filter(Boolean).join(' ') || undefined}
        className={`
          w-full px-3 py-2 rounded-lg border text-sm
          bg-white border-gray-200 text-gray-800
          placeholder-gray-300
          focus:outline-none focus:ring-2 focus:ring-sage-400 focus:border-transparent
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors
          ${error ? 'border-red-300 focus:ring-red-300' : ''}
          ${className}
        `}
        {...inputProps}
      />
      {error && <p id={errorId} className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
