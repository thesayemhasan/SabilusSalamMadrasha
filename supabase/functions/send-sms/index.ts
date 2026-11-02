// Supabase Edge Function: send-sms
// অভিভাবকের মোবাইলে এসএমএস পাঠায়। সেবাদাতার চাবি শুধু এখানকার Secrets-এ থাকে (ব্রাউজারে নয়)।
// কোন সেবাদাতা চলবে তা অ্যাডমিন পাতা (এসএমএস) থেকে ঠিক হয় (sms_config: provider)।
// ১) BulkSMSBD — Secrets: BULKSMSBD_API_KEY, BULKSMSBD_SENDER_ID, (ঐচ্ছিক) SMS_API_URL, SMS_BALANCE_URL
// ২) যেকোনো সেবাদাতা (HTTP API) — Secrets:
//    SMS_CUSTOM_URL      = পুরো ঠিকানা, জায়গায় {number} {message} {sender} বসান (চাবিসহ)।
//                          যেমন https://example.com/send?key=XXXX&to={number}&from={sender}&text={message}
//    SMS_CUSTOM_SENDER   = সেন্ডার আইডি/নাম (ঐচ্ছিক)
//    SMS_CUSTOM_METHOD   = GET (ডিফল্ট) বা POST
//    SMS_CUSTOM_BODY     = POST হলে বডির লেখা, একই {number} {message} {sender} সহ (ঐচ্ছিক)
//    SMS_CUSTOM_CONTENT_TYPE = বডির ধরন, যেমন application/x-www-form-urlencoded (ডিফল্ট) বা application/json
//    SMS_CUSTOM_OK       = সফল হলে উত্তরে যে লেখা থাকে (ঐচ্ছিক; না দিলে HTTP 2xx হলেই সফল)
//    SMS_CUSTOM_NUMBER   = নম্বরের রূপ: 880 (8801712345678, ডিফল্ট) | local (01712345678) | plus (+8801712345678)
//    SMS_CUSTOM_BALANCE_URL = ব্যালেন্সের ঠিকানা (ঐচ্ছিক)
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const API_URL = Deno.env.get('SMS_API_URL') || 'https://bulksmsbd.net/api/smsapi'
const BAL_URL = Deno.env.get('SMS_BALANCE_URL') || 'https://bulksmsbd.net/api/getBalanceApi'
const KEY = Deno.env.get('BULKSMSBD_API_KEY') || ''
const SENDER = Deno.env.get('BULKSMSBD_SENDER_ID') || ''
let provider = 'bulksmsbd'
const DEDUPE_HOURS: Record<string, number> = { absent: 20, dues: 72 }

const normPhone = (p: string) => {
  const d = String(p || '').replace(/[^\d]/g, '')
  const n = d.startsWith('880') ? d : d.startsWith('0') ? `88${d}` : d.length === 10 ? `880${d}` : d
  return /^8801[3-9]\d{8}$/.test(n) ? n : ''
}
const segments = (t: string) => (/^[\x00-\x7F]*$/.test(t) ? Math.max(1, Math.ceil(t.length / 160)) : Math.max(1, Math.ceil([...t].length / 70)))

const fmtCustom = (phone: string) => {
  const m = (Deno.env.get('SMS_CUSTOM_NUMBER') || '880').toLowerCase()
  return m === 'local' ? phone.slice(2) : m === 'plus' ? `+${phone}` : phone
}
const subst = (tpl: string, phone: string, message: string, enc: boolean) => {
  const e = (s: string) => (enc ? encodeURIComponent(s) : s)
  return tpl.replaceAll('{number}', e(fmtCustom(phone))).replaceAll('{message}', e(message)).replaceAll('{sender}', e(Deno.env.get('SMS_CUSTOM_SENDER') || ''))
}
async function sendCustom(phone: string, message: string) {
  const urlTpl = Deno.env.get('SMS_CUSTOM_URL') || ''
  const method = (Deno.env.get('SMS_CUSTOM_METHOD') || 'GET').toUpperCase()
  const ct = Deno.env.get('SMS_CUSTOM_CONTENT_TYPE') || 'application/x-www-form-urlencoded'
  const bodyTpl = Deno.env.get('SMS_CUSTOM_BODY') || ''
  const okText = Deno.env.get('SMS_CUSTOM_OK') || ''
  try {
    const isJson = ct.includes('json')
    const init: RequestInit = { method }
    if (method === 'POST' && bodyTpl) {
      init.headers = { 'Content-Type': ct }
      // JSON বডিতে বার্তার " ও নতুন লাইন ঠিক রাখতে JSON-escape করা হয়
      init.body = isJson ? subst(bodyTpl, phone, JSON.stringify(message).slice(1, -1), false) : subst(bodyTpl, phone, message, true)
    }
    const r = await fetch(subst(urlTpl, phone, message, true), init)
    const txt = await r.text()
    const ok = okText ? txt.includes(okText) : r.ok
    return { ok: ok && r.ok, detail: `HTTP ${r.status}: ${txt.slice(0, 250)}` }
  } catch (e) {
    return { ok: false, detail: `সংযোগ ত্রুটি: ${(e as Error).message}` }
  }
}

async function sendOne(phone: string, message: string) {
  if (provider === 'custom') return sendCustom(phone, message)
  const body = new URLSearchParams({ api_key: KEY, type: 'text', number: phone, senderid: SENDER, message })
  try {
    const r = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
    const txt = await r.text()
    let code: unknown = null
    try { code = JSON.parse(txt).response_code } catch { /* not json */ }
    return { ok: String(code) === '202', detail: txt.slice(0, 300) }
  } catch (e) {
    return { ok: false, detail: `সংযোগ ত্রুটি: ${(e as Error).message}` }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const auth = req.headers.get('Authorization') || ''
    const url = Deno.env.get('SUPABASE_URL')!
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: u } = await asUser.auth.getUser()
    if (!u?.user) return json({ error: 'লগইন প্রয়োজন' }, 401)
    const body = await req.json()
    const action = body.action || 'send'

    const { data: pv } = await admin.from('sms_config').select('value').eq('key', 'provider').maybeSingle()
    provider = pv && JSON.stringify(pv.value).includes('custom') ? 'custom' : 'bulksmsbd'
    if (provider === 'custom') {
      if (!Deno.env.get('SMS_CUSTOM_URL')) return json({ error: 'কাস্টম সেবাদাতার ঠিকানা বসানো নেই (Supabase Secret: SMS_CUSTOM_URL)' }, 500)
    } else if (!KEY || !SENDER) return json({ error: 'সেবাদাতার চাবি বসানো নেই (Supabase Secrets: BULKSMSBD_API_KEY ও BULKSMSBD_SENDER_ID)' }, 500)

    if (action === 'balance') {
      const { data: ok } = await asUser.rpc('sms_allowed', { k: 'admin' })
      if (!ok) return json({ error: 'অনুমতি নেই' }, 403)
      if (provider === 'custom') {
        const bu = Deno.env.get('SMS_CUSTOM_BALANCE_URL')
        if (!bu) return json({ balance: 'এই সেবাদাতার ব্যালেন্স এখানে দেখা যায় না, তাদের ড্যাশবোর্ডে দেখুন।' })
        return json({ balance: (await (await fetch(bu)).text()).slice(0, 300) })
      }
      const r = await fetch(`${BAL_URL}?api_key=${encodeURIComponent(KEY)}`)
      return json({ balance: (await r.text()).slice(0, 300) })
    }

    if (action === 'test') {
      const { data: ok } = await asUser.rpc('sms_allowed', { k: 'admin' })
      if (!ok) return json({ error: 'অনুমতি নেই' }, 403)
      const phone = normPhone(body.phone)
      if (!phone) return json({ error: 'মোবাইল নম্বর ঠিক নয়' }, 400)
      const msg = String(body.message || '').slice(0, 300)
      if (!msg) return json({ error: 'বার্তা ফাঁকা' }, 400)
      const r = await sendOne(phone, msg)
      await admin.from('sms_log').insert({ kind: 'test', phone, message: msg, segments: segments(msg), status: r.ok ? 'sent' : 'failed', detail: r.detail, sent_by: u.user.id })
      return json({ ok: r.ok, detail: r.detail })
    }

    // সাধারণ পাঠানো: { kind: 'absent'|'dues', items: [{ student_id, vars: {name, date, amount, class} }] }
    const kind = String(body.kind || '')
    if (!['absent', 'dues'].includes(kind)) return json({ error: 'বার্তার ধরন ঠিক নয়' }, 400)
    const { data: ok } = await asUser.rpc('sms_allowed', { k: kind })
    if (!ok) return json({ error: 'এই বার্তা পাঠানোর অনুমতি নেই' }, 403)
    const items: { student_id: string; vars?: Record<string, string> }[] = Array.isArray(body.items) ? body.items.slice(0, 200) : []
    if (items.length === 0) return json({ error: 'কোনো ছাত্র বাছাই করা নেই' }, 400)

    const { data: tpl } = await admin.from('sms_templates').select('*').eq('key', kind).maybeSingle()
    if (!tpl || !tpl.enabled) return json({ error: 'এই বার্তাটি বন্ধ আছে বা লেখা নেই' }, 400)
    const ids = items.map((i) => i.student_id)
    const { data: studs } = await admin.from('students').select('id,guardian_phone,phone2,name_bn').in('id', ids)
    const byId = Object.fromEntries((studs || []).map((s) => [s.id, s]))
    const since = new Date(Date.now() - (DEDUPE_HOURS[kind] || 20) * 3600 * 1000).toISOString()
    const { data: recent } = await admin.from('sms_log').select('student_id').eq('kind', kind).eq('status', 'sent').gte('created_at', since).in('student_id', ids)
    const done = new Set((recent || []).map((r) => r.student_id))

    const out = { sent: 0, failed: 0, skipped: 0, segments: 0 }
    const logs: Record<string, unknown>[] = []
    const queue = [...items]
    const worker = async () => {
      while (queue.length) {
        const it = queue.shift()!
        const s = byId[it.student_id]
        const base = { kind, student_id: it.student_id, sent_by: u.user.id }
        if (!s) { out.skipped++; logs.push({ ...base, status: 'skipped', detail: 'ছাত্র পাওয়া যায়নি', segments: 0 }); continue }
        const phone = normPhone(s.guardian_phone) || normPhone(s.phone2)
        if (!phone) { out.skipped++; logs.push({ ...base, status: 'skipped', detail: 'মোবাইল নম্বর নেই বা ঠিক নয়', segments: 0 }); continue }
        if (done.has(it.student_id)) { out.skipped++; logs.push({ ...base, phone, status: 'skipped', detail: 'আগেই পাঠানো হয়েছে', segments: 0 }); continue }
        const vars = { name: s.name_bn || '', ...(it.vars || {}) }
        const message = String(tpl.body_bn).replace(/\{(\w+)\}/g, (_: string, k: string) => String(vars[k] ?? ''))
        const seg = segments(message)
        const r = await sendOne(phone, message)
        if (r.ok) { out.sent++; out.segments += seg } else out.failed++
        logs.push({ ...base, phone, message, segments: seg, status: r.ok ? 'sent' : 'failed', detail: r.ok ? null : r.detail })
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()])
    if (logs.length) await admin.from('sms_log').insert(logs)
    return json(out)
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
