import './DashboardIcon.css'

export default function DashboardIcon({ name, size = 32, className = '' }) {
  return <span
    aria-hidden="true"
    className={`dashboard-icon dashboard-icon--${name} ${className}`}
    style={{ width: size, height: size }}
  />
}
