import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useSite } from '../../lib/store'
import { MODULES, BUILT } from '../../lib/modules'
import Icon from '../../components/Icon'

export default function Dashboard() {
  const { modules } = useSite()
  const [c, setC] = useState({})
  useEffect(() => {
    const d = new Date(); const pz = (n) => String(n).padStart(2, '0')
    const today = `${d.getFullYear()}-${pz(d.getMonth() + 1)}-${pz(d.getDate())}`
    const count = (t, f) => {
      let q = supabase.from(t).select('*', { count: 'exact', head: true })
      if (f) q = f(q)
      return q.then((r) => r.count ?? 0)
    }
    Promise.all([
      count('admission_applications', (q) => q.eq('status', 'new')),
      count('contact_messages', (q) => q.eq('is_read', false)),
      count('notices'),
      count('events'),
      count('students', (q) => q.eq('status', 'active')),
      count('staff', (q) => q.eq('status', 'active')),
      count('attendance', (q) => q.eq('person_type', 'student').eq('date', today)),
      count('attendance', (q) => q.eq('person_type', 'student').eq('date', today).in('status', ['present', 'late'])),
    ]).then(([apps, msgs, notices, events, stu, staff, marked, here]) => setC({ apps, msgs, notices, events, stu, staff, marked, here }))
  }, [])

  const enabled = MODULES.filter((m) => (BUILT.has(m.key) ? modules[m.key] !== false : modules[m.key])).length
  const tiles = [
    ['নতুন আবেদন', c.apps, '/admin/applications'],
    ['অপঠিত বার্তা', c.msgs, '/admin/messages'],
    ['নোটিশ', c.notices, '/admin/notices'],
    ['ইভেন্ট', c.events, '/admin/events'],
    ['সক্রিয় ছাত্র', c.stu, '/admin/students'],
    ['শিক্ষক-কর্মচারী', c.staff, '/admin/staff'],
    ['আজ ছাত্র উপস্থিত', c.marked === undefined ? undefined : `${c.here}/${c.marked}`, '/admin/attendance'],
  ]

  return (
    <>
      <h2>ড্যাশবোর্ড</h2>
      <div className="quick">
        {[['megaphone', 'নতুন নোটিশ', '/admin/notices'], ['calendar', 'নতুন ইভেন্ট', '/admin/events'], ['image', 'হোম স্লাইড', '/admin/slides'], ['building', 'হোমে নতুন রো', '/admin/home-blocks'], ['apply', 'ভর্তি ফরম', '/admin/admission-form'], ['users', 'ছাত্র-ছাত্রী', '/admin/students'], ['clipboard', 'আজকের হাজিরা', '/admin/attendance'], ['edit', 'লেখা বদলান', '/admin/texts'], ['gear', 'সেটিংস', '/admin/settings']].map(([ic, label, to]) => (
          <Link to={to} key={to}><span className="big"><Icon name={ic} size={34} /></span>{label}</Link>
        ))}
      </div>
      <div className="grid g4" style={{ marginBottom: 20 }}>
        {tiles.map(([label, n, to]) => (
          <Link to={to} className="card stat" key={label}>
            <b>{n ?? '…'}</b>
            <span className="muted">{label}</span>
          </Link>
        ))}
      </div>
      <div className="card">
        <h3>সিস্টেমের অবস্থা</h3>
        <p>ধাপ ১ ও ২ চালু: পাবলিক ওয়েবসাইট, অ্যাডমিন লগইন, ভর্তির আবেদন, ছাত্র-ছাত্রী, শ্রেণি, শিক্ষক-কর্মচারী, হাজিরা (হাতে ও ZKTeco)।</p>
        <p className="muted" style={{ margin: 0 }}>
          চালু মডিউল: {enabled} / {MODULES.length}। বাকি মডিউল (বেতন-হিসাব, পরীক্ষা, হিফজ, এসএমএস ইত্যাদি) পরের ধাপগুলোতে যোগ হবে।
        </p>
      </div>
    </>
  )
}
