import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchAll } from '../../lib/db'
import { ImageUpload, Modal, Select, useConfirm } from '../../components/Ui'
import Icon from '../../components/Icon'
import { downloadCsv } from './Crud'
import { PrintDoc, VoidDialog, dateBn, monthStr, nm, num, taka, todayStr, useMethods, voidPatch } from './fin'

// kind = 'income' (দান ও অন্যান্য আয়) অথবা 'expense' (ব্যয়)
export default function Ledger({ kind }) {
  const income = kind === 'income'
  const confirm = useConfirm()
  const methods = useMethods()
  const [cats, setCats] = useState([])
  const [rows, setRows] = useState([])
  const [from, setFrom] = useState(`${monthStr()}-01`)
  const [to, setTo] = useState(todayStr())
  const [cat, setCat] = useState('')
  const [form, setForm] = useState(null)
  const [vd, setVd] = useState(null)
  const [doc, setDoc] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    supabase.from('ledger_categories').select('*').eq('kind', kind).order('sort', { ascending: true }).then(({ data }) => setCats((data || []).filter((c) => c.published !== false)))
  }, [kind])
  const load = useCallback(async () => {
    const { data } = await fetchAll((a, b) => supabase.from('ledger').select('*').eq('kind', kind).gte('date', from).lte('date', to).order('date', { ascending: false }).range(a, b))
    setRows(data || [])
  }, [kind, from, to])
  useEffect(() => { load() }, [load])

  const shown = rows.filter((r) => !cat || r.category_id === cat)
  const total = shown.filter((r) => !r.void).reduce((a, r) => a + num(r.amount), 0)

  async function save() {
    setErr('')
    const c = cats.find((x) => x.id === form.category_id)
    if (!c) return setErr('খাত বাছাই করুন।')
    if (num(form.amount) <= 0) return setErr('টাকার পরিমাণ দিন।')
    if (!(await confirm({ danger: false, name: `${c.name_bn} — ${taka(form.amount)}`, text: `${income ? 'আয়' : 'ব্যয়'} হিসেবে সংরক্ষণ করবেন? সংরক্ষণের পর অঙ্ক বদলানো যাবে না (শুধু বাতিল করা যাবে)।`, ok: 'হ্যাঁ, সংরক্ষণ করুন' }))) return
    const { data, error } = await supabase.from('ledger').insert({ kind, category_id: c.id, category_name: nm(c), amount: num(form.amount), method: form.method, date: form.date, party: form.party || null, phone: form.phone || null, voucher_url: form.voucher_url || null, note: form.note || null }).select().single()
    if (error) return setErr(error.message)
    setForm(null); load()
    if (income && data) showReceipt(data)
  }

  const showReceipt = (r) => setDoc({ kind: /দান|donat/i.test(r.category_name || '') ? 'donation' : 'income', no: r.receipt_no, date: r.date, rows: [[`${r.category_name || 'আয়'}${r.note ? ` — ${r.note}` : ''}`, r.amount]], total: r.amount, meta: [['দাতা', r.party], ['ফোন', r.phone], ['মাধ্যম', methods.label(r.method)]], note: r.void ? `বাতিল: ${r.void_reason}` : 'আল্লাহ আপনার দান কবুল করুন।' })

  return (
    <>
      <div className="toolbar">
        <h2 style={{ margin: 0, flex: '1 1 auto' }}>{income ? 'দান, চাঁদা ও অন্যান্য আয়' : 'ব্যয়'}</h2>
        <button className="btn outline" onClick={() => downloadCsv(`${income ? 'আয়' : 'ব্যয়'}-${from}-${to}.csv`, ['তারিখ', 'খাত', income ? 'দাতা' : 'প্রাপক', 'মাধ্যম', 'টাকা', 'রসিদ নং', 'অবস্থা'], shown.map((r) => [r.date, r.category_name, r.party, methods.label(r.method), r.amount, r.receipt_no, r.void ? `বাতিল: ${r.void_reason}` : 'সক্রিয়']))}><Icon name="upload" size={17} cls="cur" /> Excel</button>
        <button className="btn" onClick={() => setForm({ category_id: '', amount: '', method: 'cash', date: todayStr(), party: '', phone: '', note: '', voucher_url: '' })}><Icon name="plus" size={18} cls="cur" /> {income ? 'নতুন আয়' : 'নতুন ব্যয়'}</button>
      </div>
      <div className="toolbar" style={{ marginTop: -4 }}>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ maxWidth: 170 }} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ maxWidth: 170 }} />
        <div style={{ minWidth: 200 }}><Select value={cat} onChange={setCat} options={[['', 'সব খাত'], ...cats.map((c) => [c.id, nm(c)])]} /></div>
      </div>
      <div className="card" style={{ marginBottom: 12 }}>মোট {income ? 'আয়' : 'ব্যয়'} (বাতিল বাদে): <b>{taka(total)}</b> · এন্ট্রি {shown.length}টি</div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>তারিখ</th><th>খাত</th><th>{income ? 'দাতা' : 'প্রাপক'}</th><th>মাধ্যম</th><th>টাকা</th><th></th></tr></thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan="6" className="muted">এই সময়ে কোনো এন্ট্রি নেই।</td></tr>}
            {shown.map((r) => (
              <tr key={r.id} style={r.void ? { opacity: 0.55 } : undefined}>
                <td>{dateBn(r.date)}</td><td>{r.category_name} {r.void && <span className="pill">বাতিল</span>}</td>
                <td>{r.party || '—'}{r.note && <div className="muted" style={{ fontSize: '.82rem' }}>{r.note}</div>}</td><td>{methods.label(r.method)}</td>
                <td style={r.void ? { textDecoration: 'line-through' } : undefined}>{taka(r.amount)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {income && <button className="btn small outline" onClick={() => showReceipt(r)}><Icon name="printer" size={15} cls="cur" /> রসিদ</button>}{' '}
                  {r.voucher_url && <a className="btn small outline" href={r.voucher_url} target="_blank" rel="noreferrer">ভাউচার</a>}{' '}
                  {!r.void && <button className="btn small danger" onClick={() => setVd(r)}>বাতিল</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {form && (
        <Modal onClose={() => setForm(null)} wide>
          <h3>{income ? 'নতুন আয়' : 'নতুন ব্যয়'}</h3>
          <div className="form">
            <div className="row2">
              <div className="field"><label>খাত *</label><Select value={form.category_id} onChange={(v) => setForm({ ...form, category_id: v })} placeholder="খাত বাছাই করুন" options={cats.map((c) => [c.id, nm(c)])} /></div>
              <div className="field"><label>টাকা *</label><input type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            </div>
            <div className="row2">
              <div className="field"><label>মাধ্যম</label><Select value={form.method} onChange={(v) => setForm({ ...form, method: v })} options={methods.list} /></div>
              <div className="field"><label>তারিখ</label><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            </div>
            <div className="row2">
              <div className="field"><label>{income ? 'দাতার নাম' : 'যাকে দেওয়া হয়েছে'}</label><input value={form.party} onChange={(e) => setForm({ ...form, party: e.target.value })} /></div>
              <div className="field"><label>ফোন (ঐচ্ছিক)</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="field"><label>বিবরণ / নোট</label><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
            {!income && <div className="field"><label>ভাউচার / বিলের ছবি (ঐচ্ছিক)</label><ImageUpload folder="vouchers" value={form.voucher_url} onChange={(v) => setForm({ ...form, voucher_url: v })} /></div>}
            {err && <div className="alert err">{err}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="btn outline" onClick={() => setForm(null)}>বাতিল</button><button className="btn" onClick={save}>সংরক্ষণ</button></div>
          </div>
        </Modal>
      )}
      {doc && <PrintDoc kind={doc.kind} no={doc.no} date={doc.date} rows={doc.rows} total={doc.total} meta={doc.meta} footNote={doc.note} onClose={() => setDoc(null)} />}
      {vd && <VoidDialog name={`${vd.category_name} (${taka(vd.amount)})`} onClose={() => setVd(null)} onDone={async (why) => { const { error } = await supabase.from('ledger').update(voidPatch(why)).eq('id', vd.id); if (error) window.alert(error.message); setVd(null); load() }} />}
    </>
  )
}
