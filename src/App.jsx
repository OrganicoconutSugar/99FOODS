import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import AppLayout from './components/layout/AppLayout'
import Login from './pages/Login'
import Landing from './pages/Landing'
import ErrorBoundary from './components/ui/ErrorBoundary'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const KasirMenu = lazy(() => import('./pages/KasirMenu'))
const StokHPP = lazy(() => import('./pages/StokHPP'))
const PembelianBahan = lazy(() => import('./pages/PembelianBahan'))
const Penjualan = lazy(() => import('./pages/Penjualan'))
const PesananDapur = lazy(() => import('./pages/PesananDapur'))
const Laporan = lazy(() => import('./pages/Laporan'))

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
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-400" role="status">Memuat halaman...</div>}>
      <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="app" element={<Dashboard />} />
        <Route path="menu"      element={<KasirMenu />} />
        <Route path="stok"      element={<StokHPP />} />
        <Route path="pembelian" element={<PembelianBahan />} />
        <Route path="penjualan" element={<Penjualan />} />
        <Route path="dapur" element={<PesananDapur />} />
        <Route path="laporan"   element={<Laporan />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
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
