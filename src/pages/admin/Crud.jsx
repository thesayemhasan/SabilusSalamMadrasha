import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/db'
import { LANGS } from '../../lib/texts'
import { ImageUpload, Modal, Select, Switch, useConfirm } from '../../components/Ui'
import Icon from '../../components/Icon'

export const ICON_CHOICES = ['star', 'book', 'books', 'moon', 'lotus', 'chat', 'apply', 'megaphone', 'calendar', 'image', 'teacher', 'building', 'shield', 'users', 'clock', 'pin', 'phone', 'mail', 'globe', 'video', 'bell', 'home'].map((k) => [k, k])

const toLocal = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

// ড্রপডাউনের অপশন অন্য টেবিল থেকে আনা: { table, label: (row)=>text, eq: {col: val}, order }
function useOpts(specs) {
  const [o, setO] = useState({})
  useEffect(() => {
    let off = false
    Object.entries(specs).forEach(([name, sp]) => {
      let q = supabase.from(sp.table).select('*').order(sp.order || 'sort', { ascending: true })
      Object.entries(sp.eq || {}).forEach(([c, v]) => { q = q.eq(c, v) })
      q.then(({ data }) => { if (!off) setO((x) => ({ ...x, [name]: (data || []).map((r) => [sp.value ? sp.value(r) : r.id, sp.label(r)]) })) })
    })
    return () => { off = true }
    // eslint-disable-next-line
  }, [])
  return o
}

export function downloadCsv(file, head, rows) {
  const esc = (x) => `"${String(x ?? '').replace(/"/g, '""')}"`
  const txt = '\ufeff' + [head, ...rows].map((r) => r.map(esc).join(',')).join('\r\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' }))
  a.download = file
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

// একটি জেনেরিক তালিকা + যোগ/সম্পাদনা/মুছা ফর্ম
export default function Crud({ table, title, hint, fields, order = 'created_at', asc = false, summary, blank = {}, nameOf, beforeSave, extra, toggle = 'published', toggleLabel = 'প্রকাশিত', eq, filters = [], searchFields, csv, addLabel = 'নতুন যোগ করুন', afterSave, rowFilter, decorate }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState(null)
  const [msg, setMsg] = useState('')
  const [q, setQ] = useState('')
  const [fv, setFv] = useState({})
  const confirm = useConfirm()
  const optSpecs = useMemo(() => {
    const o = {}
    fields.forEach((f) => { if (f.optionsFrom) o[f.name] = f.optionsFrom })
    filters.forEach((f) => { if (f.optionsFrom) o[`f:${f.name}`] = f.optionsFrom })
    return o
  }, []) // eslint-disable-line
  const opts = useOpts(optSpecs)
  const maps = useMemo(() => {
    const m = {}
    Object.entries(opts).forEach(([k, arr]) => { m[k.replace('f:', '')] = Object.fromEntries(arr) })
    return m
  }, [opts])

  const load = useCallback(async () => {
    const { data, error } = await fetchAll((a, b) => {
      let qy = supabase.from(table).select('*').order(order, { ascending: asc }).range(a, b)
      Object.entries(eq || {}).forEach(([c, v]) => { qy = qy.eq(c, v) })
      return qy
    })
    if (error) setMsg(error.message)
    setRows(data || [])
    setLoading(false)
  }, [table, order, asc, eq])
  useEffect(() => { load() }, [load])

  const label = (r) => (nameOf ? nameOf(r) : r.title_bn || r.name_bn || r.label_bn || r.caption_bn || r.title_en || 'এই আইটেম')

  async function remove(row) {
    if (!(await confirm({ name: label(row), text: 'মুছে ফেলবেন? এটি আর ফিরিয়ে আনা যাবে না।' }))) return
    const { error } = await supabase.from(table).delete().eq('id', row.id)
    if (error) setMsg(error.message)
    load()
  }

  async function flip(row, v) {
    await supabase.from(table).update({ [toggle]: v }).eq('id', row.id)
    load()
  }

  // rowFilter: কোন সারি দেখানো হবে (যেমন শিক্ষাবর্ষে ভর্তি); decorate: শুধু তালিকায় দেখানোর মান বদলায় (সম্পাদনায় আসল সারি যায়)
  const base = useMemo(() => (rowFilter ? rows.filter(rowFilter) : rows), [rows, rowFilter])
  const shown = (decorate ? base.map(decorate) : base).filter((r) => {
    if (q && searchFields && !searchFields.some((k) => String(r[k] ?? '').toLowerCase().includes(q.trim().toLowerCase()))) return false
    return filters.every((f) => !fv[f.name] || String(r[f.name] ?? '') === String(fv[f.name]))
  })

  return (
    <>
      <div className="toolbar">
        <h2 style={{ margin: 0, flex: '1 1 auto' }}>{title}</h2>
        {extra && extra({ reload: load })}
        {csv && <button className="btn outline" onClick={() => downloadCsv(csv.file, csv.cols.map((c) => c[0]), shown.map((r) => csv.cols.map((c) => c[1](r, maps))))}><Icon name="upload" size={18} cls="cur" /> Excel এক্সপোর্ট</button>}
        <button className="btn" onClick={() => { const nx = fields.some((f) => f.name === 'sort') && !blank.sort ? rows.reduce((m, r) => Math.max(m, Number(r.sort) || 0), 0) + 1 : blank.sort; setEdit(fields.some((f) => f.name === 'sort') ? { ...blank, sort: nx } : { ...blank }) }}><Icon name="plus" size={18} cls="cur" /> {addLabel}</button>
      </div>
      {(searchFields || filters.length > 0) && (
        <div className="toolbar" style={{ marginTop: -4 }}>
          {searchFields && <input className="search-in" placeholder="খুঁজুন…" value={q} onChange={(e) => setQ(e.target.value)} />}
          {filters.map((f) => (
            <div key={f.name} style={{ minWidth: 170 }}>
              <Select value={fv[f.name] ?? ''} onChange={(x) => setFv((o) => ({ ...o, [f.name]: x }))} options={[['', f.label], ...(f.options || opts[`f:${f.name}`] || [])]} />
            </div>
          ))}
          <span className="muted">{shown.length} / {base.length} জন</span>
        </div>
      )}
      {hint && <p className="muted" style={{ marginTop: -6 }}>{hint}</p>}
      {msg && <div className="alert err" style={{ marginBottom: 12 }}>{msg}</div>}
      {loading ? <p>লোড হচ্ছে…</p> : shown.length === 0 ? <div className="card muted">{base.length ? 'কোনো ফল পাওয়া যায়নি।' : 'এখনো কিছু যোগ করা হয়নি।'}</div> : (
        <div className="stack">
          {shown.map((r) => (
            <div className="card row-card" key={r.id}>
              <div style={{ minWidth: 0, flex: '1 1 240px' }}>{summary(r, maps)}</div>
              <div className="row-actions">
                {toggle && <><span className="muted" style={{ fontSize: '.8rem' }}>{toggleLabel}</span>
                <Switch checked={r[toggle]} onChange={(v) => flip(r, v)} /></>}
                <button className="btn small outline" onClick={() => setEdit(rows.find((x) => x.id === r.id) || r)}><Icon name="edit" size={15} cls="cur" /> সম্পাদনা</button>
                <button className="btn small danger" onClick={() => remove(r)}><Icon name="trash" size={15} cls="cur" /> মুছুন</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {edit && <Form table={table} fields={fields} opts={opts} initial={edit} beforeSave={beforeSave} onClose={() => setEdit(null)} onSaved={(row) => { setEdit(null); load(); afterSave && afterSave(row) }} />}
    </>
  )
}

function ItemsEditor({ value, onChange, itemFields, tab }) {
  const items = Array.isArray(value) ? value : []
  const upd = (i, k, val) => onChange(items.map((it, j) => (j === i ? { ...it, [k]: val } : it)))
  const move = (i, d) => { const a = [...items]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; onChange(a) }
  return (
    <div className="items-ed">
      {items.map((it, i) => (
        <div className="item-row" key={i}>
          <div className="item-top">
            <b>#{i + 1}</b>
            <span className="row-actions">
              <button type="button" className="btn small outline" onClick={() => move(i, -1)} aria-label="up"><Icon name="chevup" size={14} cls="cur" /></button>
              <button type="button" className="btn small outline" onClick={() => move(i, 1)} aria-label="down"><Icon name="chevdown" size={14} cls="cur" /></button>
              <button type="button" className="btn small danger" onClick={() => onChange(items.filter((_, j) => j !== i))}><Icon name="trash" size={14} cls="cur" /></button>
            </span>
          </div>
          {itemFields.map((f) => {
            const name = f.i18n ? `${f.name}_${tab}` : f.name
            return (
              <div className="field" key={name}>
                <label>{f.label}{f.i18n ? ` (${LANGS.find((l) => l.code === tab).label})` : ''}</label>
                {f.type === 'icon' && (
                  <div className="icon-pick">
                    {ICON_CHOICES.map(([k]) => <button type="button" key={k} className={(it[name] || 'star') === k ? 'on' : ''} onClick={() => upd(i, name, k)} title={k}><Icon name={k} size={22} /></button>)}
                  </div>
                )}
                {f.type === 'textarea' && <textarea value={it[name] || ''} onChange={(e) => upd(i, name, e.target.value)} />}
                {(!f.type || f.type === 'text') && <input value={it[name] || ''} onChange={(e) => upd(i, name, e.target.value)} />}
              </div>
            )
          })}
        </div>
      ))}
      <button type="button" className="btn small outline" onClick={() => onChange([...items, { icon: 'star' }])}><Icon name="plus" size={15} cls="cur" /> আইটেম যোগ</button>
    </div>
  )
}

// সংখ্যার ঘর: লেখার সময় ফাঁকা করা যায় (আগে মুছলেই ০ ফিরে আসত)
function NumField({ value, onChange, nullable, placeholder, step }) {
  const [t, setT] = useState(value === null || value === undefined ? (nullable ? '' : '0') : String(value))
  return <input type="number" step={step} value={t} placeholder={placeholder} onChange={(e) => { const x = e.target.value; setT(x); onChange(x === '' ? (nullable ? null : 0) : Number(x)) }} />
}

function Form({ table, fields, opts = {}, initial, beforeSave, onClose, onSaved }) {
  const [v, setV] = useState(initial)
  const [tab, setTab] = useState('bn')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const hasI18n = fields.some((f) => f.i18n) || fields.some((f) => f.itemFields?.some((x) => x.i18n))
  const set = (k, val) => setV((o) => ({ ...o, [k]: val }))

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    let { id, created_at, ...payload } = v
    // ফাঁকা বাছাই ("") ডাটাবেজের uuid ঘরে গেলে ত্রুটি হয় — তাই ফাঁকা হলে null পাঠানো হয়
    fields.forEach((f) => { if ((f.optionsFrom || /_id$/.test(f.name || '')) && payload[f.name] === '') payload[f.name] = null })
    if (beforeSave) payload = beforeSave(payload)
    const q = id ? supabase.from(table).update(payload).eq('id', id) : supabase.from(table).insert(payload)
    const { error } = await q
    setBusy(false)
    if (error) return setErr(error.message)
    onSaved()
  }

  return (
    <Modal onClose={onClose} wide>
      <h3>{initial.id ? 'সম্পাদনা' : 'নতুন যোগ করুন'}</h3>
      <form className="form" onSubmit={save}>
        {hasI18n && (
          <div className="tabs">
            {LANGS.map((l) => (
              <button type="button" key={l.code} className={tab === l.code ? 'on' : ''} onClick={() => setTab(l.code)}>{l.label}</button>
            ))}
          </div>
        )}
        {fields.filter((f) => !f.showIf || f.showIf(v)).map((f) => {
          const name = f.i18n ? `${f.name}_${tab}` : f.name
          return (
            <div className="field" key={name}>
              {f.type !== 'bool' && <label>{f.label}{f.i18n ? ` (${LANGS.find((l) => l.code === tab).label})` : ''}{f.required && (!f.i18n || tab === 'bn') ? ' *' : ''}</label>}
              {f.type === 'textarea' && <textarea rows={f.rows} value={v[name] || ''} onChange={(e) => set(name, e.target.value)} />}
              {(f.type === 'text' || !f.type) && <input required={f.required && (!f.i18n || tab === 'bn')} value={v[name] || ''} onChange={(e) => set(name, e.target.value)} placeholder={f.placeholder} />}
              {f.type === 'date' && <input type="date" required={f.required !== false} value={v[name] || ''} onChange={(e) => set(name, e.target.value)} />}
              {f.type === 'datetime' && <input type="datetime-local" value={toLocal(v[name])} onChange={(e) => set(name, e.target.value ? new Date(e.target.value).toISOString() : null)} />}
              {f.type === 'number' && <NumField value={v[name]} nullable={f.nullable} placeholder={f.placeholder} step={f.step} onChange={(x) => set(name, x)} />}
              {f.type === 'image' && <ImageUpload folder={table} value={v[name]} onChange={(x) => set(name, x)} shape={f.shape} />}
              {f.type === 'select' && <Select value={v[name] ?? ''} onChange={(x) => set(name, x)} options={f.optionsFrom ? [['', f.blankLabel || '— বাছাই করুন —'], ...(opts[f.name] || [])] : f.options} />}
              {f.type === 'items' && <ItemsEditor value={v[name]} onChange={(x) => set(name, x)} itemFields={f.itemFields} tab={tab} />}
              {f.type === 'bool' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Switch checked={v[name]} onChange={(x) => set(name, x)} /> {f.label}
                </label>
              )}
              {f.hint && <span className="muted" style={{ fontSize: '.85rem' }}>{f.hint}</span>}
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
