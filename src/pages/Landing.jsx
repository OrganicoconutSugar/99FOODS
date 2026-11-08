import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react'
import logo from '../assets/element/logo.png'
import packagedFood from '../assets/landing/produk-kemasan.jpg'
import bowlFood from '../assets/landing/sajian-mangkuk.jpg'
import foodCollection from '../assets/landing/aneka-produk.jpg'
import foodPromo from '../assets/landing/promo-99foods.png'
import squarePastry from '../assets/landing/cutout-pastry-square.png'
import pastel from '../assets/landing/cutout-pastel.png'
import dimsum from '../assets/landing/cutout-dimsum.png'
import './Landing.css'

const INTRO_EXIT_MS = 780
const INTRO_VIDEO = '/videos/99foods-intro-landscape.mp4'

const slides = [
  {
    id: 'rasa',
    eyebrow: 'Selamat datang di 99Foods',
    title: <>RASA<br />YANG<br />DEKAT.</>,
    subtitle: 'Dari dapur kami, untuk setiap momenmu.',
    caption: 'Cerita 99Foods',
    color: 'orange',
    art: '01',
    image: packagedFood,
    imageAlt: 'Aneka sajian 99Foods dalam kemasan',
    photoLabel: 'PILIHAN 99FOODS',
  },
  {
    id: 'menu',
    eyebrow: 'Pilihan untuk dinikmati',
    title: <>TEMUKAN<br />FAVORIT<br />BARU.</>,
    subtitle: 'Sajian pilihan 99Foods untuk dinikmati kapan saja.',
    caption: 'Menu & sajian',
    color: 'sage',
    art: '02',
    image: bowlFood,
    imageAlt: 'Sajian 99Foods dalam mangkuk',
    photoLabel: 'SIAP DINIKMATI',
  },
  {
    id: 'dapur',
    eyebrow: 'Di balik setiap pesanan',
    title: <>DIBUAT<br />DENGAN<br />HATI.</>,
    subtitle: 'Cerita dari dapur, bahan, dan orang-orang di balik 99Foods.',
    caption: 'Dari dapur',
    color: 'red',
    art: '03',
    image: foodCollection,
    imageAlt: 'Beragam makanan yang disiapkan 99Foods',
    photoLabel: 'DARI DAPUR KAMI',
  },
  {
    id: 'kasir',
    eyebrow: 'Untuk tim 99Foods',
    title: <>SEMUA<br />LEBIH<br />RAPI.</>,
    subtitle: 'Kelola transaksi, stok, dan laporan dalam satu tempat.',
    caption: 'Dashboard kasir',
    color: 'ink',
    art: '04',
    image: foodPromo,
    imageAlt: 'Foto promosi makanan 99Foods',
    photoLabel: 'PESAN & NIKMATI',
  },
]

function LandingIntro({ onComplete }) {
  const [isExiting, setIsExiting] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const finishTimer = useRef(null)
  const isFinishing = useRef(false)

  const finishIntro = useCallback(() => {
    if (isFinishing.current) return
    isFinishing.current = true
    setIsExiting(true)

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    finishTimer.current = window.setTimeout(onComplete, reduceMotion ? 30 : INTRO_EXIT_MS)
  }, [onComplete])

  useEffect(() => () => {
    if (finishTimer.current) window.clearTimeout(finishTimer.current)
  }, [])

  return (
    <section className={`landing-intro${isExiting ? ' is-exiting' : ''}`} aria-label="Video pembuka 99Foods">
      <video
        className="landing-intro-video"
        src={INTRO_VIDEO}
        autoPlay
        muted={isMuted}
        playsInline
        preload="auto"
        onEnded={finishIntro}
        onError={finishIntro}
      />

      <div className="landing-intro-top" aria-hidden="true">
        <span>99FOODS</span>
        <span>Rasa yang dekat</span>
      </div>

      <div className="landing-intro-controls">
        <button type="button" onClick={() => setIsMuted((muted) => !muted)}>
          {isMuted ? 'Nyalakan suara' : 'Matikan suara'}
        </button>
        <button type="button" onClick={finishIntro}>Lewati intro</button>
      </div>
    </section>
  )
}

export default function Landing() {
  const [active, setActive] = useState(0)
  const [showIntro, setShowIntro] = useState(true)
  const activeRef = useRef(0)
  const wheelTime = useRef(0)
  const startX = useRef(null)

  const completeIntro = useCallback(() => setShowIntro(false), [])

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
      {showIntro && <LandingIntro onComplete={completeIntro} />}

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
            <div className="landing-art" aria-label={`Foto ${slide.caption}`}>
              <div className="landing-art-backdrop" style={{ backgroundImage: index === active ? `url(${slide.image})` : undefined }} aria-hidden="true" />
              <div className="landing-art-number" aria-hidden="true">{slide.art}</div>
              <figure className="landing-photo-slot has-image">
                <img src={slide.image} alt={slide.imageAlt} loading={index === 0 ? 'eager' : 'lazy'} decoding="async" />
                <figcaption><span>{slide.photoLabel}</span><span>99 / {slide.art}</span></figcaption>
              </figure>
              <img className="landing-snack landing-snack--square" src={squarePastry} alt="" aria-hidden="true" loading="lazy" decoding="async" />
              <img className="landing-snack landing-snack--pastel" src={pastel} alt="" aria-hidden="true" loading="lazy" decoding="async" />
              <img className="landing-snack landing-snack--dimsum" src={dimsum} alt="" aria-hidden="true" loading="lazy" decoding="async" />
              <span className="landing-art-kicker" aria-hidden="true">RASA • CERITA • 99FOODS</span>
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
