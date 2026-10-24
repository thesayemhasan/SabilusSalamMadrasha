import { createPortal } from 'react-dom'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { uploadImage, configured } from '../lib/supabase'
import Icon from './Icon'

export function Switch({ checked, onChange, disabled }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </label>
  )
}

export function Modal({ onClose, children, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`box ${wide ? 'wide' : ''}`}>{children}</div>
    </div>
  )
}

/* ---------- নিজস্ব ড্রপডাউন ---------- */
export function Select({ value, onChange, options, placeholder = '—', disabled, small }) {
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(-1)
  const [pos, setPos] = useState(null)
  const ref = useRef()
  const btn = useRef()
  const opts = options.map((o) => (Array.isArray(o) ? { value: o[0], label: o[1] } : typeof o === 'object' ? o : { value: o, label: o }))
  const cur = opts.find((o) => String(o.value) === String(value ?? ''))

  const place = () => {
    if (!btn.current) return
    const r = btn.current.getBoundingClientRect()
    const below = window.innerHeight - r.bottom
    const h = Math.min(opts.length * 44 + 14, 280)
    const up = below < h + 12 && r.top > below
    setPos({ left: r.left, width: r.width, ...(up ? { bottom: window.innerHeight - r.top + 6, maxHeight: Math.min(280, r.top - 12) } : { top: r.bottom + 6, maxHeight: Math.min(280, below - 12) }) })
  }
  useEffect(() => {
    if (!open) return
    place()
    const off = (e) => { if (e.target.closest && e.target.closest('.sel-pop')) return; if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const close = (e) => { if (!e.target.closest || !e.target.closest('.sel-pop')) setOpen(false) }
    document.addEventListener('mousedown', off)
    document.addEventListener('touchstart', off)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => { document.removeEventListener('mousedown', off); document.removeEventListener('touchstart', off); window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close) }
  }, [open])

  const pickAt = (o) => { onChange(o.value); setOpen(false) }
  const key = (e) => {
    if (disabled) return
    if (e.key === 'Escape') return setOpen(false)
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) { setOpen(true); setHi(Math.max(0, opts.findIndex((o) => String(o.value) === String(value ?? '')))); return }
      setHi((h) => (h + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length)
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (open && hi >= 0) pickAt(opts[hi]); else setOpen(!open)
    }
  }

  return (
    <div className="sel" ref={ref}>
      <button ref={btn} type="button" className={`sel-btn ${open ? 'open' : ''} ${small ? 'small' : ''}`} disabled={disabled} onClick={() => { setOpen(!open); setHi(-1) }} onKeyDown={key} aria-haspopup="listbox" aria-expanded={open}>
        <span className={cur ? '' : 'ph'}>{cur ? cur.label : placeholder}</span>
        <Icon name="chevdown" size={18} />
      </button>
      {open && pos && createPortal(
        <ul className="sel-pop" role="listbox" style={pos}>
          {opts.length === 0 && <li className="empty">—</li>}
          {opts.map((o, i) => (
            <li key={String(o.value)} role="option" aria-selected={cur === o} className={`${cur === o ? 'sel' : ''} ${hi === i ? 'hi' : ''}`} onMouseEnter={() => setHi(i)} onClick={() => pickAt(o)}>
              <span>{o.label}</span>
              {cur === o && <Icon name="check" size={16} />}
            </li>
          ))}
        </ul>,
        document.body
      )}
    </div>
  )
}

/* ---------- মুছা/পরিবর্তনের নিশ্চিতকরণ পপআপ ---------- */
const ConfirmCtx = createContext(null)
export function ConfirmProvider({ children }) {
  const [st, setSt] = useState(null)
  const ask = useCallback((opts) => new Promise((resolve) => setSt({ ...opts, resolve })), [])
  const close = (v) => { st.resolve(v); setSt(null) }
  const del = st && (st.action ? st.action === 'delete' : st.danger !== false)
  const text = st && (st.text || st.question)
  const okLabel = st && (st.ok || st.yes)
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      {st && (
        <Modal onClose={() => close(false)}>
          <div className="confirm" role="alertdialog">
            <div className={`confirm-ic ${del ? 'del' : ''}`}><Icon name={del ? 'trash' : 'edit'} size={30} cls="cur" /></div>
            <h3>{st.title || (del ? 'মুছে ফেলার নিশ্চিতকরণ' : 'পরিবর্তন নিশ্চিত করুন')}</h3>
            {st.name && <div className="confirm-name">“{st.name}”</div>}
            <p className="muted pre">{text || (del ? 'মুছে ফেলবেন? এটি আর ফিরিয়ে আনা যাবে না।' : 'পরিবর্তন করবেন?')}</p>
            <div className="confirm-actions">
              <button type="button" className="btn outline" onClick={() => close(false)}>বাতিল</button>
              <button type="button" autoFocus className={`btn ${del ? 'danger' : ''}`} onClick={() => close(true)}>{okLabel || (del ? 'হ্যাঁ, মুছুন' : 'হ্যাঁ, করুন')}</button>
            </div>
          </div>
        </Modal>
      )}
    </ConfirmCtx.Provider>
  )
}
// const confirm = useConfirm(); if (await confirm({ name: 'নোটিশের নাম' })) ...
export const useConfirm = () => useContext(ConfirmCtx)

export function ImageUpload({ value, onChange, folder, shape = 'sq' }) {
  const ref = useRef()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function pick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) return setErr('ছবি ৫ MB এর কম হতে হবে')
    setBusy(true)
    setErr('')
    try {
      onChange(await uploadImage(file, folder))
    } catch (ex) {
      setErr('আপলোড হয়নি: ' + (ex.message || ''))
    }
    setBusy(false)
    e.target.value = ''
  }

  return (
    <div>
      <div className="img-up">
        {value ? <img className={shape === 'wide' ? 'wide' : ''} src={value} alt="" /> : null}
        <input ref={ref} type="file" accept="image/*" hidden onChange={pick} />
        <button type="button" className="btn small outline" disabled={busy || !configured} onClick={() => ref.current.click()}>
          <Icon name="upload" size={16} cls="cur" /> {busy ? 'আপলোড হচ্ছে…' : 'ছবি আপলোড'}
        </button>
        {value && <button type="button" className="btn small outline" onClick={() => onChange('')}>সরান</button>}
      </div>
      <input style={{ marginTop: 8 }} placeholder="অথবা ছবির লিংক বসান" value={value || ''} onChange={(e) => onChange(e.target.value)} />
      {err && <div className="alert err" style={{ marginTop: 6 }}>{err}</div>}
    </div>
  )
}
