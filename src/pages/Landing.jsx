import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react'
import logo from '../assets/element/logo.png'
import './Landing.css'

const slides = [
  {
    id: 'rasa',
    eyebrow: 'Selamat datang di 99Foods',
    title: <>RASA<br />YANG<br />DEKAT.</>,
    subtitle: 'Dari dapur kami, untuk setiap momenmu.',
    caption: 'Cerita 99Foods',
    color: 'orange',
    art: '01',
    image: null,
  },
  {
    id: 'menu',
    eyebrow: 'Pilihan untuk dinikmati',
    title: <>TEMUKAN<br />FAVORIT<br />BARU.</>,
    subtitle: 'Ruang untuk foto menu dan sajian andalan 99Foods.',
    caption: 'Menu & sajian',
    color: 'sage',
    art: '02',
    image: null,
  },
  {
    id: 'dapur',
    eyebrow: 'Di balik setiap pesanan',
    title: <>DIBUAT<br />DENGAN<br />HATI.</>,
    subtitle: 'Cerita dari dapur, bahan, dan orang-orang di balik 99Foods.',
    caption: 'Dari dapur',
    color: 'red',
    art: '03',
    image: null,
  },
  {
    id: 'kasir',
    eyebrow: 'Untuk tim 99Foods',
    title: <>SEMUA<br />LEBIH<br />RAPI.</>,
    subtitle: 'Kelola transaksi, stok, dan laporan dalam satu tempat.',
    caption: 'Dashboard kasir',
    color: 'ink',
    art: '04',
    image: null,
  },
]

export default function Landing() {
  const [active, setActive] = useState(0)
  const activeRef = useRef(0)
  const wheelTime = useRef(0)
  const startX = useRef(null)

  const goTo = useCallback((index) => {
    const next = Math.max(0, Math.min(slides.length - 1, index))
    activeRef.current = next
    setActive(next)
  }, [])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'ArrowRight') goTo(activeRef.current + 1)
      if (event.key === 'ArrowLeft') goTo(activeRef.current - 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [goTo])

  const onWheel = (event) => {
    if (Math.abs(event.deltaX) < 12 && Math.abs(event.deltaY) < 12) return
    const now = Date.now()
    if (now - wheelTime.current < 680) return
    wheelTime.current = now
    const direction = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
    goTo(activeRef.current + (direction > 0 ? 1 : -1))
  }

  const onPointerDown = (event) => {
    if (event.target.closest('a, button')) return
    startX.current = event.clientX
  }

  const onPointerUp = (event) => {
    if (startX.current === null) return
    const distance = event.clientX - startX.current
    startX.current = null
    if (Math.abs(distance) > 55) goTo(activeRef.current + (distance < 0 ? 1 : -1))
  }

  return (
    <main className="landing" onWheel={onWheel} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { startX.current = null }}>
      <header className="landing-header">
        <Link to="/" className="landing-brand" aria-label="99Foods, kembali ke awal" onClick={() => goTo(0)}>
          <img src={logo} alt="" />
          <span>99FOODS <b>|</b> 99FOODS</span>
        </Link>
        <Link className="landing-login" to="/login">Login Kasir <ArrowUpRight size={16} aria-hidden="true" /></Link>
      </header>

      <div className="landing-track" style={{ transform: `translate3d(-${active * 100}%, 0, 0)` }}>
        {slides.map((slide, index) => (
          <section className={`landing-slide landing-slide--${slide.color}`} key={slide.id} aria-label={`${slide.caption}, halaman ${index + 1} dari ${slides.length}`} aria-hidden={index !== active}>
            <div className="landing-copy">
              <div className="landing-copy-inner">
                <p className="landing-eyebrow">{slide.eyebrow}</p>
                <h1>{slide.title}</h1>
                <p className="landing-subtitle">{slide.subtitle}</p>
                {index === 0 && <Link className="landing-primary" to="/login">Masuk ke Kasir <ArrowUpRight size={19} aria-hidden="true" /></Link>}
                {index === slides.length - 1 && <Link className="landing-primary" to="/login">Buka Dashboard <ArrowUpRight size={19} aria-hidden="true" /></Link>}
              </div>
            </div>
            <div className="landing-art" aria-label={slide.image ? `Foto ${slide.caption}` : 'Tempat foto 99Foods yang akan ditambahkan'}>
              <div className="landing-art-number" aria-hidden="true">{slide.art}</div>
              <div className={`landing-photo-slot${slide.image ? ' has-image' : ''}`}>
                {slide.image && <img src={slide.image} alt={slide.caption} />}
                <span className="landing-slot-corner landing-slot-corner--tl" />
                <span className="landing-slot-corner landing-slot-corner--tr" />
                <span className="landing-slot-corner landing-slot-corner--bl" />
                <span className="landing-slot-corner landing-slot-corner--br" />
                {!slide.image && <><span>FOTO 99FOODS</span><small>Area foto pilihanmu</small></>}
              </div>
              <span className="landing-art-wordmark">99FOODS</span>
            </div>
          </section>
        ))}
      </div>

      <div className="landing-bottom">
        <div className="landing-progress" aria-label="Pilih bagian landing page">
          {slides.map((slide, index) => (
            <button key={slide.id} type="button" className={index === active ? 'is-active' : ''} onClick={() => goTo(index)} aria-label={`Tampilkan ${slide.caption}`} aria-current={index === active ? 'step' : undefined}>
              <span>{String(index + 1).padStart(2, '0')}</span>
            </button>
          ))}
        </div>
        <div className="landing-caption"><strong>{slides[active].caption}</strong><span>99Foods</span><Link to="/login">Login Kasir <ArrowUpRight size={14} aria-hidden="true" /></Link></div>
        <div className="landing-arrows">
          <button type="button" onClick={() => goTo(active - 1)} disabled={active === 0} aria-label="Sebelumnya"><ArrowLeft size={19} /></button>
          <button type="button" onClick={() => goTo(active + 1)} disabled={active === slides.length - 1} aria-label="Selanjutnya"><ArrowRight size={19} /></button>
        </div>
      </div>
    </main>
  )
}
