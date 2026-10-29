import { useState } from 'react'
import JSZip from 'jszip'
import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/db'
import { useAuth } from '../../lib/store'
import { saveBlob } from '../../lib/xlsx'
import Icon from '../../components/Icon'

// সব টেবিল: [নাম, বাংলা পরিচয়, সাজানোর কলাম]
const TABLES = [
  ['profiles', 'ব্যবহারকারী', 'id'], ['features', 'ফিচার তালিকা', 'key'], ['site_texts', 'সাইটের লেখা', 'key'], ['site_settings', 'সাইটের সেটিংস', 'key'], ['modules', 'মডিউল সুইচ', 'key'], ['integrations', 'মেশিন ও বাইরের সেবা', 'key'],
  ['notices', 'নোটিশ', 'id'], ['events', 'ইভেন্ট', 'id'], ['gallery', 'গ্যালারি', 'id'], ['public_teachers', 'শিক্ষকবৃন্দ (পাবলিক)', 'id'], ['departments', 'বিভাগ', 'id'], ['hero_slides', 'হোম স্লাইড', 'id'], ['home_blocks', 'হোম সেকশন', 'id'],
  ['admission_applications', 'ভর্তির আবেদন', 'id'], ['contact_messages', 'যোগাযোগের বার্তা', 'id'], ['admission_fields', 'ভর্তি ফরমের ঘর', 'id'], ['lookups', 'তালিকা (আবাসিক ধরন, সময় ইত্যাদি)', 'id'],
  ['academic_years', 'শিক্ষাবর্ষ', 'id'], ['classes', 'শ্রেণি/হালকা', 'id'], ['students', 'ছাত্র-ছাত্রী', 'id'], ['enrollments', 'বর্ষে ভর্তি', 'id'], ['staff', 'শিক্ষক-কর্মচারী', 'id'],
  ['attendance', 'হাজিরা', 'id'], ['device_punches', 'মেশিনের পাঞ্চ', 'id'],
  ['fee_heads', 'ফি-র ধরন', 'id'], ['fee_rates', 'ফি-র হার', 'id'], ['student_fees', 'ছাত্রভিত্তিক ফি', 'id'], ['invoices', 'বিল', 'id'], ['payments', 'আদায় ও রসিদ', 'id'], ['payment_items', 'রসিদের আইটেম', 'id'],
  ['ledger_categories', 'আয়-ব্যয়ের খাত', 'id'], ['ledger', 'আয়-ব্যয়ের খাতা', 'id'], ['staff_advances', 'অগ্রিম', 'id'], ['salary_payments', 'বেতন', 'id'], ['audit_log', 'আর্থিক লগ', 'id'],
  ['exams', 'পরীক্ষা', 'id'], ['exam_subjects', 'পরীক্ষার বিষয়', 'id'], ['exam_marks', 'নম্বর', 'id'], ['hifz_logs', 'হিফজ', 'id'],
  ['print_configs', 'প্রিন্ট ডিজাইন', 'key'], ['student_incidents', 'আচরণগত ঘটনা', 'id'], ['readmissions', 'পুনঃভর্তির সিদ্ধান্ত', 'id'],
]
const BUCKET = 'media'
const LAST = 'backup_last'
const bn = (n) => Number(n || 0).toLocaleString('bn-BD')
const rd = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const wr = (k, v) => { try { localStorage.setItem(k, v) } catch { /* ignore */ } }

const cell = (v) => {
  if (v === null || v === undefined) return ''
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const toCsv = (rows) => {
  const cols = []
  rows.forEach((r) => Object.keys(r).forEach((k) => { if (!cols.includes(k)) cols.push(k) }))
  return `﻿${[cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n')}`
}
const stamp = (d = new Date()) => { const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}` }

async function listFiles(prefix = '') {
  const out = []
  for (let off = 0; off < 100000; off += 1000) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000, offset: off })
    if (error) throw error
    ;(data || []).forEach((f) => { f.id ? out.push(prefix ? `${prefix}/${f.name}` : f.name) : out.push({ dir: prefix ? `${prefix}/${f.name}` : f.name }) })
    if (!data || data.length < 1000) break
  }
  const files = []
  for (const x of out) {
    if (typeof x === 'string') files.push(x)
    else files.push(...(await listFiles(x.dir)))
  }
  return files
}

export default function Backup() {
  const { isSuper } = useAuth()
  const [withMedia, setWithMedia] = useState(false)
  const [busy, setBusy] = useState(false)
  const [prog, setProg] = useState({})
  const [step, setStep] = useState('')
  const [result, setResult] = useState(null)
  const [err, setErr] = useState('')
  const [last, setLast] = useState(rd(LAST))

  if (!isSuper) {
    return (
      <>
        <h2>ব্যাকআপ ও ডাউনলোড</h2>
        <div className="card">এই পাতা শুধু সুপার অ্যাডমিন দেখতে পারেন, কারণ ব্যাকআপে সব তথ্য থাকে।</div>
      </>
    )
  }
  const lastDate = last ? new Date(last) : null
  const days = lastDate ? Math.floor((Date.now() - lastDate.getTime()) / 86400000) : null

  async function run() {
    setBusy(true); setErr(''); setResult(null); setProg({}); setStep('')
    const zip = new JSZip()
    const rep = []
    try {
      for (const [t, label, ord] of TABLES) {
        setProg((o) => ({ ...o, [t]: 'চলছে…' }))
        const { data, error } = await fetchAll((a, b) => supabase.from(t).select('*').order(ord, { ascending: true }).range(a, b))
        if (error) { rep.push({ t, label, n: 0, exp: null, error: error.message }); setProg((o) => ({ ...o, [t]: `ত্রুটি: ${error.message}` })); continue }
        const { count } = await supabase.from(t).select('*', { count: 'exact', head: true })
        const rows = data || []
        zip.file(`json/${t}.json`, JSON.stringify(rows, null, 1))
        zip.file(`csv/${t}.csv`, toCsv(rows))
        const ok = count === null || count === undefined || count === rows.length
        rep.push({ t, label, n: rows.length, exp: count, error: ok ? '' : `সারি মেলেনি (পাওয়া ${rows.length}, আছে ${count})` })
        setProg((o) => ({ ...o, [t]: ok ? `${bn(rows.length)} সারি ✓` : `সারি মেলেনি ✗` }))
      }
      let media = { files: 0, failed: [], skipped: !withMedia }
      if (withMedia) {
        setStep('ছবি ও ফাইলের তালিকা তৈরি হচ্ছে…')
        let files = []
        try { files = await listFiles() } catch (e) { media.failed.push(`তালিকা: ${e.message}`) }
        for (let i = 0; i < files.length; i++) {
          setStep(`ফাইল নামছে: ${bn(i + 1)} / ${bn(files.length)}`)
          const { data, error } = await supabase.storage.from(BUCKET).download(files[i])
          if (error || !data) { media.failed.push(files[i]); continue }
          zip.file(`media/${files[i]}`, data)
          media.files += 1
        }
      }
      const bad = rep.filter((r) => r.error)
      const lines = [
        'সাবিলুস সালাম মাদরাসা — ডেটা ব্যাকআপ',
        `তৈরির সময়: ${new Date().toLocaleString('bn-BD')}`,
        '',
        'ফোল্ডার: json = সম্পূর্ণ তথ্য (পুনরুদ্ধারের জন্য), csv = Excel-এ খোলার জন্য' + (withMedia ? ', media = ছবি ও ফাইল' : ''),
        '',
        ...rep.map((r) => `${r.t} (${r.label}): ${r.error ? `সমস্যা — ${r.error}` : `${r.n} সারি`}`),
        '',
        withMedia ? `ছবি/ফাইল: ${media.files} টি${media.failed.length ? `, নামেনি ${media.failed.length} টি: ${media.failed.join(', ')}` : ''}` : 'ছবি/ফাইল: এই ব্যাকআপে নেই',
        '',
        'সতর্কতা: এই ফাইলে ব্যবহারকারীর ইমেইল, ছাত্রদের ব্যক্তিগত তথ্য ও মেশিনের সেটিং থাকতে পারে। নিরাপদ জায়গায় রাখুন, অন্যকে দেবেন না।',
      ]
      zip.file('ব্যাকআপ-তথ্য.txt', lines.join('\r\n'))
      setStep('zip ফাইল তৈরি হচ্ছে…')
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
      saveBlob(blob, `ব্যাকআপ-${stamp()}.zip`)
      const total = rep.reduce((a, r) => a + r.n, 0)
      if (bad.length === 0) { const now = new Date().toISOString(); wr(LAST, now); setLast(now) }
      setResult({ total, tables: rep.length, bad, media, size: blob.size })
    } catch (e) {
      setErr(`ব্যাকআপ সম্পূর্ণ হয়নি: ${e.message || e}`)
    }
    setStep(''); setBusy(false)
  }

  return (
    <>
      <div className="toolbar"><h2 style={{ margin: 0, flex: '1 1 auto' }}>ব্যাকআপ ও ডাউনলোড</h2></div>
      <p className="muted" style={{ marginTop: -6 }}>এক ক্লিকে ছাত্র, হাজিরা, ফি, হিসাব, পরীক্ষাসহ সব তথ্য একটি zip ফাইলে নামান। সপ্তাহে অন্তত একবার নামিয়ে কম্পিউটারে ও আরেক জায়গায় (পেনড্রাইভ বা গুগল ড্রাইভ) রাখুন।</p>

      <div className="card" style={{ marginBottom: 14, borderInlineStart: `4px solid ${days === null || days > 7 ? 'var(--secondary)' : 'var(--primary)'}` }}>
        {lastDate ? <>এই ব্রাউজারে শেষ ব্যাকআপ: <b>{lastDate.toLocaleString('bn-BD')}</b> ({days === 0 ? 'আজ' : `${bn(days)} দিন আগে`}){days > 7 && <b style={{ color: 'var(--secondary)' }}> — ৭ দিনের বেশি হয়ে গেছে, নতুন ব্যাকআপ নিন।</b>}</> : <b style={{ color: 'var(--secondary)' }}>এই ব্রাউজারে এখনো কোনো ব্যাকআপ নেওয়া হয়নি।</b>}
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <input type="checkbox" checked={withMedia} onChange={(e) => setWithMedia(e.target.checked)} disabled={busy} />
          ছবি ও ফাইলসহ (ছাত্র-শিক্ষকের ছবি, গ্যালারি; ধীর ও ফাইল বড় হবে)
        </label>
        <button className="btn" onClick={run} disabled={busy}><Icon name="upload" size={18} cls="cur" /> {busy ? 'ব্যাকআপ চলছে… পাতা বন্ধ করবেন না' : 'সব ডেটার ব্যাকআপ নামান'}</button>
        {step && <p className="muted" style={{ marginBottom: 0 }}>{step}</p>}
        {err && <div className="alert err" style={{ marginTop: 12 }}>{err}</div>}
      </div>

      {result && (
        <div className={`alert ${result.bad.length || result.media.failed.length ? 'err' : 'ok'}`} style={{ marginBottom: 14 }}>
          {result.bad.length === 0 && result.media.failed.length === 0 ? <>ব্যাকআপ সম্পূর্ণ: <b>{bn(result.tables)}</b> টি তালিকা, মোট <b>{bn(result.total)}</b> সারি{result.media.skipped ? '' : `, ${bn(result.media.files)} টি ফাইল`}। ফাইলটি নেমে গেছে ({(result.size / 1048576).toFixed(1)} MB)।</> : (
            <>
              <b>ব্যাকআপ ফাইল নেমেছে, কিন্তু সব তথ্য সম্পূর্ণ নয়:</b>
              <ul style={{ margin: '6px 0 0' }}>
                {result.bad.map((b) => <li key={b.t}>{b.label}: {b.error}</li>)}
                {result.media.failed.length > 0 && <li>{bn(result.media.failed.length)} টি ফাইল নামেনি (বিস্তারিত zip-এর ব্যাকআপ-তথ্য.txt ফাইলে)</li>}
              </ul>
            </>
          )}
        </div>
      )}

      {Object.keys(prog).length > 0 && (
        <div className="card table-wrap">
          <table>
            <thead><tr><th>তালিকা</th><th>অবস্থা</th></tr></thead>
            <tbody>{TABLES.filter(([t]) => prog[t]).map(([t, label]) => <tr key={t}><td>{label}</td><td style={{ color: String(prog[t]).includes('✗') || String(prog[t]).startsWith('ত্রুটি') ? 'var(--secondary)' : undefined }}>{prog[t]}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </>
  )
}
