import { Link, Navigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useSite } from '../../lib/store'
import { BUILT, MODULES, MODULE_GROUPS } from '../../lib/modules'
import { Switch } from '../../components/Ui'

const LINKS = {
  attendance: ['/admin/integrations', 'ZKTeco মেশিনের তথ্য বসান'],
  sms: ['/admin/integrations', 'এসএমএস গেটওয়ের তথ্য বসান'],
  online_payment: ['/admin/integrations', 'পেমেন্ট গেটওয়ের তথ্য বসান'],
  events: ['/admin/events', 'ইভেন্ট ক্যালেন্ডার খুলুন'],
  website: ['/admin/texts', 'ওয়েবসাইটের লেখা সম্পাদনা করুন'],
  settings: ['/admin/settings', 'প্রতিষ্ঠানের তথ্য খুলুন'],
}

export default function ModulePage() {
  const { key } = useParams()
  const { modules, reload } = useSite()
  const m = MODULES.find((x) => x.key === key)
  if (!m) return <Navigate to="/admin" replace />
  const group = MODULE_GROUPS.find((g) => g.id === m.group)
  const built = BUILT.has(m.key)
  const on = built ? modules[m.key] !== false : Boolean(modules[m.key])
  const link = LINKS[m.key]

  async function toggle(v) {
    await supabase.from('modules').upsert({ key: m.key, enabled: v, updated_at: new Date().toISOString() })
    reload()
  }

  return (
    <>
      <p className="muted" style={{ margin: 0 }}>{group?.label}</p>
      <h2>
        {m.name}
        {m.free && <span className="tag free">ফ্রি</span>}
        {built ? <span className="tag built">তৈরি আছে</span> : <span className="tag">ধাপ {m.step}</span>}
      </h2>
      <div className="card form">
        <p style={{ margin: 0 }}>{m.desc}</p>
        <div className="mod-row" style={{ borderBottom: 0 }}>
          <b>এই মডিউল {on ? 'চালু' : 'বন্ধ'} আছে</b>
          <Switch checked={on} onChange={toggle} />
        </div>
        {built ? (
          <div className="alert ok">এই অংশ ইতিমধ্যে তৈরি। নিচের বাটন থেকে খুলুন।</div>
        ) : (
          <div className="alert info">
            এই মডিউল ধাপ {m.step} এ তৈরি হবে। সুইচ চালু রাখলে তৈরি হওয়ার পর নিজে থেকেই কাজ শুরু করবে, নতুন করে কিছু করতে হবে না।
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {link && <Link className="btn" to={link[0]}>{link[1]}</Link>}
          <Link className="btn outline" to="/admin/modules">সব মডিউল</Link>
        </div>
      </div>
    </>
  )
}
