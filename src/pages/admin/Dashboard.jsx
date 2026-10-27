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
  const [st, setSt] = useState([])
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

function FinanceCharts({ onTiles }) {
  const [d, setD] = useState(null)
  useEffect(() => {
    Promise.all([rows('payments'), rows('ledger'), rows('salary_payments'), rows('invoices'), rows('students'), rows('classes', 'sort'), rows('staff_advances')]).then(([pay, led, sal, inv, stu, cls, adv]) => setD({ pay, led, sal, inv, stu, cls, adv }))
  }, [])
  const model = useMemo(() => {
    if (!d) return null
    const months = []; const now = new Date()
    for (let i = 5; i >= 0; i--) { const x = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`) }
    const inc = Object.fromEntries(months.map((m) => [m, 0])); const exp = { ...inc }
    d.pay.filter((p) => !p.void).forEach((p) => { const m = String(p.paid_at).slice(0, 7); if (m in inc) inc[m] += num(p.amount) })
    d.led.filter((l) => !l.void).forEach((l) => { const m = String(l.date).slice(0, 7); if (l.kind === 'income' && m in inc) inc[m] += num(l.amount); if (l.kind === 'expense' && m in exp) exp[m] += num(l.amount) })
    d.sal.filter((s) => !s.void).forEach((s) => { const m = String(s.paid_at).slice(0, 7); if (m in exp) exp[m] += num(s.net) })
    d.adv.filter((s) => !s.void).forEach((s) => { const m = String(s.date).slice(0, 7); if (m in exp) exp[m] += num(s.amount) })
    const cn = Object.fromEntries(d.cls.map((c) => [c.id, nm(c)])); const sc = Object.fromEntries(d.stu.map((s) => [s.id, s.class_id]))
    const dueBy = {}; let dueTotal = 0
    d.inv.filter((i) => !i.cancelled && num(i.amount) - num(i.paid) > 0).forEach((i) => { const k = cn[sc[i.student_id]] || 'শ্রেণি ঠিক নেই'; const v = num(i.amount) - num(i.paid); dueBy[k] = (dueBy[k] || 0) + v; dueTotal += v })
    const today = todayStr(); const mNow = months[months.length - 1]
    const todayIn = d.pay.filter((p) => !p.void && p.paid_at === today).reduce((a, p) => a + num(p.amount), 0)
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
    return { months, inc, exp, dueBy: Object.entries(dueBy).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8), dueTotal, todayIn, monthFee, catIn: Object.entries(catIn).map(([label, value]) => ({ label, value })), catEx: Object.entries(catEx).map(([label, value]) => ({ label, value })), balance: months.reduce((a, m) => a + inc[m] - exp[m], 0) }
  }, [d])
  useEffect(() => { if (model) onTiles({ todayIn: model.todayIn, monthFee: model.monthFee, dueTotal: model.dueTotal }) }, [model]) // eslint-disable-line
  if (!model) return null
  const fm = (n) => taka(n)
  return (
    <>
      <div className="dash-sec"><h3>অর্থনৈতিক চার্ট</h3><Link to="/admin/reports" className="more-link">বিস্তারিত রিপোর্ট <Icon name="arrowright" size={15} cls="cur" /></Link></div>
      <div className="grid g2">
        <ChartCard wide title="গত ৬ মাসের আয় ও ব্যয়" sub="আয় = ফি + দান; ব্যয় = খরচ + বেতন + অগ্রিম" table={model.months.map((m) => [monthName(m), `আয় ${fm(model.inc[m])} · ব্যয় ${fm(model.exp[m])}`])}>
          <Columns labels={model.months.map((m) => monthName(m).split(' ')[0])} a={model.months.map((m) => model.inc[m])} b={model.months.map((m) => model.exp[m])} nameA="আয়" nameB="ব্যয়" />
        </ChartCard>
        <ChartCard title="শ্রেণি অনুযায়ী বকেয়া" sub={`মোট বকেয়া ${fm(model.dueTotal)}`} table={model.dueBy.map((x) => [x.label, fm(x.value)])}><HBars data={model.dueBy} fmt={fm} empty="কোনো বকেয়া নেই" /></ChartCard>
        <ChartCard title="এই মাসের আয়ের উৎস" table={model.catIn.map((x) => [x.label, fm(x.value)])}><Donut data={model.catIn} /></ChartCard>
        <ChartCard title="এই মাসের ব্যয়ের খাত" table={model.catEx.map((x) => [x.label, fm(x.value)])}><Donut data={model.catEx} /></ChartCard>
      </div>
    </>
  )
}

export default function Dashboard() {
  const { modules } = useSite()
  const { can, isFinance, isSuper } = useAuth()
  const c = useCounts()
  const [cnt, setCnt] = useState({})
  const [fin, setFin] = useState(null)
  useEffect(() => {
    Promise.all([supabase.from('students').select('*', { count: 'exact', head: true }).eq('status', 'active'), supabase.from('staff').select('*', { count: 'exact', head: true }).eq('status', 'active')]).then(([a, b]) => setCnt({ stu: a.count ?? 0, staff: b.count ?? 0 }))
  }, [])
  const enabled = MODULES.filter((m) => (BUILT.has(m.key) ? modules[m.key] !== false : modules[m.key])).length
  const tiles = [
    ['সক্রিয় ছাত্র', cnt.stu, '/admin/students'],
    ['শিক্ষক-কর্মচারী', cnt.staff, '/admin/staff'],
    ['আজ উপস্থিত ছাত্র', c.marked === undefined ? undefined : `${bnum(c.here)} / ${bnum(c.marked)}`, '/admin/attendance'],
    ['নতুন ভর্তির আবেদন', c.apps, '/admin/applications'],
    ['অপঠিত বার্তা', c.msgs, '/admin/messages'],
    ...(fin ? [['আজকের আদায়', taka(fin.todayIn), '/admin/fees'], ['এই মাসের ফি আদায়', taka(fin.monthFee), '/admin/fees'], ['মোট বকেয়া', taka(fin.dueTotal), '/admin/reports']] : []),
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
