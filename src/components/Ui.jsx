import { useRef, useState } from 'react'
import { uploadImage, configured } from '../lib/supabase'

export function Switch({ checked, onChange, disabled }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </label>
  )
}

export function Modal({ onClose, children }) {
  return (
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="box">{children}</div>
    </div>
  )
}

export function ImageUpload({ value, onChange, folder }) {
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
        {value ? <img src={value} alt="" /> : null}
        <input ref={ref} type="file" accept="image/*" hidden onChange={pick} />
        <button type="button" className="btn small outline" disabled={busy || !configured} onClick={() => ref.current.click()}>
          {busy ? 'আপলোড হচ্ছে…' : 'ছবি আপলোড'}
        </button>
        {value && <button type="button" className="btn small outline" onClick={() => onChange('')}>মুছুন</button>}
      </div>
      <input style={{ marginTop: 8 }} placeholder="অথবা ছবির লিংক বসান" value={value || ''} onChange={(e) => onChange(e.target.value)} />
      {err && <div className="alert err" style={{ marginTop: 6 }}>{err}</div>}
    </div>
  )
}
