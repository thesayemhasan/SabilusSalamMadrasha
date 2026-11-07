import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/db'
import { useConfig } from '../../lib/config'
import { useSite } from '../../lib/store'
import { Select, useConfirm } from '../../components/Ui'
import { dateBn, monthName, monthStr, num, pad, taka, todayStr } from './fin'

const DEFAULTS = { due_day: 10, mode: 'fixed', amount: 50, head_name: 'বিলম্ব ফি' }

// বিলম্ব ফি: নির্ধারিত তারিখের পরেও মাসিক বিল বাকি থাকলে প্রতি শিক্ষার্থীকে একবার বিলম্ব ফি-র বিল যোগ করা
export default function LateFee() {
  const confirm = useConfirm()
  const { modules } = useSite()
  const { cfg, setCfg, save, ready } = useConfig('late_fee', DEFAULTS)
  const [month, setMonth] = useState(monthStr())
  const [inv, setInv] = useState([])
  const [heads, setHeads] = useState([])
  const [students, setStudents] = useState({})
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open || !/^\d{4}-\d{2}$/.test(month)) return
    fetchAll((a, b) => supabase.from('invoices').select('*').eq('period', month).order('id').range(a, b)).then(({ data }) => setInv(data || []))
    supabase.from('fee_heads').select('*').then(({ data }) => setHeads(data || []))
    fetchAll((a, b) => supabase.from('students').select('id,student_no,name_bn,status').order('id').range(a, b)).then(({ data }) => setStudents(Object.fromEntries((data || []).map((s) => [s.id, s]))))
  }, [open, month])

  const lateHead = heads.find((h) => h.name_bn === cfg.head_name)
  const dueDate = `${month}-${pad(Math.min(28, Math.max(1, Number(cfg.due_day) || 10)))}`
  const overdue = todayStr() > dueDate
  const plan = useMemo(() => {
    const monthlyIds = new Set(heads.filter((h) => h.kind === 'monthly').map((h) => h.id))
    const per = {}
    inv.forEach((i) => {
      if (i.cancelled || !monthlyIds.has(i.head_id)) return
      const due = num(i.amount) - num(i.paid)
      if (due > 0) per[i.student_id] = (per[i.student_id] || 0) + due
    })
    const have = new Set(inv.filter((i) => lateHead && i.head_id === lateHead.id).map((i) => i.student_id))
    const rows = []
    let skipped = 0
    Object.entries(per).forEach(([sid, due]) => {
      if (have.has(sid)) { skipped += 1; return }
      const fee = cfg.mode === 'percent' ? Math.round((due * num(cfg.amount)) / 100) : num(cfg.amount)
      if (fee > 0) rows.push({ sid, due, fee })
    })
    return { rows, skipped, total: rows.reduce((a, r) => a + r.fee, 0) }
  }, [inv, heads, cfg.mode, cfg.amount, lateHead]) // eslint-disable-line

  async function apply() {
    if (!plan.rows.length) return
    if (!overdue) return setMsg(`এই মাসের নির্ধারিত তারিখ ${dateBn(dueDate)}। এখনো সেই তারিখ পার হয়নি।`)
    if (!(await confirm({ danger: false, name: `${plan.rows.length} জনের বিলম্ব ফি (${taka(plan.total)})`, text: `${monthName(month)} মাসের বাকি থাকা শিক্ষার্থীদের বিলে বিলম্ব ফি যোগ হবে। যাদের আগে যোগ হয়েছে তাদের বাদ যাবে।`, ok: 'হ্যাঁ, যোগ করুন' }))) return
    setBusy(true); setMsg('')
    let head = lateHead
    if (!head) {
      const r = await supabase.from('fee_heads').insert({ name_bn: cfg.head_name, kind: 'one_time', default_amount: 0, published: false }).select().single()
      if (r.error) { setBusy(false); return setMsg(`ত্রুটি: ${r.error.message}`) }
      head = r.data
    }
    const rows = plan.rows.map((r) => ({ student_id: r.sid, head_id: head.id, period: month, title: `${cfg.head_name} — ${monthName(month)}`, amount: r.fee }))
    for (let i = 0; i < rows.length; i += 400) {
      const { error } = await supabase.from('invoices').upsert(rows.slice(i, i + 400), { onConflict: 'student_id,head_id,period', ignoreDuplicates: true })
      if (error) { setBusy(false); return setMsg(`ত্রুটি: ${error.message}`) }
    }
    setBusy(false)
    setMsg(`${rows.length.toLocaleString('bn-BD')} জনের বিলম্ব ফি যোগ হয়েছে।`)
    const { data } = await supabase.from('invoices').select('*').eq('period', month)
    setInv(data || [])
    const h = await supabase.from('fee_heads').select('*'); setHeads(h.data || [])
  }
  if (!ready || modules.late_fee === false) return null
  const up = (k, v) => setCfg((c) => ({ ...c, [k]: v }))

  return (
    <div className="card form" style={{ marginBottom: 14 }}>
      <h3 style={{ marginTop: 0, cursor: 'pointer' }} onClick={() => setOpen(!open)}>বিলম্ব ফি {open ? '▾' : '▸'}</h3>
      {open && (
        <>
          <p className="muted" style={{ marginTop: 0 }}>প্রতি মাসের নির্ধারিত তারিখের পরেও মাসিক বিল বাকি থাকলে, প্রতি শিক্ষার্থীকে একবার বিলম্ব ফি-র বিল যোগ করা যায়। যোগ হওয়ার আগে কতজনের কত টাকা হবে তা দেখা যায়।</p>
          <div className="grid g3">
            <div className="field"><label>প্রতি মাসের নির্ধারিত তারিখ (১–২৮)</label><input type="number" min="1" max="28" value={cfg.due_day} onChange={(e) => up('due_day', e.target.value)} /></div>
            <div className="field"><label>ফি-র ধরন</label><Select value={cfg.mode} onChange={(v) => up('mode', v)} options={[['fixed', 'নির্দিষ্ট টাকা'], ['percent', 'বাকির শতাংশ (%)']]} /></div>
            <div className="field"><label>{cfg.mode === 'percent' ? 'শতাংশ (%)' : 'টাকার পরিমাণ'}</label><input type="number" min="0" value={cfg.amount} onChange={(e) => up('amount', e.target.value)} /></div>
          </div>
          <div className="grid g2">
            <div className="field"><label>বিলে যে নামে দেখাবে</label><input value={cfg.head_name} onChange={(e) => up('head_name', e.target.value)} /></div>
            <div className="field"><label>কোন মাসের জন্য</label><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <button className="btn small outline" onClick={async () => { const e = await save(cfg); setMsg(e ? `ত্রুটি: ${e.message}` : 'সেটিংস সংরক্ষিত হয়েছে') }}>সেটিংস সংরক্ষণ</button>
          </div>
          <p style={{ margin: '4px 0' }}>নির্ধারিত তারিখ: <b>{dateBn(dueDate)}</b> {overdue ? '(পার হয়েছে)' : '(এখনো পার হয়নি)'} · বিলম্ব ফি যোগ হবে: <b>{plan.rows.length.toLocaleString('bn-BD')}</b> জন, মোট <b>{taka(plan.total)}</b>{plan.skipped ? ` · আগে যোগ হয়েছে: ${plan.skipped.toLocaleString('bn-BD')} জন` : ''}</p>
          <button className="btn" disabled={busy || !plan.rows.length || !overdue} onClick={apply}>বিলম্ব ফি যোগ করুন</button>
          {msg && <div className={`alert ${/ত্রুটি|পার হয়নি/.test(msg) ? 'err' : 'ok'}`} style={{ marginTop: 10 }}>{msg}</div>}
        </>
      )}
    </div>
  )
}
