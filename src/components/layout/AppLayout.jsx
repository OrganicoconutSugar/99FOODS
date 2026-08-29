import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import Chatbot from '../ui/Chatbot'
import ChatbotButton from '../ui/ChatbotButton'
import { useChat } from '../../context/ChatContext'
import { supabase } from '../../lib/supabase'

export default function AppLayout() {
  const { isOpen, setIsOpen } = useChat()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [lowStockCount, setLowStockCount] = useState(0)

  useEffect(() => {
    fetchLowStock()
    const channel = supabase
      .channel('bahan_stok')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bahan_baku' }, fetchLowStock)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  const fetchLowStock = async () => {
    try {
      const { data } = await supabase.from('bahan_baku').select('id, stok, stok_minimum')
      if (data) setLowStockCount(data.filter(b => b.stok <= b.stok_minimum).length)
    } catch {}
  }

  return (
    <div className="app-layout flex h-screen bg-stone-50 overflow-hidden">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar setMobileOpen={setMobileOpen} lowStockCount={lowStockCount} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin relative">
          <Outlet />
        </main>
      </div>
      <ChatbotButton />
      <Chatbot open={isOpen} onClose={() => setIsOpen(false)} />
    </div>
  )
}
