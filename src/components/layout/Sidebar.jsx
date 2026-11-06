import { NavLink } from 'react-router-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import DashboardIcon from '../ui/DashboardIcon'
import { useAuth } from '../../context/AuthContext'
import { resetDemoData } from '../../lib/demoSupabase'
import toast from 'react-hot-toast'
import logo from '../../assets/element/logo.png'

const NAV_GROUPS = [
  { title: 'Utama', items: [
    { to: '/app', icon: 'dashboard', label: 'Dashboard' },
  ] },
  { title: 'Fitur', items: [
    { to: '/menu', icon: 'menu', label: 'Menu' },
  ] },
  { title: 'Dapur', items: [
    { to: '/stok', icon: 'stock', label: 'Stok Makanan' },
    { to: '/pembelian', icon: 'purchase', label: 'Pembelian Bahan' },
    { to: '/penjualan', icon: 'sales', label: 'Transaksi Jual' },
    { to: '/dapur', icon: 'kitchen', label: 'Pesanan Dapur' },
  ] },
  { title: 'Analitik', items: [
    { to: '/laporan', icon: 'report', label: 'Laporan' },
  ] },
]

export default function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) {
  const { logout, isDemo } = useAuth()

  const handleResetDemo = () => {
    if (!window.confirm('Kembalikan semua data demo ke kondisi awal?')) return
    resetDemoData()
    window.location.assign('/app')
  }

  const handleLogout = async () => {
    try {
      await logout()
      toast.success('Berhasil logout')
    } catch {
      toast.error('Gagal logout')
    }
  }

  const renderNavContent = (isCollapsed) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`sidebar-brand flex items-center px-3 py-2 border-b border-gray-100 ${isCollapsed ? 'px-2' : ''}`}>
        <img
          src={logo}
          alt="99Foods"
          className={isCollapsed ? 'w-11 h-11 object-contain flex-shrink-0 mx-auto' : 'w-16 h-16 object-contain flex-shrink-0'}
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 overflow-y-auto scrollbar-thin" aria-label="Menu utama">
        {NAV_GROUPS.map(({ title, items }, index) => (
          <div key={title} className={index === 0 ? '' : 'mt-4'}>
            {isCollapsed
              ? index > 0 && <div className="mx-2 mb-2 border-t border-gray-100" aria-hidden="true" />
              : <h2 className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400">{title}</h2>}
            <div className="space-y-0.5">
              {items.map(({ to, icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/app'}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm font-medium transition-colors duration-100
                    ${isActive ? 'bg-sage-500 text-white' : 'text-gray-500 hover:bg-sage-50 hover:text-sage-700'}
                    ${isCollapsed ? 'justify-center' : ''}`
                  }
                  title={isCollapsed ? label : undefined}
                >
                  <DashboardIcon name={icon} size={32} />
                  {!isCollapsed && <span className="truncate">{label}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 border-t border-gray-100">
        {isDemo && <button
          onClick={handleResetDemo}
          className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-500 hover:bg-sage-50 hover:text-sage-700 ${isCollapsed ? 'justify-center' : ''}`}
          title={isCollapsed ? 'Reset data demo' : undefined}
        >
          <DashboardIcon name="reset" size={30} />
          {!isCollapsed && <span>Reset data demo</span>}
        </button>}
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors ${isCollapsed ? 'justify-center' : ''}`}
          title={isCollapsed ? 'Logout' : undefined}
        >
          <DashboardIcon name="logout" size={30} />
          {!isCollapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={`dashboard-sidebar hidden md:flex flex-col h-[100dvh] bg-white border-r border-gray-100 transition-all duration-200 flex-shrink-0 relative ${collapsed ? 'w-14' : 'w-56'}`}>
        {renderNavContent(collapsed)}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="absolute -right-3 top-[140px] z-10 w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
        >
          {collapsed ? <ChevronRight size={11} className="text-gray-400" /> : <ChevronLeft size={11} className="text-gray-400" />}
        </button>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/20" onClick={() => setMobileOpen(false)} />
          <aside className="dashboard-sidebar relative w-56 h-full bg-white flex flex-col">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-gray-100"
            >
              <X size={16} className="text-gray-400" />
            </button>
            {renderNavContent(false)}
          </aside>
        </div>
      )}
    </>
  )
}
