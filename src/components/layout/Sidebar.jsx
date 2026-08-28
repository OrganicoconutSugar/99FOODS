import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, UtensilsCrossed, ShoppingCart, Receipt,
  BarChart2, Package, LogOut, ChevronLeft, ChevronRight, X
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import logo from '../../assets/element/logosidebar.png'

const NAV_ITEMS = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/menu',      icon: UtensilsCrossed, label: 'Menu' },
  { to: '/stok',      icon: Package,         label: 'Stok Makanan' },
  { to: '/pembelian', icon: ShoppingCart,    label: 'Pembelian Bahan' },
  { to: '/penjualan', icon: Receipt,         label: 'Transaksi Jual' },
  { to: '/laporan',   icon: BarChart2,       label: 'Laporan' },
]

export default function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) {
  const { logout } = useAuth()

  const handleLogout = async () => {
    try {
      await logout()
      toast.success('Berhasil logout')
    } catch {
      toast.error('Gagal logout')
    }
  }

  const NavContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex flex-col items-center gap-1 px-3 py-4 border-b border-gray-100 ${collapsed ? 'px-2' : ''}`}>
        <img
          src={logo}
          alt="99Foods"
          className={collapsed ? 'w-10 h-12 object-contain' : 'w-24 h-28 object-contain'}
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto scrollbar-thin">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-100
              ${isActive
                ? 'bg-sage-500 text-white'
                : 'text-gray-500 hover:bg-sage-50 hover:text-sage-700'
              }
              ${collapsed ? 'justify-center' : ''}`
            }
            title={collapsed ? label : undefined}
          >
            <Icon size={17} className="flex-shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 border-t border-gray-100">
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors ${collapsed ? 'justify-center' : ''}`}
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut size={17} className="flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex flex-col h-screen bg-white border-r border-gray-100 transition-all duration-200 flex-shrink-0 relative ${collapsed ? 'w-14' : 'w-56'}`}>
        {NavContent}
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
          <aside className="relative w-56 h-full bg-white flex flex-col">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-gray-100"
            >
              <X size={16} className="text-gray-400" />
            </button>
            {NavContent}
          </aside>
        </div>
      )}
    </>
  )
}
