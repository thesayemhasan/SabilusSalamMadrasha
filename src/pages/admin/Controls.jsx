import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useSite } from '../../lib/store'
import { BUILT, INTEGRATIONS, MODULES, MODULE_GROUPS } from '../../lib/modules'
import { Switch } from '../../components/Ui'

export function Modules() {
  const { modules, reload } = useSite()
  const [msg, setMsg] = useState('')

  async function toggle(key, enabled) {
    const { error } = await supabase.from('modules').upsert({ key, enabled, updated_at: new Date().toISOString() })
    if (error) return setMsg(error.message)
    reload()
  }

  return (
    <>
      <h2>মডিউল সুইচ</h2>
      <p className="muted">প্রতিটি মডিউল এখান থেকে চালু/বন্ধ করা যায়। যে মডিউল এখনো তৈরি হয়নি, তার পাশে ধাপ নম্বর দেওয়া আছে; সেই ধাপ যোগ হলে সুইচ অনুযায়ী নিজে থেকে মেনুতে আসবে।</p>
      {msg && <div className="alert err">{msg}</div>}
      {MODULE_GROUPS.map((g) => (
        <div className="card" key={g.id} style={{ marginBottom: 14 }}>
          <h3>{g.label}</h3>
          {MODULES.filter((m) => m.group === g.id).map((m) => {
            const built = BUILT.has(m.key)
            const on = built ? modules[m.key] !== false : Boolean(modules[m.key])
            return (
              <div className="mod-row" key={m.key}>
                <div>
                  <b>{m.name}</b>
                  {m.free && <span className="tag free">ফ্রি</span>}
                  {built ? <span className="tag built">তৈরি আছে</span> : <span className="tag">ধাপ {m.step}</span>}
                  <div className="muted" style={{ fontSize: '.85rem' }}>{m.desc}</div>
                </div>
                <Switch checked={on} onChange={(v) => toggle(m.key, v)} />
              </div>
            )
          })}
        </div>
      ))}
    </>
  )
}

export function Integrations() {
  const [data, setData] = useState({})
  const [state, setState] = useState({})

  useEffect(() => {
    supabase.from('integrations').select('*').then(({ data: rows }) => {
      const o = {}
      ;(rows || []).forEach((r) => (o[r.key] = r))
      setData(o)
    })
  }, [])

  const get = (k) => data[k] || { key: k, enabled: false, config: {} }
  const patch = (k, p) => setData({ ...data, [k]: { ...get(k), ...p } })

  async function save(k) {
    const r = get(k)
    setState({ ...state, [k]: '…' })
    const { error } = await supabase.from('integrations').upsert({ key: k, enabled: r.enabled, config: r.config, updated_at: new Date().toISOString() })
    setState({ ...state, [k]: error ? 'ত্রুটি: ' + error.message : 'সংরক্ষিত হয়েছে' })
  }

  return (
    <>
      <h2>মেশিন ও বাইরের সেবা</h2>
      <div className="alert info" style={{ marginBottom: 14 }}>
        এখানকার তথ্য শুধু অ্যাডমিন দেখতে পারেন। মেশিন বা সেবার তথ্য বসিয়ে "চালু" করলে সংশ্লিষ্ট মডিউল (হাজিরা, এসএমএস, অনলাইন পেমেন্ট) এবং তার হিসাব নিজে থেকে সক্রিয় হবে। কোনো কিছু না থাকলে মডিউল বন্ধ অবস্থায় থাকবে, কোনো সমস্যা হবে না।
      </div>
      <div className="stack">
        {INTEGRATIONS.map((it) => {
          const r = get(it.key)
          return (
            <div className="card form" key={it.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <h3 style={{ margin: 0 }}>{it.name}</h3>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`pill ${r.enabled ? 'ok' : ''}`}>{r.enabled ? 'চালু' : 'বন্ধ'}</span>
                  <Switch checked={r.enabled} onChange={(v) => patch(it.key, { enabled: v })} />
                </label>
              </div>
              <p className="muted" style={{ margin: 0 }}>{it.note}</p>
              <div className="row2">
                {it.fields.map(([f, label]) => (
                  <div className="field" key={f}>
                    <label>{label}</label>
                    <input value={r.config?.[f] || ''} onChange={(e) => patch(it.key, { config: { ...r.config, [f]: e.target.value } })} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button className="btn small" onClick={() => save(it.key)}>সংরক্ষণ</button>
                <span className="muted">{state[it.key]}</span>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
