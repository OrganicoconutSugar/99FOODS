import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { DEMO_EMAIL, DEMO_PASSWORD, useAuth } from '../context/AuthContext'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import toast from 'react-hot-toast'
import logo from '../assets/element/logo.png'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import './Login.css'

export default function Login() {
  const { user, login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to="/app" replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Email dan password harus diisi')
      return
    }
    setLoading(true)
    try {
      await login(email, password)
      toast.success('Selamat datang!')
    } catch (err) {
      toast.error(err.message || 'Login gagal. Periksa email dan password.')
    } finally {
      setLoading(false)
    }
  }

  const fillDemo = () => {
    setEmail(DEMO_EMAIL)
    setPassword(DEMO_PASSWORD)
  }

  return (
    <main className="login-page">
      <section className="login-story">
        <Link to="/" className="login-brand" aria-label="Kembali ke 99Foods">
          <img src={logo} alt="" />
          <span>99FOODS <b>|</b> 99FOODS</span>
        </Link>
        <div className="login-story-copy">
          <p>UNTUK TIM 99FOODS</p>
          <h1>SEMUA<br />LEBIH<br />RAPI.</h1>
          <span>Kelola transaksi, stok, dan laporan dalam satu tempat.</span>
        </div>
        <Link to="/" className="login-back"><ArrowLeft size={16} /> Kembali ke halaman utama</Link>
        <strong aria-hidden="true">99</strong>
      </section>

      <section className="login-form-side">
        <div className="login-content">
          <p className="login-eyebrow">AKSES DASHBOARD / 99FOODS</p>
          <h2>SELAMAT<br />DATANG.</h2>
          <p className="login-lead">Masuk untuk melihat aktivitas usahamu.</p>
          <div className="login-form">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="owner@99foods.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <Button type="submit" className="w-full mt-1" loading={loading} size="lg">
              Masuk <ArrowUpRight size={18} />
            </Button>
          </form>
          </div>

        <div className="login-demo border border-sage-200 bg-sage-50 p-4 text-sm text-gray-700">
          <p className="font-semibold">Coba semua fitur dengan akun demo</p>
          <p className="mt-1 text-xs text-gray-500">Coba seluruh fitur dengan data contoh lokal yang terpisah dari toko.</p>
          <p className="mt-3 font-mono text-xs break-all">{DEMO_EMAIL} / {DEMO_PASSWORD}</p>
          <button type="button" onClick={fillDemo} className="mt-3 border-b-2 border-sage-600 pb-0.5 text-xs font-bold text-sage-700">Isi akun demo</button>
        </div>
        </div>
        <p className="login-foot">BUMC 99Foods</p>
      </section>
    </main>
  )
}
