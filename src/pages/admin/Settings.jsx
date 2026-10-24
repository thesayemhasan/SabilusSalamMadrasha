import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { DEFAULT_SETTINGS, useSite } from '../../lib/store'
import { DEFAULT_MENU, SOCIAL_TYPES, menuOf } from '../../lib/util'
import { ImageUpload, Select, Switch } from '../../components/Ui'
import Icon from '../../components/Icon'
import { TextRow as Row } from './TextsEditor'

function SocialList({ value, onChange }) {
  const list = Array.isArray(value) ? value : []
  const upd = (i, p) => onChange(list.map((x, j) => (j === i ? { ...x, ...p } : x)))
  return (
    <div className="items-ed">
      {list.map((x, i) => (
        <div className="soc-row" key={i}>
          <div className="soc-type"><Select value={x.type || 'facebook'} onChange={(v) => upd(i, { type: v })} options={SOCIAL_TYPES} /></div>
          <input placeholder="লিংক / নম্বর / ইমেইল" value={x.url || ''} onChange={(e) => upd(i, { url: e.target.value })} />
          <button type="button" className="btn small danger" aria-label="remove" onClick={() => onChange(list.filter((_, j) => j !== i))}><Icon name="trash" size={15} cls="cur" /></button>
        </div>
      ))}
      <button type="button" className="btn small outline" onClick={() => onChange([...list, { type: 'facebook', url: '' }])}><Icon name="plus" size={15} cls="cur" /> আইকন যোগ করুন</button>
    </div>
  )
}

function MenuEditor({ value, onChange }) {
  const list = value || DEFAULT_MENU
  const upd = (i, p) => onChange(list.map((x, j) => (j === i ? { ...x, ...p } : x)))
  const move = (i, d) => { const a = [...list]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; onChange(a) }
  return (
    <div className="items-ed">
      {list.map((m, i) => (
        <div className="menu-row" key={i}>
          <Switch checked={m.show !== false} onChange={(v) => upd(i, { show: v })} />
          <input placeholder="নাম (বাংলা)" value={m.label_bn || ''} onChange={(e) => upd(i, { label_bn: e.target.value })} />
          <input placeholder="Name (English)" value={m.label_en || ''} onChange={(e) => upd(i, { label_en: e.target.value })} />
          <input placeholder="/about অথবা https://…" value={m.to || ''} onChange={(e) => upd(i, { to: e.target.value })} disabled={m.to === '/'} />
          <span className="row-actions">
            <button type="button" className="btn small outline" aria-label="up" onClick={() => move(i, -1)}><Icon name="chevup" size={14} cls="cur" /></button>
            <button type="button" className="btn small outline" aria-label="down" onClick={() => move(i, 1)}><Icon name="chevdown" size={14} cls="cur" /></button>
            {!m.key && <button type="button" className="btn small danger" aria-label="remove" onClick={() => onChange(list.filter((_, j) => j !== i))}><Icon name="trash" size={14} cls="cur" /></button>}
          </span>
        </div>
      ))}
      <button type="button" className="btn small outline" onClick={() => onChange([...list, { to: '', label_bn: '', label_en: '', show: true }])}><Icon name="plus" size={15} cls="cur" /> নতুন মেনু যোগ করুন</button>
      <p className="muted" style={{ fontSize: '.85rem', margin: 0 }}>নাম ফাঁকা রাখলে ডিফল্ট নাম দেখাবে। "হোম" এর লিংক বদলানো যায় না।</p>
    </div>
  )
}

const TABS = [['inst', 'প্রতিষ্ঠান ও রং'], ['header', 'হেডার ও মেনু'], ['home', 'হোম পেইজ'], ['footer', 'ফুটার ও ডেভেলপার'], ['contact', 'যোগাযোগ ও সোশ্যাল'], ['account', 'অ্যাকাউন্ট ও ভর্তি']]

export default function Settings() {
  const { settings, reload } = useSite()
  const [v, setV] = useState(settings)
  const [tab, setTab] = useState('inst')
  const [state, setState] = useState('')
  useEffect(() => setV(settings), [settings])
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value })
  const put = (k, x) => setV({ ...v, [k]: x })
  const sw = (k, label, hint) => (
    <label className="toggle-row">
      <Switch checked={v[k] !== false && v[k] !== undefined ? true : v[k] === true} onChange={(x) => put(k, x)} />
      <span>{label}{hint && <small className="muted"> — {hint}</small>}</span>
    </label>
  )

  async function save(e) {
    e.preventDefault()
    setState('সংরক্ষণ হচ্ছে…')
    const { error } = await supabase.from('site_settings').upsert({ key: 'institute', value: v, updated_at: new Date().toISOString() })
    if (error) return setState('ত্রুটি: ' + error.message)
    await reload()
    setState('সংরক্ষিত হয়েছে')
  }

  return (
    <>
      <h2>সেটিংস</h2>
      <p className="muted">সাইটের লেখা (নাম, ঠিকানা, শিরোনাম ইত্যাদি) বদলাতে "সাইটের লেখা" মেনুতে যান। এখানে লেখার ঘরগুলো সরাসরি সম্পাদনার সুযোগও আছে।</p>
      <div className="seg wrap">
        {TABS.map(([k, l]) => <button key={k} type="button" className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      <form className="form" onSubmit={save}>
        {tab === 'inst' && (
          <>
            <div className="card form">
              <h3>লোগো ও ছবি</h3>
              <div className="field"><label>লোগো (ক্লিক করলে সাইট রিফ্রেশ হয়)</label><ImageUpload folder="brand" value={v.logo_url} onChange={(x) => put('logo_url', x || DEFAULT_SETTINGS.logo_url)} /></div>
              <div className="field"><label>হোম পেইজের প্রথম (ব্র্যান্ড) স্লাইডের পেছনের ছবি (ঐচ্ছিক)</label><ImageUpload folder="brand" value={v.hero_image} onChange={(x) => put('hero_image', x)} /></div>
            </div>
            <div className="card form">
              <h3>রং (থিম)</h3>
              <div className="row2">
                <div className="field"><label>প্রধান রং (সবুজ)</label><input type="color" value={v.color_primary} onChange={set('color_primary')} /></div>
                <div className="field"><label>হাইলাইট রং (গোলাপি)</label><input type="color" value={v.color_secondary} onChange={set('color_secondary')} /></div>
                <div className="field"><label>শিরোনামের রং (নীল)</label><input type="color" value={v.color_accent} onChange={set('color_accent')} /></div>
              </div>
            </div>
          </>
        )}

        {tab === 'header' && (
          <>
            <div className="card form">
              <h3>হেডারের উপরের এক লাইন</h3>
              <p className="muted" style={{ margin: 0 }}>নিচের লেখা ফাঁকা রাখলে ফোন নম্বর দেখাবে। কিছু লিখলে সেটাই দেখাবে (যেমন: ভর্তি চলছে — ০১৭XXXXXXXX)।</p>
              <Row k="header.text" />
              {sw('header_show_signup', 'হেডারে "সাইন আপ" বোতাম দেখান')}
            </div>
            <div className="card form">
              <h3>মেনু</h3>
              <p className="muted" style={{ margin: 0 }}>চালু/বন্ধ করুন, ক্রম বদলান, নাম বদলান বা নতুন মেনু (ভেতরের বা বাইরের লিংক) যোগ করুন। এই মেনু হেডার ও ফুটার দুই জায়গাতেই কাজ করে।</p>
              <MenuEditor value={v.menu} onChange={(x) => put('menu', x)} />
              {v.menu && <button type="button" className="btn small outline" onClick={() => put('menu', null)}>ডিফল্ট মেনুতে ফিরুন</button>}
            </div>
          </>
        )}

        {tab === 'home' && (
          <>
            <div className="card form">
              <h3>স্লাইডের উপরের "ভর্তি চলছে" বার</h3>
              {sw('apply_open', 'বারটি দেখান')}
              <div className="field"><label>বোতামের লিংক</label><input value={v.apply_link || ''} onChange={set('apply_link')} placeholder="/admission" /></div>
              <Row k="apply.title" /><Row k="apply.text" /><Row k="apply.btn" />
              <p className="muted" style={{ margin: 0 }}>এর বাইরে যেকোনো বিজ্ঞপ্তি বার দিতে "হোম সেকশন" মেনুতে ধরন "ঘোষণা বার" বেছে নিন।</p>
            </div>
            <div className="card form">
              <h3>হোম স্লাইড</h3>
              <div className="field">
                <label>স্লাইডের ছবির উৎস</label>
                <div className="seg">
                  <button type="button" className={v.hero_mode !== 'gallery' ? 'on' : ''} onClick={() => put('hero_mode', 'custom')}>নিজস্ব স্লাইড ছবি</button>
                  <button type="button" className={v.hero_mode === 'gallery' ? 'on' : ''} onClick={() => put('hero_mode', 'gallery')}>গ্যালারির ছবি</button>
                </div>
                <span className="muted" style={{ fontSize: '.85rem' }}>নিজস্ব ছবি যোগ করতে "হোম স্লাইড" মেনুতে যান (১২০০×৬০০ পিক্সেল)।</span>
              </div>
              {sw('hero_brand_slide', 'প্রথমে মাদরাসার পরিচিতি স্লাইড (লোগো ও লেখা) দেখান')}
            </div>
            <div className="card form">
              <h3>জরুরি নোটিশ বোর্ড</h3>
              {sw('urgent_show', 'স্লাইডের নিচে জরুরি নোটিশ বোর্ড দেখান', 'নোটিশ মেনু থেকে নোটিশ যোগ করুন')}
              <div className="field"><label>কতগুলো নোটিশ ঘুরে ঘুরে দেখাবে</label><input type="number" min="1" max="20" value={v.urgent_count ?? 6} onChange={(e) => put('urgent_count', Number(e.target.value))} /></div>
              <Row k="urgent.title" />
            </div>
          </>
        )}

        {tab === 'footer' && (
          <>
            <div className="card form">
              <h3>ফুটারের লেখা</h3>
              <Row k="footer.about" /><Row k="footer.rights" />
            </div>
            <div className="card form">
              <h3>ডেভেলপারের পরিচিতি</h3>
              {sw('dev_show', 'ফুটারে ডেভেলপারের পরিচিতি দেখান', 'নাম না দিলে দেখাবে না')}
              <div className="field"><label>ছোট ছবি (ঐচ্ছিক)</label><ImageUpload folder="brand" value={v.dev_photo} onChange={(x) => put('dev_photo', x)} /></div>
              <div className="row2">
                <div className="field"><label>নাম</label><input value={v.dev_name || ''} onChange={set('dev_name')} /></div>
                <div className="field"><label>পদবি / ছোট পরিচয় (ঐচ্ছিক)</label><input value={v.dev_role || ''} onChange={set('dev_role')} placeholder="Full-stack developer" /></div>
              </div>
              <div className="field"><label>সোশ্যাল আইকন</label><SocialList value={v.dev_socials} onChange={(x) => put('dev_socials', x)} /></div>
              <Row k="footer.dev" />
            </div>
          </>
        )}

        {tab === 'contact' && (
          <div className="card form">
            <h3>যোগাযোগ</h3>
            <div className="row2">
              <div className="field"><label>ফোন নম্বর</label><input value={v.phone || ''} onChange={set('phone')} /></div>
              <div className="field"><label>হোয়াটসঅ্যাপ নম্বর</label><input value={v.whatsapp || ''} onChange={set('whatsapp')} /></div>
            </div>
            <div className="field"><label>ইমেইল</label><input type="email" value={v.email || ''} onChange={set('email')} /></div>
            <div className="row2">
              <div className="field"><label>ফেসবুক পেইজ লিংক</label><input value={v.facebook || ''} onChange={set('facebook')} /></div>
              <div className="field"><label>ইউটিউব চ্যানেল লিংক</label><input value={v.youtube || ''} onChange={set('youtube')} /></div>
            </div>
            <div className="field"><label>আরও সোশ্যাল আইকন (ফুটারে দেখাবে)</label><SocialList value={v.socials} onChange={(x) => put('socials', x)} /></div>
            <div className="field">
              <label>গুগল ম্যাপ এম্বেড লিংক</label>
              <input placeholder="https://www.google.com/maps/embed?pb=…" value={v.map_embed || ''} onChange={set('map_embed')} />
              <span className="muted" style={{ fontSize: '.85rem' }}>Google Maps → Share → Embed a map থেকে শুধু src="…" এর ভেতরের লিংকটি বসান।</span>
            </div>
          </div>
        )}

        {tab === 'account' && (
          <>
            <div className="card form">
              <h3>গ্রাহকের সাইন আপ</h3>
              {sw('signup_enabled', 'ওয়েবসাইটে নতুন সাইন আপ চালু রাখুন', 'সাইন আপ করা কেউ অ্যাডমিন অনুমতি না দেওয়া পর্যন্ত কোনো ম্যানেজমেন্ট অ্যাক্সেস পায় না')}
            </div>
            <div className="card form">
              <h3>ভর্তি ফরম</h3>
              {sw('admission_agree', 'আবেদনের আগে "নীতিমালা মেনে নিলাম" টিক বাধ্যতামূলক করুন')}
              <p className="muted" style={{ margin: 0 }}>নীতিমালার লেখা বদলাতে "সাইটের লেখা → ভর্তি ও আবেদন ফরম" এ যান।</p>
            </div>
          </>
        )}

        <div className="save-bar">
          <button className="btn">সংরক্ষণ করুন</button>
          <span className="muted">{state}</span>
        </div>
      </form>
    </>
  )
}
