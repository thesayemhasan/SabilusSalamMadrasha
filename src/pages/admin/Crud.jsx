import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { LANGS } from '../../lib/texts'
import { ImageUpload, Modal, Switch } from '../../components/Ui'

// একটি জেনেরিক তালিকা + যোগ/সম্পাদনা/মুছা ফর্ম (নোটিশ, ইভেন্ট, গ্যালারি, শিক্ষক এসবে ব্যবহৃত)
export default function Crud({ table, title, fields, order = 'created_at', asc = false, summary, blank = {} }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState(null)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase.from(table).select('*').order(order, { ascending: asc })
    if (error) setMsg(error.message)
    setRows(data || [])
    setLoading(false)
  }, [table, order, asc])
  useEffect(() => { load() }, [load])

  async function remove(row) {
    if (!confirm('মুছে ফেলবেন?')) return
    const { error } = await supabase.from(table).delete().eq('id', row.id)
    if (error) setMsg(error.message)
    load()
  }

  async function toggle(row, name, v) {
    await supabase.from(table).update({ [name]: v }).eq('id', row.id)
    load()
  }

  return (
    <>
      <div className="toolbar">
        <h2 style={{ margin: 0, flex: '1 1 auto' }}>{title}</h2>
        <button className="btn" onClick={() => setEdit({ ...blank })}>+ নতুন যোগ করুন</button>
      </div>
      {msg && <div className="alert err" style={{ marginBottom: 12 }}>{msg}</div>}
      {loading ? <p>লোড হচ্ছে…</p> : rows.length === 0 ? <div className="card muted">এখনো কিছু যোগ করা হয়নি।</div> : (
        <div className="stack">
          {rows.map((r) => (
            <div className="card" key={r.id} style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0, flex: '1 1 240px' }}>{summary(r)}</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span className="muted" style={{ fontSize: '.8rem' }}>প্রকাশিত</span>
                <Switch checked={r.published} onChange={(v) => toggle(r, 'published', v)} />
                <button className="btn small outline" onClick={() => setEdit(r)}>সম্পাদনা</button>
                <button className="btn small danger" onClick={() => remove(r)}>মুছুন</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {edit && <Form table={table} fields={fields} initial={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    </>
  )
}

function Form({ table, fields, initial, onClose, onSaved }) {
  const [v, setV] = useState(initial)
  const [tab, setTab] = useState('bn')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const hasI18n = fields.some((f) => f.i18n)
  const set = (k, val) => setV((o) => ({ ...o, [k]: val }))

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    const { id, created_at, ...payload } = v
    const q = id ? supabase.from(table).update(payload).eq('id', id) : supabase.from(table).insert(payload)
    const { error } = await q
    setBusy(false)
    if (error) return setErr(error.message)
    onSaved()
  }

  return (
    <Modal onClose={onClose}>
      <h3>{initial.id ? 'সম্পাদনা' : 'নতুন যোগ করুন'}</h3>
      <form className="form" onSubmit={save}>
        {hasI18n && (
          <div className="tabs">
            {LANGS.map((l) => (
              <button type="button" key={l.code} className={tab === l.code ? 'on' : ''} onClick={() => setTab(l.code)}>{l.label}</button>
            ))}
          </div>
        )}
        {fields.map((f) => {
          const name = f.i18n ? `${f.name}_${tab}` : f.name
          return (
            <div className="field" key={name}>
              {f.type !== 'bool' && <label>{f.label}{f.i18n ? ` (${LANGS.find((l) => l.code === tab).label})` : ''}{f.required && tab === 'bn' ? ' *' : ''}</label>}
              {f.type === 'textarea' && <textarea dir={tab === 'ar' && f.i18n ? 'rtl' : undefined} value={v[name] || ''} onChange={(e) => set(name, e.target.value)} />}
              {(f.type === 'text' || !f.type) && <input dir={tab === 'ar' && f.i18n ? 'rtl' : undefined} required={f.required && (!f.i18n || tab === 'bn')} value={v[name] || ''} onChange={(e) => set(name, e.target.value)} />}
              {f.type === 'date' && <input type="date" required value={v[name] || ''} onChange={(e) => set(name, e.target.value)} />}
              {f.type === 'number' && <input type="number" value={v[name] ?? 0} onChange={(e) => set(name, Number(e.target.value))} />}
              {f.type === 'image' && <ImageUpload folder={table} value={v[name]} onChange={(x) => set(name, x)} />}
              {f.type === 'bool' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Switch checked={v[name]} onChange={(x) => set(name, x)} /> {f.label}
                </label>
              )}
            </div>
          )
        })}
        {err && <div className="alert err">{err}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="btn outline" onClick={onClose}>বাতিল</button>
          <button className="btn" disabled={busy}>{busy ? 'সংরক্ষণ হচ্ছে…' : 'সংরক্ষণ'}</button>
        </div>
      </form>
    </Modal>
  )
}
