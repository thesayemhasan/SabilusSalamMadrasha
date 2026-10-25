import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/store'
import { Modal, Select, Switch, useConfirm } from '../../components/Ui'
import { FEATURES, STAFF_ROLES, TEMPLATES, ROLE_LABEL, AREA_KEYS } from '../../lib/features'
import { downloadCsv } from './Crud'
import { ROLES } from '../../lib/util'
export { ROLES }

const genPw = () => {
  const c = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const a = new Uint32Array(10)
  crypto.getRandomValues(a)
  return Array.from(a, (n) => c[n % c.length]).join('')
}

// ডাটাবেজের কাস্টম ফিচারসহ পুরো তালিকা
function useFeatureList() {
  const [custom, setCustom] = useState([])
  const load = useCallback(async () => {
    const { data } = await supabase.from('features').select('*').eq('builtin', false).order('sort')
    setCustom((data || []).map((f) => ({ key: f.key, area: 'custom', grp: f.grp || 'নতুন ফিচার', name: f.name_bn, paths: [], custom: true })))
  }, [])
  useEffect(() => { load() }, [load])
  return { list: useMemo(() => [...FEATURES, ...custom], [custom]), custom, reload: load }
}

// কারও বর্তমান অনুমতি (ফাঁকা থাকলে ভূমিকার ডিফল্ট)
function currentPerms(p) {
  const x = p.permissions || {}
  if (Object.keys(x).length) return { ...x }
  if (p.role === 'admin') return Object.fromEntries(FEATURES.map((f) => [f.key, true]))
  if (p.role === 'accountant') return Object.fromEntries(AREA_KEYS('finance').map((k) => [k, true]))
  return {}
}

function PermBoxes({ list, perms, setPerms }) {
  const groups = [...new Set(list.map((f) => f.grp))]
  const set = (keys, v) => setPerms((p) => { const n = { ...p }; keys.forEach((k) => { n[k] = v }); return n })
  return (
    <div className="perm-groups">
      {groups.map((g) => {
        const items = list.filter((f) => f.grp === g)
        const on = items.filter((f) => perms[f.key]).length
        return (
          <div key={g} className="perm-g">
            <div className="perm-h">
              <b>{g}</b>
              <span className="muted">{on}/{items.length}</span>
              <button type="button" className="btn small outline" onClick={() => set(items.map((f) => f.key), true)}>সব চালু</button>
              <button type="button" className="btn small outline" onClick={() => set(items.map((f) => f.key), false)}>সব বন্ধ</button>
            </div>
            {items.map((f) => (
              <div key={f.key} className="perm-row">
                <span>{f.name}{f.custom && <span className="tag" style={{ marginInlineStart: 6 }}>নতুন</span>}</span>
                <Switch checked={!!perms[f.key]} onChange={(v) => set([f.key], v)} />
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function TemplatePick({ onPick }) {
  return (
    <div className="field">
      <label>রেডিমেড সেট থেকে শুরু করুন (পরে বদলানো যাবে)</label>
      <Select placeholder="— বেছে নিন —" value="" onChange={(k) => k && onPick(TEMPLATES[k])} options={Object.entries(TEMPLATES).map(([k, v]) => [k, v.name])} />
    </div>
  )
}

const ASSIGNABLE = ['admin', 'accountant', 'staff', 'none']

function PermsEditor({ p, list, onClose, onSaved }) {
  const confirm = useConfirm()
  const [role, setRole] = useState(p.role === 'super_admin' ? 'admin' : p.role === 'none' ? 'staff' : p.role)
  const [perms, setPerms] = useState(currentPerms(p))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const total = list.length
  const on = list.filter((f) => perms[f.key]).length

  async function save() {
    if (!(await confirm({ danger: false, name: p.full_name || p.email, text: `${on}টি ফিচার চালু থাকবে। সংরক্ষণ করবেন?`, ok: 'হ্যাঁ, সংরক্ষণ করুন' }))) return
    setBusy(true)
    const clean = Object.fromEntries(list.map((f) => [f.key, !!perms[f.key]]))
    const { error } = await supabase.from('profiles').update({ role, permissions: clean }).eq('id', p.id)
    setBusy(false)
    if (error) return setErr(error.message)
    onSaved()
  }
  return (
    <Modal onClose={onClose} wide>
      <h3>{p.full_name || p.email}</h3>
      <div className="muted" style={{ marginBottom: 10 }}>{p.email} · চালু ফিচার {on}/{total}</div>
      <div className="field">
        <label>ভূমিকা</label>
        <Select value={role} onChange={setRole} options={ASSIGNABLE.map((r) => [r, r === 'none' ? 'সাবস্ক্রাইবার (অ্যাডমিন অ্যাক্সেস বন্ধ)' : ROLE_LABEL[r]])} />
      </div>
      <TemplatePick onPick={(t) => setPerms(Object.fromEntries(t.keys.map((k) => [k, true])))} />
      <PermBoxes list={list} perms={perms} setPerms={setPerms} />
      {err && <div className="alert err">{err}</div>}
      <div className="row-actions" style={{ marginTop: 14 }}>
        <button className="btn" disabled={busy} onClick={save}>{busy ? 'সংরক্ষণ হচ্ছে…' : 'সংরক্ষণ'}</button>
        <button className="btn outline" onClick={onClose}>বাতিল</button>
      </div>
    </Modal>
  )
}

function Credentials({ c, onClose }) {
  const text = `লগইন: ${location.origin}${location.pathname}#/admin\nইমেইল: ${c.email}\nপাসওয়ার্ড: ${c.password}`
  return (
    <Modal onClose={onClose}>
      <h3>লগইনের তথ্য</h3>
      <div className="alert info pre" style={{ userSelect: 'all' }}>{text}</div>
      <p className="muted">পাসওয়ার্ড ডাটাবেজে লেখা অবস্থায় থাকে না। তাই এখনই কপি করে ব্যক্তিকে দিন। পরে ভুলে গেলে “পাসওয়ার্ড বদল” দিয়ে নতুন সেট করা যাবে।</p>
      <div className="row-actions">
        <button className="btn" onClick={() => navigator.clipboard?.writeText(text)}>কপি করুন</button>
        <button className="btn outline" onClick={onClose}>বন্ধ</button>
      </div>
    </Modal>
  )
}

function NewUser({ list, onClose, onDone }) {
  const [f, setF] = useState({ name: '', email: '', password: genPw(), role: 'staff' })
  const [perms, setPerms] = useState({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    const clean = Object.fromEntries(list.map((x) => [x.key, !!perms[x.key]]))
    const { error } = await supabase.rpc('admin_create_user', { p_email: f.email, p_password: f.password, p_name: f.name, p_role: f.role, p_perms: clean })
    setBusy(false)
    if (error) return setErr(error.message)
    onDone({ email: f.email.trim().toLowerCase(), password: f.password })
  }
  return (
    <Modal onClose={onClose} wide>
      <form onSubmit={save} className="form">
        <h3>নতুন অ্যাডমিন / কর্মী</h3>
        <div className="field"><label>নাম (রসিদে “Printed by” হিসেবে এই নাম ছাপা হবে)</label><input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="field"><label>ইমেইল (লগইনের জন্য)</label><input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div className="field"><label>পাসওয়ার্ড</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input required minLength={6} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
            <button type="button" className="btn outline" onClick={() => setF({ ...f, password: genPw() })}>নতুন বানান</button>
          </div>
        </div>
        <div className="field"><label>ভূমিকা</label><Select value={f.role} onChange={(v) => setF({ ...f, role: v })} options={['admin', 'accountant', 'staff'].map((r) => [r, ROLE_LABEL[r]])} /></div>
        <TemplatePick onPick={(t) => setPerms(Object.fromEntries(t.keys.map((k) => [k, true])))} />
        <PermBoxes list={list} perms={perms} setPerms={setPerms} />
        {err && <div className="alert err">{err}</div>}
        <div className="row-actions">
          <button className="btn" disabled={busy}>{busy ? 'তৈরি হচ্ছে…' : 'তৈরি করুন'}</button>
          <button type="button" className="btn outline" onClick={onClose}>বাতিল</button>
        </div>
      </form>
    </Modal>
  )
}

function Access({ p, onClose, onDone }) {
  const [email, setEmail] = useState(p.email || '')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    let error = null
    if (email.trim().toLowerCase() !== (p.email || '').toLowerCase()) ({ error } = await supabase.rpc('admin_set_email', { p_user: p.id, p_email: email }))
    if (!error && pw) ({ error } = await supabase.rpc('admin_set_password', { p_user: p.id, p_password: pw }))
    setBusy(false)
    if (error) return setErr(error.message)
    onDone(pw ? { email, password: pw } : null)
  }
  return (
    <Modal onClose={onClose}>
      <form onSubmit={save} className="form">
        <h3>ইমেইল ও পাসওয়ার্ড — {p.full_name || p.email}</h3>
        <div className="field"><label>লগইন ইমেইল</label><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="field"><label>নতুন পাসওয়ার্ড (না বদলাতে চাইলে ফাঁকা রাখুন)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} />
            <button type="button" className="btn outline" onClick={() => setPw(genPw())}>বানান</button>
          </div>
        </div>
        {err && <div className="alert err">{err}</div>}
        <div className="row-actions">
          <button className="btn" disabled={busy}>সংরক্ষণ</button>
          <button type="button" className="btn outline" onClick={onClose}>বাতিল</button>
        </div>
      </form>
    </Modal>
  )
}

function FeatureTab({ custom, reload }) {
  const confirm = useConfirm()
  const [f, setF] = useState({ key: '', name: '', grp: 'নতুন ফিচার' })
  const [err, setErr] = useState('')
  async function add(e) {
    e.preventDefault()
    setErr('')
    const key = f.key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
    if (FEATURES.some((x) => x.key === key)) return setErr('এই কোড আগেই আছে')
    const { error } = await supabase.from('features').insert({ key, name_bn: f.name, grp: f.grp || 'নতুন ফিচার', area: 'custom', builtin: false, sort: 200 })
    if (error) return setErr(error.message)
    setF({ key: '', name: '', grp: 'নতুন ফিচার' })
    reload()
  }
  async function del(x) {
    if (!(await confirm({ name: x.name, text: 'ফিচারটি তালিকা থেকে মুছবেন?', ok: 'হ্যাঁ, মুছুন' }))) return
    await supabase.from('features').delete().eq('key', x.key)
    reload()
  }
  return (
    <>
      <div className="alert info" style={{ marginBottom: 14 }}>
        নিচে প্যানেলের সব ফিচার। নতুন ফিচার যোগ করলে সেটি সবার অনুমতির তালিকায় আসবে, আপনি যাকে চান তাকে চালু করে দিতে পারবেন। নতুন পেজ/মডিউল তৈরি হলে তা এই অনুমতির সাথে জোড়া লাগবে।
      </div>
      <form onSubmit={add} className="card form" style={{ marginBottom: 16 }}>
        <h3>নতুন ফিচার যোগ করুন</h3>
        <div className="grid g3">
          <div className="field"><label>নাম</label><input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="field"><label>কোড (ইংরেজি)</label><input required value={f.key} onChange={(e) => setF({ ...f, key: e.target.value })} placeholder="exam_marks" /></div>
          <div className="field"><label>গ্রুপ</label><input value={f.grp} onChange={(e) => setF({ ...f, grp: e.target.value })} /></div>
        </div>
        {err && <div className="alert err">{err}</div>}
        <button className="btn">যোগ করুন</button>
      </form>
      <div className="table-wrap"><table>
        <thead><tr><th>ফিচার</th><th>গ্রুপ</th><th></th></tr></thead>
        <tbody>
          {FEATURES.map((x) => <tr key={x.key}><td>{x.name}</td><td>{x.grp}</td><td className="muted">তৈরি আছে</td></tr>)}
          {custom.map((x) => <tr key={x.key}><td>{x.name} <span className="tag">নতুন</span></td><td>{x.grp}</td><td><button className="btn small danger" onClick={() => del(x)}>মুছুন</button></td></tr>)}
        </tbody>
      </table></div>
    </>
  )
}

function Subscribers({ rows, onEdit }) {
  const [q, setQ] = useState('')
  const [subj, setSubj] = useState('')
  const [body, setBody] = useState('')
  const subs = rows.filter((r) => r.role === 'none' && r.email)
  const shown = subs.filter((r) => `${r.full_name || ''} ${r.email}`.toLowerCase().includes(q.toLowerCase()))
  const emails = subs.map((r) => r.email)
  // মেইল অ্যাপের লিংকের দৈর্ঘ্যের সীমা এড়াতে ভাগ করে পাঠানো হয়
  const chunks = []
  let cur = []
  let len = 0
  emails.forEach((e) => { if (len + e.length > 1200 && cur.length) { chunks.push(cur); cur = []; len = 0 } cur.push(e); len += e.length + 1 })
  if (cur.length) chunks.push(cur)
  const href = (list) => `mailto:?bcc=${encodeURIComponent(list.join(','))}&subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`
  return (
    <>
      <div className="alert info" style={{ marginBottom: 14 }}>
        ওয়েবসাইটে সাইন আপ করা সবাই সাবস্ক্রাইবার; তাদের কোনো অনুমোদন লাগে না। মোট: <b>{subs.length}</b> জন।
      </div>
      <div className="card form" style={{ marginBottom: 16 }}>
        <h3>সবাইকে ইমেইল</h3>
        <div className="field"><label>বিষয়</label><input value={subj} onChange={(e) => setSubj(e.target.value)} /></div>
        <div className="field"><label>বার্তা</label><textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} /></div>
        <div className="row-actions">
          {chunks.map((c, i) => <a key={i} className="btn" href={href(c)}>{chunks.length > 1 ? `মেইল খুলুন (${i + 1}/${chunks.length})` : 'মেইল খুলুন'}</a>)}
          <button className="btn outline" onClick={() => navigator.clipboard?.writeText(emails.join(', '))}>সব ইমেইল কপি</button>
          <button className="btn outline" onClick={() => downloadCsv('subscribers.csv', ['নাম', 'ইমেইল'], subs.map((r) => [r.full_name || '', r.email]))}>CSV</button>
        </div>
        <p className="muted" style={{ margin: 0 }}>বোতামে চাপলে আপনার মেইল অ্যাপ সব প্রাপকসহ (BCC) খুলবে, আপনি শুধু “Send” দেবেন। সাইট থেকেই নিজে নিজে হাজার হাজার মেইল পাঠাতে হলে আলাদা ইমেইল সেবা (যেমন Resend/Brevo) যুক্ত করতে হয়; সেটি পরের ধাপে করা যাবে।</p>
      </div>
      <input placeholder="নাম বা ইমেইল খুঁজুন" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 10 }} />
      <div className="table-wrap"><table>
        <thead><tr><th>নাম / ইমেইল</th><th>যোগ দেওয়ার তারিখ</th><th></th></tr></thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.id}>
              <td><b>{r.full_name || '—'}</b><div className="muted" style={{ fontSize: '.85rem' }}>{r.email}</div></td>
              <td>{new Date(r.created_at).toLocaleDateString('bn-BD')}</td>
              <td><button className="btn small outline" onClick={() => onEdit(r)}>অ্যাডমিন বানান</button></td>
            </tr>
          ))}
          {!shown.length && <tr><td colSpan={3} className="muted">কেউ নেই</td></tr>}
        </tbody>
      </table></div>
    </>
  )
}

export default function Users() {
  const confirm = useConfirm()
  const { isSuper, profile } = useAuth()
  const { list, custom, reload } = useFeatureList()
  const [rows, setRows] = useState([])
  const [tab, setTab] = useState('staff')
  const [edit, setEdit] = useState(null)
  const [access, setAccess] = useState(null)
  const [creating, setCreating] = useState(false)
  const [cred, setCred] = useState(null)
  const load = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at')
    setRows(data || [])
  }, [])
  useEffect(() => { load() }, [load])

  if (!isSuper) return <div className="alert warn">এই পেজ শুধু সুপার অ্যাডমিনের জন্য।</div>

  const staff = rows.filter((r) => STAFF_ROLES.includes(r.role))

  async function deactivate(r) {
    if (!(await confirm({ name: r.full_name || r.email, text: 'অ্যাডমিন অ্যাক্সেস বন্ধ করবেন? ব্যক্তি সাবস্ক্রাইবার হয়ে যাবে।', ok: 'হ্যাঁ, বন্ধ করুন' }))) return
    await supabase.from('profiles').update({ role: 'none', permissions: {} }).eq('id', r.id)
    load()
  }
  const count = (r) => (r.role === 'super_admin' ? list.length : list.filter((f) => currentPerms(r)[f.key]).length)

  return (
    <>
      <h2>ব্যবহারকারী ও অনুমতি</h2>
      <div className="tabs">
        <button className={tab === 'staff' ? 'on' : ''} onClick={() => setTab('staff')}>অ্যাডমিন ও কর্মী ({staff.length})</button>
        <button className={tab === 'features' ? 'on' : ''} onClick={() => setTab('features')}>ফিচার তালিকা</button>
        <button className={tab === 'subs' ? 'on' : ''} onClick={() => setTab('subs')}>সাবস্ক্রাইবার ({rows.filter((r) => r.role === 'none').length})</button>
      </div>

      {tab === 'staff' && (
        <>
          <div className="alert info" style={{ marginBottom: 14 }}>
            এখানে আপনি ঠিক করেন কে কোন ফিচার ব্যবহার করতে পারবে। অ্যাডমিন ও কর্মীরা শুধু আপনার দেওয়া ইমেইল-পাসওয়ার্ড দিয়ে লগইন করবে। আপনি যেকোনো সময় ফিচার চালু/বন্ধ করতে বা পাসওয়ার্ড বদলাতে পারবেন।
          </div>
          <button className="btn" style={{ marginBottom: 12 }} onClick={() => setCreating(true)}>+ নতুন অ্যাডমিন / কর্মী</button>
          <div className="table-wrap"><table>
            <thead><tr><th>নাম / ইমেইল</th><th>ভূমিকা</th><th>চালু ফিচার</th><th></th></tr></thead>
            <tbody>
              {staff.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.full_name || '—'}</b><div className="muted" style={{ fontSize: '.85rem' }}>{r.email}</div></td>
                  <td>{ROLE_LABEL[r.role]}</td>
                  <td>{r.role === 'super_admin' ? 'সব' : `${count(r)} / ${list.length}`}</td>
                  <td>
                    {r.role !== 'super_admin' && (
                      <div className="row-actions">
                        <button className="btn small" onClick={() => setEdit(r)}>ফিচার</button>
                        <button className="btn small outline" onClick={() => setAccess(r)}>ইমেইল / পাসওয়ার্ড</button>
                        <button className="btn small danger" onClick={() => deactivate(r)}>অ্যাক্সেস বন্ধ</button>
                      </div>
                    )}
                    {r.id === profile?.id && <span className="muted">আপনি</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </>
      )}
      {tab === 'features' && <FeatureTab custom={custom} reload={reload} />}
      {tab === 'subs' && <Subscribers rows={rows} onEdit={setEdit} />}

      {edit && <PermsEditor p={edit} list={list} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
      {access && <Access p={access} onClose={() => setAccess(null)} onDone={(c) => { setAccess(null); load(); if (c) setCred(c) }} />}
      {creating && <NewUser list={list} onClose={() => setCreating(false)} onDone={(c) => { setCreating(false); load(); setCred(c) }} />}
      {cred && <Credentials c={cred} onClose={() => setCred(null)} />}
    </>
  )
}
