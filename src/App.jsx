import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import AppLayout from './components/layout/AppLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import KasirMenu from './pages/KasirMenu'
import StokHPP from './pages/StokHPP'
import PembelianBahan from './pages/PembelianBahan'
import Penjualan from './pages/Penjualan'
import Laporan from './pages/Laporan'
import ErrorBoundary from './components/ui/ErrorBoundary'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl bg-sage-500 flex items-center justify-center mx-auto mb-3 animate-pulse">
            <span className="text-white font-bold text-sm">99</span>
          </div>
          <p className="text-sm text-gray-400">Memuat...</p>
        </div>
      </div>
    )
  }
  return user ? children : <Navigate to="/login" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="menu"      element={<KasirMenu />} />
        <Route path="stok"      element={<StokHPP />} />
        <Route path="pembelian" element={<PembelianBahan />} />
        <Route path="penjualan" element={<Penjualan />} />
        <Route path="laporan"   element={<Laporan />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ErrorBoundary>
          <AppRoutes />
        </ErrorBoundary>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: { borderRadius: '10px', fontSize: '13px', border: '1px solid #e5e7eb' },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  )
}
