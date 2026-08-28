export default function Card({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 p-5 ${className}`}>
      {children}
    </div>
  )
}
