import { useState } from 'react'
import { useAuth, useSite } from '../../lib/store'
import { RECEIPT_DEFAULTS, useConfig } from '../../lib/config'
import { Switch } from '../../components/Ui'
import { ReceiptBody, todayStr } from './fin'

const BLOCKS = [['title', 'শিরোনাম'], ['no', 'রসিদ নং'], ['date', 'তারিখ'], ['meta', 'নাম/মাধ্যম ইত্যাদি'], ['items', 'বিবরণ ও টাকা (মোটসহ)'], ['by', 'Printed by']]
const TITLES = [['fee', 'ফি / বেতন আদায়'], ['donation', 'দান গ্রহণ'], ['income', 'অন্যান্য আয়'], ['salary', 'বেতন স্লিপ (শিক্ষক-কর্মচারী)']]
const LABELS = [['no', 'নং'], ['date', 'তারিখ'], ['desc', 'বিবরণ (কলাম)'], ['amount', 'টাকা (কলাম)'], ['total', 'মোট'], ['receiver', 'গ্রহীতার স্বাক্ষর'], ['authority', 'কর্তৃপক্ষের স্বাক্ষর'], ['printed_by', '“Printed by” লেখা']]

export default function ReceiptSettings() {
  const { settings, t } = useSite()
  const { profile } = useAuth()
  const { cfg, setCfg, save, ready } = useConfig('receipt', RECEIPT_DEFAULTS)
  const [mode, setMode] = useState('online')
  const [kind, setKind] = useState('fee')
  const [msg, setMsg] = useState('')
  const up = (path, v) => setCfg((c) => {
    const n = JSON.parse(JSON.stringify(c))
    let o = n
    path.slice(0, -1).forEach((k) => { o = o[k] })
    o[path[path.length - 1]] = v
    return n
  })
  const num = (v) => (v === '' ? 0 : Number(v))
  async function doSave() {
    const e = await save(cfg)
    setMsg(e ? `ত্রুটি: ${e.message}` : 'সংরক্ষিত হয়েছে')
  }
  const hdr = { logo: settings.logo_url, name: t('site.name') || 'সাবিলুস সালাম মাদরাসা', addr: `${t('site.address')}${settings.phone ? ` · ${settings.phone}` : ''}` }
  const sample = { rows: [['মাসিক বেতন — জানুয়ারি', 1500], ['পরীক্ষা ফি', 300]], total: 1800, meta: [['ছাত্র', 'নমুনা ছাত্র (260001)'], ['মাধ্যম', 'নগদ']], no: 'R-000123', date: todayStr(), by: profile?.full_name || 'অ্যাডমিন', hdr }
  if (!ready) return <p>লোড হচ্ছে…</p>
  return (
    <>
      <h2>রসিদের লেখা ও ডিজাইন</h2>
      <p className="muted">শিরোনাম রসিদের ধরন অনুযায়ী নিজে বসে (ফি আদায়, দান গ্রহণ ইত্যাদি)। এখানে লেখা, মার্জিন ও প্যাডে প্রিন্টের অবস্থান বদলাতে পারবেন। কোন মোড চালু থাকবে তা “মডিউল সুইচ” থেকে ঠিক হয়।</p>
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div>
          <div className="card form" style={{ marginBottom: 14 }}>
            <h3>সাধারণ</h3>
            <div className="grid g3">
              <div className="field"><label>চারদিকের মার্জিন (ইঞ্চি)</label><input type="number" step="0.05" min="0" value={cfg.margin_in} onChange={(e) => up(['margin_in'], num(e.target.value))} /></div>
              <div className="field"><label>লেখার মাপ (pt)</label><input type="number" step="0.5" min="7" value={cfg.font_pt} onChange={(e) => up(['font_pt'], num(e.target.value))} /></div>
              <label className="toggle-row"><Switch checked={cfg.show_printed_by} onChange={(v) => up(['show_printed_by'], v)} /><span>Printed by দেখান</span></label>
            </div>
            <div className="field"><label>সব রসিদের নিচের সাধারণ লেখা (ঐচ্ছিক)</label><input value={cfg.note} onChange={(e) => up(['note'], e.target.value)} placeholder="যেমন: আদায়কৃত অর্থ ফেরতযোগ্য নয়" /></div>
          </div>
          <div className="card form" style={{ marginBottom: 14 }}>
            <h3>শিরোনাম (রসিদের ধরন অনুযায়ী)</h3>
            {TITLES.map(([k, l]) => <div className="field" key={k}><label>{l}</label><input value={cfg.titles[k]} onChange={(e) => up(['titles', k], e.target.value)} /></div>)}
          </div>
          <div className="card form" style={{ marginBottom: 14 }}>
            <h3>অন্যান্য লেখা</h3>
            <div className="grid g2">{LABELS.map(([k, l]) => <div className="field" key={k}><label>{l}</label><input value={cfg.labels[k]} onChange={(e) => up(['labels', k], e.target.value)} /></div>)}</div>
          </div>
          <div className="card form">
            <h3>প্যাডে প্রিন্টের অবস্থান (মিমি)</h3>
            <p className="muted" style={{ margin: 0 }}>মার্জিনের ভেতরের বাঁ-উপরের কোণ থেকে মাপা হয়। প্রথমবার একটা সাদা কাগজে প্রিন্ট করে প্যাডের উপর ধরে মিলিয়ে নিন।</p>
            <div className="grid g2">
              <div className="field"><label>সব লেখা ডানে সরান (মিমি)</label><input type="number" step="0.5" value={cfg.pad.dx} onChange={(e) => up(['pad', 'dx'], num(e.target.value))} /></div>
              <div className="field"><label>সব লেখা নিচে সরান (মিমি)</label><input type="number" step="0.5" value={cfg.pad.dy} onChange={(e) => up(['pad', 'dy'], num(e.target.value))} /></div>
            </div>
            <div className="table-wrap"><table>
              <thead><tr><th>অংশ</th><th>দেখান</th><th>বাঁ থেকে</th><th>উপর থেকে</th><th>প্রস্থ</th></tr></thead>
              <tbody>
                {BLOCKS.map(([k, l]) => (
                  <tr key={k}>
                    <td>{l}</td>
                    <td><Switch checked={cfg.pad.blocks[k].show} onChange={(v) => up(['pad', 'blocks', k, 'show'], v)} /></td>
                    {['x', 'y', 'w'].map((f) => <td key={f}><input type="number" step="0.5" style={{ width: 80 }} value={cfg.pad.blocks[k][f]} onChange={(e) => up(['pad', 'blocks', k, f], num(e.target.value))} /></td>)}
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
          <div className="row-actions" style={{ marginTop: 14 }}>
            <button className="btn" onClick={doSave}>সংরক্ষণ</button>
            <button className="btn outline" onClick={() => { setCfg(RECEIPT_DEFAULTS); setMsg('ডিফল্ট বসানো হয়েছে, সংরক্ষণ চাপলে স্থায়ী হবে') }}>ডিফল্টে ফিরুন</button>
          </div>
          {msg && <div className="alert info" style={{ marginTop: 10 }}>{msg}</div>}
        </div>
        <div>
          <div className="tabs">
            <button className={mode === 'online' ? 'on' : ''} onClick={() => setMode('online')}>অনলাইন রসিদ</button>
            <button className={mode === 'pad' ? 'on' : ''} onClick={() => setMode('pad')}>প্যাডে প্রিন্ট</button>
          </div>
          <div className="tabs">
            {TITLES.map(([k, l]) => <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{l}</button>)}
          </div>
          <div className={mode === 'pad' ? 'pad-wrap' : 'card'}>
            <ReceiptBody cfg={cfg} mode={mode} kind={kind} {...sample} />
          </div>
        </div>
      </div>
    </>
  )
}
