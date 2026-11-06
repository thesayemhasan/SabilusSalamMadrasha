import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useSite, pick } from '../../lib/store'
import { dig } from '../../lib/util'
import { Select } from '../../components/Ui'
import { canvasToPdf } from '../../lib/resultPdf'
import { layoutCanvas } from '../../lib/layoutCanvas'
import { defaultLayout } from '../../lib/layout'
import { marksheetData, verifyLink } from '../../lib/marksheet'
import { saveBlob } from '../../lib/xlsx'
import PageHead from '../../components/PageHead'

const num = (v) => (v === null || v === undefined ? '' : Number(v))

export default function Result() {
  const { t, lang, settings } = useSite()
  const [opt, setOpt] = useState(null)
  const [examId, setExamId] = useState('')
  const [clsId, setClsId] = useState('')
  const [no, setNo] = useState('')
  const [dob, setDob] = useState('')
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState(null)
  const [err, setErr] = useState('')
  const d = (v) => dig(v, lang)
  const [pdfBusy, setPdfBusy] = useState(false)

  async function downloadPdf() {
    if (!res) return
    setPdfBusy(true)
    try {
      const layout = res.layout && res.layout.sides ? res.layout : defaultLayout('marksheet')
      const data = marksheetData({
        inst: { inst_name: t('site.name'), inst_addr: t('site.address'), inst_phone: settings.phone || '', logo: settings.logo_url },
        student: res.student, className: pick(res.class, 'name', lang), exam: res.exam,
        subjects: res.subjects.map((x) => ({ name_bn: x.name_bn, name_en: x.name_en, full: x.full, pass: x.pass, marks: x.marks, absent: x.absent })),
        result: res.result, lang, verifyUrl: verifyLink(res.verify_code),
      })
      const canvas = await layoutCanvas(layout, 'front', data)
      saveBlob(await canvasToPdf(canvas), `marksheet-${res.student.student_no}.pdf`)
    } catch (e) { setErr(String(e.message || e)) }
    setPdfBusy(false)
  }

  useEffect(() => {
    supabase.rpc('public_result_options').then(({ data }) => setOpt(data || { exams: [], classes: [] }), () => setOpt({ exams: [], classes: [] }))
  }, [])

  const classes = opt ? opt.classes.filter((c) => !examId || (c.exam_ids || []).includes(examId)) : []

  async function submit(e) {
    e.preventDefault()
    setErr(''); setRes(null)
    if (!examId || !clsId || !no.trim() || !dob) { setErr(t('result.notfound')); return }
    setBusy(true)
    const { data, error } = await supabase.rpc('public_result', { p_exam: examId, p_class: clsId, p_no: no.replace(/[০-৯]/g, (x) => '০১২৩৪৫৬৭৮৯'.indexOf(x)), p_dob: dob })
    setBusy(false)
    if (error || !data) { setErr(t('result.notfound')); return }
    setRes(data)
  }

  const r = res && res.result
  return (
    <>
      <PageHead title={t('result.title')} sub={t('result.sub')} />
      <section className="section">
        <div className="container stack" style={{ maxWidth: 760 }}>
          {opt && opt.exams.length === 0 ? <p className="muted">{t('result.none')}</p> : (
            <form className="card stack" onSubmit={submit}>
              <div className="grid g2">
                <div className="field"><label>{t('result.exam')}</label><Select placeholder="—" value={examId} onChange={(v) => { setExamId(v); setClsId('') }} options={(opt?.exams || []).map((x) => [x.id, `${pick(x, 'name', lang)}${x.year ? ` (${d(x.year)})` : ''}`])} /></div>
                <div className="field"><label>{t('result.class')}</label><Select placeholder="—" value={clsId} onChange={setClsId} options={classes.map((c) => [c.id, pick(c, 'name', lang)])} /></div>
                <div className="field"><label>{t('result.id')}</label><input value={no} onChange={(e) => setNo(e.target.value)} inputMode="numeric" autoComplete="off" /></div>
                <div className="field"><label>{t('result.dob')}</label><input type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></div>
              </div>
              <button className="btn" disabled={busy}>{t('result.submit')}</button>
              {err && <div className="alert err">{err}</div>}
            </form>
          )}

          {res && (
            <div className="card stack" id="result-print">
              <div>
                <h3 style={{ margin: 0 }}>{pick(res.student, 'name', lang)}</h3>
                <div className="muted">
                  {t('result.id')}: {d(res.student.student_no)} · {pick(res.class, 'name', lang)} · {pick(res.exam, 'name', lang)}{res.exam.year ? ` (${d(res.exam.year)})` : ''}
                  {res.student.father_name ? <> · {t('result.father')}: {res.student.father_name}</> : null}
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>{t('result.subject')}</th><th>{t('result.full')}</th><th>{t('result.marks')}</th></tr></thead>
                  <tbody>
                    {res.subjects.map((s, i) => {
                      const fail = !s.absent && s.marks !== null && Number(s.marks) < Number(s.pass)
                      return (
                        <tr key={i}>
                          <td>{pick(s, 'name', lang)}</td><td>{d(num(s.full))}</td>
                          <td style={{ color: fail || s.absent ? '#c0262d' : undefined, fontWeight: fail ? 700 : 400 }}>{s.absent ? t('result.absent') : s.marks === null ? '—' : d(num(s.marks))}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {r && (r.total || r.avg || r.division || r.merit) && (
                <div className="grid g2">
                  {[['total', 'result.total'], ['avg', 'result.avg'], ['division', 'result.division'], ['merit', 'result.merit']].filter(([k]) => r[k]).map(([k, l]) => (
                    <div className="card" key={k}><div className="muted">{t(l)}</div><b style={{ fontSize: '1.2rem' }}>{d(r[k])}</b></div>
                  ))}
                </div>
              )}
              <button type="button" className="btn outline" onClick={downloadPdf} disabled={pdfBusy}>{pdfBusy ? '…' : t('result.pdf')}</button>
            </div>
          )}
        </div>
      </section>
    </>
  )
}
