import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { DEFAULT_SETTINGS, useSite } from '../../lib/store'
import { ImageUpload, Switch } from '../../components/Ui'

export default function Settings() {
  const { settings, reload } = useSite()
  const [v, setV] = useState(settings)
  const [state, setState] = useState('')
  useEffect(() => setV(settings), [settings])
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value })

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
      <h2>প্রতিষ্ঠানের তথ্য ও থিম</h2>
      <p className="muted">নাম ও ঠিকানা তিন ভাষায় বদলাতে "সাইটের লেখা" মেনুতে যান।</p>
      <form className="form" onSubmit={save}>
        <div className="card form">
          <h3>লোগো ও ছবি</h3>
          <div className="field"><label>লোগো</label><ImageUpload folder="brand" value={v.logo_url} onChange={(x) => setV({ ...v, logo_url: x || DEFAULT_SETTINGS.logo_url })} /></div>
          <div className="field"><label>হোম পেইজের ব্যানার ছবি (ঐচ্ছিক)</label><ImageUpload folder="brand" value={v.hero_image} onChange={(x) => setV({ ...v, hero_image: x })} /></div>
        </div>
        <div className="card form">
          <h3>হোম পেইজ</h3>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Switch checked={v.apply_open !== false} onChange={(x) => setV({ ...v, apply_open: x })} /> "ভর্তির আবেদন চলছে" বার দেখান
          </label>
        </div>
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
          <div className="field">
            <label>গুগল ম্যাপ এম্বেড লিংক</label>
            <input placeholder="https://www.google.com/maps/embed?pb=…" value={v.map_embed || ''} onChange={set('map_embed')} />
            <span className="muted" style={{ fontSize: '.85rem' }}>Google Maps → Share → Embed a map থেকে শুধু src="…" এর ভেতরের লিংকটি বসান।</span>
          </div>
        </div>
        <div className="card form">
          <h3>রং (থিম)</h3>
          <div className="row2">
            <div className="field"><label>প্রধান রং (সবুজ)</label><input type="color" value={v.color_primary} onChange={set('color_primary')} /></div>
            <div className="field"><label>হাইলাইট রং (গোলাপি)</label><input type="color" value={v.color_secondary} onChange={set('color_secondary')} /></div>
            <div className="field"><label>শিরোনামের রং (নীল)</label><input type="color" value={v.color_accent} onChange={set('color_accent')} /></div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button className="btn">সংরক্ষণ করুন</button>
          <span className="muted">{state}</span>
        </div>
      </form>
    </>
  )
}
