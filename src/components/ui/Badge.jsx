const variants = {
  green:  'bg-sage-100 text-sage-700',
  red:    'bg-red-50 text-red-600',
  yellow: 'bg-amber-50 text-amber-600',
  blue:   'bg-sky-50 text-sky-600',
  orange: 'bg-orange-50 text-orange-600',
  gray:   'bg-gray-100 text-gray-500',
}

export default function Badge({ children, variant = 'gray', className = '' }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  )
}
