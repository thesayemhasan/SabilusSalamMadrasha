import { useState } from 'react'
import JSZip from 'jszip'
import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/db'
import { TABLES } from '../../lib/backupTables'

const bn = (n) => Number(n || 0).toLocaleString('bn-BD')
const stable = (v) => {
  if (v === null || v === undefined) return 'null'
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`
  if (typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`
  return JSON.stringify(v)
}
const same = (fileRow, dbRow) => Object.keys(fileRow).every((k) => stable(fileRow[k]) === stable(dbRow[k]))
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', pdf: 'application/pdf', mp4: 'video/mp4' }
const NOTE = { profiles: 'লগইন অ্যাকাউন্ট (Supabase Auth) ফাইলে থাকে না; শুধু প্রোফাইলের সারি ফেরত আসবে, আর সেই ব্যবহারকারীর লগইন আগে থেকে থাকতে হবে।' }

export default function Restore() {
  const [an, setAn] = useState(null)
  const [sel, setSel] = useState({})
  const [mode, setMode] = useState('missing')
  const [withMedia, setWithMedia] = useState(false)
  const [sure, setSure] = useState(false)
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState('')
  const [res, setRes] = useState(null)
  const [err, setErr] = useState('')

  async function analyze(zip) {
    const out = []
    for (const [t, label, pk] of TABLES) {
      const f = zip.file(`json/${t}.json`)
      if (!f) { out.push({ t, label, pk, inFile: false }); continue }
      setStep(`যাচাই হচ্ছে: ${label}`)
      const fileRows = JSON.parse(await f.async('string'))
      const { data, error } = await fetchAll((a, b) => supabase.from(t).select('*').order(pk, { ascending: true }).range(a, b))
      if (error) { out.push({ t, label, pk, inFile: true, fileRows: fileRows.length, error: error.message }); continue }
      const db = new Map((data || []).map((r) => [String(r[pk]), r]))
      const missingRows = []; const diffRows = []
      fileRows.forEach((r) => { const d = db.get(String(r[pk])); if (!d) missingRows.push(r); else if (!same(r, d)) diffRows.push(r) })
      const inFileKeys = new Set(fileRows.map((r) => String(r[pk])))
      out.push({ t, label, pk, inFile: true, fileRows: fileRows.length, dbCount: db.size, missingRows, diffRows, extra: [...db.keys()].filter((k) => !inFileKeys.has(k)).length })
    }
    const media = Object.keys(zip.files).filter((n) => n.startsWith('media/') && !zip.files[n].dir)
    return { tables: out, media, zip }
  }

  async function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true); setErr(''); setRes(null); setAn(null); setSure(false)
    try {
      const zip = await JSZip.loadAsync(file)
      if (!Object.keys(zip.files).some((n) => n.startsWith('json/'))) throw new Error('এটি এই সাইটের ব্যাকআপ zip নয় (ভেতরে json ফোল্ডার নেই)।')
      const a = await analyze(zip)
      setAn(a)
      const s = {}
      a.tables.forEach((x) => { s[x.t] = x.inFile && !x.error && x.t !== 'profiles' && (x.missingRows.length > 0) })
      setSel(s)
    } catch (ex) { setErr(`ফাইল পড়া যায়নি: ${ex.message}`) }
    setStep(''); setBusy(false)
  }

  async function run() {
    setBusy(true); setErr(''); setRes(null)
    const report = []
    const retry = []
    try {
      for (const x of an.tables) {
        if (!sel[x.t] || !x.inFile || x.error) continue
        const rows = mode === 'missing' ? x.missingRows : [...x.missingRows, ...x.diffRows]
        const r = { t: x.t, label: x.label, ok: 0, failed: 0, first: '' }
        for (let i = 0; i < rows.length; i += 200) {
          setStep(`ফেরত আনা হচ্ছে: ${x.label} (${bn(Math.min(i + 200, rows.length))} / ${bn(rows.length)})`)
          const chunk = rows.slice(i, i + 200)
          const { error } = await supabase.from(x.t).upsert(chunk, { onConflict: x.pk, ignoreDuplicates: mode === 'missing' })
          if (!error) { r.ok += chunk.length; continue }
          for (const row of chunk) {
            const one = await supabase.from(x.t).upsert(row, { onConflict: x.pk, ignoreDuplicates: mode === 'missing' })
            if (one.error) retry.push({ x, row, r, msg: one.error.message }); else r.ok += 1
          }
        }
        report.push(r)
      }
      // কিছু সারি অন্য টেবিলের ওপর নির্ভর করে (যেমন শ্রেণি → শিক্ষক); সব শেষে আরেকবার চেষ্টা
      for (const q of retry) {
        setStep('বাকি সারি আবার চেষ্টা হচ্ছে…')
        const one = await supabase.from(q.x.t).upsert(q.row, { onConflict: q.x.pk, ignoreDuplicates: mode === 'missing' })
        if (one.error) { q.r.failed += 1; if (!q.r.first) q.r.first = one.error.message } else q.r.ok += 1
      }
      let media = null
      if (withMedia && an.media.length) {
        media = { ok: 0, exists: 0, failed: 0 }
        for (let i = 0; i < an.media.length; i++) {
          setStep(`ফাইল ফেরত আনা হচ্ছে: ${bn(i + 1)} / ${bn(an.media.length)}`)
          const name = an.media[i]
          const path = name.slice('media/'.length)
          const blob = await an.zip.files[name].async('blob')
          const ext = path.split('.').pop().toLowerCase()
          const { error } = await supabase.storage.from('media').upload(path, blob, { upsert: false, contentType: MIME[ext] || blob.type || 'application/octet-stream' })
          if (!error) media.ok += 1
          else if (/exist|duplicate/i.test(error.message)) media.exists += 1
          else media.failed += 1
        }
      }
      setRes({ report, media })
      setStep('ফলাফল যাচাই হচ্ছে…')
      setAn(await analyze(an.zip))
    } catch (ex) { setErr(`ফেরত আনা সম্পূর্ণ হয়নি: ${ex.message}`) }
    setStep(''); setBusy(false); setSure(false)
  }

  const chosen = an ? an.tables.filter((x) => sel[x.t] && x.inFile && !x.error) : []
  const total = chosen.reduce((a, x) => a + x.missingRows.length + (mode === 'overwrite' ? x.diffRows.length : 0), 0)

  return (
    <div className="card" style={{ marginTop: 22 }}>
      <h3 style={{ marginTop: 0 }}>ব্যাকআপ থেকে ফেরত আনা (রিস্টোর)</h3>
      <p className="muted">ভুলে ডেটা মুছে গেলে বা নতুন জায়গায় সাইট সরালে আগের ব্যাকআপ zip এখানে দিন। প্রথমে শুধু <b>যাচাই</b> হয় (কী কী হারিয়েছে, কী বদলেছে), আপনি দেখে নিশ্চিত করলে তবেই ফেরত আসে। <b>কোনো সারি মোছা হয় না।</b></p>
      <label className="btn outline" style={{ display: 'inline-flex', cursor: busy ? 'wait' : 'pointer' }}>
        ব্যাকআপ zip বাছুন
        <input type="file" accept=".zip,application/zip" onChange={onFile} disabled={busy} style={{ display: 'none' }} />
      </label>
      {step && <p className="muted" style={{ marginBottom: 0 }}>{step}</p>}
      {err && <div className="alert err" style={{ marginTop: 12 }}>{err}</div>}

      {an && (
        <>
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table>
              <thead><tr><th></th><th>তালিকা</th><th>ফাইলে</th><th>এখন আছে</th><th>হারানো</th><th>ভিন্ন</th><th>ফাইলে নেই</th></tr></thead>
              <tbody>
                {an.tables.map((x) => (
                  <tr key={x.t} style={{ opacity: x.inFile ? 1 : 0.5 }}>
                    <td><input type="checkbox" disabled={!x.inFile || Boolean(x.error) || busy} checked={Boolean(sel[x.t])} onChange={(e) => setSel({ ...sel, [x.t]: e.target.checked })} /></td>
                    <td>{x.label}{NOTE[x.t] && <div className="muted" style={{ fontSize: '.78rem' }}>{NOTE[x.t]}</div>}</td>
                    {!x.inFile ? <td colSpan="5" className="muted">ফাইলে নেই</td> : x.error ? <td colSpan="5" style={{ color: 'var(--secondary)' }}>পড়া যায়নি: {x.error}</td> : (
                      <>
                        <td>{bn(x.fileRows)}</td><td>{bn(x.dbCount)}</td>
                        <td style={{ color: x.missingRows.length ? 'var(--secondary)' : undefined, fontWeight: x.missingRows.length ? 700 : 400 }}>{bn(x.missingRows.length)}</td>
                        <td>{bn(x.diffRows.length)}</td><td>{bn(x.extra)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ fontSize: '.85rem' }}>হারানো = ফাইলে আছে, এখন নেই। ভিন্ন = দুই জায়গায় আছে কিন্তু তথ্য আলাদা। ফাইলে নেই = এখন আছে, ব্যাকআপে নেই (এগুলো সবসময় অক্ষত থাকে)।</p>

          <div className="stack" style={{ margin: '10px 0' }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}><input type="radio" checked={mode === 'missing'} onChange={() => setMode('missing')} disabled={busy} /><span><b>শুধু হারানো সারি ফেরত আনুন</b> (নিরাপদ, ডিফল্ট)। যা এখন আছে তা একটুও বদলাবে না।</span></label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}><input type="radio" checked={mode === 'overwrite'} onChange={() => setMode('overwrite')} disabled={busy} /><span><b>হারানো সারি ফেরত + "ভিন্ন" সারি ব্যাকআপের তথ্য দিয়ে বদলান।</b> এখনকার নতুন করা পরিবর্তন ব্যাকআপের পুরোনো তথ্যে ফিরে যাবে।</span></label>
            {an.media.length > 0 && <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={withMedia} onChange={(e) => setWithMedia(e.target.checked)} disabled={busy} /> ছবি ও ফাইলও ফেরত আনুন ({bn(an.media.length)} টি; যেগুলো আগে থেকে আছে সেগুলো ছোঁয়া হবে না)</label>}
          </div>

          <div className="alert" style={{ margin: '10px 0' }}>
            ফেরত আনা হবে: <b>{bn(chosen.length)}</b> টি তালিকায় মোট <b>{bn(total)}</b> সারি{withMedia && an.media.length ? ` ও ${bn(an.media.length)} টি ফাইল (নতুনগুলো)` : ''}।
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' }}><input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} disabled={busy} /> আমি বুঝেছি, ফেরত আনার আগে বর্তমান ডেটার একটি ব্যাকআপ নামিয়ে রেখেছি।</label>
          <button className="btn" disabled={busy || !sure || (total === 0 && !(withMedia && an.media.length))} onClick={run}>{busy ? 'চলছে… পাতা বন্ধ করবেন না' : 'ফেরত আনুন'}</button>
        </>
      )}

      {res && (
        <div style={{ marginTop: 14 }}>
          <div className={`alert ${res.report.some((r) => r.failed) || res.media?.failed ? 'err' : 'ok'}`}>
            <b>ফেরত আনা শেষ।</b>
            <ul style={{ margin: '6px 0 0' }}>
              {res.report.map((r) => <li key={r.t}>{r.label}: {bn(r.ok)} সারি ফিরেছে{r.failed ? <b style={{ color: 'var(--secondary)' }}>, {bn(r.failed)} টি ফেরেনি ({r.first})</b> : ''}</li>)}
              {res.media && <li>ফাইল: {bn(res.media.ok)} টি ফিরেছে, {bn(res.media.exists)} টি আগেই ছিল{res.media.failed ? `, ${bn(res.media.failed)} টি ফেরেনি` : ''}</li>}
            </ul>
          </div>
          <p className="muted">উপরের তালিকা নতুন করে যাচাই করা হয়েছে: "হারানো" ০ হলে সব ফিরে এসেছে।</p>
        </div>
      )}
    </div>
  )
}
