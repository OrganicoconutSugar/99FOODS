import { isValidElement } from 'react'
import Card from './Card'

export default function StatCard({ label, value, icon, sub }) {
  const renderIcon = () => {
    if (isValidElement(icon)) return icon
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
      <div className="stat-card-icon flex-shrink-0">
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
