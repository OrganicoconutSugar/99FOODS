import { useState } from 'react'
import { Menu, Bell } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import AvatarUploader from '../ui/AvatarUploader'

export default function Navbar({ setMobileOpen, lowStockCount = 0 }) {
  const { user } = useAuth()
  const [avatarOpen, setAvatarOpen] = useState(false)

  const avatarUrl = user?.user_metadata?.avatar_url
  const initial   = user?.email?.[0]?.toUpperCase() ?? 'O'

  return (
    <>
      <header className="h-13 flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 flex-shrink-0">
        <button
          className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
          onClick={() => setMobileOpen(true)}
        >
          <Menu size={18} />
        </button>

        <div className="hidden md:block" />

        <div className="flex items-center gap-2">
          {lowStockCount > 0 && (
            <div className="relative">
              <button className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-500">
                <Bell size={18} />
              </button>
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-red-400 text-white text-[9px] font-bold flex items-center justify-center">
                {lowStockCount > 9 ? '9+' : lowStockCount}
              </span>
            </div>
          )}

          <button
            onClick={() => setAvatarOpen(true)}
            className="w-8 h-8 rounded-full overflow-hidden bg-sage-100 flex items-center justify-center text-xs font-semibold text-sage-700 border border-gray-100 hover:ring-2 hover:ring-sage-200 transition-shadow"
            title="Klik untuk ganti foto profile"
          >
            {avatarUrl
              ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              : initial}
          </button>
        </div>
      </header>

      <AvatarUploader open={avatarOpen} onClose={() => setAvatarOpen(false)} />
    </>
  )
}