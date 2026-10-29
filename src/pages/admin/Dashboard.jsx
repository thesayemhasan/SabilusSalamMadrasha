import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/db'
import { useAuth, useSite } from '../../lib/store'
import { PATH_FEATURE } from '../../lib/features'
import { MODULES, BUILT } from '../../lib/modules'
import Icon from '../../components/Icon'
import { Select } from '../../components/Ui'
import { ChartCard, Columns, Donut, HBars } from '../../components/Charts'
import { monthName, nm, num, taka, todayStr } from './fin'
import { useYear, useEnrolled, inYearStudents } from '../../lib/year'

export const BLOOD = ['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−']
const bnum = (n) => Number(n || 0).toLocaleString('bn-BD')
const rows = (t, order = 'created_at') => fetchAll((a, b) => supabase.from(t).select('*').order(order, { ascending: true }).range(a, b)).then((r) => (r.error ? [] : r.data || []))

function useCounts() {
  const [c, setC] = useState({})
  useEffect(() => {
    const today = todayStr()
    const count = (t, f) => { let q = supabase.from(t).select('*', { count: 'exact', head: true }); if (f) q = f(q); return q.then((r) => r.count ?? 0) }
    Promise.all([
      count('admission_applications', (q) => q.eq('status', 'new')),
      count('contact_messages', (q) => q.eq('is_read', false)),
      count('attendance', (q) => q.eq('person_type', 'student').eq('date', today)),
      count('attendance', (q) => q.eq('person_type', 'student').eq('date', today).in('status', ['present', 'late'])),
    ]).then(([apps, msgs, marked, here]) => setC({ apps, msgs, marked, here }))
  }, [])
  return c
}

function StudentCharts() {
  const en = useEnrolled()
  const [stAll, setSt] = useState([])
  const st = useMemo(() => inYearStudents(stAll, en), [stAll, en.active, en.ids, en.classOf]) // eslint-disable-line
  const [classes, setClasses] = useState([])
  const [depts, setDepts] = useState([])
  const [res, setRes] = useState([])
  const [f, setF] = useState({ dept: '', cls: '', res: '', gender: '', blood: '', status: 'active' })
  useEffect(() => {
    rows('students').then(setSt); rows('classes', 'sort').then(setClasses); rows('departments', 'sort').then(setDepts)
    supabase.from('lookups').select('*').eq('kind', 'residence').order('sort', { ascending: true }).then(({ data }) => setRes(data || []))
  }, [])
  const set = (k) => (v) => setF((o) => ({ ...o, [k]: v }))
  const shown = st.filter((s) => (!f.dept || s.department_id === f.dept) && (!f.cls || s.class_id === f.cls) && (!f.res || s.residence === f.res) && (!f.gender || s.gender === f.gender) && (!f.blood || (s.blood_group || '') === f.blood) && (!f.status || s.status === f.status))
  const group = (key, label) => { const o = {}; shown.forEach((s) => { const k = key(s); o[k] = (o[k] || 0) + 1 }); return Object.entries(o).map(([k, v]) => ({ label: label(k), value: v })) }
  const cn = Object.fromEntries(classes.map((c) => [c.id, nm(c)])); const dn = Object.fromEntries(depts.map((d) => [d.id, nm(d)]))
  const byClass = group((s) => s.class_id || '-', (k) => cn[k] || 'শ্রেণি ঠিক নেই').sort((a, b) => b.value - a.value)
  const byDept = group((s) => s.department_id || '-', (k) => dn[k] || 'বিভাগ ঠিক নেই')
  const byGender = group((s) => s.gender || '-', (k) => ({ male: 'ছেলে', female: 'মেয়ে' }[k] || 'উল্লেখ নেই'))
  const byRes = group((s) => s.residence || '-', (k) => (k === '-' ? 'উল্লেখ নেই' : k))
  const byBlood = [...BLOOD, ''].map((b) => ({ label: b || 'অজানা', value: shown.filter((s) => (s.blood_group || '') === b).length })).filter((d) => d.value)
  const tbl = (d) => d.map((x) => [x.label, bnum(x.value)])
  return (
    <>
      <div className="dash-sec"><h3>ছাত্র-ছাত্রীর পরিসংখ্যান</h3><span className="muted">ফিল্টার বদলালে চার্ট নিজে বদলাবে</span></div>
      <div className="toolbar">
        <div style={{ minWidth: 150 }}><Select value={f.dept} onChange={set('dept')} options={[['', 'সব বিভাগ'], ...depts.map((d) => [d.id, nm(d)])]} /></div>
        <div style={{ minWidth: 150 }}><Select value={f.cls} onChange={set('cls')} options={[['', 'সব শ্রেণি'], ...classes.map((c) => [c.id, nm(c)])]} /></div>
        <div style={{ minWidth: 150 }}><Select value={f.res} onChange={set('res')} options={[['', 'আবাসিক/অনাবাসিক'], ...res.map((r) => [r.name_bn, r.name_bn])]} /></div>
        <div style={{ minWidth: 130 }}><Select value={f.gender} onChange={set('gender')} options={[['', 'ছেলে/মেয়ে'], ['male', 'ছেলে'], ['female', 'মেয়ে']]} /></div>
        <div style={{ minWidth: 130 }}><Select value={f.blood} onChange={set('blood')} options={[['', 'রক্তের গ্রুপ'], ...BLOOD.map((b) => [b, b])]} /></div>
        <div style={{ minWidth: 130 }}><Select value={f.status} onChange={set('status')} options={[['', 'সব অবস্থা'], ['active', 'সক্রিয়'], ['inactive', 'নিষ্ক্রিয়'], ['left', 'ছেড়ে গেছে'], ['graduated', 'পাশ / ফারেগ']]} /></div>
        <button className="btn small outline" onClick={() => setF({ dept: '', cls: '', res: '', gender: '', blood: '', status: 'active' })}>ফিল্টার মুছুন</button>
      </div>
      <div className="grid g2">
        <div className="card viz" style={{ display: 'grid', placeItems: 'center', textAlign: 'center' }}>
          <div><div className="muted">ফিল্টার অনুযায়ী মোট ছাত্র-ছাত্রী</div><b style={{ fontSize: '3rem', color: 'var(--primary)', lineHeight: 1.2 }}>{bnum(shown.length)}</b><div className="muted">মোট নথিভুক্ত: {bnum(st.length)}</div></div>
        </div>
        <ChartCard title="ছেলে ও মেয়ে" table={tbl(byGender)}><Donut data={byGender} /></ChartCard>
        <ChartCard title="শ্রেণি অনুযায়ী" table={tbl(byClass)}><HBars data={byClass} /></ChartCard>
        <ChartCard title="বিভাগ অনুযায়ী" table={tbl(byDept)}><HBars data={byDept} /></ChartCard>
        <ChartCard title="রক্তের গ্রুপ" sub="ছাত্রের তথ্যে রক্তের গ্রুপ দিলে এখানে দেখাবে" table={tbl(byBlood)}><HBars data={byBlood} /></ChartCard>
        <ChartCard title="আবাসিক / অনাবাসিক" table={tbl(byRes)}><Donut data={byRes} /></ChartCard>
      </div>
    </>
  )
}

// আয়-ব্যয়ের বিশ্লেষণ: আয়ের কত অংশ ব্যয়, বেশি/কম কত, আগের সময়ের সাথে তুলনা ইত্যাদি (রং: আয় = নীল, ব্যয় = কমলা)
const pc = (n, d = 1) => `${Number(n).toLocaleString('bn-BD', { maximumFractionDigits: d })}%`
// prefix: 'YYYY-MM' / 'YYYY' (শুরু মিলিয়ে) অথবা [শুরু, শেষ] তারিখের পরিসর
const hit = (pf, v) => {
  const x = String(v || '')
  if (!Array.isArray(pf)) return x.startsWith(pf)
  const L = Math.min(x.length, 10)
  return L >= 7 && x.slice(0, L) >= pf[0].slice(0, L) && x.slice(0, L) <= pf[1].slice(0, L)
}
const monthsBetween = (a, b) => {
  const out = []; let y = Number(a.slice(0, 4)); let m = Number(a.slice(5, 7))
  const ey = Number(b.slice(0, 4)); const em = Number(b.slice(5, 7))
  while ((y < ey || (y === ey && m <= em)) && out.length < 48) { out.push(`${y}-${String(m).padStart(2, '0')}`); m += 1; if (m > 12) { m = 1; y += 1 } }
  return out
}

function Insights({ d }) {
  const now = new Date()
  const nowYear = now.getFullYear()
  const { year: ay, years: ays } = useYear()
  const [mode, setMode] = useState('month')
  const yFrom = ay ? ay.start_date : `${nowYear}-01-01`
  const yTo = ay ? ay.end_date : `${nowYear}-12-31`
  const monthList = useMemo(() => monthsBetween(yFrom, yTo), [yFrom, yTo])
  const dflt = useMemo(() => { const cur = `${nowYear}-${String(now.getMonth() + 1).padStart(2, '0')}`; return monthList.includes(cur) ? cur : (cur < monthList[0] ? monthList[0] : monthList[monthList.length - 1]) }, [monthList]) // eslint-disable-line
  const [monPick, setMon] = useState('')
  const mon = monthList.includes(monPick) ? monPick : dflt
  const sum = useMemo(() => (prefix) => {
    const r = { fee: 0, other: 0, exp: 0, sal: 0, adv: 0, cats: {}, billed: 0, paid: 0 }
    d.pay.filter((p) => !p.void && hit(prefix, p.paid_at)).forEach((p) => { r.fee += num(p.amount) })
    d.led.filter((l) => !l.void && hit(prefix, l.date)).forEach((l) => {
      if (l.kind === 'income') r.other += num(l.amount)
      else { r.exp += num(l.amount); r.cats[l.category_name || 'ব্যয়'] = (r.cats[l.category_name || 'ব্যয়'] || 0) + num(l.amount) }
    })
    d.sal.filter((x) => !x.void && hit(prefix, x.paid_at)).forEach((x) => { r.sal += num(x.net) })
    d.adv.filter((x) => !x.void && hit(prefix, x.date)).forEach((x) => { r.adv += num(x.amount) })
    if (r.sal) r.cats['শিক্ষক-কর্মচারীর বেতন'] = r.sal
    if (r.adv) r.cats['অগ্রিম'] = r.adv
    r.exp += r.sal + r.adv
    r.inc = r.fee + r.other
    d.inv.filter((i) => !i.cancelled && hit(prefix, i.period)).forEach((i) => { r.billed += num(i.amount); r.paid += num(i.paid) })
    return r
  }, [d])
  const MN = Array.from({ length: 12 }, (_, i) => monthName(`2000-${String(i + 1).padStart(2, '0')}`).split(' ')[0])
  const bnYear = (y) => Number(y).toLocaleString('bn-BD', { useGrouping: false })
  const isMonth = mode === 'month'
  const shiftY = (dt) => `${Number(dt.slice(0, 4)) - 1}${dt.slice(4)}`
  const prevAy = ay ? ays.filter((y) => y.end_date < ay.start_date).sort((p, q) => (p.end_date < q.end_date ? 1 : -1))[0] : null
  const prefix = isMonth ? mon : [yFrom, yTo]
  const prevPrefix = isMonth
    ? (Number(mon.slice(5)) === 1 ? `${Number(mon.slice(0, 4)) - 1}-12` : `${mon.slice(0, 4)}-${String(Number(mon.slice(5)) - 1).padStart(2, '0')}`)
    : (prevAy ? [prevAy.start_date, prevAy.end_date] : [shiftY(yFrom), shiftY(yTo)])
  const labelOf = (pf) => (Array.isArray(pf) ? (pf === prefix ? (ay?.name_bn || `${bnYear(pf[0].slice(0, 4))} সাল`) : (prevAy?.name_bn || 'আগের বছর')) : `${MN[Number(pf.slice(5)) - 1]} ${bnYear(pf.slice(0, 4))}`)
  const c = sum(prefix)
  const P = { name: labelOf(prefix), before: labelOf(prevPrefix), prev: sum(prevPrefix) }
  const isCurrentMonth = isMonth && prefix === `${nowYear}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const M = { day: now.getDate(), days: new Date(nowYear, now.getMonth() + 1, 0).getDate() }
  const net = c.inc - c.exp
  const max = Math.max(1, c.inc, c.exp)
  const top = Object.entries(c.cats).sort((a, b) => b[1] - a[1])[0]
  const chg = (a, b) => (b > 0 ? ((a - b) / b) * 100 : null)
  const chgTxt = (a, b) => { const x = chg(a, b); if (x === null) return a > 0 ? 'আগে ছিল না' : '—'; return `${x >= 0 ? '▲' : '▼'} ${pc(Math.abs(x))}` }
  const empty = !c.inc && !c.exp
  const BLUE = 'var(--v1)'; const ORG = 'var(--v2)'
  const Bar = ({ v, color, label }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr auto', gap: 10, alignItems: 'center', margin: '6px 0' }}>
      <span style={{ fontSize: '.9rem' }}>{label}</span>
      <span style={{ background: 'var(--th)', borderRadius: 99, height: 14, overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${Math.max(v ? 2 : 0, (v / max) * 100)}%`, background: color, borderRadius: 99 }} /></span>
      <b style={{ color }}>{taka(v)}</b>
    </div>
  )
  const Tile2 = ({ label, value, sub, color }) => <div className="card stat"><b style={color ? { color } : undefined}>{value}</b><span className="muted">{label}</span>{sub && <small className="muted">{sub}</small>}</div>
  const projected = isCurrentMonth && M.day > 0 ? (c.exp / M.day) * M.days : null
  return (
    <>
      <div className="dash-sec"><h3>আয়-ব্যয়ের বিশ্লেষণ</h3></div>
      <div className="grid g4" style={{ marginBottom: 12, alignItems: 'end' }}>
        <div className="field"><label>কীভাবে দেখবেন</label><Select value={mode} onChange={setMode} options={[['month', 'মাস অনুযায়ী'], ['year', 'পুরো শিক্ষাবর্ষ']]} /></div>
        {isMonth && <div className="field"><label>মাস</label><Select value={mon} onChange={setMon} options={monthList.map((m) => [m, `${MN[Number(m.slice(5)) - 1]} ${bnYear(m.slice(0, 4))}`])} /></div>}
        <div className="field"><label>শিক্ষাবর্ষ</label><input readOnly value={ay?.name_bn || `${bnYear(nowYear)} সাল`} title="উপরের সিলেক্টর থেকে শিক্ষাবর্ষ বদলান" /></div>
      </div>
      <div className="card viz" style={{ marginBottom: 14 }}>
        <div className="viz-head"><div><h3>{P.name}: আয়ের তুলনায় ব্যয়</h3><span className="muted">আয় = ফি + দান/অন্যান্য আয়; ব্যয় = খরচ + বেতন + অগ্রিম</span></div></div>
        {empty ? <p className="muted">{P.name}-এ কোনো আয় বা ব্যয় নেই।</p> : (
          <>
            <Bar v={c.inc} color={BLUE} label="আয়" />
            <Bar v={c.exp} color={ORG} label="ব্যয়" />
            <div style={{ marginTop: 12, display: 'grid', gap: 4 }}>
              {c.inc > 0 && net >= 0 && <div>আয়ের <b style={{ color: ORG }}>{pc((c.exp / c.inc) * 100)}</b> ব্যয় হয়েছে, বাকি <b style={{ color: BLUE }}>{pc((net / c.inc) * 100)}</b> ({taka(net)}) থেকে গেছে।</div>}
              {c.inc === 0 && <div style={{ color: ORG }}>এই সময়ে কোনো আয় নেই, তবু {taka(c.exp)} ব্যয় হয়েছে।</div>}
              {c.inc > 0 && net < 0 && <div>আয়ের <b style={{ color: ORG }}>পুরোটাই (১০০%)</b> ব্যয় হয়ে গেছে, তার ওপরেও <b style={{ color: ORG }}>{taka(-net)}</b> বেশি ব্যয় হয়েছে — যা আয়ের <b style={{ color: ORG }}>{pc((-net / c.inc) * 100)}</b> বেশি (ঘাটতি)।</div>}
              {c.inc > 0 && net === 0 && <div>আয় ও ব্যয় সমান।</div>}
            </div>
          </>
        )}
      </div>
      <div className="grid g4" style={{ marginBottom: 20 }}>
        <Tile2 label="সঞ্চয়ের হার (আয়ের কত অংশ জমেছে)" value={c.inc > 0 ? pc(Math.max(0, (net / c.inc) * 100)) : '—'} color={net < 0 ? ORG : BLUE} sub={c.inc > 0 ? `${net >= 0 ? 'উদ্বৃত্ত' : 'ঘাটতি (কিছু জমেনি)'} ${taka(Math.abs(net))}` : undefined} />
        <Tile2 label={`আয়: ${P.before}-এর তুলনায়`} value={chgTxt(c.inc, P.prev.inc)} color={BLUE} sub={`${P.before}: ${taka(P.prev.inc)}`} />
        <Tile2 label={`ব্যয়: ${P.before}-এর তুলনায়`} value={chgTxt(c.exp, P.prev.exp)} color={ORG} sub={`${P.before}: ${taka(P.prev.exp)}`} />
        <Tile2 label="সবচেয়ে বড় ব্যয়ের খাত" value={top ? top[0] : '—'} color={ORG} sub={top && c.exp > 0 ? `মোট ব্যয়ের ${pc((top[1] / c.exp) * 100)} (${taka(top[1])})` : undefined} />
        <Tile2 label="বেতন ও অগ্রিমের অংশ" value={c.exp > 0 ? pc(((c.sal + c.adv) / c.exp) * 100) : '—'} color={ORG} sub={c.inc > 0 && (c.sal + c.adv) > 0 ? ((c.sal + c.adv) > c.inc ? 'বেতন ও অগ্রিমই আয়ের চেয়ে বেশি' : `আয়ের ${pc(((c.sal + c.adv) / c.inc) * 100)} বেতনে গেছে`) : 'মোট ব্যয়ের মধ্যে'} />
        <Tile2 label="ফি আদায়ের হার (ইস্যু করা মাসিক বিল)" value={c.billed > 0 ? pc((c.paid / c.billed) * 100) : '—'} color={BLUE} sub={c.billed > 0 ? `বিল ${taka(c.billed)} · জমা ${taka(c.paid)}` : 'এই সময়ের কোনো বিল নেই'} />
        <Tile2 label="ফি ও অন্যান্য আয়ের ভাগ" value={c.inc > 0 ? pc((c.fee / c.inc) * 100) : '—'} color={BLUE} sub={c.inc > 0 ? `ফি ${taka(c.fee)} · দান/অন্যান্য ${taka(c.other)}` : undefined} />
        {projected !== null && <Tile2 label="এই হারে চললে মাস শেষে মোট ব্যয় (আনুমানিক)" value={taka(Math.round(projected))} color={ORG} sub={`দৈনিক গড় ${taka(Math.round(c.exp / Math.max(1, M.day)))}`} />}
      </div>
    </>
  )
}

function FinanceCharts({ onTiles }) {
  const { year: ay, inYear } = useYear()
  const [d, setD] = useState(null)
  useEffect(() => {
    Promise.all([rows('payments'), rows('ledger'), rows('salary_payments'), rows('invoices'), rows('students'), rows('classes', 'sort'), rows('staff_advances')]).then(([pay, led, sal, inv, stu, cls, adv]) => setD({ pay, led, sal, inv, stu, cls, adv }))
  }, [])
  const model = useMemo(() => {
    if (!d) return null
    const months = []; const t0 = todayStr()
    // শিক্ষাবর্ষ নির্বাচিত থাকলে: আজ ওই বর্ষের ভেতরে হলে আজকের মাস, নইলে বর্ষের শেষ (বা শুরু) মাস ধরে হিসাব
    const anchorStr = !ay || inYear(t0) ? t0 : (t0 > ay.end_date ? ay.end_date : ay.start_date)
    const now = new Date(Number(anchorStr.slice(0, 4)), Number(anchorStr.slice(5, 7)) - 1, 1)
    for (let i = 5; i >= 0; i--) { const x = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`) }
    const inc = Object.fromEntries(months.map((m) => [m, 0])); const exp = { ...inc }
    d.pay.filter((p) => !p.void).forEach((p) => { const m = String(p.paid_at).slice(0, 7); if (m in inc) inc[m] += num(p.amount) })
    d.led.filter((l) => !l.void).forEach((l) => { const m = String(l.date).slice(0, 7); if (l.kind === 'income' && m in inc) inc[m] += num(l.amount); if (l.kind === 'expense' && m in exp) exp[m] += num(l.amount) })
    d.sal.filter((s) => !s.void).forEach((s) => { const m = String(s.paid_at).slice(0, 7); if (m in exp) exp[m] += num(s.net) })
    d.adv.filter((s) => !s.void).forEach((s) => { const m = String(s.date).slice(0, 7); if (m in exp) exp[m] += num(s.amount) })
    const cn = Object.fromEntries(d.cls.map((c) => [c.id, nm(c)])); const sc = Object.fromEntries(d.stu.map((s) => [s.id, s.class_id]))
    const dueBy = {}; let dueTotal = 0
    d.inv.filter((i) => !i.cancelled && (!ay || hit([ay.start_date, ay.end_date], i.period)) && num(i.amount) - num(i.paid) > 0).forEach((i) => { const k = cn[sc[i.student_id]] || 'শ্রেণি ঠিক নেই'; const v = num(i.amount) - num(i.paid); dueBy[k] = (dueBy[k] || 0) + v; dueTotal += v })
    const today = t0; const mNow = months[months.length - 1]
    const todayIn = (ay && !inYear(today) ? [] : d.pay.filter((p) => !p.void && p.paid_at === today)).reduce((a, p) => a + num(p.amount), 0)
    const monthFee = d.pay.filter((p) => !p.void && String(p.paid_at).slice(0, 7) === mNow).reduce((a, p) => a + num(p.amount), 0)
    const catIn = {}
    d.led.filter((l) => !l.void && l.kind === 'income' && String(l.date).slice(0, 7) === mNow).forEach((l) => { catIn[l.category_name || 'আয়'] = (catIn[l.category_name || 'আয়'] || 0) + num(l.amount) })
    if (monthFee) catIn['ছাত্র ফি'] = monthFee
    // এই মাসের ব্যয়ের খাত: খরচের খাতসমূহ + শিক্ষক-কর্মচারীর বেতন + অগ্রিম
    const catEx = {}
    d.led.filter((l) => !l.void && l.kind === 'expense' && String(l.date).slice(0, 7) === mNow).forEach((l) => { catEx[l.category_name || 'ব্যয়'] = (catEx[l.category_name || 'ব্যয়'] || 0) + num(l.amount) })
    const salNow = d.sal.filter((x) => !x.void && String(x.paid_at).slice(0, 7) === mNow).reduce((a, x) => a + num(x.net), 0)
    const advNow = d.adv.filter((x) => !x.void && String(x.date).slice(0, 7) === mNow).reduce((a, x) => a + num(x.amount), 0)
    if (salNow) catEx['শিক্ষক-কর্মচারীর বেতন'] = (catEx['শিক্ষক-কর্মচারীর বেতন'] || 0) + salNow
    if (advNow) catEx['অগ্রিম'] = (catEx['অগ্রিম'] || 0) + advNow
    return { curM: mNow === t0.slice(0, 7), mName: monthName(mNow), months, inc, exp, dueBy: Object.entries(dueBy).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8), dueTotal, todayIn, monthFee, catIn: Object.entries(catIn).map(([label, value]) => ({ label, value })), catEx: Object.entries(catEx).map(([label, value]) => ({ label, value })), balance: months.reduce((a, m) => a + inc[m] - exp[m], 0) }
  }, [d, ay]) // eslint-disable-line
  useEffect(() => { if (model) onTiles({ todayIn: model.todayIn, monthFee: model.monthFee, dueTotal: model.dueTotal, curM: model.curM, mName: model.mName }) }, [model]) // eslint-disable-line
  if (!model) return null
  const fm = (n) => taka(n)
  return (
    <>
      <div className="dash-sec"><h3>অর্থনৈতিক চার্ট</h3><Link to="/admin/reports" className="more-link">বিস্তারিত রিপোর্ট <Icon name="arrowright" size={15} cls="cur" /></Link></div>
      <div className="grid g2">
        <ChartCard wide title={model.curM ? 'গত ৬ মাসের আয় ও ব্যয়' : `${model.mName} পর্যন্ত ৬ মাসের আয় ও ব্যয়`} sub="আয় = ফি + দান; ব্যয় = খরচ + বেতন + অগ্রিম" table={model.months.map((m) => [monthName(m), `আয় ${fm(model.inc[m])} · ব্যয় ${fm(model.exp[m])}`])}>
          <Columns labels={model.months.map((m) => monthName(m).split(' ')[0])} a={model.months.map((m) => model.inc[m])} b={model.months.map((m) => model.exp[m])} nameA="আয়" nameB="ব্যয়" />
        </ChartCard>
        <ChartCard title="শ্রেণি অনুযায়ী বকেয়া" sub={`মোট বকেয়া ${fm(model.dueTotal)}`} table={model.dueBy.map((x) => [x.label, fm(x.value)])}><HBars data={model.dueBy} fmt={fm} empty="কোনো বকেয়া নেই" /></ChartCard>
        <ChartCard title={model.curM ? 'এই মাসের আয়ের উৎস' : `${model.mName}-এর আয়ের উৎস`} table={model.catIn.map((x) => [x.label, fm(x.value)])}><Donut data={model.catIn} tone="income" /></ChartCard>
        <ChartCard title={model.curM ? 'এই মাসের ব্যয়ের খাত' : `${model.mName}-এর ব্যয়ের খাত`} table={model.catEx.map((x) => [x.label, fm(x.value)])}><Donut data={model.catEx} tone="expense" /></ChartCard>
      </div>
      <Insights d={d} />
    </>
  )
}

export default function Dashboard() {
  const { modules } = useSite()
  const { can, isFinance, isSuper } = useAuth()
  const c = useCounts()
  const [cnt, setCnt] = useState({})
  const [fin, setFin] = useState(null)
  const enD = useEnrolled()
  const [stuY, setStuY] = useState(null)
  useEffect(() => {
    if (!enD.active || !enD.ids) { setStuY(null); return }
    fetchAll((a, b) => supabase.from('students').select('id').eq('status', 'active').order('id').range(a, b)).then((r) => setStuY((r.data || []).filter((s) => enD.ids.has(s.id)).length))
  }, [enD.active, enD.ids])
  useEffect(() => {
    Promise.all([supabase.from('students').select('*', { count: 'exact', head: true }).eq('status', 'active'), supabase.from('staff').select('*', { count: 'exact', head: true }).eq('status', 'active')]).then(([a, b]) => setCnt({ stu: a.count ?? 0, staff: b.count ?? 0 }))
  }, [])
  const enabled = MODULES.filter((m) => (BUILT.has(m.key) ? modules[m.key] !== false : modules[m.key])).length
  const tiles = [
    ['সক্রিয় ছাত্র', enD.active ? (stuY ?? undefined) : cnt.stu, '/admin/students'],
    ['শিক্ষক-কর্মচারী', cnt.staff, '/admin/staff'],
    ['আজ উপস্থিত ছাত্র', c.marked === undefined ? undefined : `${bnum(c.here)} / ${bnum(c.marked)}`, '/admin/attendance'],
    ['নতুন ভর্তির আবেদন', c.apps, '/admin/applications'],
    ['অপঠিত বার্তা', c.msgs, '/admin/messages'],
    ...(fin ? [['আজকের আদায়', taka(fin.todayIn), '/admin/fees'], [fin.curM === false ? `${fin.mName}-এর ফি আদায়` : 'এই মাসের ফি আদায়', taka(fin.monthFee), '/admin/fees'], ['মোট বকেয়া', taka(fin.dueTotal), '/admin/reports']] : []),
  ]
  const quick = [['wallet', 'ফি আদায়', '/admin/fees'], ['clipboard', 'আজকের হাজিরা', '/admin/attendance'], ['users', 'ছাত্র-ছাত্রী', '/admin/students'], ['coins', 'নতুন ব্যয়', '/admin/expense'], ['apply', 'ভর্তির আবেদন', '/admin/applications'], ['chart', 'রিপোর্ট', '/admin/reports'], ['megaphone', 'নোটিশ', '/admin/notices'], ['image', 'হোম স্লাইড', '/admin/slides'], ['gear', 'সেটিংস', '/admin/settings']]
  const ok = ([, , to]) => !PATH_FEATURE[to] || can(PATH_FEATURE[to])
  return (
    <>
      <div className="dash-top">
        <h2 style={{ margin: 0 }}>ড্যাশবোর্ড</h2>
        <Link to="/" className="btn outline"><Icon name="globe" size={18} cls="cur" /> ওয়েবসাইট দেখুন</Link>
      </div>
      <div className="quick">
        {quick.filter((q) => ok([0, 0, q[2]])).map(([ic, label, to]) => (
          <Link to={to} key={to}><span className="big"><Icon name={ic} size={34} /></span>{label}</Link>
        ))}
      </div>
      <div className="grid g4" style={{ marginBottom: 20 }}>
        {tiles.filter((x) => ok([0, 0, x[2]])).map(([label, n, to]) => (
          <Link to={to} className="card stat" key={label}>
            <b>{n ?? '…'}</b>
            <span className="muted">{label}</span>
          </Link>
        ))}
      </div>
      {can('students') && <StudentCharts />}
      {isFinance && <FinanceCharts onTiles={setFin} />}
      {isSuper && <div className="card" style={{ marginTop: 22 }}>
        <h3>সিস্টেমের অবস্থা</h3>
        <p>ধাপ ১, ২ ও ৩ চালু: ওয়েবসাইট, ভর্তি, ছাত্র-ছাত্রী, শিক্ষক-কর্মচারী, হাজিরা, ফি ও রসিদ, দান ও আয়-ব্যয়, বেতন, রিপোর্ট।</p>
        <p className="muted" style={{ margin: 0 }}>চালু মডিউল: {enabled} / {MODULES.length}। বাকি মডিউল (পরীক্ষা, হিফজ, এসএমএস ইত্যাদি) পরের ধাপগুলোতে যোগ হবে।</p>
      </div>}
    </>
  )
}
