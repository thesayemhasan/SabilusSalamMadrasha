import { useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { DEFAULTS, LANGS, META, TEXT_GROUPS } from '../../lib/texts'
import { useSite } from '../../lib/store'
import { Select, useConfirm } from '../../components/Ui'

export function TextRow({ k }) {
  const confirm = useConfirm()
  const { overrides, reload } = useSite()
  const cur = overrides[k] || {}
  const [v, setV] = useState({
    bn: cur.bn ?? DEFAULTS[k].bn,
    ar: cur.ar ?? DEFAULTS[k].ar ?? '',
    en: cur.en ?? DEFAULTS[k].en,
  })
  const [state, setState] = useState('')
  const changed = LANGS.some((l) => (v[l.code] || '') !== (cur[l.code] ?? DEFAULTS[k][l.code]))
  const edited = Boolean(overrides[k])
  const Field = META[k].multiline ? 'textarea' : 'input'
  const long = META[k].multiline && ((DEFAULTS[k].bn || '').length > 250 || (v.bn || '').length > 250)

  async function save() {
    setState('…')
    const { error } = await supabase.from('site_texts').upsert({ key: k, ar: cur.ar ?? DEFAULTS[k].ar, ...v, updated_at: new Date().toISOString() })
    if (error) return setState('ত্রুটি: ' + error.message)
    await reload()
    setState('সংরক্ষিত হয়েছে')
  }
  async function reset() {
    if (!(await confirm({ name: DEFAULTS[k].bn ? DEFAULTS[k].bn.slice(0, 40) : k, action: 'reset', question: 'লেখাটি মূল অবস্থায় ফিরিয়ে নেবেন?' }))) return
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
      <div className="grid g2">
        {LANGS.map((l) => (
          <div className="field" key={l.code}>
            <label>{l.label}</label>
            <Field dir={l.dir} style={long ? { minHeight: 320 } : undefined} value={v[l.code] || ''} onChange={(e) => setV({ ...v, [l.code]: e.target.value })} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="btn small" disabled={!changed} onClick={save}>সংরক্ষণ</button>
        {edited && <button type="button" className="btn small outline" onClick={reset}>মূল লেখায় ফিরুন</button>}
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
      <p className="muted">ওয়েবসাইটের প্রতিটি লেখা এখান থেকে বাংলা ও ইংরেজিতে বদলানো যায় (গোপনীয়তা নীতি, শর্তাবলি ও ভর্তির নীতিমালাও এখানে)। সংরক্ষণ করলেই সাইটে বদলে যাবে।</p>
      <div className="toolbar">
        <Select value={group} onChange={(x) => { setGroup(x); setQ('') }} options={TEXT_GROUPS.map((g) => [g.id, g.label])} />
        <input placeholder="লেখা খুঁজুন…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="stack">
        {keys.map((k) => <TextRow key={k} k={k} />)}
        {keys.length === 0 && <div className="card muted">কিছু পাওয়া যায়নি।</div>}
      </div>
    </>
  )
}

export { TextRow as Row }
