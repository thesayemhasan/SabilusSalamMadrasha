import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Select, Switch } from '../../components/Ui'
import { fill, normPhone, segments } from '../../lib/sms'
import { printedAt } from './fin'

const bn = (n) => Number(n || 0).toLocaleString('bn-BD')
const TOKENS = { absent: ['{name} = শিক্ষার্থীর নাম', '{date} = হাজিরার তারিখ'], dues: ['{name} = শিক্ষার্থীর নাম', '{amount} = মোট বকেয়া (টাকা)'] }
const SAMPLE = { absent: { name: 'আব্দুল্লাহ', date: '২৯ অক্টো ২০২৬' }, dues: { name: 'আব্দুল্লাহ', amount: '১,২০০' } }
const STATUS = { sent: 'সফল', failed: 'ব্যর্থ', skipped: 'বাদ' }

async function call(body) {
  const { data, error } = await supabase.functions.invoke('send-sms', { body })
  if (error) { let m = error.message; try { const j = await error.context.json(); if (j?.error) m = j.error } catch { /* ignore */ } throw new Error(m) }
  if (data?.error) throw new Error(data.error)
  return data
}

function Template({ t, onSaved }) {
  const [v, setV] = useState(t)
  const [msg, setMsg] = useState('')
  const sample = fill(v.body_bn, SAMPLE[t.key] || {})
  async function save() {
    setMsg('')
    if (!v.body_bn.trim()) return setMsg('বার্তা ফাঁকা রাখা যাবে না।')
    const { error } = await supabase.from('sms_templates').update({ title: v.title, body_bn: v.body_bn, enabled: v.enabled, updated_at: new Date().toISOString() }).eq('key', t.key)
    setMsg(error ? error.message : 'সংরক্ষণ হয়েছে।'); if (!error) onSaved()
  }
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="toolbar" style={{ marginBottom: 6 }}>
        <h3 style={{ margin: 0, flex: '1 1 auto' }}>{t.title}</h3>
        <span className="muted" style={{ fontSize: '.85rem' }}>চালু</span><Switch checked={v.enabled} onChange={(x) => setV({ ...v, enabled: x })} />
      </div>
      <div className="field"><label>বার্তার লেখা (মাস্কিং SMS বাংলায় হতে হয়)</label><textarea rows={3} value={v.body_bn} onChange={(e) => setV({ ...v, body_bn: e.target.value })} /></div>
      <p className="muted" style={{ margin: '4px 0' }}>ব্যবহারযোগ্য: {(TOKENS[t.key] || []).join(' · ')}</p>
      <p style={{ margin: '4px 0' }}>নমুনা: <b>{sample}</b></p>
      <p className="muted" style={{ margin: '4px 0' }}>{bn([...sample].length)} অক্ষর, প্রায় {bn(segments(sample))} টি SMS (বাংলায় ৭০ অক্ষরে ১টি)। বার্তা ছোট রাখলে খরচ কম।</p>
      <button className="btn small" onClick={save}>সংরক্ষণ</button> {msg && <span className="muted" style={{ marginInlineStart: 8 }}>{msg}</span>}
    </div>
  )
}

export default function Sms() {
  const [tpls, setTpls] = useState([])
  const [rate, setRate] = useState('0.5')
  const [log, setLog] = useState([])
  const [stu, setStu] = useState({})
  const [filter, setFilter] = useState('')
  const [bal, setBal] = useState('')
  const [tPhone, setTPhone] = useState('')
  const [tMsg, setTMsg] = useState('')
  const [info, setInfo] = useState('')
  const [rateMsg, setRateMsg] = useState('')
  const [provider, setProvider] = useState('bulksmsbd')
  const [pvMsg, setPvMsg] = useState('')

  const load = useCallback(async () => {
    const { data: t } = await supabase.from('sms_templates').select('*').order('key')
    setTpls(t || [])
    const { data: c } = await supabase.from('sms_config').select('*').eq('key', 'rate').maybeSingle()
    if (c) setRate(String(c.value))
    const { data: pv } = await supabase.from('sms_config').select('*').eq('key', 'provider').maybeSingle()
    if (pv) setProvider(String(pv.value).includes('custom') ? 'custom' : 'bulksmsbd')
    const { data: l } = await supabase.from('sms_log').select('*').order('created_at', { ascending: false }).limit(200)
    setLog(l || [])
    const ids = [...new Set((l || []).map((x) => x.student_id).filter(Boolean))]
    if (ids.length) { const { data: s } = await supabase.from('students').select('id,name_bn,student_no').in('id', ids.slice(0, 200)); setStu(Object.fromEntries((s || []).map((x) => [x.id, x]))) }
  }, [])
  useEffect(() => { load() }, [load])

  async function balance() { setBal('দেখা হচ্ছে…'); try { setBal((await call({ action: 'balance' })).balance) } catch (e) { setBal(`ত্রুটি: ${e.message}`) } }
  async function test() {
    setInfo('')
    if (!normPhone(tPhone)) return setInfo('মোবাইল নম্বর ঠিক নয় (যেমন 01712345678)।')
    if (!tMsg.trim()) return setInfo('বার্তা লিখুন।')
    setInfo('পাঠানো হচ্ছে…')
    try { const r = await call({ action: 'test', phone: tPhone, message: tMsg }); setInfo(r.ok ? 'পাঠানো হয়েছে। মোবাইলে এসেছে কিনা দেখুন।' : `ব্যর্থ: ${r.detail}`); load() } catch (e) { setInfo(`ত্রুটি: ${e.message}`) }
  }
  async function saveRate() {
    const n = Number(rate)
    if (!(n > 0)) return setRateMsg('সঠিক সংখ্যা দিন।')
    const { error } = await supabase.from('sms_config').upsert({ key: 'rate', value: n })
    setRateMsg(error ? error.message : 'সংরক্ষণ হয়েছে।')
  }
  async function saveProvider(v) {
    setProvider(v); setPvMsg('')
    const { error } = await supabase.from('sms_config').upsert({ key: 'provider', value: v })
    setPvMsg(error ? error.message : 'সংরক্ষণ হয়েছে।')
  }
  const shown = log.filter((r) => !filter || r.status === filter)

  return (
    <>
      <div className="toolbar"><h2 style={{ margin: 0, flex: '1 1 auto' }}>এসএমএস</h2></div>
      <p className="muted" style={{ marginTop: -6 }}>অভিভাবকের মোবাইলে অনুপস্থিতি ও বকেয়ার খবর। পাঠানোর বোতাম আছে <b>হাজিরা</b> পাতায় (অনুপস্থিতদের জন্য) এবং <b>রিপোর্ট → বকেয়া</b> তালিকায়। প্রতিবার পাঠানোর আগে সংখ্যা, নমুনা ও খরচ দেখিয়ে আপনার অনুমতি নেওয়া হয়।</p>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="toolbar">
          <b>কোন সেবাদাতা দিয়ে পাঠাবেন:</b>
          <div style={{ minWidth: 280 }}><Select value={provider} onChange={saveProvider} options={[['bulksmsbd', 'BulkSMSBD'], ['custom', 'অন্য সেবাদাতা (যেকোনো HTTP API)']]} /></div>
          {pvMsg && <span className="muted">{pvMsg}</span>}
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>সেবাদাতা বদলাতে চাইলে এখানে বদলান। প্রতিটির চাবি Supabase-এর Secrets-এ আগে থেকে বসানো থাকতে হবে (নিচের ধাপ দেখুন)। বদলানোর পর "টেস্ট SMS" দিয়ে যাচাই করুন।</p>
      </div>

      <details className="card" style={{ marginBottom: 14 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>প্রথমবার চালুর ধাপ (সেবাদাতার চাবি বসানো)</summary>
        <ol style={{ lineHeight: 1.9 }}>
          <li>SMS সেবাদাতার (যেমন BulkSMSBD) অ্যাকাউন্ট থেকে <b>API Key</b> ও অনুমোদিত <b>Sender ID</b> (মাস্কিং নাম) নিন। সেখানে "IP White List" বন্ধ করে নিন, কারণ Supabase-এর IP বদলায়।</li>
          <li>Supabase → Edge Functions → <b>send-sms</b> নামে ফাংশন বানিয়ে দেওয়া কোড বসান।</li>
          <li>Supabase → Edge Functions → Secrets-এ যোগ করুন: <code>BULKSMSBD_API_KEY</code> ও <code>BULKSMSBD_SENDER_ID</code>।</li>
          <li>নিচে "ব্যালেন্স দেখুন" ও "টেস্ট SMS" দিয়ে যাচাই করুন। চাবি কখনো ব্রাউজারে বা GitHub-এ রাখবেন না।</li>
        </ol>
        <p style={{ marginBottom: 4 }}><b>অন্য সেবাদাতা হলে</b> Supabase → Edge Functions → Secrets-এ দিন:</p>
        <ul style={{ lineHeight: 1.8, marginTop: 0 }}>
          <li><code>SMS_CUSTOM_URL</code>: সেবাদাতার ডকুমেন্টের পাঠানোর ঠিকানা, নম্বর/বার্তা/সেন্ডারের জায়গায় <code>{'{number}'}</code> <code>{'{message}'}</code> <code>{'{sender}'}</code> লিখে (চাবিও এর ভেতরেই থাকবে)। যেমন: <code>https://example.com/send?key=XXXX&to={'{number}'}&from={'{sender}'}&text={'{message}'}</code></li>
          <li><code>SMS_CUSTOM_SENDER</code> (সেন্ডার নাম), <code>SMS_CUSTOM_METHOD</code> (GET বা POST), <code>SMS_CUSTOM_BODY</code> ও <code>SMS_CUSTOM_CONTENT_TYPE</code> (POST হলে)</li>
          <li><code>SMS_CUSTOM_OK</code>: সফল হলে উত্তরে যে লেখা আসে (না দিলে HTTP সফল হলেই সফল ধরা হবে, তাই দেওয়াই ভালো)</li>
          <li><code>SMS_CUSTOM_NUMBER</code>: <code>880</code> (8801712345678) বা <code>local</code> (01712345678) বা <code>plus</code> (+880…)</li>
        </ul>
      </details>

      <div className="card" style={{ marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>যাচাই</h3>
        <div className="toolbar">
          <button className="btn outline" onClick={balance}>সেবাদাতার ব্যালেন্স দেখুন</button>
          {bal && <span>{bal}</span>}
        </div>
        <div className="toolbar" style={{ marginTop: 8 }}>
          <input style={{ maxWidth: 190 }} placeholder="নিজের মোবাইল নম্বর" value={tPhone} onChange={(e) => setTPhone(e.target.value)} />
          <input style={{ flex: '1 1 240px' }} placeholder="টেস্ট বার্তা (বাংলায় লিখুন)" value={tMsg} onChange={(e) => setTMsg(e.target.value)} />
          <button className="btn" onClick={test}>টেস্ট SMS পাঠান</button>
        </div>
        {info && <p className="muted" style={{ marginBottom: 0 }}>{info}</p>}
        <div className="toolbar" style={{ marginTop: 10 }}>
          <span>প্রতি SMS-এর দাম (টাকা, খরচের হিসাবের জন্য):</span>
          <input style={{ maxWidth: 110 }} value={rate} onChange={(e) => setRate(e.target.value)} />
          <button className="btn small" onClick={saveRate}>সংরক্ষণ</button>{rateMsg && <span className="muted">{rateMsg}</span>}
        </div>
      </div>

      {tpls.map((t) => <Template key={t.key + t.updated_at} t={t} onSaved={load} />)}

      <div className="card table-wrap">
        <div className="toolbar" style={{ marginBottom: 8 }}>
          <h3 style={{ margin: 0, flex: '1 1 auto' }}>পাঠানোর রেকর্ড (শেষ ২০০টি)</h3>
          {['', 'sent', 'failed', 'skipped'].map((s) => <button key={s} className={`btn small ${filter === s ? '' : 'outline'}`} onClick={() => setFilter(s)}>{s ? STATUS[s] : 'সব'}</button>)}
          <button className="btn small outline" onClick={load}>নতুন করে আনুন</button>
        </div>
        <table>
          <thead><tr><th>সময়</th><th>ধরন</th><th>শিক্ষার্থী</th><th>নম্বর</th><th>অবস্থা</th><th>বার্তা / কারণ</th></tr></thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan="6" className="muted">কোনো রেকর্ড নেই।</td></tr>}
            {shown.map((r) => (
              <tr key={r.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleString('bn-BD', { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td>{{ absent: 'অনুপস্থিতি', dues: 'বকেয়া', test: 'টেস্ট' }[r.kind] || r.kind}</td>
                <td>{stu[r.student_id]?.name_bn || '—'}</td><td>{r.phone || '—'}</td>
                <td style={{ color: r.status === 'failed' ? 'var(--secondary)' : undefined }}>{STATUS[r.status]}</td>
                <td style={{ fontSize: '.85rem' }}>{r.status === 'sent' ? r.message : (r.detail || r.message)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: '.8rem' }}>{printedAt()}</p>
    </>
  )
}
