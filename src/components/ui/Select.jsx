export default function Select({ label, error, children, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-gray-600">
          {label}
        </label>
      )}
      <select
        className={`
          w-full px-3 py-2 rounded-lg border text-sm
          bg-white border-gray-200 text-gray-800
          focus:outline-none focus:ring-2 focus:ring-sage-400 focus:border-transparent
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors
          ${error ? 'border-red-300 focus:ring-red-300' : ''}
          ${className}
        `}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
