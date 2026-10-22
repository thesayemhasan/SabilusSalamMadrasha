import { useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { DEFAULTS, LANGS, META, TEXT_GROUPS } from '../../lib/texts'
import { useSite } from '../../lib/store'

function Row({ k }) {
  const { overrides, reload } = useSite()
  const cur = overrides[k] || {}
  const [v, setV] = useState({
    bn: cur.bn ?? DEFAULTS[k].bn,
    ar: cur.ar ?? DEFAULTS[k].ar,
    en: cur.en ?? DEFAULTS[k].en,
  })
  const [state, setState] = useState('')
  const changed = LANGS.some((l) => (v[l.code] || '') !== (cur[l.code] ?? DEFAULTS[k][l.code]))
  const edited = Boolean(overrides[k])
  const Field = META[k].multiline ? 'textarea' : 'input'

  async function save() {
    setState('…')
    const { error } = await supabase.from('site_texts').upsert({ key: k, ...v, updated_at: new Date().toISOString() })
    if (error) return setState('ত্রুটি: ' + error.message)
    await reload()
    setState('সংরক্ষিত হয়েছে')
  }
  async function reset() {
    if (!confirm('মূল লেখায় ফিরিয়ে নেবেন?')) return
    await supabase.from('site_texts').delete().eq('key', k)
    setV({ ...DEFAULTS[k] })
    await reload()
    setState('মূল লেখা ফিরেছে')
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <code style={{ fontSize: '.8rem', color: 'var(--muted)' }}>{k}</code>
        {edited && <span className="pill ok">পরিবর্তিত</span>}
      </div>
      <div className="grid g3">
        {LANGS.map((l) => (
          <div className="field" key={l.code}>
            <label>{l.label}</label>
            <Field dir={l.dir} value={v[l.code] || ''} onChange={(e) => setV({ ...v, [l.code]: e.target.value })} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn small" disabled={!changed} onClick={save}>সংরক্ষণ</button>
        {edited && <button className="btn small outline" onClick={reset}>মূল লেখায় ফিরুন</button>}
        <span className="muted" style={{ fontSize: '.85rem' }}>{state}</span>
      </div>
    </div>
  )
}

export default function TextsEditor() {
  const [group, setGroup] = useState(TEXT_GROUPS[0].id)
  const [q, setQ] = useState('')
  const keys = useMemo(() => {
    const all = Object.keys(DEFAULTS)
    if (q.trim()) {
      const s = q.trim().toLowerCase()
      return all.filter((k) => k.toLowerCase().includes(s) || LANGS.some((l) => (DEFAULTS[k][l.code] || '').toLowerCase().includes(s)))
    }
    return all.filter((k) => META[k].group === group)
  }, [group, q])

  return (
    <>
      <h2>সাইটের লেখা</h2>
      <p className="muted">ওয়েবসাইটের প্রতিটি লেখা এখান থেকে বাংলা, আরবি ও ইংরেজিতে বদলানো যায়। সংরক্ষণ করলেই সাইটে বদলে যাবে।</p>
      <div className="toolbar">
        <select value={group} onChange={(e) => { setGroup(e.target.value); setQ('') }}>
          {TEXT_GROUPS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
        </select>
        <input placeholder="লেখা খুঁজুন…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="stack">
        {keys.map((k) => <Row key={k} k={k} />)}
        {keys.length === 0 && <div className="card muted">কিছু পাওয়া যায়নি।</div>}
      </div>
    </>
  )
}
