import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSite } from '../lib/store'
import Icon from './Icon'

const ymd = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const KEY = 'site_popup_seen'
const store = {
  get: (s) => { try { return (s === 'local' ? localStorage : sessionStorage).getItem(KEY) || '' } catch { return '' } },
  set: (s, v) => { try { (s === 'local' ? localStorage : sessionStorage).setItem(KEY, v) } catch { /* ব্যক্তিগত ব্রাউজার */ } },
}

// সাইট খুললে একটি ছবির পপআপ (যেমন মাহফিলের পোস্টার)। ক্রস চাপলে সাইট দেখা যায়।
export default function SitePopup() {
  const { modules } = useSite()
  const [p, setP] = useState(null)
  const [show, setShow] = useState(false)
  const nav = useNavigate()

  useEffect(() => {
    if (!supabase) return
    let live = true
    supabase.from('site_settings').select('value').eq('key', 'popup').maybeSingle().then(({ data }) => {
      const v = data?.value
      if (!live || !v || !v.enabled || !v.image_url) return
      const d = ymd()
      if ((v.start && d < v.start) || (v.end && d > v.end)) return
      // কতবার দেখাবে: always = প্রতিবার সাইট খুললে, session = ব্রাউজার বন্ধ না করা পর্যন্ত একবার, daily = দিনে একবার
      const freq = v.frequency || 'session'
      const mark = `${v.image_url}|${freq === 'daily' ? d : ''}`
      if (freq !== 'always' && store.get(freq === 'daily' ? 'local' : 'session') === mark) return
      const im = new Image()
      im.onload = () => { if (live) { setP({ ...v, mark, freq }); setShow(true) } }
      im.src = v.image_url
    }, () => {})
    return () => { live = false }
  }, [])

  const close = () => {
    setShow(false)
    if (p && p.freq !== 'always') store.set(p.freq === 'daily' ? 'local' : 'session', p.mark)
  }
  useEffect(() => {
    if (!show) return
    const k = (e) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', k)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = '' }
  }, [show]) // eslint-disable-line

  if (!show || !p) return null
  let to = ''
  if (p.link_kind === 'photocard' && modules.photocard === true) to = '/photocard'
  else if (p.link_kind === 'link' && (p.link_url || '').trim()) to = p.link_url.trim()
  const go = () => {
    if (!to) return
    close()
    if (/^(https?:|mailto:|tel:)/i.test(to)) window.open(to, '_blank', 'noopener')
    else nav(to.startsWith('/') ? to : `/${to}`)
  }
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={p.alt || 'popup'} onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(8,12,30,.72)', display: 'grid', placeItems: 'center', padding: 16, WebkitBackdropFilter: 'blur(3px)', backdropFilter: 'blur(3px)' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', maxWidth: 'min(92vw, 640px)', maxHeight: '88vh', display: 'grid' }}>
        <button type="button" aria-label="বন্ধ করুন" onClick={close} style={{ position: 'absolute', top: -14, right: -14, width: 38, height: 38, borderRadius: 19, border: '2px solid #fff', background: '#e5007d', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,.35)', zIndex: 2 }}>
          <Icon name="close" size={18} cls="cur" />
        </button>
        <img src={p.image_url} alt={p.alt || ''} onClick={to ? go : undefined} style={{ maxWidth: '100%', maxHeight: '88vh', objectFit: 'contain', borderRadius: 14, boxShadow: '0 12px 44px rgba(0,0,0,.5)', cursor: to ? 'pointer' : 'default', background: '#fff' }} />
        {to && <button type="button" className="btn" onClick={go} style={{ position: 'absolute', left: '50%', bottom: 14, transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>{p.button_text || (p.link_kind === 'photocard' ? 'ফটোকার্ড বানান' : 'বিস্তারিত দেখুন')}</button>}
      </div>
    </div>,
    document.body
  )
}
