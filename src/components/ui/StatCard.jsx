import Card from './Card'

export default function StatCard({ label, value, icon, color = 'sage', sub }) {
  const colors = {
    sage:   'bg-sage-50 text-sage-600',
    green:  'bg-sage-50 text-sage-600',
    blue:   'bg-sky-50 text-sky-600',
    orange: 'bg-amber-50 text-amber-600',
    red:    'bg-red-50 text-red-500',
    purple: 'bg-violet-50 text-violet-600',
  }

  const renderIcon = () => {
    if (typeof icon === 'string') {
      return <img src={icon} alt="" className="w-6 h-6 object-contain" />
    }
    if (typeof icon === 'function') {
      return <icon size={20} className="text-current" />
    }
    return null
  }

  return (
    <Card className="flex items-start gap-4 min-w-0">
      <div className={`rounded-lg p-2.5 flex-shrink-0 ${colors[color]}`}>
        {renderIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-base font-semibold text-gray-800 whitespace-nowrap">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </Card>
  )
}
