import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useSite } from '../lib/store'
import Icon from './Icon'

// পেইজ বদলালে সবসময় একদম উপর থেকে শুরু
export function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }) }, [pathname])
  return null
}

// নিচে নামলে ডান কোনায় "উপরে যান" বোতাম; চারপাশে স্ক্রলের অগ্রগতির রিং
export function BackToTop() {
  const { t } = useSite()
  const [p, setP] = useState(0)
  useEffect(() => {
    const f = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight
      setP(h > 0 ? Math.min(1, window.scrollY / h) : 0)
    }
    window.addEventListener('scroll', f, { passive: true })
    f()
    return () => window.removeEventListener('scroll', f)
  }, [])
  const show = typeof window !== 'undefined' && window.scrollY > 380
  const C = 2 * Math.PI * 21
  return (
    <button type="button" className={`to-top ${show ? 'on' : ''}`} aria-label={t('nav.top')} title={t('nav.top')} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
      <svg viewBox="0 0 48 48" className="ring" aria-hidden="true">
        <circle cx="24" cy="24" r="21" className="trk" />
        <circle cx="24" cy="24" r="21" className="bar" strokeDasharray={C} strokeDashoffset={C * (1 - p)} />
      </svg>
      <span className="arr"><Icon name="arrowup" size={22} cls="cur" /></span>
    </button>
  )
}
